/**
 * 从GitHub获取PromptX源码并智能管理依赖
 * 直接从develop分支获取最新v1.7.1版本
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROMPTX_CONFIG = {
  // GitHub仓库信息 - 使用develop分支获取最新开发代码
  repository: 'https://github.com/Deepractice/PromptX.git',
  branch: 'develop', // 🔥 使用develop分支获取最新功能
  
  // 本地路径配置
  buildDir: path.join(__dirname, '..', 'resources'),
  promptxDir: path.join(__dirname, '..', 'resources', 'promptx'),
  
  // 只复制这些必要文件/目录
  includeFiles: [
    'src/',           // 源码目录
    'resource/',      // 资源文件
    'package.json',   // 包信息
    'README.md',      // 文档
    'LICENSE',        // 许可证
    'CHANGELOG.md'    // 变更日志
  ],
  
  // 排除这些文件/目录（减少体积）
  excludePatterns: [
    '.git/',
    '.github/',
    'node_modules/',
    '.gitignore',
    '.eslintrc.*',
    'jest.config.*',
    'tsconfig.*',
    'tests/',
    'test/',
    '__tests__/',
    '*.test.js',
    '*.spec.js',
    '.changeset/',
    'docs/',
    'examples/',
    '.vscode/',
    '.idea/',
    '*.log'
  ]
};

async function main() {
  console.log('🚀 [构建] 开始从GitHub获取PromptX源码...');
  
  try {
    // 1. 清理和创建目录
    await setupDirectories();
    
    // 2. 从GitHub克隆最新代码
    await cloneFromGitHub();
    
    // 3. 复制必要文件
    await copyEssentialFiles();
    
    // 4. 安装运行时依赖（完整生产依赖）
    await installRuntimeDependencies();
    
    // 5. 验证安装结果
    await validateInstallation();
    
    // 6. 清理临时文件
    await cleanup();
    
    console.log('🎉 [构建] PromptX源码获取完成！');
    
  } catch (error) {
    console.error('❌ [构建] PromptX源码获取失败:', error);
    process.exit(1);
  }
}

async function setupDirectories() {
  console.log('📁 [构建] 设置目录结构...');
  
  // 清理旧的promptx目录
  if (fs.existsSync(PROMPTX_CONFIG.promptxDir)) {
    fs.rmSync(PROMPTX_CONFIG.promptxDir, { recursive: true, force: true });
    console.log('🗑️ [构建] 清理旧版本目录');
  }
  
  // 创建构建目录
  fs.mkdirSync(PROMPTX_CONFIG.buildDir, { recursive: true });
  fs.mkdirSync(PROMPTX_CONFIG.promptxDir, { recursive: true });
}

async function cloneFromGitHub() {
  console.log(`📥 [构建] 从GitHub克隆: ${PROMPTX_CONFIG.repository} (${PROMPTX_CONFIG.branch})`);
  
  const tempCloneDir = path.join(PROMPTX_CONFIG.buildDir, 'promptx-temp');
  
  try {
    // 浅克隆指定分支，节省时间和空间
    const cloneCommand = [
      'git clone',
      '--depth 1',                                    // 只克隆最新commit
      '--single-branch',                             // 只克隆指定分支
      `--branch ${PROMPTX_CONFIG.branch}`,          // 指定分支
      PROMPTX_CONFIG.repository,
      tempCloneDir
    ].join(' ');
    
    console.log(`🔧 [构建] 执行: ${cloneCommand}`);
    execSync(cloneCommand, { stdio: 'pipe' });
    
    // 获取版本信息
    const gitHash = execSync('git rev-parse --short HEAD', { 
      cwd: tempCloneDir,
      encoding: 'utf8' 
    }).trim();
    
    const gitDate = execSync('git log -1 --format=%cd --date=short', { 
      cwd: tempCloneDir,
      encoding: 'utf8' 
    }).trim();
    
    console.log(`✅ [构建] 克隆成功 - 版本: ${gitHash} (${gitDate})`);
    
    // 暂存克隆目录路径供后续使用
    PROMPTX_CONFIG._tempDir = tempCloneDir;
    
  } catch (error) {
    throw new Error(`GitHub克隆失败: ${error.message}`);
  }
}

async function copyEssentialFiles() {
  console.log('📋 [构建] 复制必要文件...');
  
  const sourceDir = PROMPTX_CONFIG._tempDir;
  const targetDir = path.join(PROMPTX_CONFIG.promptxDir, 'package');
  
  // 确保目标目录存在
  fs.mkdirSync(targetDir, { recursive: true });
  
  let copiedCount = 0;
  let skippedCount = 0;
  
  // 复制包含的文件/目录
  for (const includeItem of PROMPTX_CONFIG.includeFiles) {
    const sourcePath = path.join(sourceDir, includeItem);
    const targetPath = path.join(targetDir, includeItem);
    
    if (fs.existsSync(sourcePath)) {
      const stats = fs.statSync(sourcePath);
      
      if (stats.isDirectory()) {
        copyDirectorySelectively(sourcePath, targetPath);
        console.log(`✅ [构建] 复制目录: ${includeItem}`);
      } else {
        // 确保目标目录存在
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`✅ [构建] 复制文件: ${includeItem}`);
      }
      copiedCount++;
    } else {
      console.log(`⚠️ [构建] 文件不存在，跳过: ${includeItem}`);
      skippedCount++;
    }
  }
  
  console.log(`📊 [构建] 文件复制完成: ${copiedCount} 个成功, ${skippedCount} 个跳过`);
}

function copyDirectorySelectively(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  
  fs.mkdirSync(destDir, { recursive: true });
  
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    
    // 检查是否应该排除
    const shouldExclude = PROMPTX_CONFIG.excludePatterns.some(pattern => {
      return entry.name.includes(pattern.replace('/', '')) || 
             entry.name.match(pattern.replace('/', '').replace('*', '.*'));
    });
    
    if (shouldExclude) {
      continue; // 跳过排除的文件
    }
    
    if (entry.isDirectory()) {
      copyDirectorySelectively(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function installRuntimeDependencies() {
  console.log('🔧 [构建] 安装运行时依赖...');
  
  const packageDir = path.join(PROMPTX_CONFIG.promptxDir, 'package');
  const packageJsonPath = path.join(packageDir, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.log('⚠️ [构建] 未找到package.json，跳过依赖安装');
    return;
  }
  
  try {
    // 策略1: 完整安装所有生产依赖（推荐）
    const installCommand = [
      'cd', `"${packageDir}"`,
      '&&',
      'npm install',                                    // 使用install而不是ci（develop分支可能没有lock文件）
      '--production',                                   // 只安装生产依赖
      '--ignore-scripts',                               // 跳过prepare脚本，避免husky错误
      '--no-fund',                                      // 跳过资助信息
      '--no-audit',                                     // 跳过安全审计
      '--no-optional',                                  // 跳过可选依赖
      '--registry https://registry.npmmirror.com'       // 使用国内镜像
    ].join(' ');
    
    console.log('🔧 [构建] 执行依赖安装...');
    execSync(installCommand, { 
      stdio: 'inherit',
      timeout: 300000 // 5分钟超时
    });
    
    console.log('✅ [构建] 依赖安装完成');
    
    // 统计安装结果
    const nodeModulesDir = path.join(packageDir, 'node_modules');
    if (fs.existsSync(nodeModulesDir)) {
      const nodeModulesSize = await getDirectorySize(nodeModulesDir);
      console.log(`📊 [构建] 依赖大小: ${formatBytes(nodeModulesSize)}`);
    }
    
  } catch (error) {
    console.warn('⚠️ [构建] 依赖安装失败，将以无依赖模式运行:', error.message);
  }
}

async function validateInstallation() {
  console.log('🔍 [构建] 验证安装结果...');
  
  const packageDir = path.join(PROMPTX_CONFIG.promptxDir, 'package');
  
  // 检查关键文件
  const criticalFiles = [
    'src/bin/promptx.js',
    'src/lib/core/pouch/index.js',
    'package.json'
  ];
  
  let allValid = true;
  
  for (const file of criticalFiles) {
    const filePath = path.join(packageDir, file);
    if (fs.existsSync(filePath)) {
      console.log(`✅ [构建] 关键文件存在: ${file}`);
    } else {
      console.error(`❌ [构建] 关键文件缺失: ${file}`);
      allValid = false;
    }
  }
  
  if (!allValid) {
    throw new Error('关键文件验证失败');
  }
  
  // 读取版本信息
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
    console.log(`📦 [构建] 包信息: ${packageJson.name}@${packageJson.version}`);
    
    // 显示核心依赖
    if (packageJson.dependencies) {
      const depCount = Object.keys(packageJson.dependencies).length;
      console.log(`📋 [构建] 生产依赖: ${depCount} 个`);
      
      // 显示关键依赖版本
      const keyDeps = ['@modelcontextprotocol/sdk', 'commander', 'express', 'zod'];
      keyDeps.forEach(dep => {
        if (packageJson.dependencies[dep]) {
          console.log(`   🔸 ${dep}: ${packageJson.dependencies[dep]}`);
        }
      });
    }
  } catch (e) {
    console.warn('⚠️ [构建] 无法读取包版本信息');
  }
  
  console.log('✅ [构建] 验证通过');
}

async function cleanup() {
  console.log('🧹 [构建] 清理临时文件...');
  
  if (PROMPTX_CONFIG._tempDir && fs.existsSync(PROMPTX_CONFIG._tempDir)) {
    fs.rmSync(PROMPTX_CONFIG._tempDir, { recursive: true, force: true });
    console.log('✅ [构建] 临时目录清理完成');
  }
}

/**
 * 计算目录大小
 */
async function getDirectorySize(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  
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

// 运行主函数
main().catch(error => {
  console.error('❌ [构建] 执行失败:', error);
  process.exit(1);
});