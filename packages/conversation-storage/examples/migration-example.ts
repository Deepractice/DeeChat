/**
 * 依赖注入重构迁移示例
 * 演示如何从旧的初始化方式迁移到新的依赖注入方式
 */

import {
  // 新的依赖注入方式
  ConversationStorage,
  BetterSQLite3Adapter,

  // 向后兼容方式
  initializeConversationStorage,
} from '../src/index.js';

async function newWayExample() {
  console.log('\n=== 新的依赖注入方式 ===');

  // 1. 创建数据库适配器
  const dbAdapter = new BetterSQLite3Adapter('./test-conversation-new.db', {
    verbose: console.log
  });

  // 2. 注入到业务包中
  const conversationStorage = new ConversationStorage({
    database: dbAdapter,
    tablePrefix: 'deechat_',
    autoMigrate: true
  });

  // 3. 初始化
  await conversationStorage.initialize();

  // 4. 使用功能
  const session = await conversationStorage.createSession({
    title: '测试会话',
    ai_config_name: 'gpt-4'
  });

  console.log('创建的会话:', session);

  // 保存消息
  const message = conversationStorage.saveMessage({
    session_id: session.id,
    role: 'user',
    content: '你好，世界！'
  });

  console.log('保存的消息:', message);

  // 获取消息历史
  const history = conversationStorage.getMessageHistory(session.id);
  console.log('消息历史:', history);

  // 5. 关闭连接
  conversationStorage.close();
}

async function legacyWayExample() {
  console.log('\n=== 向后兼容方式（旧代码无需修改）===');

  // 旧的初始化方式仍然可以工作
  const storage = await initializeConversationStorage('./test-conversation-legacy.db', {
    tablePrefix: 'legacy_',
    readonly: false
  });

  // 使用方式完全一样
  const session = await storage.createSession({
    title: '传统方式会话',
    ai_config_name: 'gpt-3.5-turbo'
  });

  console.log('传统方式创建的会话:', session);

  // 保存消息
  const message = storage.saveMessage({
    session_id: session.id,
    role: 'assistant',
    content: '你好！我是AI助手。',
    token_usage: {
      prompt_tokens: 10,
      completion_tokens: 8,
      total_tokens: 18
    }
  });

  console.log('传统方式保存的消息:', message);

  storage.close();
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
  const storage = new ConversationStorage({
    database: mockAdapter
  });

  await storage.initialize();
  console.log('Mock 数据库对话存储初始化成功');
  storage.close();
}

async function statsExample() {
  console.log('\n=== 统计功能示例 ===');

  const dbAdapter = new BetterSQLite3Adapter('./test-conversation-stats.db');
  const storage = new ConversationStorage({
    database: dbAdapter
  });

  await storage.initialize();

  // 创建多个会话和消息
  const session1 = await storage.createSession({
    title: '会话1',
    ai_config_name: 'gpt-4'
  });

  const session2 = await storage.createSession({
    title: '会话2',
    ai_config_name: 'gpt-3.5-turbo'
  });

  // 添加消息
  storage.saveMessage({
    session_id: session1.id,
    role: 'user',
    content: '用户消息1'
  });

  storage.saveMessage({
    session_id: session1.id,
    role: 'assistant',
    content: 'AI回复1'
  });

  storage.saveMessage({
    session_id: session2.id,
    role: 'system',
    content: '系统消息'
  });

  // 获取统计信息
  const stats = await storage.getStats();
  console.log('统计信息:', stats);

  // 健康检查
  const health = storage.healthCheck();
  console.log('健康状态:', health);

  storage.close();
}

async function main() {
  try {
    await newWayExample();
    await legacyWayExample();
    await testExample();
    await statsExample();

    console.log('\n✅ 所有示例运行成功！ConversationStorage 依赖注入重构完成。');
  } catch (error) {
    console.error('❌ 示例运行失败:', error);
  }
}

// 运行示例
main().catch(console.error);