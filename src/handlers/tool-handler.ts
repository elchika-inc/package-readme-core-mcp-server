import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';
import { Validators } from '../utils/validators.js';
import { 
  SmartPackageSearchParams,
  SmartPackageReadmeParams,
  SmartPackageInfoParams,
  OrchestrationErrorType 
} from '../types/index.js';

import { SmartPackageSearchTool } from '../tools/smart-package-search.js';
import { SmartPackageReadmeTool } from '../tools/smart-package-readme.js';
import { SmartPackageInfoTool } from '../tools/smart-package-info.js';
import { ListSupportedManagersTool } from '../tools/list-supported-managers.js';

export class ToolHandler {
  constructor(
    private smartPackageSearchTool: SmartPackageSearchTool,
    private smartPackageReadmeTool: SmartPackageReadmeTool,
    private smartPackageInfoTool: SmartPackageInfoTool,
    private listSupportedManagersTool: ListSupportedManagersTool
  ) {}

  async handleToolCall(name: string, args: any): Promise<any> {
    try {
      logger.logOrchestrationStart(name, args);
      const startTime = Date.now();

      let result;
      
      switch (name) {
        case 'smart_package_search':
          result = await this.handleSmartPackageSearch(args);
          break;
        
        case 'smart_package_readme':
          result = await this.handleSmartPackageReadme(args);
          break;
        
        case 'smart_package_info':
          result = await this.handleSmartPackageInfo(args);
          break;
        
        case 'list_supported_managers':
          result = await this.handleListSupportedManagers();
          break;
        
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${name}`
          );
      }

      const executionTime = Date.now() - startTime;
      logger.logOrchestrationComplete(
        name, 
        result.success, 
        result.metadata?.managers_attempted || [], 
        executionTime
      );

      return result;

    } catch (error) {
      logger.error(`Tool execution failed: ${name}`, { error: String(error), args });
      throw error;
    }
  }

  private async handleSmartPackageSearch(args: SmartPackageSearchParams): Promise<any> {
    const validation = Validators.validateSmartPackageSearchParams(args);
    if (!validation.valid) {
      return this.createValidationErrorResponse(validation.errors);
    }

    return await this.smartPackageSearchTool.execute(validation.validatedParams!);
  }

  private async handleSmartPackageReadme(args: SmartPackageReadmeParams): Promise<any> {
    return await this.smartPackageReadmeTool.execute(args);
  }

  private async handleSmartPackageInfo(args: SmartPackageInfoParams): Promise<any> {
    const validation = Validators.validateSmartPackageInfoParams(args);
    if (!validation.valid) {
      return this.createValidationErrorResponse(validation.errors);
    }

    return await this.smartPackageInfoTool.execute(validation.validatedParams!);
  }

  private async handleListSupportedManagers(): Promise<any> {
    return await this.listSupportedManagersTool.execute();
  }

  private createValidationErrorResponse(errors: any[]) {
    return {
      success: false,
      errors: [{
        error_type: OrchestrationErrorType.VALIDATION_ERROR,
        message: 'Input validation failed',
        details: { validation_errors: errors }
      }],
      metadata: {
        execution_time: 0,
        managers_attempted: [],
        managers_succeeded: [],
        detection_confidence: 0
      }
    };
  }
}