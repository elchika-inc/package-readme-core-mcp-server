import { OrchestrationError, OrchestrationErrorType, PackageManager } from '../types/index.js';
import { logger } from './logger.js';

export class ErrorHandler {
  static createError(
    type: OrchestrationErrorType,
    message: string,
    manager?: PackageManager,
    details?: any
  ): OrchestrationError {
    return {
      manager,
      error_type: type,
      message,
      details
    };
  }

  static handleDetectionError(
    packageName: string,
    contextHints?: string[],
    originalError?: any
  ): OrchestrationError {
    logger.error('Package manager detection failed', {
      package_name: packageName,
      context_hints: contextHints,
      original_error: originalError
    });

    return this.createError(
      OrchestrationErrorType.DETECTION_FAILED,
      `Failed to detect package manager for "${packageName}"`,
      undefined,
      { package_name: packageName, context_hints: contextHints, original_error: originalError }
    );
  }

  static handleConnectionError(
    manager: PackageManager,
    originalError?: any
  ): OrchestrationError {
    logger.error(`MCP server connection failed: ${manager}`, originalError);

    return this.createError(
      OrchestrationErrorType.MCP_SERVER_UNAVAILABLE,
      `MCP server for ${manager} is unavailable`,
      manager,
      { original_error: originalError }
    );
  }

  static handleTimeoutError(
    manager: PackageManager,
    toolName: string,
    timeoutMs: number
  ): OrchestrationError {
    logger.warn(`Tool call timed out: ${manager}.${toolName}`, {
      timeout_ms: timeoutMs
    });

    return this.createError(
      OrchestrationErrorType.TIMEOUT,
      `Tool call to ${manager}.${toolName} timed out after ${timeoutMs}ms`,
      manager,
      { tool_name: toolName, timeout_ms: timeoutMs }
    );
  }

  static handleValidationError(
    message: string,
    invalidInput?: any
  ): OrchestrationError {
    logger.warn('Input validation failed', {
      message,
      invalid_input: invalidInput
    });

    return this.createError(
      OrchestrationErrorType.VALIDATION_ERROR,
      message,
      undefined,
      { invalid_input: invalidInput }
    );
  }

  static handleAllManagersFailedError(
    attemptedManagers: PackageManager[],
    individualErrors: OrchestrationError[]
  ): OrchestrationError {
    logger.error('All package managers failed', {
      attempted_managers: attemptedManagers,
      error_count: individualErrors.length
    });

    return this.createError(
      OrchestrationErrorType.ALL_MANAGERS_FAILED,
      `All ${attemptedManagers.length} package managers failed`,
      undefined,
      { attempted_managers: attemptedManagers, individual_errors: individualErrors }
    );
  }

  static handleToolCallError(
    manager: PackageManager,
    toolName: string,
    originalError: any
  ): OrchestrationError {
    const isConnectionError = this.isConnectionRelatedError(originalError);
    const errorType = isConnectionError 
      ? OrchestrationErrorType.MCP_SERVER_UNAVAILABLE 
      : OrchestrationErrorType.CONNECTION_ERROR;

    logger.error(`Tool call failed: ${manager}.${toolName}`, {
      error_type: errorType,
      original_error: originalError
    });

    return this.createError(
      errorType,
      `Tool call to ${manager}.${toolName} failed: ${originalError?.message || 'Unknown error'}`,
      manager,
      { tool_name: toolName, original_error: originalError }
    );
  }

  static isConnectionRelatedError(error: any): boolean {
    if (!error) return false;

    const errorMessage = error.message || String(error);
    const connectionErrorIndicators = [
      'ECONNRESET',
      'ECONNREFUSED',
      'EPIPE',
      'ENOTFOUND',
      'ETIMEDOUT',
      'Connection closed',
      'Connection refused',
      'Server not available',
      'Cannot connect'
    ];

    return connectionErrorIndicators.some(indicator => 
      errorMessage.includes(indicator)
    );
  }

  static isRetryableError(error: OrchestrationError): boolean {
    const retryableTypes = [
      OrchestrationErrorType.TIMEOUT,
      OrchestrationErrorType.CONNECTION_ERROR,
      OrchestrationErrorType.MCP_SERVER_UNAVAILABLE
    ];

    return retryableTypes.includes(error.error_type);
  }

