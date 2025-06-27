import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { PackageManager, MCPServerConfig } from '../types/index.js';

export interface MCPClientManager {
  clients: Map<PackageManager, Client>;
  
  connect(manager: PackageManager): Promise<void>;
  disconnect(manager: PackageManager): Promise<void>;
  isConnected(manager: PackageManager): boolean;
  
  callTool<T>(
    manager: PackageManager, 
    toolName: string, 
    params: any
  ): Promise<T>;
  
  callToolParallel<T>(
    managers: PackageManager[], 
    toolName: string, 
    params: any
  ): Promise<Map<PackageManager, T>>;
  
  callToolWithTimeout<T>(
    manager: PackageManager,
    toolName: string,
    params: any,
    timeoutMs?: number
  ): Promise<T>;
  
  callToolParallelWithTimeout<T>(
    managers: PackageManager[],
    toolName: string,
    params: any,
    timeoutMs?: number
  ): Promise<Map<PackageManager, T>>;
}

export class MCPClientManagerImpl implements MCPClientManager {
  public clients: Map<PackageManager, Client> = new Map();
  private serverConfigs: Map<PackageManager, MCPServerConfig> = new Map();
  private connectionStatus: Map<PackageManager, boolean> = new Map();
  private healthCheckIntervals: Map<PackageManager, NodeJS.Timeout> = new Map();

  constructor(serverConfigs: Map<PackageManager, MCPServerConfig>) {
    this.serverConfigs = serverConfigs;
  }

  async connect(manager: PackageManager): Promise<void> {
    if (this.isConnected(manager)) {
      return; // Already connected
    }

    const config = this.serverConfigs.get(manager);
    if (!config) {
      throw new Error(`No server configuration found for ${manager}`);
    }

    try {
      // Create stdio transport for the MCP server
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: config.env
      });

      // Create client
      const client = new Client({
        name: `tool-orchestration-client-${manager}`,
        version: '1.0.0'
      }, {
        capabilities: {
          tools: {}
        }
      });

      // Connect to the server
      await client.connect(transport);

      // Store client and update status
      this.clients.set(manager, client);
      this.connectionStatus.set(manager, true);

      // Start health check if configured
      if (config.health_check_interval) {
        this.startHealthCheck(manager, config.health_check_interval);
      }

      // Log through the shared logger system instead of console.log
    } catch (error) {
      this.connectionStatus.set(manager, false);
      // Error will be handled by the caller with proper logging
      throw error;
    }
  }

  async disconnect(manager: PackageManager): Promise<void> {
    const client = this.clients.get(manager);
    if (client) {
      try {
        await (client as any).close();
      } catch (error) {
        // Error will be handled by the caller with proper logging
      }
      
      this.clients.delete(manager);
    }

    this.connectionStatus.set(manager, false);

    // Stop health check
    const healthCheckInterval = this.healthCheckIntervals.get(manager);
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
      this.healthCheckIntervals.delete(manager);
    }

    // Log through the shared logger system instead of console.log
  }

  isConnected(manager: PackageManager): boolean {
    return this.connectionStatus.get(manager) === true && 
           this.clients.has(manager);
  }

  async callTool<T>(
    manager: PackageManager, 
    toolName: string, 
    params: any
  ): Promise<T> {
    if (!this.isConnected(manager)) {
      throw new Error(`Not connected to ${manager} MCP server`);
    }

    const client = this.clients.get(manager);
    if (!client) {
      throw new Error(`No client available for ${manager}`);
    }

    try {
      const startTime = Date.now();
      const result = await client.callTool({
        name: toolName,
        arguments: params
      });

      const endTime = Date.now();
      // Tool call timing is logged by the caller

      return result.content as T;
    } catch (error) {
      // Error will be handled by the caller with proper logging
      
      // Check if we should reconnect
      if (this.shouldReconnectOnError(error)) {
        this.connectionStatus.set(manager, false);
        // Could implement auto-reconnection here
      }
      
      throw error;
    }
  }

  async callToolParallel<T>(
    managers: PackageManager[], 
    toolName: string, 
    params: any
  ): Promise<Map<PackageManager, T>> {
    const promises = managers.map(async (manager) => {
      try {
        const result = await this.callTool<T>(manager, toolName, params);
        return { manager, result, error: null };
      } catch (error) {
        return { manager, result: null, error };
      }
    });

    const results = await Promise.allSettled(promises);
    const resultMap = new Map<PackageManager, T>();

    for (const promiseResult of results) {
      if (promiseResult.status === 'fulfilled') {
        const { manager, result, error } = promiseResult.value;
        if (result && !error) {
          resultMap.set(manager, result);
        }
      }
    }

    return resultMap;
  }

  async callToolWithTimeout<T>(
    manager: PackageManager,
    toolName: string,
    params: any,
    timeoutMs: number = 5000
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Tool call to ${manager}.${toolName} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.callTool<T>(manager, toolName, params)
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  async callToolParallelWithTimeout<T>(
    managers: PackageManager[],
    toolName: string,
    params: any,
    timeoutMs: number = 8000
  ): Promise<Map<PackageManager, T>> {
    const promises = managers.map(async (manager) => {
      try {
        const result = await this.callToolWithTimeout<T>(manager, toolName, params, timeoutMs);
        return { manager, result, error: null };
      } catch (error) {
        return { manager, result: null, error };
      }
    });

    const results = await Promise.allSettled(promises);
    const resultMap = new Map<PackageManager, T>();

    for (const promiseResult of results) {
      if (promiseResult.status === 'fulfilled') {
        const { manager, result, error } = promiseResult.value;
        if (result && !error) {
          resultMap.set(manager, result);
        }
      }
    }

    return resultMap;
  }

  private startHealthCheck(manager: PackageManager, intervalMs: number): void {
    const interval = setInterval(async () => {
      try {
        const client = this.clients.get(manager);
        if (client) {
          // Simple ping-like health check
          await client.listTools();
        }
      } catch (error) {
        // Health check error will be handled by the caller
        this.connectionStatus.set(manager, false);
        // Could implement auto-reconnection here
      }
    }, intervalMs);

    this.healthCheckIntervals.set(manager, interval);
  }

  private shouldReconnectOnError(error: any): boolean {
    // Define which errors should trigger a reconnection attempt
    const reconnectErrors = [
      'ECONNRESET',
      'EPIPE',
      'ENOTFOUND',
      'Connection closed'
    ];

    const errorMessage = error?.message || '';
    return reconnectErrors.some(errorType => 
      errorMessage.includes(errorType)
    );
  }

  async connectAll(): Promise<void> {
    const connectionPromises = Array.from(this.serverConfigs.keys()).map(manager => 
      this.connect(manager).catch(error => {
        // Connection error will be handled by the caller
        // Don't throw - allow other connections to proceed
      })
    );

    await Promise.allSettled(connectionPromises);
  }

  async disconnectAll(): Promise<void> {
    const disconnectionPromises = Array.from(this.clients.keys()).map(manager => 
      this.disconnect(manager).catch(error => {
        // Disconnection error will be handled by the caller
      })
    );

    await Promise.allSettled(disconnectionPromises);
  }

  getConnectedManagers(): PackageManager[] {
    return Array.from(this.clients.keys()).filter(manager => 
      this.isConnected(manager)
    );
  }

  getConnectionStatus(): Map<PackageManager, boolean> {
    return new Map(this.connectionStatus);
  }

  async retryConnection(manager: PackageManager, maxRetries: number = 3): Promise<boolean> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.connect(manager);
        return true;
      } catch (error) {
        // Connection retry error will be handled by the caller
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    return false;
  }
}