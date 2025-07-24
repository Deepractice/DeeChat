/**
 * 构建时预下载PromptX依赖脚本
 * 在项目构建时自动下载并打包PromptX，避免运行时下载
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROMPTX_VERSION = 'beta'; // 可以配置不同版本
const BUILD_RESOURCES_DIR = path.join(__dirname, '..', 'resources');
const PROMPTX_BUILD_DIR = path.join(BUILD_RESOURCES_DIR, 'promptx');

async function main() {
  console.log('🚀 [构建] 开始预下载PromptX依赖...');
  
  try {
    // 1. 创建构建资源目录
    console.log('📁 [构建] 创建资源目录...');
    await createDirectories();
    
    // 2. 下载PromptX及其依赖
    console.log('📥 [构建] 下载PromptX及依赖...');
    await downloadPromptX();
    
    // 3. 验证下载结果
    console.log('✅ [构建] 验证下载结果...');
    await validateDownload();
    
    console.log('🎉 [构建] PromptX预下载完成！');
    
  } catch (error) {
    console.error('❌ [构建] PromptX预下载失败:', error);
    process.exit(1);
  }
}

async function createDirectories() {
  // 创建resources目录结构
  const dirs = [BUILD_RESOURCES_DIR, PROMPTX_BUILD_DIR];
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ [构建] 创建目录: ${dir}`);
    } else {
      console.log(`✅ [构建] 目录已存在: ${dir}`);
    }
  }
}

async function downloadPromptX() {
  const tempDir = path.join(PROMPTX_BUILD_DIR, 'temp');
  
  try {
    // 清理临时目录
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
    
    // 创建package.json用于安装
    const packageJson = {
      name: 'promptx-build-install',
      version: '1.0.0',
      dependencies: {
        'dpml-prompt': PROMPTX_VERSION
      }
    };
    
    fs.writeFileSync(
      path.join(tempDir, 'package.json'), 
      JSON.stringify(packageJson, null, 2)
    );
    
    console.log('🔧 [构建] 开始npm安装...');
    
    // 执行npm install
    execSync(
      `cd "${tempDir}" && npm install --registry https://registry.npmmirror.com --no-fund --no-audit`, 
      { 
        stdio: 'inherit',
        timeout: 120000
      }
    );
    
    // 复制安装结果到最终位置
    const sourceDir = path.join(tempDir, 'node_modules', 'dpml-prompt');
    const targetDir = path.join(PROMPTX_BUILD_DIR, 'package');
    
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    
    // 复制包文件
    copyDirectory(sourceDir, targetDir);
    
    // 复制node_modules依赖
    const nodeModulesSource = path.join(tempDir, 'node_modules');
    const nodeModulesTarget = path.join(targetDir, 'node_modules');
    copyDirectory(nodeModulesSource, nodeModulesTarget);
    
    // 清理临时目录
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    console.log('✅ [构建] PromptX包复制完成');
    
  } catch (error) {
    console.error('❌ [构建] npm安装失败:', error);
    throw error;
  }
}

function copyDirectory(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`源目录不存在: ${src}`);
  }
  
  fs.mkdirSync(dest, { recursive: true });
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function validateDownload() {
  const packageDir = path.join(PROMPTX_BUILD_DIR, 'package');
  const nodeModulesDir = path.join(packageDir, 'node_modules');
  
  // 检查包目录
  if (!fs.existsSync(packageDir)) {
    throw new Error('PromptX包目录不存在');
  }
  
  // 检查node_modules
  if (!fs.existsSync(nodeModulesDir)) {
    throw new Error('node_modules目录不存在');
  }
  
  // 检查关键依赖
  const criticalDeps = ['commander', '@types/node'];
  for (const dep of criticalDeps) {
    const depPath = path.join(nodeModulesDir, dep);
    if (!fs.existsSync(depPath)) {
      console.warn(`⚠️ [构建] 警告: 缺少依赖 ${dep}`);
    }
  }
  
  // 寻找入口文件
  const possibleEntries = [
    path.join(packageDir, 'dist', 'mcp-server.js'),
    path.join(packageDir, 'src', 'bin', 'promptx.js'),
    path.join(packageDir, 'bin', 'promptx.js'),
    path.join(packageDir, 'lib', 'mcp-server.js'),
    path.join(packageDir, 'index.js')
  ];
  
  let entryFound = false;
  for (const entry of possibleEntries) {
    if (fs.existsSync(entry)) {
      console.log(`✅ [构建] 找到入口文件: ${entry}`);
      entryFound = true;
      break;
    }
  }
  
  if (!entryFound) {
    throw new Error('未找到PromptX入口文件');
  }
  
  console.log('✅ [构建] PromptX验证通过');
}

// 运行主函数
main().catch(error => {
  console.error('❌ [构建] 执行失败:', error);
  process.exit(1);
});