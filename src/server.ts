import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';

// Import all components
import { PatternDetector } from './detection/pattern-detector.js';
import { ContextAnalyzer } from './detection/context-analyzer.js';
import { ConfidenceCalculator } from './detection/confidence-calculator.js';
import { ManagerRegistry } from './detection/manager-registry.js';
import { MCPClientManagerImpl } from './clients/mcp-client-manager.js';
import { ToolProxy } from './clients/tool-proxy.js';

// Import tools
import { SmartPackageSearchTool } from './tools/smart-package-search.js';
import { SmartPackageReadmeTool } from './tools/smart-package-readme.js';
import { SmartPackageInfoTool } from './tools/smart-package-info.js';
import { ListSupportedManagersTool } from './tools/list-supported-managers.js';

// Import utilities
import { logger } from './utils/logger.js';
import { ErrorHandler } from './utils/error-handler.js';
import { Validators } from './utils/validators.js';
import { cacheManager } from './utils/cache.js';

// Import types
import { 
  SmartPackageSearchParams,
  SmartPackageReadmeParams,
  SmartPackageInfoParams,
  OrchestrationErrorType 
} from './types/index.js';

export class ToolOrchestrationMCPServer {
  private server: Server;
  private managerRegistry: ManagerRegistry;
  private clientManager: MCPClientManagerImpl;
  private patternDetector: PatternDetector;
  private contextAnalyzer: ContextAnalyzer;
  private confidenceCalculator: ConfidenceCalculator;
  private toolProxy: ToolProxy;

  // Tool instances
  private smartPackageSearchTool: SmartPackageSearchTool;
  private smartPackageReadmeTool: SmartPackageReadmeTool;
  private smartPackageInfoTool: SmartPackageInfoTool;
  private listSupportedManagersTool: ListSupportedManagersTool;

  constructor() {
    this.server = new Server(
      {
        name: 'package-readme-core-mcp-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
          resources: {}
        }
      }
    );

    // Initialize components
    this.managerRegistry = new ManagerRegistry();
    this.patternDetector = new PatternDetector();
    this.contextAnalyzer = new ContextAnalyzer();
    this.confidenceCalculator = new ConfidenceCalculator();
    
    // Initialize client manager (will be configured after registry initialization)
    this.clientManager = new MCPClientManagerImpl(new Map());
    this.toolProxy = new ToolProxy(this.clientManager);

    // Initialize tools
    this.smartPackageSearchTool = new SmartPackageSearchTool(
      this.patternDetector,
      this.contextAnalyzer,
      this.confidenceCalculator,
      this.managerRegistry,
      this.toolProxy
    );

    this.smartPackageReadmeTool = new SmartPackageReadmeTool(
      this.patternDetector,
      this.contextAnalyzer,
      this.confidenceCalculator,
      this.managerRegistry,
      this.toolProxy
    );

    this.smartPackageInfoTool = new SmartPackageInfoTool(
      this.patternDetector,
      this.contextAnalyzer,
      this.confidenceCalculator,
      this.managerRegistry,
      this.toolProxy
    );

