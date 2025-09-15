#!/usr/bin/env ts-node

/**
 * conversation-storage 包核心功能验证脚本
 */

import { join } from 'path';
import { tmpdir } from 'os';
import { rmSync, existsSync } from 'fs';
import { ConversationStorage } from '../src';

async function main() {
  console.log('🧪 conversation-storage 包核心功能验证');
  console.log('='.repeat(50));

  // 创建临时数据库
  const testDbPath = join(tmpdir(), `test-${Date.now()}.db`);
  console.log(`📁 测试数据库: ${testDbPath}`);

  const storage = new ConversationStorage({ dbPath: testDbPath });

  try {
    // 1. 初始化
    console.log('\n1️⃣ 初始化存储管理器...');
    await storage.initialize();
    console.log('✅ 初始化成功');

    // 2. 健康检查
    const health = storage.healthCheck();
    console.log(`✅ 健康状态: ${health.status}`);
    console.log(`✅ 管理的表: ${health.details.tables_managed.join(', ')}`);

    // 3. 创建会话
    console.log('\n2️⃣ 创建测试会话...');
    const session = await storage.createSession({
      title: '测试对话会话',
      ai_config_name: 'test-openai-config'
    });
    console.log(`✅ 会话创建成功: ${session.title} (ID: ${session.id})`);

    // 4. 保存消息
    console.log('\n3️⃣ 保存测试消息...');
    
    const userMessage = storage.saveMessage({
      session_id: session.id,
      role: 'user',
      content: 'Hello, this is a test message!'
    });
    console.log(`✅ 用户消息: ${userMessage.content}`);

    const assistantMessage = storage.saveMessage({
      session_id: session.id,
      role: 'assistant',
      content: 'Hello! I received your test message. How can I help you?',
      token_usage: {
        prompt_tokens: 10,
        completion_tokens: 15,
        total_tokens: 25
      }
    });
    console.log(`✅ AI回复: ${assistantMessage.content}`);
    console.log(`✅ Token使用: ${JSON.stringify(assistantMessage.token_usage)}`);

    // 5. 查询消息历史
    console.log('\n4️⃣ 查询消息历史...');
    const history = storage.getMessageHistory(session.id);
    console.log(`✅ 消息历史数量: ${history.length}`);
    history.forEach((msg, index) => {
      console.log(`   ${index + 1}. [${msg.role}] ${msg.content.substring(0, 50)}...`);
    });

    // 6. 验证会话更新
    console.log('\n5️⃣ 验证会话信息更新...');
    const updatedSession = storage.getSession(session.id);
    console.log(`✅ 会话消息计数: ${updatedSession?.message_count}`);

    // 7. 获取统计信息
    console.log('\n6️⃣ 获取统计信息...');
    const stats = await storage.getStats();
    console.log(`✅ 总会话数: ${stats.total_sessions}`);
    console.log(`✅ 总消息数: ${stats.total_messages}`);
    console.log(`✅ 消息角色分布:`, stats.messages_by_role);

    // 8. 更新会话
    console.log('\n7️⃣ 更新会话信息...');
    await storage.updateSession(session.id, {
      title: '更新后的测试会话',
      ai_config_name: 'updated-config'
    });
    
    const updatedSessionInfo = storage.getSession(session.id);
    console.log(`✅ 更新后标题: ${updatedSessionInfo?.title}`);
    console.log(`✅ 更新后配置: ${updatedSessionInfo?.ai_config_name}`);

    // 9. 测试查询功能
    console.log('\n8️⃣ 测试查询功能...');
    const recentMessages = storage.getRecentMessages(session.id, 2);
    console.log(`✅ 最近2条消息数量: ${recentMessages.length}`);

    const userMessages = storage.getMessageHistory(session.id, { role: 'user' });
    console.log(`✅ 用户消息数量: ${userMessages.length}`);

    // 10. 测试事务功能
    console.log('\n9️⃣ 测试事务功能...');
    const session2 = await storage.createSession({
      title: '事务测试会话',
      ai_config_name: 'transaction-test'
    });

    // 批量保存消息
    storage.saveMessage({
      session_id: session2.id,
      role: 'user',
      content: '事务测试消息1'
    });

    storage.saveMessage({
      session_id: session2.id,
      role: 'assistant',
      content: '事务测试消息2'
    });

    const session2Updated = storage.getSession(session2.id);
    console.log(`✅ 事务测试会话消息计数: ${session2Updated?.message_count}`);

    console.log('\n🎉 所有核心功能验证通过！');

  } catch (error) {
    console.error('❌ 验证过程中出错:', error);
    process.exit(1);
  } finally {
    // 清理
    storage.close();
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
      console.log('🗑️ 清理测试数据库');
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('✨ conversation-storage 包验证完成！');
}

// 运行验证
if (require.main === module) {
  main().catch(console.error);
}

export { main };