import { ManagerRegistry } from '../detection/manager-registry.js';
import { MCPClientManagerImpl } from '../clients/mcp-client-manager.js';
import { logger } from '../utils/logger.js';
import { cacheManager } from '../utils/cache.js';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: {
    connected_managers: number;
    total_managers: number;
    cache_stats: any;
    uptime: number;
  };
}

export class HealthChecker {
  private startTime = Date.now();

  constructor(
    private managerRegistry: ManagerRegistry,
    private clientManager: MCPClientManagerImpl
  ) {}

  async checkHealth(): Promise<HealthStatus> {
    try {
      const totalManagers = this.managerRegistry.getManagerCount();
      const connectedManagers = this.clientManager.getConnectedManagers().length;
      const cacheStats = cacheManager.getOverallStats();

      const status = this.determineStatus(connectedManagers, totalManagers);

      return {
        status,
        details: {
          connected_managers: connectedManagers,
          total_managers: totalManagers,
          cache_stats: cacheStats,
          uptime: Date.now() - this.startTime
        }
      };

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
      };
    }
  }

  private determineStatus(connected: number, total: number): 'healthy' | 'degraded' | 'unhealthy' {
    if (connected === 0) {
      return 'unhealthy';
    } else if (connected < total * 0.5) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }
}