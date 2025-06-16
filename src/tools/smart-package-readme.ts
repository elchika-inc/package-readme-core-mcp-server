import { SmartPackageReadmeParams, SmartPackageReadmeResponse, PackageManager, OrchestrationResponse, OrchestrationErrorType, AlternativePackageResult } from '../types/index.js';
import { PatternDetector } from '../detection/pattern-detector.js';
import { ContextAnalyzer } from '../detection/context-analyzer.js';
import { ConfidenceCalculator } from '../detection/confidence-calculator.js';
import { ManagerRegistry } from '../detection/manager-registry.js';
import { ToolProxy } from '../clients/tool-proxy.js';

export class SmartPackageReadmeTool {
  constructor(
    private patternDetector: PatternDetector,
    private contextAnalyzer: ContextAnalyzer,
    private confidenceCalculator: ConfidenceCalculator,
    private managerRegistry: ManagerRegistry,
    private toolProxy: ToolProxy
  ) {}

  async execute(params: SmartPackageReadmeParams): Promise<OrchestrationResponse<SmartPackageReadmeResponse>> {
    const startTime = Date.now();
    const managers_attempted: PackageManager[] = [];
    const managers_succeeded: PackageManager[] = [];
    const errors: any[] = [];

    try {
      // Validate input
      if (!this.patternDetector.validatePackageName(params.package_name)) {
        return {
          success: false,
          errors: [{
            error_type: OrchestrationErrorType.INVALID_PACKAGE_NAME,
            message: `Invalid package name: ${params.package_name}`,
            details: { package_name: params.package_name }
          }],
          metadata: {
            execution_time: Date.now() - startTime,
            managers_attempted: [],
            managers_succeeded: [],
            detection_confidence: 0
          }
        };
      }

      // Step 1: Detect package managers
      const patternDetections = this.patternDetector.detectByPackageName(params.package_name);
      const contextDetections = this.contextAnalyzer.analyzeContextHints(params.context_hints);

      // Step 2: Calculate confidence and determine execution strategy
      const detectedManagers = this.confidenceCalculator.calculateOverallConfidence(
        patternDetections,
        contextDetections,
        params.preferred_managers
      );

      if (detectedManagers.length === 0) {
        return {
          success: false,
          errors: [{
            error_type: OrchestrationErrorType.DETECTION_FAILED,
            message: 'Could not detect appropriate package manager',
            details: { package_name: params.package_name, context_hints: params.context_hints }
          }],
          metadata: {
            execution_time: Date.now() - startTime,
            managers_attempted: [],
            managers_succeeded: [],
            detection_confidence: 0
          }
        };
      }

      // Update availability status
      detectedManagers.forEach(detection => {
        detection.available = this.managerRegistry.isManagerAvailable(detection.manager);
      });

      // Filter to only available managers
      const availableDetections = detectedManagers.filter(d => d.available);
      
      if (availableDetections.length === 0) {
        return {
          success: false,
          errors: [{
            error_type: OrchestrationErrorType.MCP_SERVER_UNAVAILABLE,
            message: 'No MCP servers available for detected package managers',
            details: { detected_managers: detectedManagers.map(d => d.manager) }
          }],
          metadata: {
            execution_time: Date.now() - startTime,
            managers_attempted: [],
            managers_succeeded: [],
            detection_confidence: Math.max(...detectedManagers.map(d => d.confidence))
          }
        };
      }

      // Step 3: Determine execution strategy
      const executionStrategy = this.confidenceCalculator.shouldUseParallelExecution(availableDetections);
      managers_attempted.push(...executionStrategy.managers);

      // Step 4: Execute tool calls
      const readmeParams = {
        package_name: params.package_name,
        version: params.version,
        include_examples: params.include_examples
      };

      let toolResults;
      if (executionStrategy.useParallel) {
        toolResults = await this.toolProxy.executeToolParallel(
          executionStrategy.managers,
          'get_package_readme',
          readmeParams
        );
      } else {
        const singleResult = await this.toolProxy.executeToolSingle(
          executionStrategy.managers[0],
          'get_package_readme',
          readmeParams
        );
        toolResults = [singleResult];
      }

      // Step 5: Process results
      const results = Array.isArray(toolResults) ? toolResults : [toolResults];
      const successfulResults = results.filter(r => r.success);
      managers_succeeded.push(...successfulResults.map(r => r.manager));

      // Collect errors from failed results
      const failedResults = results.filter(r => !r.success);
      errors.push(...failedResults.map(r => ({
        manager: r.manager,
        error_type: OrchestrationErrorType.MCP_SERVER_UNAVAILABLE,
        message: r.error || 'Unknown error',
        details: r
      })));

      // Step 6: Select best result
      if (successfulResults.length === 0) {
        return {
          success: false,
          errors: errors.length > 0 ? errors : [{
            error_type: OrchestrationErrorType.ALL_MANAGERS_FAILED,
            message: 'All package manager lookups failed',
            details: { package_name: params.package_name }
          }],
          metadata: {
            execution_time: Date.now() - startTime,
            managers_attempted,
            managers_succeeded,
            detection_confidence: Math.max(...detectedManagers.map(d => d.confidence))
          }
        };
      }

      // Select the result from the manager with highest confidence
      const bestResult = this.selectBestResult(successfulResults, detectedManagers);
      const bestManagerDetection = detectedManagers.find(d => d.manager === bestResult.manager);

      // Generate alternative results
      const alternativeResults = this.generateAlternativeResults(
        successfulResults.filter(r => r.manager !== bestResult.manager),
        params.package_name
      );

      const response: SmartPackageReadmeResponse = {
        package_manager: bestResult.manager,
        confidence_score: bestManagerDetection?.confidence || 0,
        readme_data: {
          package_manager: bestResult.manager,
          package_name: params.package_name,
          version: params.version,
          ...bestResult.data
        },
        alternative_results: alternativeResults.length > 0 ? alternativeResults : undefined
      };

      return {
        success: true,
        data: response,
        errors: errors.length > 0 ? errors : undefined,
        metadata: {
          execution_time: Date.now() - startTime,
          managers_attempted,
          managers_succeeded,
          detection_confidence: bestManagerDetection?.confidence || 0
        }
      };

    } catch (error) {
      return {
        success: false,
        errors: [{
          error_type: OrchestrationErrorType.ALL_MANAGERS_FAILED,
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          details: { error: String(error) }
        }],
        metadata: {
          execution_time: Date.now() - startTime,
          managers_attempted,
          managers_succeeded,
          detection_confidence: 0
        }
      };
    }
  }