    this.listSupportedManagersTool = new ListSupportedManagersTool(
      this.managerRegistry,
      this.clientManager
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List tools handler
    (this.server as any).setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'smart_package_search',
            description: 'Automatically detects package manager and searches for packages across multiple registries',
            inputSchema: {
              type: 'object',
              properties: {
                package_name: {
                  type: 'string',
                  description: 'Name of the package to search for'
                },
                context_hints: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Optional context hints to help with package manager detection'
                },
                preferred_managers: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Optional list of preferred package managers to try first'
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results to return (default: 10)'
                }
              },
              required: ['package_name']
            }
          },
          {
            name: 'smart_package_readme',
            description: 'Automatically detects package manager and retrieves package README/documentation',
            inputSchema: {
              type: 'object',
              properties: {
                package_name: {
                  type: 'string',
                  description: 'Name of the package to get README for'
                },
                version: {
                  type: 'string',
                  description: 'Optional specific version of the package'
                },
                context_hints: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Optional context hints to help with package manager detection'
                },
                preferred_managers: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Optional list of preferred package managers to try first'
                },
                include_examples: {
                  type: 'boolean',
                  description: 'Whether to include usage examples in the response'
                }
              },
              required: ['package_name']
            }
          },
          {
            name: 'smart_package_info',
            description: 'Automatically detects package manager and retrieves detailed package information',
            inputSchema: {
              type: 'object',
              properties: {
                package_name: {
                  type: 'string',
                  description: 'Name of the package to get information for'
                },
                context_hints: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Optional context hints to help with package manager detection'
                },
                preferred_managers: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Optional list of preferred package managers to try first'
                },
                include_dependencies: {
                  type: 'boolean',
                  description: 'Whether to include dependency information in the response'
                }
              },
              required: ['package_name']
            }
          },
          {
            name: 'list_supported_managers',
            description: 'Lists all supported package managers and their current connection status',
            inputSchema: {
              type: 'object',
              properties: {},
              required: []
            }
          }
        ]
      }
    });

    // Handle prompts list
    (this.server as any).setRequestHandler(ListPromptsRequestSchema, async () => {
      return { prompts: [] };
    });

    // Handle resources list
    (this.server as any).setRequestHandler(ListResourcesRequestSchema, async () => {
      return { resources: [] };
    });

    // Call tool handler
    (this.server as any).setRequestHandler(CallToolRequestSchema, async (request: any, _extra: any) => {
      const { name, arguments: args } = request.params;

      try {
        logger.logOrchestrationStart(name, args);
        const startTime = Date.now();

        let result;
        
        switch (name) {
          case 'smart_package_search':
            result = await this.handleSmartPackageSearch(args as any);
            break;
          
          case 'smart_package_readme':
            result = await this.handleSmartPackageReadme(args as any);
            break;
          
          case 'smart_package_info':
            result = await this.handleSmartPackageInfo(args as any);
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

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        }

      } catch (error) {
        logger.error(`Tool execution failed: ${name}`, { error: String(error), args });
        
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  private async handleSmartPackageSearch(args: SmartPackageSearchParams): Promise<any> {
    // Validate input
    const validation = Validators.validateSmartPackageSearchParams(args);
    if (!validation.valid) {
      return {
        success: false,
        errors: [{
          error_type: OrchestrationErrorType.VALIDATION_ERROR,
          message: 'Input validation failed',
          details: { validation_errors: validation.errors }
        },],
        metadata: {
          execution_time: 0,
          managers_attempted: [],
          managers_succeeded: [],
          detection_confidence: 0
        }
      }
    }

    return await this.smartPackageSearchTool.execute(validation.validatedParams!);
  }

  private async handleSmartPackageReadme(args: SmartPackageReadmeParams): Promise<any> {
    return await this.smartPackageReadmeTool.execute(args);
  }

  private async handleSmartPackageInfo(args: SmartPackageInfoParams): Promise<any> {
    // Validate input
    const validation = Validators.validateSmartPackageInfoParams(args);
    if (!validation.valid) {
      return {
        success: false,
        errors: [{
          error_type: OrchestrationErrorType.VALIDATION_ERROR,
          message: 'Input validation failed',
          details: { validation_errors: validation.errors }
        },],
        metadata: {
          execution_time: 0,
          managers_attempted: [],
          managers_succeeded: [],
          detection_confidence: 0
        }
      }
    }

    return await this.smartPackageInfoTool.execute(validation.validatedParams!);
  }

  private async handleListSupportedManagers(): Promise<any> {
    return await this.listSupportedManagersTool.execute();
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Package README Core MCP Server...');

      // Initialize manager registry
      await this.managerRegistry.initialize();
      logger.info(`Loaded ${this.managerRegistry.getManagerCount()} package managers`);

      // Update client manager with server configurations
      const availableManagers = this.managerRegistry.getAvailableManagers();
      const serverConfigs = new Map();
      
      for (const manager of availableManagers) {
        if (manager.mcp_server_config) {
          serverConfigs.set(manager.manager, manager.mcp_server_config);
        }
      }

      // Recreate client manager with proper configurations
      this.clientManager = new MCPClientManagerImpl(serverConfigs);
      this.toolProxy = new ToolProxy(this.clientManager);

      // Update tool instances with new client manager
      this.smartPackageSearchTool = new SmartPackageSearchTool(
        this.patternDetector,
        this.contextAnalyzer,
        this.confidenceCalculator,
        this.managerRegistry,
        this.toolProxy
      );

      this.smartPackageReadmeTool = new SmartPackageReadmeTool(
        this.patternDetector,
        this.contextAnalyzer,
        this.confidenceCalculator,
        this.managerRegistry,
        this.toolProxy
      );

      this.smartPackageInfoTool = new SmartPackageInfoTool(
        this.patternDetector,
        this.contextAnalyzer,
        this.confidenceCalculator,
        this.managerRegistry,
        this.toolProxy
      );

      this.listSupportedManagersTool = new ListSupportedManagersTool(
        this.managerRegistry,
        this.clientManager
      );

      // Connect to available MCP servers
      logger.info('Connecting to MCP servers...');
      await this.clientManager.connectAll();
      
      const connectedManagers = this.clientManager.getConnectedManagers();
      logger.info(`Connected to ${connectedManagers.length} MCP servers: ${connectedManagers.join(', ')}`);

      // Start cache management
      cacheManager.startPeriodicCleanup();

      logger.info('Package README Core MCP Server initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize server', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      logger.info('Cleaning up Package README Core MCP Server...');

      // Disconnect from all MCP servers
      await this.clientManager.disconnectAll();

      // Shutdown cache manager (stops periodic cleanup and clears caches)
      cacheManager.shutdown();

      logger.info('Package README Core MCP Server cleanup completed');

    } catch (error) {
      logger.error('Error during cleanup', error);
      throw error;
    }
  }

  getServer(): Server {
    return this.server;
  }

  // Health check method
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      connected_managers: number;
      total_managers: number;
      cache_stats: any;
      uptime: number;
    };
  }> {
    try {
      const startTime = Date.now();
      const totalManagers = this.managerRegistry.getManagerCount();
      const connectedManagers = this.clientManager.getConnectedManagers().length;
      const cacheStats = cacheManager.getOverallStats();

      let status: 'healthy' | 'degraded' | 'unhealthy';
      
      if (connectedManagers === 0) {
        status = 'unhealthy';
      } else if (connectedManagers < totalManagers * 0.5) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }

      return {
        status,
        details: {
          connected_managers: connectedManagers,
          total_managers: totalManagers,
          cache_stats: cacheStats,
          uptime: Date.now() - startTime
        }
      }

    } catch (error) {
      logger.error('Health check failed', error);
      return {
        status: 'unhealthy',
        details: {
          connected_managers: 0,
          total_managers: 0,
          cache_stats: null,
          uptime: 0
        }
      }
    }
  }
}