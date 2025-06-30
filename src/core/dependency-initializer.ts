import { PatternDetector } from '../detection/pattern-detector.js';
import { ContextAnalyzer } from '../detection/context-analyzer.js';
import { ConfidenceCalculator } from '../detection/confidence-calculator.js';
import { ManagerRegistry } from '../detection/manager-registry.js';
import { MCPClientManagerImpl } from '../clients/mcp-client-manager.js';
import { ToolProxy } from '../clients/tool-proxy.js';

import { SmartPackageSearchTool } from '../tools/smart-package-search.js';
import { SmartPackageReadmeTool } from '../tools/smart-package-readme.js';
import { SmartPackageInfoTool } from '../tools/smart-package-info.js';
import { ListSupportedManagersTool } from '../tools/list-supported-managers.js';

import { logger } from '../utils/logger.js';
import { cacheManager } from '../utils/cache.js';

export interface Dependencies {
  managerRegistry: ManagerRegistry;
  clientManager: MCPClientManagerImpl;
  patternDetector: PatternDetector;
  contextAnalyzer: ContextAnalyzer;
  confidenceCalculator: ConfidenceCalculator;
  toolProxy: ToolProxy;
  smartPackageSearchTool: SmartPackageSearchTool;
  smartPackageReadmeTool: SmartPackageReadmeTool;
  smartPackageInfoTool: SmartPackageInfoTool;
  listSupportedManagersTool: ListSupportedManagersTool;
}

export class DependencyInitializer {
  static createInitialDependencies(): Partial<Dependencies> {
    const managerRegistry = new ManagerRegistry();
    const patternDetector = new PatternDetector();
    const contextAnalyzer = new ContextAnalyzer();
    const confidenceCalculator = new ConfidenceCalculator();
    
    const clientManager = new MCPClientManagerImpl(new Map());
    const toolProxy = new ToolProxy(clientManager);

    return {
      managerRegistry,
      patternDetector,
      contextAnalyzer,
      confidenceCalculator,
      clientManager,
      toolProxy
    };
  }

  static async initializeFullDependencies(
    partialDeps: Partial<Dependencies>
  ): Promise<Dependencies> {
    const {
      managerRegistry,
      patternDetector,
      contextAnalyzer,
      confidenceCalculator
    } = partialDeps;

    if (!managerRegistry || !patternDetector || !contextAnalyzer || !confidenceCalculator) {
      throw new Error('Required dependencies not provided');
    }

    await managerRegistry.initialize();
    logger.info(`Loaded ${managerRegistry.getManagerCount()} package managers`);

    const availableManagers = managerRegistry.getAvailableManagers();
    const serverConfigs = new Map();
    
    for (const manager of availableManagers) {
      if (manager.mcp_server_config) {
        serverConfigs.set(manager.manager, manager.mcp_server_config);
      }
    }

    const clientManager = new MCPClientManagerImpl(serverConfigs);
    const toolProxy = new ToolProxy(clientManager);

    const smartPackageSearchTool = new SmartPackageSearchTool(
      patternDetector,
      contextAnalyzer,
      confidenceCalculator,
      managerRegistry,
      toolProxy
    );

    const smartPackageReadmeTool = new SmartPackageReadmeTool(
      patternDetector,
      contextAnalyzer,
      confidenceCalculator,
      managerRegistry,
      toolProxy
    );

    const smartPackageInfoTool = new SmartPackageInfoTool(
      patternDetector,
      contextAnalyzer,
      confidenceCalculator,
      managerRegistry,
      toolProxy
    );

    const listSupportedManagersTool = new ListSupportedManagersTool(
      managerRegistry,
      clientManager
    );

    logger.info('Connecting to MCP servers...');
    await clientManager.connectAll();
    
    const connectedManagers = clientManager.getConnectedManagers();
    logger.info(`Connected to ${connectedManagers.length} MCP servers: ${connectedManagers.join(', ')}`);

    cacheManager.startPeriodicCleanup();

    return {
      managerRegistry,
      clientManager,
      patternDetector,
      contextAnalyzer,
      confidenceCalculator,
      toolProxy,
      smartPackageSearchTool,
      smartPackageReadmeTool,
      smartPackageInfoTool,
      listSupportedManagersTool
    };
  }
}