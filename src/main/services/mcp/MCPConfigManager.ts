/**
 * MCP配置管理器
 * 负责配置的加载、保存、验证和迁移
 */

import { 
  MCPServerConfig, 
  createDefaultConfig, 
  validateConfig, 
  mergeConfig,
  migrateConfig,
  inferExecutionMode
} from '../../../shared/entities/MCPServerConfigV2';
import { MCPServerCollection } from '../../../shared/types/mcp-protocol';
import { MCPTransportFactory } from './transports/MCPTransportFactory';
import log from 'electron-log';
import * as fs from 'fs-extra';
import * as path from 'path';
import { app } from 'electron';

/**
 * 配置存储路径
 */
interface ConfigPaths {
  system: string;    // 系统配置目录
  project: string;   // 项目配置目录
  user: string;      // 用户配置目录
}

/**
 * 配置变更事件
 */
export interface ConfigChangeEvent {
  type: 'add' | 'update' | 'remove';
  config: MCPServerConfig;
  collection: MCPServerCollection;
}

/**
 * MCP配置管理器
 * 提供配置的统一管理接口
 */
export class MCPConfigManager {
  private configs = new Map<string, MCPServerConfig>();
  private configPaths: ConfigPaths;
  private changeListeners = new Set<(event: ConfigChangeEvent) => void>();
  private initialized = false;
  
  constructor(projectPath?: string) {
    // 初始化配置路径
    this.configPaths = {
      system: path.join(app.getPath('userData'), 'mcp', 'system'),
      project: projectPath ? path.join(projectPath, '.deechat', 'mcp') : '',
      user: path.join(app.getPath('userData'), 'mcp', 'servers')
    };
  }
  
  /**
   * 初始化配置管理器
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    log.info('[MCPConfigManager] 初始化配置管理器');
    
    // 确保目录存在
    await this.ensureDirectories();
    
    // 加载所有配置
    await this.loadAllConfigs();
    
    // 迁移旧配置
    await this.migrateOldConfigs();
    
    this.initialized = true;
    log.info(`[MCPConfigManager] 初始化完成，已加载 ${this.configs.size} 个配置`);
  }
  
  /**
   * 获取所有配置
   */
  getAllConfigs(): MCPServerConfig[] {
    return Array.from(this.configs.values());
  }
  
  /**
   * 按集合获取配置
   */
  getConfigsByCollection(collection: MCPServerCollection): MCPServerConfig[] {
    return this.getAllConfigs().filter(config => config.collection === collection);
  }
  
  /**
   * 获取单个配置
   */
  getConfig(id: string): MCPServerConfig | undefined {
    return this.configs.get(id);
  }
  
  /**
   * 添加配置
   */
  async addConfig(config: Partial<MCPServerConfig>): Promise<MCPServerConfig> {
    // 创建完整配置
    const fullConfig = createDefaultConfig(config);
    
    // 验证配置
    const errors = validateConfig(fullConfig);
    if (errors.length > 0) {
      throw new Error(`配置验证失败: ${errors.map(e => e.message).join(', ')}`);
    }
    
    // 检查名称重复
    const existing = this.findConfigByName(fullConfig.name, fullConfig.collection!);
    if (existing) {
      throw new Error(`配置名称已存在: ${fullConfig.name}`);
    }
    
    // 推断执行模式
    if (!fullConfig.execution) {
      fullConfig.execution = inferExecutionMode(fullConfig);
    }
    
    // 自动检测协议类型
    if (!fullConfig.type && fullConfig.url) {
      const detectedType = MCPTransportFactory.detectProtocolType(fullConfig.url);
      if (detectedType) {
        fullConfig.type = detectedType;
        log.info(`[MCPConfigManager] 自动检测协议类型: ${detectedType}`);
      }
    }
    
    // 保存配置
    await this.saveConfig(fullConfig);
    
    // 添加到内存
    this.configs.set(fullConfig.id, fullConfig);
    
    // 触发事件
    this.emitChange({ type: 'add', config: fullConfig, collection: fullConfig.collection! });
    
    log.info(`[MCPConfigManager] 添加配置: ${fullConfig.name} (${fullConfig.id})`);
    return fullConfig;
  }
  
