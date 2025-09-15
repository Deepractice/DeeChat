#!/usr/bin/env node

/**
 * 简单的MCP客户端测试
 */

import { McpClient } from './dist/index.js';

async function testBasic() {
  console.log('🚀 MCP Client - 基本测试');
  
  const client = new McpClient();
  
  try {
    // 初始化客户端
    await client.initialize();
    console.log('✅ 客户端初始化成功');
    
    // 添加服务器配置
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
      timeout: 30000,
      tags: ['math', 'tools']
    });
    console.log('✅ 添加服务器配置成功');
    
    // 列出服务器
    const servers = client.listServers();
    console.log(`📋 配置了 ${servers.length} 个服务器:`);
    servers.forEach(server => {
      console.log(`   - ${server.id}: ${server.name}`);
    });
    
    console.log('✅ 基本测试完成');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await client.dispose();
    console.log('✅ 客户端已清理');
  }
}

// 运行测试
testBasic().catch(console.error);