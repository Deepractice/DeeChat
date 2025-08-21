/**
 * 构建后资源复制脚本
 * 将resources目录复制到dist/main/目录，确保运行时能找到PromptX资源
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const SOURCE_RESOURCES = path.join(PROJECT_ROOT, 'resources');
const TARGET_RESOURCES = path.join(PROJECT_ROOT, 'dist', 'main', 'resources');

async function main() {
  console.log('📦 [后构建] 开始复制资源文件...');
  
  try {
    // 检查源资源目录是否存在
    if (!fs.existsSync(SOURCE_RESOURCES)) {
      console.warn('⚠️ [后构建] 源资源目录不存在，跳过复制:', SOURCE_RESOURCES);
      return;
    }
    
    // 清理目标目录
    if (fs.existsSync(TARGET_RESOURCES)) {
      console.log('🗑️ [后构建] 清理旧的资源目录...');
      fs.rmSync(TARGET_RESOURCES, { recursive: true, force: true });
    }
    
    // 创建目标目录
    fs.mkdirSync(TARGET_RESOURCES, { recursive: true });
    
    // 复制资源文件
    console.log('📋 [后构建] 复制资源文件...');
    copyDirectory(SOURCE_RESOURCES, TARGET_RESOURCES);
    
    // 验证复制结果
    await validateCopy();
    
    console.log('✅ [后构建] 资源文件复制完成！');
    
  } catch (error) {
    console.error('❌ [后构建] 资源复制失败:', error);
    process.exit(1);
  }
}

function copyDirectory(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function validateCopy() {
  // 检查PromptX包是否存在
  const promptxPackage = path.join(TARGET_RESOURCES, 'promptx', 'package');
  if (!fs.existsSync(promptxPackage)) {
    throw new Error('PromptX包目录复制失败');
  }
  
  // 检查关键文件
  const criticalPaths = [
    path.join(promptxPackage, 'src', 'lib', 'utils', 'ServerEnvironment.js'),
    path.join(promptxPackage, 'src', 'lib', 'core', 'pouch', 'index.js'),
    path.join(promptxPackage, 'src', 'lib', 'mcp', 'MCPServerStdioCommand.js')
  ];
  
  for (const criticalPath of criticalPaths) {
    if (!fs.existsSync(criticalPath)) {
      console.warn(`⚠️ [后构建] 关键文件缺失: ${criticalPath}`);
    } else {
      console.log(`✅ [后构建] 验证通过: ${path.relative(TARGET_RESOURCES, criticalPath)}`);
    }
  }
  
  console.log('✅ [后构建] 资源验证完成');
}

// 运行主函数
main().catch(error => {
  console.error('❌ [后构建] 执行失败:', error);
  process.exit(1);
});