  /**
   * 更新配置
   */
  async updateConfig(id: string, updates: Partial<MCPServerConfig>): Promise<MCPServerConfig> {
    const existing = this.configs.get(id);
    if (!existing) {
      throw new Error(`配置不存在: ${id}`);
    }
    
    // 合并配置
    const updated = mergeConfig(existing, updates);
    
    // 验证配置
    const errors = validateConfig(updated);
    if (errors.length > 0) {
      throw new Error(`配置验证失败: ${errors.map(e => e.message).join(', ')}`);
    }
    
    // 检查名称重复（如果名称改变）
    if (updates.name && updates.name !== existing.name) {
      const duplicate = this.findConfigByName(updated.name, updated.collection!);
      if (duplicate && duplicate.id !== id) {
        throw new Error(`配置名称已存在: ${updated.name}`);
      }
    }
    
    // 保存配置
    await this.saveConfig(updated);
    
    // 更新内存
    this.configs.set(id, updated);
    
    // 触发事件
    this.emitChange({ type: 'update', config: updated, collection: updated.collection! });
    
    log.info(`[MCPConfigManager] 更新配置: ${updated.name} (${id})`);
    return updated;
  }
  
  /**
   * 删除配置
   */
  async removeConfig(id: string): Promise<void> {
    const config = this.configs.get(id);
    if (!config) {
      throw new Error(`配置不存在: ${id}`);
    }
    
    // 系统配置不能删除
    if (config.collection === 'system') {
      throw new Error('系统配置不能删除');
    }
    
    // 删除文件
    const filePath = this.getConfigFilePath(config);
    await fs.remove(filePath);
    
    // 从内存删除
    this.configs.delete(id);
    
    // 触发事件
    this.emitChange({ type: 'remove', config, collection: config.collection! });
    
    log.info(`[MCPConfigManager] 删除配置: ${config.name} (${id})`);
  }
  
  /**
   * 导入配置
   */
  async importConfig(configData: any, collection: MCPServerCollection = 'user'): Promise<MCPServerConfig> {
    // 迁移旧格式
    const migrated = migrateConfig(configData);
    
    // 设置集合
    migrated.collection = collection;
    migrated.source = 'imported';
    
    // 添加配置
    return this.addConfig(migrated);
  }
  
  /**
   * 导出配置
   */
  async exportConfig(id: string): Promise<string> {
    const config = this.configs.get(id);
    if (!config) {
      throw new Error(`配置不存在: ${id}`);
    }
    
    // 清理运行时信息
    const exportData = { ...config };
    delete exportData.runtime;
    
    return JSON.stringify(exportData, null, 2);
  }
  
  /**
   * 批量导入配置
   */
  async importConfigs(filePath: string): Promise<MCPServerConfig[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    const configs: MCPServerConfig[] = [];
    const items = Array.isArray(data) ? data : [data];
    
    for (const item of items) {
      try {
        const config = await this.importConfig(item);
        configs.push(config);
      } catch (error) {
        log.error('[MCPConfigManager] 导入配置失败:', error);
      }
    }
    
    return configs;
  }
  
