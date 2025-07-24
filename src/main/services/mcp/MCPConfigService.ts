/**
 * MCP配置服务
 * 管理MCP服务器配置的持久化存储
 */

import { MCPServerEntity, MCPServerConfig } from '../../../shared/entities/MCPServerEntity';
import { IMCPConfigService } from '../../../shared/interfaces/IMCPProvider';
import { LocalStorageService } from '../core/LocalStorageService';
import { PromptXLocalStorage } from './PromptXLocalStorage';
import { PromptXBuildStorage } from './PromptXBuildStorage';

export class MCPConfigService implements IMCPConfigService {
  private storageService: LocalStorageService;
  private readonly STORAGE_KEY = 'mcp_servers';
  private promptxLocalStorage: PromptXLocalStorage;
  private promptxBuildStorage: PromptXBuildStorage;

  constructor() {
    this.storageService = new LocalStorageService();
    this.promptxLocalStorage = new PromptXLocalStorage();
    this.promptxBuildStorage = new PromptXBuildStorage();
    // 异步初始化本地存储
    this.initializeLocalStorage();
  }

  /**
   * 初始化本地存储和静默更新
   */
  private async initializeLocalStorage(): Promise<void> {
    try {
      await this.promptxLocalStorage.initialize();
      console.log('✅ [MCP Config] PromptX本地存储初始化完成');
      
      // 启动静默更新检查
      this.promptxLocalStorage.checkAndUpdateSilently();
    } catch (error) {
      console.warn('⚠️ [MCP Config] PromptX本地存储初始化失败，将使用npx方式:', error);
    }
  }

  /**
   * 保存服务器配置
   */
  async saveServerConfig(server: MCPServerEntity): Promise<void> {
    console.log(`[MCP Config] 保存服务器配置: ${server.name}`);

    const servers = await this.getAllServerConfigs();
    const existingIndex = servers.findIndex(s => s.id === server.id);

    if (existingIndex >= 0) {
      // 更新现有配置
      servers[existingIndex] = server;
    } else {
      // 添加新配置
      servers.push(server);
    }

    await this.saveAllConfigs(servers);
  }

  /**
   * 删除服务器配置
   */
  async deleteServerConfig(serverId: string): Promise<void> {
    console.log(`[MCP Config] 删除服务器配置: ${serverId}`);

    const servers = await this.getAllServerConfigs();
    const filteredServers = servers.filter(s => s.id !== serverId);

    await this.saveAllConfigs(filteredServers);
  }

  /**
   * 获取所有服务器配置
   */
  async getAllServerConfigs(): Promise<MCPServerEntity[]> {
    try {
      const data = await this.storageService.get(this.STORAGE_KEY, []);

      if (!data || !Array.isArray(data)) {
        // 首次使用，初始化默认的PromptX插件
        const defaultServers = await this.initializeDefaultServers();
        return defaultServers;
      }

      const servers = data.map((config: MCPServerConfig) => {
        // 确保日期字段正确转换
        const configWithDates = {
          ...config,
          createdAt: new Date(config.createdAt),
          updatedAt: new Date(config.updatedAt)
        };
        return MCPServerEntity.fromData(configWithDates);
      });

      // 检查是否已有PromptX插件，如果没有则添加，如果有则更新为本地化配置
      const promptxIndex = servers.findIndex(s => s.id === 'promptx-builtin');
      const promptxServer = this.createDefaultPromptXServer();

      // 🔥 异步初始化PromptX本地配置
      try {
        await this.initializePromptXServerConfig(promptxServer);
      } catch (error) {
        console.error('[MCP Config] PromptX初始化失败，但继续加载其他服务:', error);
        // 不阻塞其他服务的加载
      }

      if (promptxIndex >= 0) {
        // 更新现有PromptX配置为本地化版本
        console.log(`[MCP Config] 🔄 更新PromptX插件为本地化配置`);
        servers[promptxIndex] = promptxServer;
        await this.saveAllConfigs(servers); // 保存更新后的配置
      } else {
        // 添加新的PromptX本地化配置
        console.log(`[MCP Config] ➕ 添加PromptX本地化插件配置`);
        servers.unshift(promptxServer); // 添加到开头
        await this.saveAllConfigs(servers); // 保存更新后的配置
      }

      return servers;
    } catch (error) {
      console.error('[MCP Config] 获取配置失败:', error);
      return [];
    }
  }

  /**
   * 获取服务器配置
   */
  async getServerConfig(serverId: string): Promise<MCPServerEntity | null> {
    const servers = await this.getAllServerConfigs();
    return servers.find(s => s.id === serverId) || null;
  }

