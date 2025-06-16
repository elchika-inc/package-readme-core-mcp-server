import { SupportedManagersResponse, OrchestrationResponse } from '../types/index.js';
import { ManagerRegistry } from '../detection/manager-registry.js';
import { MCPClientManager } from '../clients/mcp-client-manager.js';

export class ListSupportedManagersTool {
  constructor(
    private managerRegistry: ManagerRegistry,
    private clientManager: MCPClientManager
  ) {}

  async execute(): Promise<OrchestrationResponse<SupportedManagersResponse>> {
    const startTime = Date.now();

    try {
      // Get all registered managers
      const allManagers = this.managerRegistry.getAllManagers();
      
      // Update real-time connection status
      const managersWithStatus = await Promise.all(
        allManagers.map(async (manager) => {
          const isConnected = this.clientManager.isConnected(manager.manager);
          const availableTools = isConnected 
            ? await this.getAvailableTools(manager.manager)
            : [];

          return {
            ...manager,
            mcp_server_available: isConnected,
            mcp_server_config: manager.mcp_server_config ? {
              ...manager.mcp_server_config,
              connection_status: isConnected ? 'connected' as const : 'disconnected' as const,
              tools: availableTools
            } : undefined
          };
        })
      );

      const response: SupportedManagersResponse = {
        managers: managersWithStatus,
        total_count: managersWithStatus.length
      };

      return {
        success: true,
        data: response,
        metadata: {
          execution_time: Date.now() - startTime,
          managers_attempted: [],
          managers_succeeded: [],
          detection_confidence: 1.0
        }
      };

    } catch (error) {
      return {
        success: false,
        errors: [{
          error_type: 'ALL_MANAGERS_FAILED' as any,
          message: error instanceof Error ? error.message : 'Failed to list supported managers',
          details: { error: String(error) }
        }],
        metadata: {
          execution_time: Date.now() - startTime,
          managers_attempted: [],
          managers_succeeded: [],
          detection_confidence: 0
        }
      };
    }
  }

  async getHealthStatus(): Promise<OrchestrationResponse<{
    healthy_managers: number;
    total_managers: number;
    connection_details: Array<{
      manager: string;
      connected: boolean;
      tools_available: string[];
      last_check: string;
    }>;
  }>> {
    const startTime = Date.now();

    try {
      const allManagers = this.managerRegistry.getAllManagers();
      const connectionDetails = [];
      let healthyCount = 0;

      for (const manager of allManagers) {
        const isConnected = this.clientManager.isConnected(manager.manager);
        const availableTools = isConnected 
          ? await this.getAvailableTools(manager.manager)
          : [];

        if (isConnected) {
          healthyCount++;
        }

        connectionDetails.push({
          manager: manager.name,
          connected: isConnected,
          tools_available: availableTools,
          last_check: new Date().toISOString()
        });
      }

      const response = {
        healthy_managers: healthyCount,
        total_managers: allManagers.length,
        connection_details: connectionDetails
      };

      return {
        success: true,
        data: response,
        metadata: {
          execution_time: Date.now() - startTime,
          managers_attempted: [],
          managers_succeeded: [],
          detection_confidence: 1.0
        }
      };

    } catch (error) {
      return {
        success: false,
        errors: [{
          error_type: 'ALL_MANAGERS_FAILED' as any,
          message: error instanceof Error ? error.message : 'Failed to get health status',
          details: { error: String(error) }
        }],
        metadata: {
          execution_time: Date.now() - startTime,
          managers_attempted: [],
          managers_succeeded: [],
          detection_confidence: 0
        }
      };
    }
  }

  async getManagerCapabilities(): Promise<OrchestrationResponse<{
    managers: Array<{
      manager: string;
      available: boolean;
      supported_tools: string[];
      detection_patterns: {
        file_patterns: string[];
        package_patterns: string[];
        keywords: string[];
      };
      priority: number;
    }>;
  }>> {
    const startTime = Date.now();

    try {
      const allManagers = this.managerRegistry.getAllManagers();
      const managerCapabilities = [];

      for (const manager of allManagers) {
        const isConnected = this.clientManager.isConnected(manager.manager);
        const availableTools = isConnected 
          ? await this.getAvailableTools(manager.manager)
          : [];

        managerCapabilities.push({
          manager: manager.name,
          available: isConnected,
          supported_tools: availableTools,
          detection_patterns: {
            file_patterns: manager.file_patterns,
            package_patterns: manager.package_name_patterns.map(p => p.source),
            keywords: manager.context_keywords
          },
          priority: manager.priority
        });
      }

      const response = {
        managers: managerCapabilities.sort((a, b) => a.priority - b.priority)
      };

      return {
        success: true,
        data: response,
        metadata: {
          execution_time: Date.now() - startTime,
          managers_attempted: [],
          managers_succeeded: [],
          detection_confidence: 1.0
        }
      };

    } catch (error) {
      return {
        success: false,
        errors: [{
          error_type: 'ALL_MANAGERS_FAILED' as any,
          message: error instanceof Error ? error.message : 'Failed to get manager capabilities',
          details: { error: String(error) }
        }],
        metadata: {
          execution_time: Date.now() - startTime,
          managers_attempted: [],
          managers_succeeded: [],
          detection_confidence: 0
        }
      };
    }
  }

