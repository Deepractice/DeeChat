/**
 * 测试动态工具发现功能
 */

const { StreamingXMLProcessor } = require('./dist/main/services/llm/managers/StreamingXMLProcessor.js');
const { MCPClient } = require('./dist/main/services/mcp/client/MCPClient.js');
const log = require('electron-log');

async function testToolDiscovery() {
  console.log('🧪 开始测试动态工具发现功能...');
  
  try {
    // 创建MCP客户端
    const mcpClient = new MCPClient();
    
    // 模拟连接服务器（在实际应用中，这些服务器会在ServiceManager中连接）
    console.log('📡 模拟MCP服务器连接...');
    
    // 创建StreamingXMLProcessor
    const processor = new StreamingXMLProcessor(
      (content) => console.log('✅ 清理内容:', content),
      undefined, // onStreamChunk
      mcpClient, // mcpClient
      'test-session'
    );
    
    // 获取工具注册表统计
    const stats = processor.getToolRegistryStats();
    console.log('📊 工具注册表统计:', stats);
    
    // 测试工具识别
    console.log('🔍 测试工具标签识别:');
    
    const testTags = [
      'promptx_learn',
      'promptx-builtin__learn', 
      'mcp_test',
      'unknown_tool'
    ];
    
    for (const tag of testTags) {
      const isToolTag = processor.isToolTag(tag);
      console.log(`  ${tag}: ${isToolTag ? '✅ 识别为工具' : '❌ 不是工具'}`);
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 运行测试
testToolDiscovery().then(() => {
  console.log('🎉 测试完成');
  process.exit(0);
}).catch(error => {
  console.error('💥 测试异常:', error);
  process.exit(1);
});