  /**
   * 更新服务器配置
   */
  async updateServerConfig(serverId: string, updates: Partial<MCPServerEntity>): Promise<void> {
    console.log(`[MCP Config] 更新服务器配置: ${serverId}`);

    const server = await this.getServerConfig(serverId);
    if (!server) {
      throw new Error(`服务器配置不存在: ${serverId}`);
    }

    // 应用更新
    server.update(updates);

    // 保存更新后的配置
    await this.saveServerConfig(server);
  }

  /**
   * 导出配置
   */
  async exportConfigs(): Promise<string> {
    console.log('[MCP Config] 导出配置');

    const servers = await this.getAllServerConfigs();
    const exportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      servers: servers.map(s => s.toData())
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * 导入配置
   */
  async importConfigs(configData: string): Promise<void> {
    console.log('[MCP Config] 导入配置');

    try {
      const importData = JSON.parse(configData);
      
      if (!importData.servers || !Array.isArray(importData.servers)) {
        throw new Error('配置数据格式无效');
      }

      // 验证并转换配置
      const servers: MCPServerEntity[] = [];
      for (const serverData of importData.servers) {
        try {
          // 确保日期字段正确转换
          const configWithDates = {
            ...serverData,
            createdAt: new Date(serverData.createdAt),
            updatedAt: new Date(serverData.updatedAt)
          };
          
          const server = MCPServerEntity.fromData(configWithDates);
          
          // 验证配置
          const validation = server.validate();
          if (!validation.isValid) {
            console.warn(`[MCP Config] 跳过无效配置: ${server.name}`, validation.errors);
            continue;
          }
          
          servers.push(server);
        } catch (error) {
          console.warn(`[MCP Config] 跳过无效服务器配置:`, error);
        }
      }

      if (servers.length === 0) {
        throw new Error('没有有效的服务器配置可导入');
      }

      // 获取现有配置
      const existingServers = await this.getAllServerConfigs();
      
      // 合并配置（避免ID冲突）
      const mergedServers = [...existingServers];
      for (const newServer of servers) {
        const existingIndex = mergedServers.findIndex(s => s.id === newServer.id);
        if (existingIndex >= 0) {
          // 如果ID冲突，生成新ID
          const updatedServer = MCPServerEntity.create({
            name: newServer.name + ' (导入)',
            description: newServer.description,
            type: newServer.type,
            isEnabled: newServer.isEnabled,
            command: newServer.command,
            args: newServer.args,
            env: newServer.env,
            url: newServer.url,
            headers: newServer.headers,
            timeout: newServer.timeout,
            retryCount: newServer.retryCount
          });
          mergedServers.push(updatedServer);
        } else {
          mergedServers.push(newServer);
        }
      }

      await this.saveAllConfigs(mergedServers);
      console.log(`[MCP Config] 成功导入 ${servers.length} 个服务器配置`);
    } catch (error) {
      console.error('[MCP Config] 导入配置失败:', error);
      throw new Error(`配置导入失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取配置统计信息
   */
  async getConfigStats(): Promise<{
    totalServers: number;
    enabledServers: number;
    serversByType: Record<string, number>;
  }> {
    const servers = await this.getAllServerConfigs();
    
    const stats = {
      totalServers: servers.length,
      enabledServers: servers.filter(s => s.isEnabled).length,
      serversByType: {} as Record<string, number>
    };

    // 统计服务器类型
    for (const server of servers) {
      stats.serversByType[server.type] = (stats.serversByType[server.type] || 0) + 1;
    }

    return stats;
  }

  /**
   * 验证所有配置
   */
  async validateAllConfigs(): Promise<{
    validConfigs: number;
    invalidConfigs: Array<{ id: string; name: string; errors: string[] }>;
  }> {
    const servers = await this.getAllServerConfigs();
    const invalidConfigs: Array<{ id: string; name: string; errors: string[] }> = [];
    let validConfigs = 0;

    for (const server of servers) {
      const validation = server.validate();
      if (validation.isValid) {
        validConfigs++;
      } else {
        invalidConfigs.push({
          id: server.id,
          name: server.name,
          errors: validation.errors
        });
      }
    }

    return {
      validConfigs,
      invalidConfigs
    };
  }

  /**
   * 清理无效配置
   */
  async cleanupInvalidConfigs(): Promise<number> {
    console.log('[MCP Config] 清理无效配置');

    const servers = await this.getAllServerConfigs();
    const validServers = servers.filter(server => {
      const validation = server.validate();
      return validation.isValid;
    });

    const removedCount = servers.length - validServers.length;
    
    if (removedCount > 0) {
      await this.saveAllConfigs(validServers);
      console.log(`[MCP Config] 清理了 ${removedCount} 个无效配置`);
    }

    return removedCount;
  }

  /**
   * 保存所有配置到存储
   */
  private async saveAllConfigs(servers: MCPServerEntity[]): Promise<void> {
    const configData = servers.map(s => s.toData());
    await this.storageService.set(this.STORAGE_KEY, configData);
  }

  /**
   * 初始化默认服务器配置
   */
  private async initializeDefaultServers(): Promise<MCPServerEntity[]> {
    console.log('[MCP Config] 初始化默认PromptX本地化插件配置');

    const promptxServer = this.createDefaultPromptXServer();
    
    // 🔥 初始化PromptX本地配置
    try {
      await this.initializePromptXServerConfig(promptxServer);
    } catch (error) {
      console.error('[MCP Config] 默认PromptX初始化失败:', error);
      throw error; // 首次初始化失败应该抛出错误
    }

    const defaultServers = [promptxServer];

    // 保存默认配置
    await this.saveAllConfigs(defaultServers);

    return defaultServers;
  }

  /**
   * 创建默认的PromptX服务器配置（彻底本地化版本）
   */
  private createDefaultPromptXServer(): MCPServerEntity {
    const { app } = require('electron');
    const path = require('path');
    const fs = require('fs');

    // 🔥 创建PromptX专用工作空间
    const promptxWorkspace = path.join(app.getPath('userData'), 'promptx-workspace');

    console.log(`[MCP Config] 🔧 创建PromptX工作空间: ${promptxWorkspace}`);

    // 确保目录存在并设置权限
    try {
      if (!fs.existsSync(promptxWorkspace)) {
        fs.mkdirSync(promptxWorkspace, { recursive: true, mode: 0o755 });
        console.log(`[MCP Config] ✅ 工作空间目录已创建: ${promptxWorkspace}`);
      } else {
        console.log(`[MCP Config] ✅ 工作空间目录已存在: ${promptxWorkspace}`);
      }

      // 验证目录权限
      fs.accessSync(promptxWorkspace, fs.constants.R_OK | fs.constants.W_OK);
      console.log(`[MCP Config] ✅ 工作空间目录权限验证通过: ${promptxWorkspace}`);
    } catch (error) {
      console.error(`[MCP Config] ❌ 工作空间目录创建或权限验证失败: ${promptxWorkspace}`, error);
      throw error;
    }

    const now = new Date();
    
    // 🚀 创建彻底本地化的服务器配置
    const server = new MCPServerEntity({
      id: 'promptx-builtin',
      name: 'PromptX (内置)',
      description: 'PromptX AI专业能力增强框架 - 提供角色激活、记忆管理和专业工具',
      type: 'stdio',
      isEnabled: true,
      command: 'node', // 🔥 固定使用node，不再用npx
      args: ['placeholder'], // 🔥 占位符，将在初始化时更新
      workingDirectory: promptxWorkspace,
      env: {},
      timeout: 10000, // 🔥 本地启动，超时时间更短
      retryCount: 3, // 🔥 本地启动更稳定，减少重试次数
      createdAt: now,
      updatedAt: now
    });

    console.log(`[MCP Config] ✅ 创建PromptX服务器实体（彻底本地化），workingDirectory: ${server.workingDirectory}`);
    return server;
  }

  /**
   * 初始化PromptX服务器配置（优先使用构建时打包版本）
   */
  private async initializePromptXServerConfig(server: MCPServerEntity): Promise<void> {
    try {
      // 🚀 优先检查构建时打包版本
      const hasBuildVersion = await this.promptxBuildStorage.hasBuildVersion();
      
      if (hasBuildVersion) {
        console.log('⚡ [PromptX] 使用构建时打包版本（零延迟启动）');
        
        // 获取构建版本启动配置
        const buildConfig = await this.promptxBuildStorage.startFromBuild();
        
        // 更新服务器配置使用构建版本
        server.command = buildConfig.command;
        server.args = buildConfig.args;
        server.workingDirectory = buildConfig.workingDirectory;
        
        // 即使使用构建版本，也在后台检查更新（用于下次构建）
        this.promptxLocalStorage.checkAndUpdateSilently().catch(() => {
          // 静默处理更新失败
        });
        
      } else {
        console.log('🔄 [PromptX] 回退到运行时下载版本');
        
        // 回退到运行时下载版本
        await this.promptxLocalStorage.ensureLocalVersionAvailable();
        
        // 获取本地启动配置
        const localConfig = await this.promptxLocalStorage.startFromLocal();
        
        // 更新服务器配置使用本地版本
        server.command = localConfig.command;
        server.args = localConfig.args;
        server.workingDirectory = localConfig.workingDirectory;
        
        // 启动静默更新检查
        this.promptxLocalStorage.checkAndUpdateSilently().catch(() => {
          // 静默处理更新失败
        });
      }
      
    } catch (error) {
      console.error('❌ [MCP Config] PromptX初始化失败:', error);
      throw new Error(`PromptX初始化失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
