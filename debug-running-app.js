#!/usr/bin/env node

/**
 * 调试正在运行的DeeChat应用中的MCP工具状态
 */

async function checkRunningApp() {
  console.log('🔍 检查正在运行的DeeChat应用状态...\n');
  
  // 检查进程
  const { execSync } = require('child_process');
  
  try {
    console.log('📋 检查Electron进程:');
    const processes = execSync('ps aux | grep -E "(electron|node.*dev)" | grep -v grep', { encoding: 'utf8' });
    console.log(processes);
    
    console.log('\n📋 检查端口占用:');
    try {
      const ports = execSync('lsof -i :5173 -i :8080 2>/dev/null || echo "No processes found"', { encoding: 'utf8' });
      console.log(ports);
    } catch (e) {
      console.log('无法检查端口');
    }
    
  } catch (error) {
    console.log('进程检查失败:', error.message);
  }
  
  console.log('\n🔧 检查编译文件状态:');
  const fs = require('fs');
  const path = require('path');
  
  const mcpConverterPath = './dist/main/shared/langchain/MCPToolConverter.js';
  if (fs.existsSync(mcpConverterPath)) {
    const stats = fs.statSync(mcpConverterPath);
    console.log(`✅ MCPToolConverter.js: ${stats.mtime} (${Math.round((Date.now() - stats.mtime) / 1000)}秒前)`);
    
    // 检查文件内容是否包含我们的修改
    const content = fs.readFileSync(mcpConverterPath, 'utf8');
    const hasDebugLogs = content.includes('🚨 [MCPToolConverter-DEBUG]');
    const hasOptionalFix = content.includes('z.string().optional()');
    const hasParameterValidation = content.includes('必需参数检查通过');
    
    console.log(`   🚨 调试日志: ${hasDebugLogs ? '✅' : '❌'}`);
    console.log(`   🔧 Schema修复: ${hasOptionalFix ? '✅' : '❌'}`);
    console.log(`   🛡️  参数验证: ${hasParameterValidation ? '✅' : '❌'}`);
    
    if (hasDebugLogs && hasOptionalFix && hasParameterValidation) {
      console.log('   ✅ 所有修复代码都已编译到文件中');
    } else {
      console.log('   ❌ 修复代码未完全编译，需要重新构建');
    }
  } else {
    console.log('❌ MCPToolConverter.js 不存在，需要编译');
  }
  
  console.log('\n💡 调试建议:');
  console.log('1. 如果修复代码已编译但问题仍存在，请完全重启应用:');
  console.log('   - 停止当前应用 (Ctrl+C 或关闭窗口)');
  console.log('   - 运行: npm run dev');
  console.log('');
  console.log('2. 如果修复代码未编译，运行:');
  console.log('   - npm run build:main');
  console.log('   - npm run dev');
  console.log('');
  console.log('3. 如果仍有问题，请提供具体的错误信息，比如:');
  console.log('   - AI生成了什么工具调用');
  console.log('   - 具体的错误消息');
  console.log('   - 前端显示的错误内容');
}

checkRunningApp();