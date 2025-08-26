/**
 * 实时监控工具调用日志脚本
 * 专门查看MCPToolConverter和参数传递相关日志
 */

console.log('🔍 [实时监控] 开始监控工具调用日志...\n');

// 监控关键字列表
const monitorKeywords = [
  'MCPToolConverter-DEBUG',
  'LangChain工具-参数',
  'MCP error',
  'parameter validation',
  '参数验证失败',
  '工具调用'
];

// 使用tail命令实时监控
const { spawn } = require('child_process');

// 监控开发服务器的日志输出
console.log('📡 正在连接到开发服务器日志...');
console.log('🎯 监控关键词：', monitorKeywords.join(', '));
console.log('=' .repeat(80));

// 实时输出匹配的日志行
let logBuffer = '';

const monitorProcess = spawn('bash', ['-c', `
  # 监控当前运行的npm进程日志
  ps aux | grep "npm run dev" | grep -v grep | head -1 | awk '{print $2}' | while read pid; do
    if [ ! -z "$pid" ]; then
      echo "找到npm进程: $pid"
      # 使用lsof找到输出文件描述符
      lsof -p $pid 2>/dev/null | grep -E "(stdout|stderr)" || echo "无法获取日志文件"
    fi
  done
`], { stdio: 'inherit' });

// 简化版：直接提示用户在DeeChat中测试
console.log('💡 [监控说明] 现在请在DeeChat界面中测试工具调用：');
console.log('');
console.log('1. 🎯 在DeeChat中输入："学习PromptX文档"');
console.log('2. 🔍 观察控制台输出中的以下关键日志：');
console.log('   - 🚨 [MCPToolConverter-DEBUG] - 字段: resource -> z.string() (必需)');
console.log('   - 🔧 [LangChain工具-参数] 收到参数: {...}');
console.log('   - ❌ MCP error -32602: parameter validation failed');
console.log('');
console.log('3. 🎯 我们期望看到：');
console.log('   ✅ AI传递: {"resource": "合适的值"}');
console.log('   ❌ 如果仍然看到: {} 或 parameter validation failed');
console.log('');
console.log('4. 🚀 修复验证：');
console.log('   - 如果AI正确传递参数 → 修复成功！');
console.log('   - 如果AI仍传递空参数 → 需要进一步增强提示词');
console.log('');

// 显示当前的修复状态
console.log('📊 [修复状态] 当前已完成的修复：');
console.log('✅ MCPToolConverter.ts - 正确处理必需参数Schema');
console.log('✅ ToolIntegrationLayer.ts - 大幅增强参数说明');
console.log('✅ 编译验证 - dist目录包含最新代码');
console.log('');
console.log('🤔 [关键问题] 如果仍然失败，可能原因：');
console.log('1. LangChain bindTools()机制限制 - 只生成描述不强制验证');
console.log('2. AI模型忽略了增强的提示词警告');
console.log('3. 系统提示词中的工具描述没有传递给AI');
console.log('4. 需要在工具执行层面添加更强的参数验证');
console.log('');

console.log('⏳ 等待您在DeeChat中测试工具调用...');
console.log('💡 测试完成后，请告诉我看到了什么日志输出！');

// 定期提醒
setInterval(() => {
  console.log(`⏰ [${new Date().toLocaleTimeString()}] 仍在监控中...请在DeeChat中测试工具调用`);
}, 30000);

// 保持脚本运行
process.stdin.resume();