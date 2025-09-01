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
      
      // 数据库已直接使用SQLite，无需迁移
      
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