  /**
   * 搜索配置
   */
  searchConfigs(query: string): MCPServerConfig[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllConfigs().filter(config => 
      config.name.toLowerCase().includes(lowerQuery) ||
      config.description?.toLowerCase().includes(lowerQuery) ||
      config.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }
  
  /**
   * 监听配置变更
   */
  onChange(listener: (event: ConfigChangeEvent) => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }
  
  /**
   * 重新加载配置
   */
  async reload(): Promise<void> {
    log.info('[MCPConfigManager] 重新加载配置');
    this.configs.clear();
    await this.loadAllConfigs();
  }
  
  /**
   * 清理无效配置
   */
  async cleanup(): Promise<number> {
    const invalid: string[] = [];
    
    for (const [id, config] of this.configs) {
      const errors = validateConfig(config);
      if (errors.length > 0) {
        log.warn(`[MCPConfigManager] 发现无效配置: ${config.name}`, errors);
        invalid.push(id);
      }
    }
    
    for (const id of invalid) {
      await this.removeConfig(id);
    }
    
    log.info(`[MCPConfigManager] 清理了 ${invalid.length} 个无效配置`);
    return invalid.length;
  }
  
  private async ensureDirectories(): Promise<void> {
    await fs.ensureDir(this.configPaths.system);
    await fs.ensureDir(this.configPaths.user);
    if (this.configPaths.project) {
      await fs.ensureDir(this.configPaths.project);
    }
  }
  
  private async loadAllConfigs(): Promise<void> {
    // 加载系统配置
    await this.loadConfigsFromDirectory(this.configPaths.system, 'system');
    
    // 加载项目配置
    if (this.configPaths.project) {
      await this.loadConfigsFromDirectory(this.configPaths.project, 'project');
    }
    
    // 加载用户配置
    await this.loadConfigsFromDirectory(this.configPaths.user, 'user');
  }
  
  private async loadConfigsFromDirectory(dir: string, collection: MCPServerCollection): Promise<void> {
    if (!await fs.pathExists(dir)) return;
    
    const files = await fs.readdir(dir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    for (const file of jsonFiles) {
      try {
        const filePath = path.join(dir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const config = JSON.parse(content);
        
        // 确保集合正确
        config.collection = collection;
        
        // 验证并添加
        const errors = validateConfig(config);
        if (errors.length === 0) {
          this.configs.set(config.id, config);
        } else {
          log.warn(`[MCPConfigManager] 跳过无效配置: ${file}`, errors);
        }
      } catch (error) {
        log.error(`[MCPConfigManager] 加载配置失败: ${file}`, error);
      }
    }
  }
  
  private async saveConfig(config: MCPServerConfig): Promise<void> {
    const filePath = this.getConfigFilePath(config);
    const dir = path.dirname(filePath);
    
    await fs.ensureDir(dir);
    await fs.writeFile(filePath, JSON.stringify(config, null, 2));
  }
  
  private getConfigFilePath(config: MCPServerConfig): string {
    const basePath = this.getCollectionPath(config.collection!);
    return path.join(basePath, `${config.id}.json`);
  }
  
  private getCollectionPath(collection: MCPServerCollection): string {
    switch (collection) {
      case 'system':
        return this.configPaths.system;
      case 'project':
        if (!this.configPaths.project) {
          throw new Error('项目路径未设置');
        }
        return this.configPaths.project;
      case 'user':
        return this.configPaths.user;
    }
  }
  
  private findConfigByName(name: string, collection: MCPServerCollection): MCPServerConfig | undefined {
    return this.getAllConfigs().find(
      config => config.name === name && config.collection === collection
    );
  }
  
  private emitChange(event: ConfigChangeEvent): void {
    this.changeListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        log.error('[MCPConfigManager] 事件监听器错误:', error);
      }
    });
  }
  
  private async migrateOldConfigs(): Promise<void> {
    // 检查旧配置文件位置
    const oldConfigPath = path.join(app.getPath('userData'), 'mcp-servers.json');
    
    if (await fs.pathExists(oldConfigPath)) {
      log.info('[MCPConfigManager] 发现旧配置文件，开始迁移');
      
      try {
        const oldData = await fs.readJson(oldConfigPath);
        const servers = Array.isArray(oldData) ? oldData : oldData.servers || [];
        
        for (const server of servers) {
          try {
            await this.importConfig(server, 'user');
          } catch (error) {
            log.error('[MCPConfigManager] 迁移配置失败:', error);
          }
        }
        
        // 备份旧文件
        await fs.move(oldConfigPath, `${oldConfigPath}.backup`, { overwrite: true });
        log.info('[MCPConfigManager] 配置迁移完成');
        
      } catch (error) {
        log.error('[MCPConfigManager] 读取旧配置失败:', error);
      }
    }
  }
}