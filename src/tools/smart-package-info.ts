import { SmartPackageInfoParams, SmartPackageInfoResponse, PackageManager, OrchestrationResponse, OrchestrationErrorType, AlternativePackageResult } from '../types/index.js';
import { PatternDetector } from '../detection/pattern-detector.js';
import { ContextAnalyzer } from '../detection/context-analyzer.js';
import { ConfidenceCalculator } from '../detection/confidence-calculator.js';
import { ManagerRegistry } from '../detection/manager-registry.js';
import { ToolProxy } from '../clients/tool-proxy.js';

export class SmartPackageInfoTool {
  constructor(
    private patternDetector: PatternDetector,
    private contextAnalyzer: ContextAnalyzer,
    private confidenceCalculator: ConfidenceCalculator,
    private managerRegistry: ManagerRegistry,
    private toolProxy: ToolProxy
  ) {}

  async execute(params: SmartPackageInfoParams): Promise<OrchestrationResponse<SmartPackageInfoResponse>> {
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
      const infoParams = {
        package_name: params.package_name,
        include_dependencies: params.include_dependencies
      };

      let toolResults;
      if (executionStrategy.useParallel) {
        toolResults = await this.toolProxy.executeToolParallel(
          executionStrategy.managers,
          'get_package_info',
          infoParams
        );
      } else {
        const singleResult = await this.toolProxy.executeToolSingle(
          executionStrategy.managers[0],
          'get_package_info',
          infoParams
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

      const response: SmartPackageInfoResponse = {
        package_manager: bestResult.manager,
        confidence_score: bestManagerDetection?.confidence || 0,
        package_data: {
          package_manager: bestResult.manager,
          package_name: params.package_name,
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
    // Priority order:
    // 1. Highest confidence detection
    // 2. Most complete package information
    // 3. Fastest response time

    const scoredResults = successfulResults.map(result => {
      const detection = detectedManagers.find(d => d.manager === result.manager);
      const confidence = detection?.confidence || 0;
      const completeness = this.calculateCompletenessScore(result.data);
      const speedScore = this.calculateSpeedScore(result.response_time);
      
      return {
        ...result,
        score: (confidence * 0.5) + (completeness * 0.3) + (speedScore * 0.2)
      };
    });

    return scoredResults.sort((a, b) => b.score - a.score)[0];
  }

  private calculateCompletenessScore(packageData: any): number {
    if (!packageData) return 0;

    let score = 0;
    const fields = [
      'description', 'homepage', 'repository', 'license', 
      'author', 'keywords', 'latest_version', 'downloads'
    ];

    for (const field of fields) {
      if (packageData[field] && packageData[field] !== '') {
        score += 1;
      }
    }

    // Bonus for dependencies information
    if (packageData.dependencies && Object.keys(packageData.dependencies).length > 0) {
      score += 0.5;
    }

    if (packageData.versions && Array.isArray(packageData.versions) && packageData.versions.length > 0) {
      score += 0.5;
    }

    return Math.min(1.0, score / fields.length);
  }

  private calculateSpeedScore(responseTime: number): number {
    // Convert response time to a score between 0 and 1
    // Faster responses get higher scores
    const maxTimeMs = 10000; // 10 seconds
    return Math.max(0, 1 - (responseTime / maxTimeMs));
  }

  private generateAlternativeResults(
    otherResults: any[],
    packageName: string
  ): AlternativePackageResult[] {
    return otherResults.map(result => {
      const briefInfo = this.generateBriefInfo(result.data, result.manager);
      const similarity = this.calculatePackageSimilarity(packageName, result.data);

      return {
        manager: result.manager,
        package_name: packageName,
        similarity_score: similarity,
        brief_info: briefInfo
      };
    });
  }

  private generateBriefInfo(packageData: any, manager: PackageManager): string {
    if (!packageData) {
      return `Package from ${manager}`;
    }

    const parts: string[] = [];

    if (packageData.description) {
      parts.push(packageData.description.substring(0, 100));
    }

    if (packageData.latest_version) {
      parts.push(`v${packageData.latest_version}`);
    }

    if (packageData.downloads && typeof packageData.downloads === 'number') {
      parts.push(`${this.formatDownloads(packageData.downloads)} downloads`);
    }

    if (packageData.license) {
      parts.push(`${packageData.license} license`);
    }

    return parts.length > 0 ? parts.join(' | ') : `Package from ${manager}`;
  }

  private formatDownloads(downloads: number): string {
    if (downloads >= 1000000) {
      return `${(downloads / 1000000).toFixed(1)}M`;
    } else if (downloads >= 1000) {
      return `${(downloads / 1000).toFixed(1)}K`;
    } else {
      return downloads.toString();
    }
  }

  private calculatePackageSimilarity(originalName: string, packageData: any): number {
    if (!packageData) return 0.5;

    let similarity = 0.5; // Base similarity

    // Exact name match
    if (packageData.package_name === originalName) {
      similarity = 1.0;
    }
    // Name contained in description or keywords
    else if (packageData.description && 
             packageData.description.toLowerCase().includes(originalName.toLowerCase())) {
      similarity = 0.8;
    }
    // Keywords match
    else if (packageData.keywords && Array.isArray(packageData.keywords)) {
      const matchingKeywords = packageData.keywords.filter((keyword: string) =>
        keyword.toLowerCase().includes(originalName.toLowerCase()) ||
        originalName.toLowerCase().includes(keyword.toLowerCase())
      );
      if (matchingKeywords.length > 0) {
        similarity = 0.7;
      }
    }

    return similarity;
  }

  async enrichWithCrossManagerData(
    primaryResult: any,
    packageName: string,
    detectedManagers: any[]
  ): Promise<any> {
    // Try to gather additional information from other package managers
    const enrichedData = { ...primaryResult.data };

    // If we don't have a repository URL, try to find it from other managers
    if (!enrichedData.repository) {
      const repoUrl = await this.findRepositoryUrl(packageName, detectedManagers, primaryResult.manager);
      if (repoUrl) {
        enrichedData.repository = repoUrl;
      }
    }

    // If we don't have download stats, try to find popularity metrics
    if (!enrichedData.downloads) {
      const popularityData = await this.findPopularityMetrics(packageName, detectedManagers, primaryResult.manager);
      if (popularityData) {
        enrichedData.downloads = popularityData.downloads;
        enrichedData.popularity_score = popularityData.score;
      }
    }

    return enrichedData;
  }

  private async findRepositoryUrl(
    packageName: string,
    detectedManagers: any[],
    excludeManager: PackageManager
  ): Promise<string | null> {
    const otherManagers = detectedManagers
      .filter(d => d.manager !== excludeManager && d.available)
      .slice(0, 2);

    for (const detection of otherManagers) {
      try {
        const result = await this.toolProxy.executeToolSingle(
          detection.manager,
          'get_package_info',
          { package_name: packageName }
        );

        if (result.success && result.data?.repository) {
          return result.data.repository;
        }
      } catch (error) {
        // Ignore errors
      }
    }

    return null;
  }

  private async findPopularityMetrics(
    packageName: string,
    detectedManagers: any[],
    excludeManager: PackageManager
  ): Promise<{ downloads: number; score: number } | null> {
    const otherManagers = detectedManagers
      .filter(d => d.manager !== excludeManager && d.available)
      .slice(0, 2);

    for (const detection of otherManagers) {
      try {
        const result = await this.toolProxy.executeToolSingle(
          detection.manager,
          'get_package_info',
          { package_name: packageName }
        );

        if (result.success && result.data?.downloads && typeof result.data.downloads === 'number') {
          return {
            downloads: result.data.downloads,
            score: this.calculatePopularityScore(result.data.downloads, detection.manager)
          };
        }
      } catch (error) {
        // Ignore errors
      }
    }

    return null;
  }

  private calculatePopularityScore(downloads: number, manager: PackageManager): number {
    // Normalize download counts across different package managers
    const managerMultipliers: Record<PackageManager, number> = {
      [PackageManager.NPM]: 1.0,
      [PackageManager.PIP]: 0.5,  // PyPI typically has lower absolute numbers
      [PackageManager.COMPOSER]: 0.1,  // Packagist has much lower numbers
      [PackageManager.CARGO]: 0.2,  // Crates.io
      [PackageManager.MAVEN]: 0.3,
      [PackageManager.NUGET]: 0.4,
      [PackageManager.GEM]: 0.3,
      [PackageManager.COCOAPODS]: 0.2,
      [PackageManager.CONAN]: 0.1,
      [PackageManager.CPAN]: 0.2,
      [PackageManager.CRAN]: 0.3,
      [PackageManager.DOCKER_HUB]: 0.8,
      [PackageManager.HELM]: 0.2,
      [PackageManager.SWIFT]: 0.2,
      [PackageManager.VCPKG]: 0.1
    };

    const multiplier = managerMultipliers[manager] || 1.0;
    const normalizedDownloads = downloads * multiplier;

    // Convert to a score between 0 and 1
    return Math.min(1.0, Math.log10(normalizedDownloads + 1) / 7); // log10(10M) ≈ 7
  }
}