  async testManagerConnections(): Promise<OrchestrationResponse<{
    connection_tests: Array<{
      manager: string;
      connection_successful: boolean;
      response_time_ms: number;
      tools_accessible: boolean;
      error_message?: string;
    }>;
    summary: {
      total_tested: number;
      successful_connections: number;
      failed_connections: number;
    };
  }>> {
    const startTime = Date.now();

    try {
      const allManagers = this.managerRegistry.getAllManagers();
      const connectionTests = [];
      let successfulConnections = 0;

      for (const manager of allManagers) {
        const testStartTime = Date.now();
        let connectionSuccessful = false;
        let toolsAccessible = false;
        let errorMessage: string | undefined;

        try {
          // Test basic connection
          connectionSuccessful = this.clientManager.isConnected(manager.manager);

          if (connectionSuccessful) {
            // Test tool accessibility
            const availableTools = await this.getAvailableTools(manager.manager);
            toolsAccessible = availableTools.length > 0;
          }

          if (connectionSuccessful && toolsAccessible) {
            successfulConnections++;
          }

        } catch (error) {
          errorMessage = error instanceof Error ? error.message : String(error);
        }

        connectionTests.push({
          manager: manager.name,
          connection_successful: connectionSuccessful,
          response_time_ms: Date.now() - testStartTime,
          tools_accessible: toolsAccessible,
          error_message: errorMessage
        });
      }

      const response = {
        connection_tests: connectionTests,
        summary: {
          total_tested: allManagers.length,
          successful_connections: successfulConnections,
          failed_connections: allManagers.length - successfulConnections
        }
      };

      return {
        success: true,
        data: response,
        metadata: {
          execution_time: Date.now() - startTime,
          managers_attempted: [],
          managers_succeeded: [],
          detection_confidence: 1.0
        }
      };

    } catch (error) {
      return {
        success: false,
        errors: [{
          error_type: 'ALL_MANAGERS_FAILED' as any,
          message: error instanceof Error ? error.message : 'Failed to test manager connections',
          details: { error: String(error) }
        }],
        metadata: {
          execution_time: Date.now() - startTime,
          managers_attempted: [],
          managers_succeeded: [],
          detection_confidence: 0
        }
      };
    }
  }

  private async getAvailableTools(manager: any): Promise<string[]> {
    try {
      const client = this.clientManager.clients.get(manager);
      if (!client) {
        return [];
      }

      const tools = await client.listTools();
      return tools.tools.map(tool => tool.name);
    } catch (error) {
      console.error(`Failed to get available tools for ${manager}:`, error);
      return [];
    }
  }

  async refreshManagerRegistry(): Promise<OrchestrationResponse<{ 
    refreshed: boolean; 
    managers_loaded: number; 
    servers_configured: number; 
  }>> {
    const startTime = Date.now();

    try {
      await this.managerRegistry.refresh();
      
      const allManagers = this.managerRegistry.getAllManagers();
      const availableManagers = this.managerRegistry.getAvailableManagers();

      const response = {
        refreshed: true,
        managers_loaded: allManagers.length,
        servers_configured: availableManagers.length
      };

      return {
        success: true,
        data: response,
        metadata: {
          execution_time: Date.now() - startTime,
          managers_attempted: [],
          managers_succeeded: [],
          detection_confidence: 1.0
        }
      };

    } catch (error) {
      return {
        success: false,
        errors: [{
          error_type: 'ALL_MANAGERS_FAILED' as any,
          message: error instanceof Error ? error.message : 'Failed to refresh manager registry',
          details: { error: String(error) }
        }],
        metadata: {
          execution_time: Date.now() - startTime,
          managers_attempted: [],
          managers_succeeded: [],
          detection_confidence: 0
        }
      };
    }
  }
}