  private selectBestResult(successfulResults: any[], detectedManagers: any[]): any {
    // Sort by manager confidence (highest first)
    const sortedResults = successfulResults.sort((a, b) => {
      const aConfidence = detectedManagers.find(d => d.manager === a.manager)?.confidence || 0;
      const bConfidence = detectedManagers.find(d => d.manager === b.manager)?.confidence || 0;
      return bConfidence - aConfidence;
    });

    return sortedResults[0];
  }

  private generateAlternativeResults(
    otherResults: any[],
    packageName: string
  ): AlternativePackageResult[] {
    return otherResults.map(result => ({
      manager: result.manager,
      package_name: packageName,
      similarity_score: 0.8, // Could implement more sophisticated similarity scoring
      brief_info: result.data?.description || `${packageName} package from ${result.manager}`
    }));
  }

  async searchSimilarPackages(
    packageName: string,
    excludeManager: PackageManager,
    detectedManagers: any[]
  ): Promise<AlternativePackageResult[]> {
    const similarResults: AlternativePackageResult[] = [];

    // Try to find similar packages in other package managers
    const otherManagers = detectedManagers
      .filter(d => d.manager !== excludeManager && d.available)
      .slice(0, 3); // Limit to top 3 alternatives

    for (const detection of otherManagers) {
      try {
        const searchResult = await this.toolProxy.executeToolSingle(
          detection.manager,
          'search_packages',
          { package_name: packageName, limit: 3 }
        );

        if (searchResult.success && searchResult.data?.packages) {
          const packages = Array.isArray(searchResult.data.packages) 
            ? searchResult.data.packages 
            : [searchResult.data.packages];

          similarResults.push(...packages.map((pkg: any) => ({
            manager: detection.manager,
            package_name: pkg.name || packageName,
            similarity_score: this.calculateSimilarityScore(packageName, pkg.name || packageName),
            brief_info: pkg.description || pkg.summary || `Package from ${detection.manager}`
          })));
        }
      } catch (error) {
        // Ignore errors in alternative searches
        console.error(`Failed to search for alternatives in ${detection.manager}:`, error);
      }
    }

    return similarResults
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, 5); // Return top 5 alternatives
  }

  private calculateSimilarityScore(original: string, candidate: string): number {
    if (original === candidate) return 1.0;
    
    // Simple similarity based on common substrings and edit distance
    const originalLower = original.toLowerCase();
    const candidateLower = candidate.toLowerCase();
    
    if (candidateLower.includes(originalLower) || originalLower.includes(candidateLower)) {
      return 0.9;
    }
    
    // Calculate Levenshtein distance for more sophisticated similarity
    const distance = this.levenshteinDistance(originalLower, candidateLower);
    const maxLength = Math.max(original.length, candidate.length);
    
    return Math.max(0, 1 - (distance / maxLength));
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator   // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }
}