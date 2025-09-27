/**
 * 依赖注入重构迁移示例
 * 演示如何从旧的初始化方式迁移到新的依赖注入方式
 */

import {
  // 新的依赖注入方式
  AIConfigManager,
  BetterSQLite3Adapter,

  // 向后兼容方式
  initializeAIConfig,
} from '../src/index.js';

async function newWayExample() {
  console.log('\n=== 新的依赖注入方式 ===');

  // 1. 创建数据库适配器
  const dbAdapter = new BetterSQLite3Adapter('./test-new.db', {
    verbose: console.log
  });

  // 2. 注入到业务包中
  const aiConfigManager = new AIConfigManager({
    database: dbAdapter,
    tablePrefix: 'deechat_',
    autoMigrate: true
  });

  // 3. 初始化
  await aiConfigManager.initialize();

  // 4. 使用功能
  const config = await aiConfigManager.configs.create({
    name: 'My GPT Config',
    api_key: 'sk-test123',
    base_url: 'https://api.openai.com/v1',
    is_default: true,
    is_active: true
  });

  console.log('创建的配置:', config);

  // 5. 关闭连接
  aiConfigManager.close();
}

async function legacyWayExample() {
  console.log('\n=== 向后兼容方式（旧代码无需修改）===');

  // 旧的初始化方式仍然可以工作
  const manager = await initializeAIConfig('./test-legacy.db', {
    tablePrefix: 'legacy_',
    readonly: false
  });

  // 使用方式完全一样
  const config = await manager.configs.create({
    name: 'Legacy GPT Config',
    api_key: 'sk-legacy123',
    base_url: 'https://api.openai.com/v1',
    is_default: true,
    is_active: true
  });

  console.log('传统方式创建的配置:', config);

  manager.close();
}

async function testExample() {
  console.log('\n=== 测试环境使用 Mock 数据库 ===');

  // 在测试环境中，你可以注入 Mock 数据库
  class MockDatabaseAdapter {
    private _isConnected = false;
    private mockData = new Map();

    async connect() {
      this._isConnected = true;
    }

    async close() {
      this._isConnected = false;
    }

    isConnected() {
      return this._isConnected;
    }

    exec() {
      // Mock implementation
    }

    prepare(sql: string) {
      return {
        run: (...params: any[]) => ({ changes: 1, lastInsertRowid: 1 }),
        get: (...params: any[]) => this.mockData.get('test') || null,
        all: (...params: any[]) => [],
        finalize: () => {}
      };
    }

    transaction<T>(fn: () => T): T {
      return fn();
    }

    run() { return { changes: 1, lastInsertRowid: 1 }; }
    get() { return null; }
    all() { return []; }

    pragma() {}
    checkpoint() {}
  }

  const mockAdapter = new MockDatabaseAdapter() as any;
  const manager = new AIConfigManager({
    database: mockAdapter
  });

  await manager.initialize();
  console.log('Mock 数据库管理器初始化成功');
  manager.close();
}

async function main() {
  try {
    await newWayExample();
    await legacyWayExample();
    await testExample();

    console.log('\n✅ 所有示例运行成功！依赖注入重构完成。');
  } catch (error) {
    console.error('❌ 示例运行失败:', error);
  }
}

// 运行示例
main().catch(console.error);