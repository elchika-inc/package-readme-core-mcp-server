import { expect, test, describe, beforeEach, vi } from "vitest";
import { ErrorHandler } from "../../src/utils/error-handler.js";
import { OrchestrationError, OrchestrationErrorType, PackageManager } from "../../src/types/index.js";

// Mock logger
const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  info: vi.fn()
};

vi.mock("../../src/utils/logger.js", () => ({
  logger: mockLogger
}));

describe('ErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createError', () => {
    test('should create basic error with required fields', () => {
      const error = ErrorHandler.createError(
        OrchestrationErrorType.VALIDATION_ERROR,
        'Test error message'
      );

      expect(error.error_type).toBe(OrchestrationErrorType.VALIDATION_ERROR);
      expect(error.message).toBe('Test error message');
      expect(error.manager).toBeUndefined();
      expect(error.details).toBeUndefined();
    });

    test('should create error with all fields', () => {
      const details = { test: 'details' };
      const error = ErrorHandler.createError(
        OrchestrationErrorType.CONNECTION_ERROR,
        'Connection failed',
        PackageManager.NPM,
        details
      );

      expect(error.error_type).toBe(OrchestrationErrorType.CONNECTION_ERROR);
      expect(error.message).toBe('Connection failed');
      expect(error.manager).toBe(PackageManager.NPM);
      expect(error.details).toEqual(details);
    });
  });

  describe('handleDetectionError', () => {
    test('should create detection error with package details', () => {
      const packageName = 'test-package';
      const contextHints = ['package.json', 'npm'];
      const originalError = new Error('Original error');

      const error = ErrorHandler.handleDetectionError(packageName, contextHints, originalError);

      expect(error.error_type).toBe(OrchestrationErrorType.DETECTION_FAILED);
      expect(error.message).toBe('Failed to detect package manager for "test-package"');
      expect(error.details.package_name).toBe(packageName);
      expect(error.details.context_hints).toEqual(contextHints);
      expect(error.details.original_error).toBe(originalError);
    });

    test('should handle missing context hints', () => {
      const error = ErrorHandler.handleDetectionError('test-package');

      expect(error.details.context_hints).toBeUndefined();
    });

    test('should handle missing original error', () => {
      const error = ErrorHandler.handleDetectionError('test-package', ['hint']);

      expect(error.details.original_error).toBeUndefined();
    });
  });

  describe('handleConnectionError', () => {
    test('should create connection error with manager details', () => {
      const originalError = new Error('Connection refused');
      const error = ErrorHandler.handleConnectionError(PackageManager.PIP, originalError);

      expect(error.error_type).toBe(OrchestrationErrorType.MCP_SERVER_UNAVAILABLE);
      expect(error.message).toBe('MCP server for pip is unavailable');
      expect(error.manager).toBe(PackageManager.PIP);
      expect(error.details.original_error).toBe(originalError);
    });

    test('should handle missing original error', () => {
      const error = ErrorHandler.handleConnectionError(PackageManager.NPM);

      expect(error.error_type).toBe(OrchestrationErrorType.MCP_SERVER_UNAVAILABLE);
      expect(error.manager).toBe(PackageManager.NPM);
    });
  });

  describe('handleTimeoutError', () => {
    test('should create timeout error with tool details', () => {
      const manager = PackageManager.MAVEN;
      const toolName = 'get_package_info';
      const timeoutMs = 5000;

      const error = ErrorHandler.handleTimeoutError(manager, toolName, timeoutMs);

      expect(error.error_type).toBe(OrchestrationErrorType.TIMEOUT);
      expect(error.message).toBe('Tool call to maven.get_package_info timed out after 5000ms');
      expect(error.manager).toBe(manager);
      expect(error.details.tool_name).toBe(toolName);
      expect(error.details.timeout_ms).toBe(timeoutMs);
    });
  });

  describe('handleValidationError', () => {
    test('should create validation error with details', () => {
      const message = 'Invalid package name format';
      const invalidInput = { package_name: '../../etc/passwd' };

      const error = ErrorHandler.handleValidationError(message, invalidInput);

      expect(error.error_type).toBe(OrchestrationErrorType.VALIDATION_ERROR);
      expect(error.message).toBe(message);
      expect(error.details.invalid_input).toEqual(invalidInput);
    });

    test('should handle missing invalid input', () => {
      const error = ErrorHandler.handleValidationError('Validation failed');

      expect(error.error_type).toBe(OrchestrationErrorType.VALIDATION_ERROR);
      expect(error.details.invalid_input).toBeUndefined();
    });
  });

  describe('handleAllManagersFailedError', () => {
    test('should create error for all managers failed', () => {
      const attemptedManagers = [PackageManager.NPM, PackageManager.PIP];
      const individualErrors = [
        ErrorHandler.createError(OrchestrationErrorType.CONNECTION_ERROR, 'NPM failed'),
        ErrorHandler.createError(OrchestrationErrorType.TIMEOUT, 'PIP timed out')
      ];

      const error = ErrorHandler.handleAllManagersFailedError(attemptedManagers, individualErrors);

      expect(error.error_type).toBe(OrchestrationErrorType.ALL_MANAGERS_FAILED);
      expect(error.message).toBe('All 2 package managers failed');
      expect(error.details.attempted_managers).toEqual(attemptedManagers);
      expect(error.details.individual_errors).toEqual(individualErrors);
    });
  });

  describe('handleToolCallError', () => {
    test('should create tool call error for connection-related issues', () => {
      const connectionError = new Error('ECONNREFUSED: Connection refused');
      const error = ErrorHandler.handleToolCallError(PackageManager.CARGO, 'search_packages', connectionError);

      expect(error.error_type).toBe(OrchestrationErrorType.MCP_SERVER_UNAVAILABLE);
      expect(error.manager).toBe(PackageManager.CARGO);
      expect(error.details.tool_name).toBe('search_packages');
    });

    test('should create tool call error for non-connection issues', () => {
      const otherError = new Error('Invalid parameters');
      const error = ErrorHandler.handleToolCallError(PackageManager.GEM, 'get_package_readme', otherError);

      expect(error.error_type).toBe(OrchestrationErrorType.CONNECTION_ERROR);
      expect(error.manager).toBe(PackageManager.GEM);
      expect(error.details.tool_name).toBe('get_package_readme');
    });
  });

  describe('isConnectionRelatedError', () => {
    test('should identify connection-related errors', () => {
      const connectionErrors = [
        new Error('ECONNRESET'),
        new Error('ECONNREFUSED'),
        new Error('EPIPE'),
        new Error('ENOTFOUND'),
        new Error('ETIMEDOUT'),
        new Error('Connection closed'),
        new Error('Connection refused'),
        new Error('Server not available'),
        new Error('Cannot connect')
      ];

      for (const error of connectionErrors) {
        expect(ErrorHandler.isConnectionRelatedError(error)).toBe(true);
      }
    });

    test('should not identify non-connection errors', () => {
      const nonConnectionErrors = [
        new Error('Invalid parameters'),
        new Error('Validation failed'),
        new Error('Package not found'),
        null,
        undefined
      ];

      for (const error of nonConnectionErrors) {
        expect(ErrorHandler.isConnectionRelatedError(error)).toBe(false);
      }
    });

    test('should handle string errors', () => {
      expect(ErrorHandler.isConnectionRelatedError('ECONNRESET')).toBe(true);
      expect(ErrorHandler.isConnectionRelatedError('Invalid input')).toBe(false);
    });
  });

  describe('isRetryableError', () => {
    test('should identify retryable errors', () => {
      const retryableErrors = [
        ErrorHandler.createError(OrchestrationErrorType.TIMEOUT, 'Timeout'),
        ErrorHandler.createError(OrchestrationErrorType.CONNECTION_ERROR, 'Connection failed'),
        ErrorHandler.createError(OrchestrationErrorType.MCP_SERVER_UNAVAILABLE, 'Server unavailable')
      ];

      for (const error of retryableErrors) {
        expect(ErrorHandler.isRetryableError(error)).toBe(true);
      }
    });

    test('should not identify non-retryable errors', () => {
      const nonRetryableErrors = [
        ErrorHandler.createError(OrchestrationErrorType.VALIDATION_ERROR, 'Validation failed'),
        ErrorHandler.createError(OrchestrationErrorType.INVALID_PACKAGE_NAME, 'Invalid name'),
        ErrorHandler.createError(OrchestrationErrorType.DETECTION_FAILED, 'Detection failed')
      ];

      for (const error of nonRetryableErrors) {
        expect(ErrorHandler.isRetryableError(error)).toBe(false);
      }
    });
  });

  describe('shouldFallbackToOtherManagers', () => {
    test('should identify errors that warrant fallback', () => {
      const fallbackErrors = [
        ErrorHandler.createError(OrchestrationErrorType.MCP_SERVER_UNAVAILABLE, 'Server unavailable'),
        ErrorHandler.createError(OrchestrationErrorType.CONNECTION_ERROR, 'Connection failed'),
        ErrorHandler.createError(OrchestrationErrorType.TIMEOUT, 'Timeout')
      ];

      for (const error of fallbackErrors) {
        expect(ErrorHandler.shouldFallbackToOtherManagers(error)).toBe(true);
      }
    });

    test('should not suggest fallback for non-fallback errors', () => {
      const nonFallbackErrors = [
        ErrorHandler.createError(OrchestrationErrorType.VALIDATION_ERROR, 'Validation failed'),
        ErrorHandler.createError(OrchestrationErrorType.INVALID_PACKAGE_NAME, 'Invalid name')
      ];

      for (const error of nonFallbackErrors) {
        expect(ErrorHandler.shouldFallbackToOtherManagers(error)).toBe(false);
      }
    });
  });

  describe('categorizeErrors', () => {
    test('should categorize errors correctly', () => {
      const errors = [
        ErrorHandler.createError(OrchestrationErrorType.CONNECTION_ERROR, 'Connection failed'),
        ErrorHandler.createError(OrchestrationErrorType.MCP_SERVER_UNAVAILABLE, 'Server unavailable'),
        ErrorHandler.createError(OrchestrationErrorType.TIMEOUT, 'Timeout'),
        ErrorHandler.createError(OrchestrationErrorType.VALIDATION_ERROR, 'Validation failed'),
        ErrorHandler.createError(OrchestrationErrorType.INVALID_PACKAGE_NAME, 'Invalid name'),
        ErrorHandler.createError(OrchestrationErrorType.DETECTION_FAILED, 'Detection failed')
      ];

      const categorized = ErrorHandler.categorizeErrors(errors);

      expect(categorized.connection_errors).toHaveLength(2);
      expect(categorized.timeout_errors).toHaveLength(1);
      expect(categorized.validation_errors).toHaveLength(2);
      expect(categorized.other_errors).toHaveLength(1);
    });

    test('should handle empty error array', () => {
      const categorized = ErrorHandler.categorizeErrors([]);

      expect(categorized.connection_errors).toHaveLength(0);
      expect(categorized.timeout_errors).toHaveLength(0);
      expect(categorized.validation_errors).toHaveLength(0);
      expect(categorized.other_errors).toHaveLength(0);
    });
  });

  describe('generateErrorSummary', () => {
    test('should generate comprehensive error summary', () => {
      const errors = [
        ErrorHandler.createError(OrchestrationErrorType.CONNECTION_ERROR, 'Connection failed'),
        ErrorHandler.createError(OrchestrationErrorType.CONNECTION_ERROR, 'Another connection failed'),
        ErrorHandler.createError(OrchestrationErrorType.TIMEOUT, 'Timeout'),
        ErrorHandler.createError(OrchestrationErrorType.VALIDATION_ERROR, 'Validation failed')
      ];

      const summary = ErrorHandler.generateErrorSummary(errors);

      expect(summary).toBe('4 total errors: 2 connection error(s), 1 timeout error(s), 1 validation error(s)');
    });

    test('should handle single error type', () => {
      const errors = [
        ErrorHandler.createError(OrchestrationErrorType.TIMEOUT, 'Timeout 1'),
        ErrorHandler.createError(OrchestrationErrorType.TIMEOUT, 'Timeout 2')
      ];

      const summary = ErrorHandler.generateErrorSummary(errors);

      expect(summary).toBe('2 total errors: 2 timeout error(s)');
    });

    test('should handle empty errors', () => {
      const summary = ErrorHandler.generateErrorSummary([]);

      expect(summary).toBe('No errors occurred');
    });
  });

  describe('createRecoveryStrategy', () => {
    test('should create strategy for retryable errors', () => {
      const errors = [
        ErrorHandler.createError(OrchestrationErrorType.TIMEOUT, 'Timeout'),
        ErrorHandler.createError(OrchestrationErrorType.CONNECTION_ERROR, 'Connection failed')
      ];

      const strategy = ErrorHandler.createRecoveryStrategy(errors);

      expect(strategy.can_retry).toBe(true);
      expect(strategy.suggested_actions).toContain('Check MCP server connections');
      expect(strategy.suggested_actions).toContain('Increase timeout values');
      expect(strategy.alternative_approaches).toContain('Try with a subset of package managers');
    });

    test('should create strategy for validation errors', () => {
      const errors = [
        ErrorHandler.createError(OrchestrationErrorType.VALIDATION_ERROR, 'Validation failed'),
        ErrorHandler.createError(OrchestrationErrorType.INVALID_PACKAGE_NAME, 'Invalid name')
      ];

      const strategy = ErrorHandler.createRecoveryStrategy(errors);

      expect(strategy.can_retry).toBe(false);
      expect(strategy.suggested_actions).toContain('Verify input parameters');
      expect(strategy.alternative_approaches).toContain('Provide more context hints');
    });

    test('should handle empty errors', () => {
      const strategy = ErrorHandler.createRecoveryStrategy([]);

      expect(strategy.can_retry).toBe(false);
      expect(strategy.suggested_actions).toHaveLength(0);
      expect(strategy.alternative_approaches).toHaveLength(0);
    });
  });

  describe('wrapError', () => {
    test('should wrap error with context', () => {
      const originalError = new Error('Original message');
      originalError.stack = 'Original stack trace';

      const wrappedError = ErrorHandler.wrapError(originalError, 'Test context');

      expect(wrappedError.message).toBe('Test context: Original message');
      expect(wrappedError.stack).toBe('Original stack trace');
    });

    test('should handle non-Error objects', () => {
      const wrappedError = ErrorHandler.wrapError('String error', 'Test context');

      expect(wrappedError.message).toBe('Test context: String error');
    });

    test('should handle null/undefined errors', () => {
      const wrappedNull = ErrorHandler.wrapError(null, 'Test context');
      const wrappedUndefined = ErrorHandler.wrapError(undefined, 'Test context');

      expect(wrappedNull.message).toBe('Test context: null');
      expect(wrappedUndefined.message).toBe('Test context: undefined');
    });
  });

  describe('logErrorDetails', () => {
    test('should log error with all details', () => {
      const { logger } = require('../../src/utils/logger.js');
      const error: OrchestrationError = {
        error_type: OrchestrationErrorType.CONNECTION_ERROR,
        message: 'Test error',
        manager: PackageManager.NPM,
        details: { 
          test: 'details',
          original_error: new Error('Original')
        }
      };

      ErrorHandler.logErrorDetails(error, 'Test context');

      expect(logger.error).toHaveBeenCalledWith(
        '[Test context] Test error',
        {
          error_type: OrchestrationErrorType.CONNECTION_ERROR,
          manager: PackageManager.NPM,
          details: error.details
        }
      );
      expect(logger.debug).toHaveBeenCalledWith('Original error details', error.details.original_error);
    });

    test('should log error without context', () => {
      const { logger } = require('../../src/utils/logger.js');
      const error: OrchestrationError = {
        error_type: OrchestrationErrorType.VALIDATION_ERROR,
        message: 'Validation failed'
      };

      ErrorHandler.logErrorDetails(error);

      expect(logger.error).toHaveBeenCalledWith(
        'Validation failed',
        {
          error_type: OrchestrationErrorType.VALIDATION_ERROR,
          manager: undefined,
          details: undefined
        }
      );
    });

    test('should not log debug info when no original error', () => {
      const { logger } = require('../../src/utils/logger.js');
      const error: OrchestrationError = {
        error_type: OrchestrationErrorType.TIMEOUT,
        message: 'Timeout error',
        details: { timeout_ms: 5000 }
      };

      ErrorHandler.logErrorDetails(error);

      expect(logger.error).toHaveBeenCalled();
      expect(logger.debug).not.toHaveBeenCalled();
    });
  });
});