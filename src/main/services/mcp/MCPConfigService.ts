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
  // private isUpdatingPromptXConfig: boolean = false; // 🔥 防止递归更新标志 - 暂时未使用

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
        console.log('[MCP Config] 首次使用，初始化默认配置...');
        const defaultServers = await this.initializeDefaultServers();
        return defaultServers;
      }

      const servers = data.map((config: MCPServerConfig) => {
        try {
          // 🔥 安全的日期转换，处理字符串和Date对象
          const safeCreateDate = (dateValue: any): Date => {
            if (dateValue instanceof Date) return dateValue;
            if (typeof dateValue === 'string' || typeof dateValue === 'number') {
              const parsed = new Date(dateValue);
              return isNaN(parsed.getTime()) ? new Date() : parsed;
            }
            return new Date(); // 回退到当前时间
          };

          const configWithDates = {
            ...config,
            createdAt: safeCreateDate(config.createdAt),
            updatedAt: safeCreateDate(config.updatedAt)
          };
          return MCPServerEntity.fromData(configWithDates);
        } catch (error) {
          console.error('[MCP Config] 服务器配置转换失败:', error, config);
          // 创建一个基本的fallback配置
          return MCPServerEntity.fromData({
            ...config,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      });

      // 🔥 只在真正首次运行时初始化PromptX配置
      if (!MCPConfigService._promptxInitialized) {
        const promptxExists = servers.some(s => s.id === 'promptx-builtin');
        
        if (!promptxExists) {
          console.log(`[MCP Config] ➕ 首次运行，添加PromptX默认配置`);
          
          try {
            const promptxServer = this.createDefaultPromptXServer();
            await this.initializePromptXServerConfig(promptxServer);
            
            servers.unshift(promptxServer); // 添加到开头
            await this.saveAllConfigs(servers);
            
            console.log('✅ [MCP Config] PromptX配置添加成功');
          } catch (error) {
            console.error('[MCP Config] PromptX配置添加失败:', error);
          }
        } else {
          console.log('[MCP Config] PromptX配置已存在，跳过初始化');
        }
        
        // 🔥 标记为已初始化，防止后续重复检查
        MCPConfigService._promptxInitialized = true;
      }

      return servers;
    } catch (error) {
      console.error('[MCP Config] 获取配置失败:', error);
      return [];
    }
  }

  // 🔒 静态标志防止重复初始化PromptX
  private static _promptxInitialized = false

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
   * 创建默认的PromptX服务器配置（沙箱版本）
   */
  private createDefaultPromptXServer(): MCPServerEntity {
    const now = new Date();
    
    // 🔥 动态获取PromptX工作目录和脚本路径 - 跨平台支持
    const path = require('path');
    const fs = require('fs');
    
    // 🔥 动态获取PromptX脚本路径
    const isDev = process.env.NODE_ENV === 'development';
    
    // 🔥 使用DeeChat项目根目录作为PromptX工作目录，确保项目上下文正确
    const deechatProjectPath = isDev 
      ? path.resolve(__dirname, '../../../..') // 开发环境：从dist/main/main/services/mcp回到项目根目录
      : process.cwd(); // 生产环境：使用当前工作目录
    
    const promptxWorkspace = deechatProjectPath;
    
    console.log(`[MCP Config] 🎯 PromptX工作目录设为DeeChat项目根目录: ${promptxWorkspace}`);
    
    // 确保.promptx目录存在
    const promptxConfigDir = path.join(promptxWorkspace, '.promptx');
    if (!fs.existsSync(promptxConfigDir)) {
      fs.mkdirSync(promptxConfigDir, { recursive: true });
      console.log(`[MCP Config] 📁 创建PromptX配置目录: ${promptxConfigDir}`);
    }
    let promptxScriptPath: string;
    
    if (isDev) {
      // 开发环境：从编译后的dist目录回到项目根目录
      // __dirname 是 dist/main/main/services/mcp，需要回到项目根目录
      promptxScriptPath = path.resolve(__dirname, '../../../../../resources/promptx/package/src/bin/promptx.js');
    } else {
      // 生产环境：使用打包后的资源
      promptxScriptPath = path.join(process.resourcesPath, 'resources/promptx/package/src/bin/promptx.js');
    }
    
    // 🚀 使用标准MCP配置，进程内运行提供最佳性能
    const server = new MCPServerEntity({
      id: 'promptx-builtin',
      name: 'PromptX (内置)',
      description: 'PromptX AI专业能力增强框架 - 进程内运行，基于官方MCP SDK',
      type: 'stdio',
      isEnabled: true,
      command: 'node', // 用户看到的是标准node命令
      args: [promptxScriptPath, 'mcp-server'], // 🔥 动态的PromptX启动参数
      workingDirectory: promptxWorkspace, // 🔥 在DeeChat项目根目录运行
      env: {
        PROMPTX_PROJECT_PATH: promptxWorkspace, // 🎯 显式指定项目路径
        PROMPTX_FORCE_PROJECT: 'true', // 🎯 强制使用指定项目路径
        MCP_MODE: 'deechat-integration' // 🎯 标识DeeChat集成模式
      },
      timeout: 10000, // 进程内启动更快
      retryCount: 2,
      createdAt: now,
      updatedAt: now
    });

    console.log(`[MCP Config] ✅ 创建PromptX进程内服务器配置:`);
    console.log(`[MCP Config]   - 脚本路径: ${promptxScriptPath}`);
    console.log(`[MCP Config]   - 工作目录: ${promptxWorkspace}`);
    return server;
  }

  /**
   * 初始化PromptX服务器配置（优先传统模式，沙箱将在运行时自动检测）
   */
  private async initializePromptXServerConfig(server: MCPServerEntity): Promise<void> {
    try {
      console.log('🚀 [PromptX] 初始化PromptX服务配置...');
      
      // 直接使用传统模式配置，让MCPTransportAdapter在运行时决定是否使用沙箱
      await this.fallbackToTraditionalPromptX(server);
      
      console.log('✅ [PromptX] 配置初始化完成，运行时将自动选择最佳执行方式');
      
    } catch (error) {
      console.error('❌ [MCP Config] PromptX配置初始化失败:', error);
      throw new Error(`PromptX配置初始化失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 回退到传统PromptX启动方式
   */
  private async fallbackToTraditionalPromptX(server: MCPServerEntity): Promise<void> {
    // 🚀 优先检查构建时打包版本
    const hasBuildVersion = await this.promptxBuildStorage.hasBuildVersion();
    
    if (hasBuildVersion) {
      console.log('⚡ [PromptX] 回退：使用构建时打包版本');
      
      // 获取构建版本启动配置
      const buildConfig = await this.promptxBuildStorage.startFromBuild();
      
      // 更新服务器配置使用构建版本
      server.command = buildConfig.command;
      server.args = buildConfig.args;
      // 🔥 保留动态设置的用户数据目录，不使用buildConfig的工作目录
      
    } else {
      console.log('🔄 [PromptX] 回退：使用运行时下载版本');
      
      try {
        // 回退到运行时下载版本
        await this.promptxLocalStorage.ensureLocalVersionAvailable();
        
        // 获取本地启动配置
        const localConfig = await this.promptxLocalStorage.startFromLocal();
        
        // 更新服务器配置使用本地版本
        server.command = localConfig.command;
        server.args = localConfig.args;
        // 🔥 保留动态设置的用户数据目录，不使用localConfig的工作目录
        
      } catch (error) {
        console.warn('⚠️ [PromptX] 本地版本不可用，使用当前JSON配置');
        
        // 🔥 直接使用当前JSON配置中的参数（已经是完整路径）
        // 不做任何修改，保持现有的JSON配置
        console.log(`[PromptX] 使用现有配置: ${server.command} ${server.args?.join(' ')}`);
      }
    }
  }
}
