#!/usr/bin/env node

/**
 * MCP客户端连接和工具调用测试
 */

import { McpClient } from './dist/index.js';

async function testConnection() {
  console.log('🚀 MCP Client - 连接和工具调用测试');
  
  const client = new McpClient();
  
  try {
    // 初始化
    await client.initialize();
    console.log('✅ 客户端初始化成功');
    
    // 添加计算器服务器
    await client.addServer({
      id: 'calculator',
      name: 'Calculator Server',
      description: 'A simple calculator MCP server',
      transport: {
        type: 'stdio',
        command: 'node',
        args: ['examples/mock-calculator-server.js']
      },
      enabled: true,
      autoReconnect: true,
      timeout: 30000
    });
    console.log('✅ 添加计算器服务器');
    
    // 连接到服务器
    console.log('🔗 连接到计算器服务器...');
    await client.connect('calculator');
    console.log('✅ 连接成功');
    
    // 检查连接状态
    const isConnected = client.isConnected('calculator');
    console.log(`📊 连接状态: ${isConnected ? '已连接' : '未连接'}`);
    
    // 列出工具
    console.log('🛠️ 获取可用工具...');
    const tools = await client.listTools('calculator');
    console.log(`找到 ${tools.length} 个工具:`);
    tools.forEach(tool => {
      console.log(`   - ${tool.name}: ${tool.description || '无描述'}`);
    });
    
    // 调用工具
    if (tools.length > 0) {
      console.log('\\n🧮 测试工具调用...');
      
      // 测试加法
      const addResult = await client.callTool('calculator', 'add', { a: 15, b: 27 });
      console.log('计算结果:', addResult);
      
      // 测试乘法
      const multiplyResult = await client.callTool('calculator', 'multiply', { a: 6, b: 7 });
      console.log('计算结果:', multiplyResult);
    }
    
    console.log('\\n✅ 连接和工具调用测试完成');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    if (error.stack) {
      console.error('错误堆栈:', error.stack);
    }
  } finally {
    await client.dispose();
    console.log('✅ 客户端已清理');
  }
}

// 运行测试
testConnection().catch(console.error);