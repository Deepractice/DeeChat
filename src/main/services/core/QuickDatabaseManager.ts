import { MinimalDatabaseService } from './MinimalDatabaseService';

/**
 * 快速数据库管理器 - 奥卡姆剃刀实现
 * 最简洁的数据库集成方案
 */
export class QuickDatabaseManager {
  private databaseService: MinimalDatabaseService;
  private initialized = false;

  constructor() {
    this.databaseService = new MinimalDatabaseService();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    console.log('🚀 QuickDatabaseManager 初始化开始...');
    
    try {
      // 检查数据库健康状态
      const isHealthy = this.databaseService.healthCheck();
      if (!isHealthy) {
        throw new Error('数据库健康检查失败');
      }
      
      // 尝试简单的数据迁移（如果有数据的话）
      await this.trySimpleMigration();
      
      this.initialized = true;
      console.log('✅ QuickDatabaseManager 初始化完成');
      
      // 输出统计信息
      const stats = this.databaseService.getStats();
      console.log('📊 数据库统计:', stats);
      
    } catch (error: any) {
      console.error('❌ QuickDatabaseManager 初始化失败:', error.message);
      throw error;
    }
  }

  private async trySimpleMigration(): Promise<void> {
    const fs = require('fs');
    const path = require('path');
    const { app } = require('electron');
    
    try {
      // 检查是否有JSON数据需要迁移
      const sessionsPath = path.join(app.getPath('userData'), 'chat-sessions.json');
      const configPath = path.join(app.getPath('userData'), 'config.json');
      const configsPath = path.join(app.getPath('userData'), 'model-configs.json');
      
      const db = this.databaseService.getDatabase();
      
      // 迁移会话数据
      if (fs.existsSync(sessionsPath)) {
        const data = JSON.parse(fs.readFileSync(sessionsPath, 'utf-8'));
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO chat_sessions 
          (id, title, selected_model_id, created_at, updated_at) 
          VALUES (?, ?, ?, ?, ?)
        `);
        
        let count = 0;
        for (const session of data) {
          stmt.run(
            session.id,
            session.title,
            session.selectedModelId || null,
            new Date(session.createdAt).getTime(),
            new Date(session.updatedAt).getTime()
          );
          count++;
        }
        console.log(`✅ 迁移了 ${count} 个聊天会话`);
      }
      
      // 迁移配置数据
      if (fs.existsSync(configsPath)) {
        const data = JSON.parse(fs.readFileSync(configsPath, 'utf-8'));
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO model_configs 
          (id, name, provider, model, api_key, base_url, is_enabled, status, priority, created_at, updated_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        let count = 0;
        for (const config of data) {
          stmt.run(
            config.id,
            config.name,
            config.provider,
            config.model,
            config.apiKey || null,
            config.baseURL || null,
            config.isEnabled !== false,
            config.status || 'unknown',
            config.priority || 0,
            new Date(config.createdAt).getTime(),
            new Date(config.updatedAt).getTime()
          );
          count++;
        }
        console.log(`✅ 迁移了 ${count} 个模型配置`);
      }
      
      // 迁移应用配置数据
      if (fs.existsSync(configPath)) {
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO configs 
          (id, key, value, created_at, updated_at) 
          VALUES (?, ?, ?, ?, ?)
        `);
        
        const now = new Date().toISOString();
        const configId = `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        stmt.run(
          configId,
          'app_config',
          JSON.stringify(configData),
          now,
          now
        );
        console.log(`✅ 迁移了应用配置数据`);
      }
      
    } catch (error: any) {
      console.warn('⚠️ 数据迁移警告:', error.message);
      // 迁移失败不影响初始化
    }
  }

  healthCheck(): boolean {
    return this.databaseService.healthCheck();
  }

  getStats(): any {
    return this.databaseService.getStats();
  }

  close(): void {
    this.databaseService.close();
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // 获取数据库实例供其他服务使用
  getDatabase() {
    return this.databaseService.getDatabase();
  }

  // 获取数据库服务实例
  getDatabaseService(): MinimalDatabaseService {
    return this.databaseService;
  }
}