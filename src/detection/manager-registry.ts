import { PackageManager, PackageManagerInfo, MCPServerConfig } from '../types/index.js';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class ManagerRegistry {
  private managers: Map<PackageManager, PackageManagerInfo> = new Map();
  private mcpServers: Map<PackageManager, MCPServerConfig> = new Map();

  async initialize(): Promise<void> {
    await this.loadPackageManagers();
    await this.loadMCPServers();
    this.updateAvailability();
  }

  private async loadPackageManagers(): Promise<void> {
    try {
      const configPath = join(__dirname, '../../config', 'package-managers.json');
      const configData = await readFile(configPath, 'utf-8');
      const config = JSON.parse(configData);

      for (const [key, managerConfig] of Object.entries(config.managers)) {
        const manager = key as PackageManager;
        const config_data = managerConfig as any;
        const info: PackageManagerInfo = {
          manager,
          name: config_data.name,
          description: config_data.description,
          file_patterns: config_data.file_patterns,
          package_name_patterns: config_data.package_name_patterns.map((p: string) => new RegExp(p)),
          context_keywords: config_data.context_keywords,
          priority: config_data.priority,
          mcp_server_available: false, // Will be updated later
        };

        this.managers.set(manager, info);
      }
    } catch (error) {
      console.error('Failed to load package managers config:', error);
      // Load defaults if config file is missing
      this.loadDefaultManagers();
    }
  }

  private async loadMCPServers(): Promise<void> {
    try {
      const configPath = join(__dirname, '../../config', 'mcp-servers.json');
      const configData = await readFile(configPath, 'utf-8');
      const config = JSON.parse(configData);

      for (const [key, serverConfig] of Object.entries(config.servers)) {
        const manager = key as PackageManager;
        const server_data = serverConfig as any;
        const mcpConfig: MCPServerConfig = {
          server_id: server_data.server_id,
          command: server_data.command,
          args: server_data.args,
          env: server_data.env,
          tools: server_data.tools,
          health_check_interval: server_data.health_check_interval,
          connection_status: 'disconnected'
        };

        this.mcpServers.set(manager, mcpConfig);
      }
    } catch (error) {
      console.error('Failed to load MCP servers config:', error);
    }
  }

  private updateAvailability(): void {
    for (const [manager, info] of this.managers.entries()) {
      const mcpConfig = this.mcpServers.get(manager);
      if (mcpConfig) {
        info.mcp_server_available = true;
        info.mcp_server_config = mcpConfig;
      }
    }
  }

  private loadDefaultManagers(): void {
    // Load minimal default configuration
    const defaultManagers: Partial<Record<PackageManager, PackageManagerInfo>> = {
      [PackageManager.NPM]: {
        manager: PackageManager.NPM,
        name: 'npm',
        description: 'Node.js package manager',
        file_patterns: ['package.json'],
        package_name_patterns: [/^[a-z0-9-~][a-z0-9-._~]*$/],
        context_keywords: ['node', 'javascript', 'typescript'],
        priority: 1,
        mcp_server_available: false
      },
      [PackageManager.PIP]: {
        manager: PackageManager.PIP,
        name: 'pip',
        description: 'Python package manager',
        file_patterns: ['requirements.txt'],
        package_name_patterns: [/^[A-Z0-9][A-Z0-9._-]*[A-Z0-9]$/i],
        context_keywords: ['python'],
        priority: 2,
        mcp_server_available: false
      }
    };

    for (const [manager, info] of Object.entries(defaultManagers)) {
      if (info) {
        this.managers.set(manager as PackageManager, info);
      }
    }
  }

  getManager(manager: PackageManager): PackageManagerInfo | undefined {
    return this.managers.get(manager);
  }

  getAllManagers(): PackageManagerInfo[] {
    return Array.from(this.managers.values())
      .sort((a, b) => a.priority - b.priority);
  }

  getAvailableManagers(): PackageManagerInfo[] {
    return this.getAllManagers()
      .filter(manager => manager.mcp_server_available);
  }

  getMCPServerConfig(manager: PackageManager): MCPServerConfig | undefined {
    return this.mcpServers.get(manager);
  }

  updateConnectionStatus(manager: PackageManager, status: 'connected' | 'disconnected' | 'error'): void {
    const mcpConfig = this.mcpServers.get(manager);
    if (mcpConfig) {
      mcpConfig.connection_status = status;
    }

    const managerInfo = this.managers.get(manager);
    if (managerInfo && managerInfo.mcp_server_config) {
      managerInfo.mcp_server_config.connection_status = status;
    }
  }

  isManagerAvailable(manager: PackageManager): boolean {
    const managerInfo = this.managers.get(manager);
    const mcpConfig = this.mcpServers.get(manager);
    
    return !!(managerInfo?.mcp_server_available && 
             mcpConfig?.connection_status === 'connected');
  }

  getManagersByPriority(): PackageManager[] {
    return this.getAllManagers()
      .sort((a, b) => a.priority - b.priority)
      .map(manager => manager.manager);
  }

  getSupportedTools(manager: PackageManager): string[] {
    const mcpConfig = this.mcpServers.get(manager);
    return mcpConfig?.tools || [];
  }

  hasToolSupport(manager: PackageManager, toolName: string): boolean {
    const supportedTools = this.getSupportedTools(manager);
    return supportedTools.includes(toolName);
  }

  getManagersWithToolSupport(toolName: string): PackageManager[] {
    return Array.from(this.mcpServers.entries())
      .filter(([_, config]) => config.tools.includes(toolName))
      .map(([manager, _]) => manager);
  }

  getManagerCount(): number {
    return this.managers.size;
  }

  getAvailableManagerCount(): number {
    return this.getAvailableManagers().length;
  }

  refresh(): Promise<void> {
    this.managers.clear();
    this.mcpServers.clear();
    return this.initialize();
  }
}