  static shouldFallbackToOtherManagers(error: OrchestrationError): boolean {
    const fallbackTypes = [
      OrchestrationErrorType.MCP_SERVER_UNAVAILABLE,
      OrchestrationErrorType.CONNECTION_ERROR,
      OrchestrationErrorType.TIMEOUT
    ];

    return fallbackTypes.includes(error.error_type);
  }

  static categorizeErrors(errors: OrchestrationError[]): {
    connection_errors: OrchestrationError[];
    timeout_errors: OrchestrationError[];
    validation_errors: OrchestrationError[];
    other_errors: OrchestrationError[];
  } {
    const categorized = {
      connection_errors: [] as OrchestrationError[],
      timeout_errors: [] as OrchestrationError[],
      validation_errors: [] as OrchestrationError[],
      other_errors: [] as OrchestrationError[]
    };

    for (const error of errors) {
      switch (error.error_type) {
        case OrchestrationErrorType.MCP_SERVER_UNAVAILABLE:
        case OrchestrationErrorType.CONNECTION_ERROR:
          categorized.connection_errors.push(error);
          break;
        case OrchestrationErrorType.TIMEOUT:
          categorized.timeout_errors.push(error);
          break;
        case OrchestrationErrorType.VALIDATION_ERROR:
        case OrchestrationErrorType.INVALID_PACKAGE_NAME:
          categorized.validation_errors.push(error);
          break;
        default:
          categorized.other_errors.push(error);
      }
    }

    return categorized;
  }

  static generateErrorSummary(errors: OrchestrationError[]): string {
    if (errors.length === 0) {
      return 'No errors occurred';
    }

    const categorized = this.categorizeErrors(errors);
    const summaryParts: string[] = [];

    if (categorized.connection_errors.length > 0) {
      summaryParts.push(`${categorized.connection_errors.length} connection error(s)`);
    }

    if (categorized.timeout_errors.length > 0) {
      summaryParts.push(`${categorized.timeout_errors.length} timeout error(s)`);
    }

    if (categorized.validation_errors.length > 0) {
      summaryParts.push(`${categorized.validation_errors.length} validation error(s)`);
    }

    if (categorized.other_errors.length > 0) {
      summaryParts.push(`${categorized.other_errors.length} other error(s)`);
    }

    return `${errors.length} total errors: ${summaryParts.join(', ')}`;
  }

  static createRecoveryStrategy(errors: OrchestrationError[]): {
    can_retry: boolean;
    suggested_actions: string[];
    alternative_approaches: string[];
  } {
    const categorized = this.categorizeErrors(errors);
    const strategy = {
      can_retry: false,
      suggested_actions: [] as string[],
      alternative_approaches: [] as string[]
    };

    // Check if any errors are retryable
    strategy.can_retry = errors.some(error => this.isRetryableError(error));

    // Generate suggestions based on error types
    if (categorized.connection_errors.length > 0) {
      strategy.suggested_actions.push('Check MCP server connections');
      strategy.suggested_actions.push('Verify server configurations');
      strategy.alternative_approaches.push('Try with a subset of package managers');
    }

    if (categorized.timeout_errors.length > 0) {
      strategy.suggested_actions.push('Increase timeout values');
      strategy.suggested_actions.push('Check network connectivity');
      strategy.alternative_approaches.push('Use sequential execution instead of parallel');
    }

    if (categorized.validation_errors.length > 0) {
      strategy.suggested_actions.push('Verify input parameters');
      strategy.suggested_actions.push('Check package name format');
      strategy.alternative_approaches.push('Provide more context hints');
    }

    return strategy;
  }

  static wrapError(originalError: any, context: string): Error {
    const message = `${context}: ${originalError?.message || String(originalError)}`;
    const wrappedError = new Error(message);
    
    // Preserve stack trace if available
    if (originalError?.stack) {
      wrappedError.stack = originalError.stack;
    }

    return wrappedError;
  }

  static logErrorDetails(error: OrchestrationError, context?: string): void {
    const logContext = context ? `[${context}] ` : '';
    
    logger.error(`${logContext}${error.message}`, {
      error_type: error.error_type,
      manager: error.manager,
      details: error.details
    });

    // Log additional context for debugging
    if (error.details?.original_error) {
      logger.debug('Original error details', error.details.original_error);
    }
  }
}