import { DatabaseService } from './DatabaseService';
import { app } from 'electron';
import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * 简化版数据迁移服务 - 奥卡姆剃刀实现
 * 
 * 设计原则：最简洁的迁移实现，直接读取JSON文件
 */
export class SimplifiedMigrationService {
  constructor(private databaseService: DatabaseService) {}

  /**
   * 执行简化迁移
   */
  async migrateToSQLite(): Promise<MigrationResult> {
    console.log('🔄 开始简化数据迁移：JSON → SQLite');
    
    const result: MigrationResult = {
      success: false,
      migratedSessions: 0,
      migratedMessages: 0,
      migratedConfigs: 0,
      migratedPreferences: 0,
      backupPath: '',
      errors: []
    };

    try {
      // Step 1: 创建备份
      result.backupPath = await this.createBackup();

      // Step 2: 在事务中执行迁移
      this.databaseService.transaction(() => {
        result.migratedSessions = this.migrateChatSessions();
        result.migratedConfigs = this.migrateModelConfigs();
        result.migratedPreferences = this.migrateUserPreferences();
      });

      result.success = true;
      console.log('✅ 简化迁移成功完成', result);

    } catch (error: any) {
      result.errors.push(error.message);
      console.error('❌ 简化迁移失败:', error);
    }

    return result;
  }

  private migrateChatSessions(): number {
    try {
      const filePath = path.join(app.getPath('userData'), 'chat-sessions.json');
      if (!require('fs').existsSync(filePath)) return 0;
      
      const data = require('fs').readFileSync(filePath, 'utf-8');
      const sessions = JSON.parse(data);
      
      const insertSession = this.databaseService.prepare(`
        INSERT OR REPLACE INTO chat_sessions 
        (id, title, selected_model_id, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?)
      `);

      let count = 0;
      for (const session of sessions) {
        insertSession.run(
          session.id,
          session.title,
          session.selectedModelId || null,
          new Date(session.createdAt).getTime(),
          new Date(session.updatedAt).getTime()
        );
        count++;
      }

      console.log(`✅ 迁移了 ${count} 个聊天会话`);
      return count;
    } catch (error: any) {
      console.warn('⚠️ 聊天会话迁移失败:', error);
      return 0;
    }
  }

  private migrateModelConfigs(): number {
    try {
      const filePath = path.join(app.getPath('userData'), 'model-configs.json');
      if (!require('fs').existsSync(filePath)) return 0;
      
      const data = require('fs').readFileSync(filePath, 'utf-8');
      const configs = JSON.parse(data);
      
      const insertConfig = this.databaseService.prepare(`
        INSERT OR REPLACE INTO model_configs 
        (id, name, provider, model, api_key, base_url, is_enabled, status, priority, 
         available_models, enabled_models, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      let count = 0;
      for (const config of configs) {
        insertConfig.run(
          config.id,
          config.name,
          config.provider,
          config.model,
          config.apiKey || null,
          config.baseURL || null,
          config.isEnabled !== false,
          config.status || 'unknown',
          config.priority || 0,
          JSON.stringify(config.availableModels || []),
          JSON.stringify(config.enabledModels || []),
          new Date(config.createdAt).getTime(),
          new Date(config.updatedAt).getTime()
        );
        count++;
      }

      console.log(`✅ 迁移了 ${count} 个模型配置`);
      return count;
    } catch (error: any) {
      console.warn('⚠️ 模型配置迁移失败:', error);
      return 0;
    }
  }

  private migrateUserPreferences(): number {
    try {
      const filePath = path.join(app.getPath('userData'), 'user-preferences.json');
      if (!require('fs').existsSync(filePath)) return 0;
      
      const data = require('fs').readFileSync(filePath, 'utf-8');
      const preferences = JSON.parse(data);
      
      const insertPreference = this.databaseService.prepare(`
        INSERT OR REPLACE INTO user_preferences (key, value, updated_at) 
        VALUES (?, ?, ?)
      `);

      const timestamp = Date.now();
      let count = 0;
      
      for (const [key, value] of Object.entries(preferences)) {
        insertPreference.run(key, JSON.stringify(value), timestamp);
        count++;
      }

      console.log(`✅ 迁移了 ${count} 个用户偏好设置`);
      return count;
    } catch (error: any) {
      console.warn('⚠️ 用户偏好迁移失败:', error);
      return 0;
    }
  }

  private async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(app.getPath('userData'), 'migration-backup');
    const backupPath = path.join(backupDir, `backup-${timestamp}`);

    await fs.mkdir(backupPath, { recursive: true });

    const filesToBackup = [
      'chat-sessions.json',
      'model-configs.json',
      'user-preferences.json'
    ];

    for (const fileName of filesToBackup) {
      const sourcePath = path.join(app.getPath('userData'), fileName);
      const targetPath = path.join(backupPath, fileName);
      
      try {
        await fs.copyFile(sourcePath, targetPath);
      } catch (error: any) {
        console.warn(`备份文件失败 ${fileName}:`, error.message);
      }
    }

    return backupPath;
  }

  async shouldMigrate(): Promise<boolean> {
    const stats = this.databaseService.getStats();
    const sessionsPath = path.join(app.getPath('userData'), 'chat-sessions.json');
    const configsPath = path.join(app.getPath('userData'), 'model-configs.json');
    
    const hasJsonFiles = require('fs').existsSync(sessionsPath) || require('fs').existsSync(configsPath);
    
    return stats.sessions_count === 0 && hasJsonFiles;
  }
}

export interface MigrationResult {
  success: boolean;
  migratedSessions: number;
  migratedMessages: number;
  migratedConfigs: number;
  migratedPreferences: number;
  backupPath: string;
  errors: string[];
}