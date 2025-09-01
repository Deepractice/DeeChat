/**
 * 实时日志监控脚本
 * 监控DeeChat应用的输出
 */

const { spawn } = require('child_process');
const fs = require('fs');

console.log('🔍 [日志监控] 开始监控DeeChat应用日志\n');

// 监控关键词
const keywords = [
  'CoreLLM-DEBUG',
  'SmartLayered-DEBUG', 
  'ToolIntegration-DEBUG',
  'MCPToolConverter-DEBUG',
  '系统提示词调试',
  'MCP error',
  'parameter validation',
  '参数验证失败',
  '工具调用'
];

console.log('🎯 监控关键词：', keywords);
console.log('=' .repeat(80));

// 方法1：监控npm log文件
const logFile = '/Users/macmima1234/.npm/_logs/2025-08-26T03_56_37_850Z-debug-0.log';
if (fs.existsSync(logFile)) {
  console.log('📄 发现npm日志文件，开始监控...');
  const tail = spawn('tail', ['-f', logFile]);
  
  tail.stdout.on('data', (data) => {
    const content = data.toString();
    const lines = content.split('\n');
    
    lines.forEach(line => {
      if (keywords.some(keyword => line.includes(keyword))) {
        console.log(`🔍 [匹配] ${line}`);
      }
    });
  });
  
  tail.on('error', (error) => {
    console.log('❌ tail命令错误:', error.message);
  });
} else {
  console.log('❌ 未找到npm日志文件');
}

// 方法2：监控进程输出
console.log('\n📡 同时监控进程输出...');

// 检查是否有console输出
setTimeout(() => {
  console.log('\n💡 [提示] 如果看不到调试日志，请执行以下操作：');
  console.log('1. 在DeeChat中输入消息，例如 "学习PromptX文档"');
  console.log('2. 观察终端中是否出现以下日志：');
  console.log('   - 🔍 [CoreLLM-DEBUG] 获取到 X 个工具');
  console.log('   - 🔍 [SmartLayered-DEBUG] 适配后工具数量');
  console.log('   - 🚨 [MCPToolConverter-DEBUG] 字段处理');
  console.log('');
  console.log('3. 如果没有看到这些日志，说明：');
  console.log('   - 可能需要重新编译 (npm run build)');
  console.log('   - 或者日志被缓冲了');
  console.log('   - 或者消息没有触发AI工具调用');
}, 3000);

// 保持脚本运行
process.stdin.resume();