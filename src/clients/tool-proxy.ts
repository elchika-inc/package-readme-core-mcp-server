import { PackageManager, PackageManagerResult, OrchestrationError, OrchestrationErrorType } from '../types/index.js';
import { MCPClientManager } from './mcp-client-manager.js';

export class ToolProxy {
  constructor(private clientManager: MCPClientManager) {}

  async executeToolSingle(
    manager: PackageManager,
    toolName: string,
    params: any,
    timeoutMs: number = 5000
  ): Promise<PackageManagerResult> {
    const startTime = Date.now();

    try {
      if (!this.clientManager.isConnected(manager)) {
        return {
          manager,
          success: false,
          error: `Not connected to ${manager} MCP server`,
          response_time: Date.now() - startTime
        };
      }

      const result = await this.clientManager.callToolWithTimeout(
        manager,
        toolName,
        params,
        timeoutMs
      );

      return {
        manager,
        success: true,
        data: result,
        response_time: Date.now() - startTime
      };
    } catch (error) {
      return {
        manager,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        response_time: Date.now() - startTime
      };
    }
  }

  async executeToolParallel(
    managers: PackageManager[],
    toolName: string,
    params: any,
    timeoutMs: number = 8000
  ): Promise<PackageManagerResult[]> {
    const startTime = Date.now();

    // Filter to only connected managers
    const connectedManagers = managers.filter(manager => 
      this.clientManager.isConnected(manager)
    );

    if (connectedManagers.length === 0) {
      return managers.map(manager => ({
        manager,
        success: false,
        error: `Not connected to ${manager} MCP server`,
        response_time: Date.now() - startTime
      }));
    }

    try {
      const results = await this.clientManager.callToolParallelWithTimeout(
        connectedManagers,
        toolName,
        params,
        timeoutMs
      );

      // Convert to PackageManagerResult array
      const packageManagerResults: PackageManagerResult[] = [];

      // Add successful results
      for (const [manager, data] of results.entries()) {
        packageManagerResults.push({
          manager,
          success: true,
          data,
          response_time: Date.now() - startTime
        });
      }

      // Add failed results for managers that didn't return data
      for (const manager of connectedManagers) {
        if (!results.has(manager)) {
          packageManagerResults.push({
            manager,
            success: false,
            error: 'Tool call failed or timed out',
            response_time: Date.now() - startTime
          });
        }
      }

      // Add results for disconnected managers
      for (const manager of managers) {
        if (!connectedManagers.includes(manager)) {
          packageManagerResults.push({
            manager,
            success: false,
            error: `Not connected to ${manager} MCP server`,
            response_time: Date.now() - startTime
          });
        }
      }

      return packageManagerResults;
    } catch (error) {
      // If the entire parallel operation fails, return error for all managers
      return managers.map(manager => ({
        manager,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        response_time: Date.now() - startTime
      }));
    }
  }

  async executeToolWithFallback(
    primaryManager: PackageManager,
    fallbackManagers: PackageManager[],
    toolName: string,
    params: any,
    timeoutMs: number = 5000
  ): Promise<PackageManagerResult> {
    // Try primary manager first
    const primaryResult = await this.executeToolSingle(
      primaryManager,
      toolName,
      params,
      timeoutMs
    );

    if (primaryResult.success) {
      return primaryResult;
    }

    // Try fallback managers one by one
    for (const fallbackManager of fallbackManagers) {
      const fallbackResult = await this.executeToolSingle(
        fallbackManager,
        toolName,
        params,
        timeoutMs
      );

      if (fallbackResult.success) {
        return fallbackResult;
      }
    }

    // If all failed, return the primary result (with original error)
    return primaryResult;
  }

  async executeToolWithEarlyReturn(
    managers: PackageManager[],
    toolName: string,
    params: any,
    earlyReturnTimeoutMs: number = 2000
  ): Promise<PackageManagerResult[]> {
    const results: PackageManagerResult[] = [];
    const promises = new Map<PackageManager, Promise<PackageManagerResult>>();

    // Start all tool calls
    for (const manager of managers) {
      const promise = this.executeToolSingle(manager, toolName, params);
      promises.set(manager, promise);
    }

    // Wait for early return timeout or first success
    const earlyReturnPromise = new Promise<PackageManagerResult | null>((resolve) => {
      const timeout = setTimeout(() => resolve(null), earlyReturnTimeoutMs);
      
      // Check for first successful result
      Promise.race(Array.from(promises.values()))
        .then(result => {
          if (result.success) {
            clearTimeout(timeout);
            resolve(result);
          }
        })
        .catch(() => {
          // Ignore errors in race condition
        });
    });

    const earlyResult = await earlyReturnPromise;

    // If we got an early successful result, we can optionally return just that
    // For now, let's wait for all results to maintain consistency
    const allResults = await Promise.allSettled(Array.from(promises.values()));

    for (let i = 0; i < allResults.length; i++) {
      const promiseResult = allResults[i];
      if (promiseResult.status === 'fulfilled') {
        results.push(promiseResult.value);
      } else {
        // Handle rejected promises
        const manager = managers[i];
        results.push({
          manager,
          success: false,
          error: promiseResult.reason?.message || 'Unknown error',
          response_time: 0
        });
      }
    }

    return results;
  }

  async validateToolSupport(
    manager: PackageManager,
    toolName: string
  ): Promise<boolean> {
    try {
      if (!this.clientManager.isConnected(manager)) {
        return false;
      }

      const client = this.clientManager.clients.get(manager);
      if (!client) {
        return false;
      }

      const tools = await client.listTools();
      return tools.tools.some(tool => tool.name === toolName);
    } catch (error) {
      console.error(`Failed to validate tool support for ${manager}.${toolName}:`, error);
      return false;
    }
  }

  async getAvailableTools(manager: PackageManager): Promise<string[]> {
    try {
      if (!this.clientManager.isConnected(manager)) {
        return [];
      }

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

  async executeWithRetry(
    manager: PackageManager,
    toolName: string,
    params: any,
    maxRetries: number = 3,
    baseTimeoutMs: number = 5000
  ): Promise<PackageManagerResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const timeoutMs = baseTimeoutMs * Math.pow(1.5, attempt - 1); // Increasing timeout
        const result = await this.executeToolSingle(manager, toolName, params, timeoutMs);
        
        if (result.success) {
          return result;
        }

        lastError = new Error(result.error || 'Unknown error');
        
        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    // All retries failed
    return {
      manager,
      success: false,
      error: lastError?.message || 'All retry attempts failed',
      response_time: 0
    };
  }

  createOrchestrationError(
    manager: PackageManager,
    errorType: OrchestrationErrorType,
    message: string,
    details?: any
  ): OrchestrationError {
    return {
      manager,
      error_type: errorType,
      message,
      details
    };
  }
}