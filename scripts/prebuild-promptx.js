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
    
    // 执行npm install，只安装生产依赖
    execSync(
      `cd "${tempDir}" && npm install --production --registry https://registry.npmmirror.com --no-fund --no-audit --no-optional`, 
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
    
    // 🔥 优化：只复制必需的运行时依赖，排除重型依赖
    console.log('🔧 [构建] 开始优化依赖复制...');
    const nodeModulesSource = path.join(tempDir, 'node_modules');
    const nodeModulesTarget = path.join(targetDir, 'node_modules');
    
    // 排除列表：去掉巨大的依赖包
    const excludePackages = [
      'node',           // 459MB - 最大的包，使用Electron自带Node.js
      'pnpm',           // 22MB - 包管理器，运行时不需要
      '@types',         // TypeScript类型定义，运行时不需要
      'typescript',     // TypeScript编译器，运行时不需要
      'eslint',         // 代码检查工具，运行时不需要
      'jest',           // 测试框架，运行时不需要
      '@jest',          // Jest相关包
      'webpack',        // 构建工具，运行时不需要
      'rollup',         // 构建工具，运行时不需要
      'vite',           // 构建工具，运行时不需要
      'esbuild',        // 构建工具，运行时不需要
    ];
    
    copyNodeModulesSelectively(nodeModulesSource, nodeModulesTarget, excludePackages);
    
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

/**
 * 选择性复制node_modules，排除重型依赖
 */
function copyNodeModulesSelectively(src, dest, excludePackages = []) {
  if (!fs.existsSync(src)) {
    console.warn(`⚠️ [构建] node_modules源目录不存在: ${src}`);
    return;
  }
  
  fs.mkdirSync(dest, { recursive: true });
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  let excludedCount = 0;
  let includedCount = 0;
  let totalSizeExcluded = 0;
  
  for (const entry of entries) {
    const packageName = entry.name;
    const srcPath = path.join(src, packageName);
    const destPath = path.join(dest, packageName);
    
    // 检查是否在排除列表中
    const shouldExclude = excludePackages.some(excludePattern => {
      return packageName === excludePattern || 
             packageName.startsWith(excludePattern + '/') ||
             packageName.startsWith(excludePattern);
    });
    
    if (shouldExclude) {
      // 计算被排除包的大小
      try {
        const stats = getDirectorySize(srcPath);
        totalSizeExcluded += stats;
        console.log(`❌ [构建] 排除依赖: ${packageName} (${formatBytes(stats)})`);
        excludedCount++;
      } catch (e) {
        console.log(`❌ [构建] 排除依赖: ${packageName}`);
        excludedCount++;
      }
      continue;
    }
    
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
      console.log(`✅ [构建] 包含依赖: ${packageName}`);
      includedCount++;
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
  
  console.log(`📊 [构建] 依赖统计: 包含 ${includedCount} 个，排除 ${excludedCount} 个`);
  console.log(`💾 [构建] 节省空间: ${formatBytes(totalSizeExcluded)}`);
}

/**
 * 计算目录大小
 */
function getDirectorySize(dirPath) {
  let totalSize = 0;
  
  function calculateSize(currentPath) {
    try {
      const stats = fs.statSync(currentPath);
      if (stats.isDirectory()) {
        const files = fs.readdirSync(currentPath);
        for (const file of files) {
          calculateSize(path.join(currentPath, file));
        }
      } else {
        totalSize += stats.size;
      }
    } catch (e) {
      // 忽略无法访问的文件
    }
  }
  
  calculateSize(dirPath);
  return totalSize;
}

/**
 * 格式化字节数
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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