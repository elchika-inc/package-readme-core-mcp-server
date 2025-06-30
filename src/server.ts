import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';

import { DependencyInitializer, Dependencies } from './core/dependency-initializer.js';
import { ToolHandler } from './handlers/tool-handler.js';
import { SchemaProvider } from './handlers/schema-provider.js';
import { HealthChecker, HealthStatus } from './core/health-checker.js';
import { logger } from './utils/logger.js';
import { cacheManager } from './utils/cache.js';

export class ToolOrchestrationMCPServer {
  private server: Server;
  private dependencies!: Dependencies;
  private toolHandler!: ToolHandler;
  private healthChecker!: HealthChecker;

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
  }

  private setupHandlers(): void {
    this.setupListToolsHandler();
    this.setupPromptsHandler();
    this.setupResourcesHandler();
    this.setupCallToolHandler();
  }

  private setupListToolsHandler(): void {
    (this.server as any).setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: SchemaProvider.getToolSchemas() };
    });
  }

  private setupPromptsHandler(): void {
    (this.server as any).setRequestHandler(ListPromptsRequestSchema, async () => {
      return { prompts: [] };
    });
  }

  private setupResourcesHandler(): void {
    (this.server as any).setRequestHandler(ListResourcesRequestSchema, async () => {
      return { resources: [] };
    });
  }

  private setupCallToolHandler(): void {
    (this.server as any).setRequestHandler(CallToolRequestSchema, async (request: any, _extra: any) => {
      const { name, arguments: args } = request.params;

      try {
        const result = await this.toolHandler.handleToolCall(name, args);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }


  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Package README Core MCP Server...');
      
      const initialDeps = DependencyInitializer.createInitialDependencies();
      this.dependencies = await DependencyInitializer.initializeFullDependencies(initialDeps);
      
      this.toolHandler = new ToolHandler(
        this.dependencies.smartPackageSearchTool,
        this.dependencies.smartPackageReadmeTool,
        this.dependencies.smartPackageInfoTool,
        this.dependencies.listSupportedManagersTool
      );
      
      this.healthChecker = new HealthChecker(
        this.dependencies.managerRegistry,
        this.dependencies.clientManager
      );
      
      this.setupHandlers();
      
      logger.info('Package README Core MCP Server initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize server', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      logger.info('Cleaning up Package README Core MCP Server...');
      
      if (this.dependencies?.clientManager) {
        await this.dependencies.clientManager.disconnectAll();
      }
      
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

  async healthCheck(): Promise<HealthStatus> {
    return this.healthChecker ? await this.healthChecker.checkHealth() : {
      status: 'unhealthy',
      details: {
        connected_managers: 0,
        total_managers: 0,
        cache_stats: null,
        uptime: 0
      }
    };
  }
}