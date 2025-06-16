import { SmartPackageSearchParams, SmartPackageSearchResponse, PackageManager, OrchestrationResponse, OrchestrationErrorType } from '../types/index.js';
import { PatternDetector } from '../detection/pattern-detector.js';
import { ContextAnalyzer } from '../detection/context-analyzer.js';
import { ConfidenceCalculator } from '../detection/confidence-calculator.js';
import { ManagerRegistry } from '../detection/manager-registry.js';
import { ToolProxy } from '../clients/tool-proxy.js';

export class SmartPackageSearchTool {
  constructor(
    private patternDetector: PatternDetector,
    private contextAnalyzer: ContextAnalyzer,
    private confidenceCalculator: ConfidenceCalculator,
    private managerRegistry: ManagerRegistry,
    private toolProxy: ToolProxy
  ) {}

  async execute(params: SmartPackageSearchParams): Promise<OrchestrationResponse<SmartPackageSearchResponse>> {
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
      const searchParams = {
        package_name: params.package_name,
        limit: params.limit || 10
      };

      let toolResults;
      if (executionStrategy.useParallel) {
        toolResults = await this.toolProxy.executeToolParallel(
          executionStrategy.managers,
          'search_packages',
          searchParams
        );
      } else {
        const singleResult = await this.toolProxy.executeToolSingle(
          executionStrategy.managers[0],
          'search_packages',
          searchParams
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

      // Step 6: Prepare response
      const aggregateConfidence = this.confidenceCalculator.calculateAggregateConfidence(
        new Map(successfulResults.map(r => [r.manager, r.data]))
      );

      const response: SmartPackageSearchResponse = {
        detected_managers: detectedManagers,
        results: results,
        confidence_score: aggregateConfidence,
        fallback_suggestions: this.generateFallbackSuggestions(params.package_name, detectedManagers)
      };

      return {
        success: successfulResults.length > 0,
        data: response,
        errors: errors.length > 0 ? errors : undefined,
        metadata: {
          execution_time: Date.now() - startTime,
          managers_attempted: managers_attempted,
          managers_succeeded: managers_succeeded,
          detection_confidence: Math.max(...detectedManagers.map(d => d.confidence))
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
          managers_attempted: managers_attempted,
          managers_succeeded: managers_succeeded,
          detection_confidence: 0
        }
      };
    }
  }

  private generateFallbackSuggestions(packageName: string, detectedManagers: any[]): string[] {
    const suggestions: string[] = [];

    // If detection confidence is low, suggest trying common variations
    if (detectedManagers.length === 0 || Math.max(...detectedManagers.map(d => d.confidence)) < 0.5) {
      // Suggest common package name variations
      suggestions.push(`Try searching for "${packageName}" with context hints like "node", "python", "php"`);
      
      // Suggest scoped packages for npm-like names
      if (!packageName.includes('/') && packageName.match(/^[a-z0-9-]+$/)) {
        suggestions.push(`Try "@scope/${packageName}" if it's a scoped npm package`);
      }
      
      // Suggest vendor/package format for composer-like names
      if (!packageName.includes('/') && packageName.match(/^[a-z0-9-]+$/)) {
        suggestions.push(`Try "vendor/${packageName}" if it's a Composer package`);
      }
    }

    return suggestions;
  }
}