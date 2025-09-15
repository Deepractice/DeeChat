#!/usr/bin/env ts-node

/**
 * 统一数据库文件使用示例
 * 展示 ai-config 和 conversation-storage 共享同一个数据库文件
 */

import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync, existsSync, rmSync } from 'fs';

// 导入重构后的包
import { AIConfigManager } from '@deepracticex/ai-config';
import { ConversationStorage } from '@deepracticex/conversation-storage';

async function main() {
  console.log('🚀 统一数据库文件使用示例');
  console.log('='=repeat(50));

  // 1. 设置统一的数据库文件路径
  const DB_DIR = join(homedir(), '.deechat');
  const DB_PATH = join(DB_DIR, 'app.db');

  console.log(`📂 数据库目录: ${DB_DIR}`);
  console.log(`🗄️  数据库文件: ${DB_PATH}`);

  // 确保目录存在（由主应用负责，不是包的职责）
  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
    console.log('✅ 创建数据库目录');
  }

  // 为了演示清理旧的数据库
  if (existsSync(DB_PATH)) {
    rmSync(DB_PATH);
    console.log('🗑️  清理旧数据库文件');
  }

  try {
    // 2. 初始化各个包的存储管理器，使用同一个数据库文件
    console.log('\n📦 初始化存储管理器...');
    
    const aiConfig = new AIConfigManager({ 
      dbPath: DB_PATH,
      tablePrefix: '' // 不使用前缀，直接使用表名
    });
    
    const conversationStorage = new ConversationStorage({ 
      dbPath: DB_PATH,
      tablePrefix: '' // 不使用前缀，直接使用表名
    });

    // 3. 初始化（创建各自管理的表）
    await aiConfig.initialize();
    console.log('✅ AI配置管理器初始化完成 (管理: ai_configs, preferences 表)');
    
    await conversationStorage.initialize();
    console.log('✅ 对话存储管理器初始化完成 (管理: sessions, messages 表)');

    // 4. 验证数据库健康状态
    console.log('\n🔍 检查数据库健康状态...');
    const aiHealth = aiConfig.healthCheck();
    const convHealth = conversationStorage.healthCheck();
    
    console.log(`AI配置健康状态: ${aiHealth.status}`);
    console.log(`对话存储健康状态: ${convHealth.status}`);

    // 5. 演示AI配置管理
    console.log('\n🤖 演示AI配置管理...');
    
    const config = await aiConfig.configs.create({
      name: 'my-openai',
      api_key: 'sk-test-key-here',
      base_url: 'https://api.openai.com/v1',
      is_default: true
    });
    console.log(`✅ 创建AI配置: ${config.name} (ID: ${config.id})`);

    await aiConfig.preferences.set({
      key: 'default_temperature',
      value: 0.7,
      category: 'ai',
      description: '默认的AI温度参数'
    });
    console.log('✅ 设置偏好: default_temperature = 0.7');

    // 6. 演示对话存储管理
    console.log('\n💬 演示对话存储管理...');
    
    const session = await conversationStorage.createSession({
      title: '与ChatGPT的对话',
      ai_config_name: 'my-openai'
    });
    console.log(`✅ 创建会话: ${session.title} (ID: ${session.id})`);

    const userMessage = await conversationStorage.saveMessage({
      session_id: session.id,
      role: 'user',
      content: '你好，请介绍一下自己'
    });
    console.log(`✅ 保存用户消息: ${userMessage.content}`);

    const aiMessage = await conversationStorage.saveMessage({
      session_id: session.id,
      role: 'assistant',
      content: '我是ChatGPT，一个AI助手，很高兴为您服务！',
      token_usage: {
        prompt_tokens: 15,
        completion_tokens: 25,
        total_tokens: 40
      }
    });
    console.log(`✅ 保存AI回复: ${aiMessage.content}`);

    // 7. 查询数据验证
    console.log('\n📊 查询数据验证...');
    
    const allConfigs = aiConfig.configs.findAll();
    console.log(`🔧 AI配置数量: ${allConfigs.length}`);
    
    const temperature = aiConfig.preferences.get('default_temperature');
    console.log(`⚙️  默认温度: ${temperature}`);
    
    const allSessions = conversationStorage.getSessions();
    console.log(`💬 会话数量: ${allSessions.length}`);
    
    const messageHistory = conversationStorage.getMessageHistory(session.id);
    console.log(`📝 消息数量: ${messageHistory.length}`);

    // 8. 获取统计信息
    console.log('\n📈 统计信息...');
    
    const aiStats = await aiConfig.getStats();
    console.log(`AI配置统计:`, {
      总配置数: aiStats.total_configs,
      活跃配置数: aiStats.active_configs,
      偏好设置数: aiStats.total_preferences
    });
    
    const convStats = await conversationStorage.getStats();
    console.log(`对话统计:`, {
      总会话数: convStats.total_sessions,
      总消息数: convStats.total_messages,
      按角色分组: convStats.messages_by_role
    });

    // 9. 验证数据库文件中的表
    console.log('\n🗂️  验证数据库表结构...');
    
    // 通过AI配置管理器查询所有表
    const tables = aiConfig.getDatabase().all<{ name: string }>(`
      SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
    `);
    
    console.log('数据库中的表:');
    tables.forEach(table => {
      console.log(`  📋 ${table.name}`);
    });

    // 10. 展示跨包查询的可能性
    console.log('\n🔗 展示跨包数据关联...');
    
    // 通过会话的 ai_config_name 关联到实际的AI配置
    const sessionWithConfig = conversationStorage.getSessions()[0];
    const relatedConfig = aiConfig.configs.findByName(sessionWithConfig.ai_config_name);
    
    if (relatedConfig) {
      console.log(`会话 "${sessionWithConfig.title}" 使用配置 "${relatedConfig.name}"`);
      console.log(`配置详情: ${relatedConfig.base_url}`);
    }

    console.log('\n✨ 演示完成！');
    console.log(`💾 所有数据都存储在统一的数据库文件中: ${DB_PATH}`);

  } catch (error) {
    console.error('❌ 演示过程中出错:', error);
  }

  console.log('\n' + '='.repeat(50));
  console.log('🎉 统一数据库文件架构演示完成！');
}

// 运行演示
if (require.main === module) {
  main().catch(console.error);
}

export { main };