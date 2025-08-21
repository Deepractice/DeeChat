/**
 * 从GitHub拉取最新的PromptX代码
 * 用于获取最新的开发版本，包括可能的文件系统工具
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const GITHUB_REPO = 'https://github.com/Deepractice/PromptX.git';
const BRANCH = 'develop'; // 使用develop分支获取最新功能
const BUILD_RESOURCES_DIR = path.join(__dirname, '..', 'resources');
const PROMPTX_BUILD_DIR = path.join(BUILD_RESOURCES_DIR, 'promptx');

async function main() {
  console.log('🚀 [GitHub更新] 开始从GitHub拉取最新PromptX代码...');
  
  try {
    // 1. 创建构建资源目录
    console.log('📁 [GitHub更新] 创建资源目录...');
    await createDirectories();
    
    // 2. 从GitHub克隆最新代码
    console.log('📥 [GitHub更新] 从GitHub克隆最新代码...');
    await cloneFromGitHub();
    
    // 3. 安装依赖
    console.log('📦 [GitHub更新] 安装依赖...');
    await installDependencies();
    
    // 4. 验证安装结果
    console.log('✅ [GitHub更新] 验证安装结果...');
    await validateInstallation();
    
    console.log('🎉 [GitHub更新] PromptX从GitHub更新完成！');
    
  } catch (error) {
    console.error('❌ [GitHub更新] PromptX更新失败:', error);
    process.exit(1);
  }
}

async function createDirectories() {
  // 创建resources目录结构
  const dirs = [BUILD_RESOURCES_DIR, PROMPTX_BUILD_DIR];
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ [GitHub更新] 创建目录: ${dir}`);
    } else {
      console.log(`✅ [GitHub更新] 目录已存在: ${dir}`);
    }
  }
}

async function cloneFromGitHub() {
  const tempDir = path.join(PROMPTX_BUILD_DIR, 'temp-github');
  const targetDir = path.join(PROMPTX_BUILD_DIR, 'package');
  
  try {
    // 清理临时目录和目标目录
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    if (fs.existsSync(targetDir)) {
      console.log('🔄 [GitHub更新] 清理现有PromptX目录...');
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    
    // 克隆GitHub仓库
    console.log(`🔧 [GitHub更新] 克隆 ${GITHUB_REPO} (${BRANCH}分支)...`);
    execSync(
      `git clone --depth 1 --branch ${BRANCH} ${GITHUB_REPO} "${tempDir}"`,
      { 
        stdio: 'inherit',
        timeout: 120000
      }
    );
    
    // 移动克隆的代码到目标目录
    fs.renameSync(tempDir, targetDir);
    
    // 删除.git目录以减小体积
    const gitDir = path.join(targetDir, '.git');
    if (fs.existsSync(gitDir)) {
      fs.rmSync(gitDir, { recursive: true, force: true });
      console.log('🧹 [GitHub更新] 清理.git目录');
    }
    
    console.log('✅ [GitHub更新] GitHub代码克隆完成');
    
  } catch (error) {
    console.error('❌ [GitHub更新] Git克隆失败:', error);
    // 如果git克隆失败，清理临时目录
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    throw error;
  }
}

async function installDependencies() {
  const packageDir = path.join(PROMPTX_BUILD_DIR, 'package');
  
  try {
    console.log('🔧 [GitHub更新] 安装npm依赖...');
    
    // 检查package.json是否存在
    const packageJsonPath = path.join(packageDir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('package.json not found in cloned repository');
    }
    
    // 安装生产依赖
    execSync(
      `cd "${packageDir}" && npm install --production --registry https://registry.npmmirror.com --no-fund --no-audit --no-optional`,
      { 
        stdio: 'inherit',
        timeout: 180000
      }
    );
    
    console.log('✅ [GitHub更新] 依赖安装完成');
    
  } catch (error) {
    console.error('❌ [GitHub更新] 依赖安装失败:', error);
    throw error;
  }
}

async function validateInstallation() {
  const packageDir = path.join(PROMPTX_BUILD_DIR, 'package');
  const nodeModulesDir = path.join(packageDir, 'node_modules');
  
  // 检查包目录
  if (!fs.existsSync(packageDir)) {
    throw new Error('PromptX包目录不存在');
  }
  
  // 检查package.json
  const packageJsonPath = path.join(packageDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error('package.json不存在');
  }
  
  // 读取版本信息
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    console.log(`📦 [GitHub更新] PromptX版本: ${packageJson.version}`);
    console.log(`📝 [GitHub更新] 描述: ${packageJson.description}`);
  } catch (e) {
    console.warn('⚠️ [GitHub更新] 无法读取版本信息');
  }
  
  // 检查node_modules
  if (!fs.existsSync(nodeModulesDir)) {
    console.warn('⚠️ [GitHub更新] node_modules目录不存在，这可能是正常的');
  }
  
  // 检查关键文件
  const criticalFiles = [
    'src/lib/index.js',
    'src/lib/mcp',
    'resource/role/nuwa'
  ];
  
  for (const file of criticalFiles) {
    const filePath = path.join(packageDir, file);
    if (fs.existsSync(filePath)) {
      console.log(`✅ [GitHub更新] 找到关键文件/目录: ${file}`);
    } else {
      console.warn(`⚠️ [GitHub更新] 缺少关键文件/目录: ${file}`);
    }
  }
  
  // 检查是否有工具目录
  const toolboxDir = path.join(packageDir, 'toolbox');
  if (fs.existsSync(toolboxDir)) {
    console.log('🔧 [GitHub更新] 发现toolbox目录!');
    const tools = fs.readdirSync(toolboxDir);
    console.log(`🔧 [GitHub更新] 工具列表: ${tools.join(', ')}`);
  } else {
    console.log('ℹ️ [GitHub更新] 未发现toolbox目录');
  }
  
  console.log('✅ [GitHub更新] PromptX验证通过');
}

// 运行主函数
main().catch(error => {
  console.error('❌ [GitHub更新] 执行失败:', error);
  process.exit(1);
});