import { DatabaseService } from './DatabaseService';
import { SimplifiedMigrationService } from './SimplifiedMigrationService';

/**
 * 快速迁移测试 - 奥卡姆剃刀实现
 * 
 * 用于验证SQLite迁移功能的简单测试脚本
 */
export class QuickMigrationTest {
  private databaseService: DatabaseService;
  private migrationService: SimplifiedMigrationService;

  constructor() {
    this.databaseService = new DatabaseService();
    this.migrationService = new SimplifiedMigrationService(this.databaseService);
  }

  /**
   * 执行完整的迁移测试
   */
  async runTest(): Promise<void> {
    console.log('🚀 开始快速迁移测试...');

    try {
      // Step 1: 检查数据库健康状态
      console.log('1️⃣ 检查数据库健康状态...');
      const isHealthy = this.databaseService.healthCheck();
      console.log(`   数据库健康状态: ${isHealthy ? '✅ 正常' : '❌ 异常'}`);

      if (!isHealthy) {
        throw new Error('数据库健康检查失败');
      }

      // Step 2: 检查是否需要迁移
      console.log('2️⃣ 检查迁移需求...');
      const shouldMigrate = await this.migrationService.shouldMigrate();
      console.log(`   是否需要迁移: ${shouldMigrate ? '✅ 需要' : '⏭️ 跳过'}`);

      if (!shouldMigrate) {
        console.log('🎉 数据库已是最新状态，测试完成！');
        return;
      }

      // Step 3: 执行迁移
      console.log('3️⃣ 执行数据迁移...');
      const result = await this.migrationService.migrateToSQLite();
      
      if (result.success) {
        console.log('✅ 迁移成功完成！');
        console.log(`   - 迁移会话: ${result.migratedSessions} 个`);
        console.log(`   - 迁移配置: ${result.migratedConfigs} 个`);
        console.log(`   - 迁移偏好: ${result.migratedPreferences} 个`);
        console.log(`   - 备份路径: ${result.backupPath}`);
      } else {
        console.log('❌ 迁移失败！');
        console.log('   错误信息:', result.errors);
      }

      // Step 4: 验证迁移结果
      console.log('4️⃣ 验证迁移结果...');
      const stats = this.databaseService.getStats();
      console.log('   数据库统计:', {
        会话数量: stats.sessions_count,
        消息数量: stats.messages_count,
        配置数量: stats.configs_count,
        数据库大小: `${Math.round(stats.db_size / 1024)} KB`
      });

      console.log('🎉 快速迁移测试完成！');

    } catch (error: any) {
      console.error('❌ 测试失败:', error.message);
      throw error;
    }
  }

  /**
   * 清理测试数据
   */
  cleanup(): void {
    try {
      this.databaseService.close();
      console.log('🧹 测试清理完成');
    } catch (error: any) {
      console.warn('⚠️ 清理过程中出现警告:', error.message);
    }
  }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  const test = new QuickMigrationTest();
  
  test.runTest()
    .then(() => {
      console.log('✨ 所有测试通过！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 测试失败:', error);
      process.exit(1);
    })
    .finally(() => {
      test.cleanup();
    });
}