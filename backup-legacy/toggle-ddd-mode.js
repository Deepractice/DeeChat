#!/usr/bin/env node

/**
 * DDD模式切换脚本
 * 🏗️ 帮助在新旧架构之间切换
 */

const fs = require('fs');
const path = require('path');

const APP_PATH = path.join(__dirname, '../src/renderer/src/App.tsx');
const APP_LEGACY_PATH = path.join(__dirname, '../src/renderer/src/components/ChatArea.tsx');
const APP_DDD_PATH = path.join(__dirname, '../src/renderer/src/components/AppWithDDD.tsx');
const MAIN_TSX_PATH = path.join(__dirname, '../src/renderer/src/main.tsx');

function showUsage() {
  console.log(`
🏗️ DeeChat DDD模式切换工具

使用方法:
  node scripts/toggle-ddd-mode.js [command]

命令:
  enable      启用DDD模式 (使用AppWithDDD组件)
  disable     禁用DDD模式 (恢复原始App组件)  
  status      查看当前状态
  help        显示帮助信息

示例:
  node scripts/toggle-ddd-mode.js enable   # 启用DDD模式
  node scripts/toggle-ddd-mode.js disable  # 禁用DDD模式
  node scripts/toggle-ddd-mode.js status   # 查看状态
  `);
}

function getCurrentMode() {
  try {
    const appContent = fs.readFileSync(APP_PATH, 'utf8');
    
    // 检查是否包含DDD相关导入
    if (appContent.includes('ChatAreaDDD') || appContent.includes('useDDDAdapter')) {
      return 'DDD';
    } else {
      return 'Legacy';
    }
  } catch (error) {
    console.error('❌ 无法读取App.tsx文件:', error.message);
    return 'Unknown';
  }
}

function showStatus() {
  const currentMode = getCurrentMode();
  const dddExists = fs.existsSync(APP_DDD_PATH);
  
  console.log(`
📊 DeeChat 架构状态

当前模式: ${currentMode === 'DDD' ? '🏗️ DDD架构' : '🏛️ 传统架构'}
DDD组件: ${dddExists ? '✅ 已实现' : '❌ 未实现'}

文件状态:
- App.tsx (当前): ${fs.existsSync(APP_PATH) ? '✅' : '❌'}
- AppWithDDD.tsx: ${dddExists ? '✅' : '❌'}
- ChatArea.tsx (Legacy): ${fs.existsSync(APP_LEGACY_PATH) ? '✅' : '❌'}

DDD架构组件:
- domains/: ${fs.existsSync(path.join(__dirname, '../src/domains')) ? '✅' : '❌'}
- application/: ${fs.existsSync(path.join(__dirname, '../src/application')) ? '✅' : '❌'}  
- infrastructure/: ${fs.existsSync(path.join(__dirname, '../src/infrastructure')) ? '✅' : '❌'}
- presentation/: ${fs.existsSync(path.join(__dirname, '../src/presentation')) ? '✅' : '❌'}
  `);
}

function enableDDDMode() {
  console.log('🏗️ 启用DDD架构模式...');
  
  // 检查DDD组件是否存在
  if (!fs.existsSync(APP_DDD_PATH)) {
    console.error('❌ AppWithDDD.tsx 不存在，请先确保DDD架构已实现');
    return false;
  }
  
  try {
    // 备份当前App.tsx
    if (fs.existsSync(APP_PATH)) {
      const backupPath = APP_PATH + '.legacy.backup';
      fs.copyFileSync(APP_PATH, backupPath);
      console.log(`📄 已备份原始App.tsx到: ${path.basename(backupPath)}`);
    }
    
    // 复制DDD版本到App.tsx
    fs.copyFileSync(APP_DDD_PATH, APP_PATH);
    
    // 设置环境变量
    const envPath = path.join(__dirname, '../.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // 更新或添加DDD配置
    if (envContent.includes('REACT_APP_ENABLE_DDD')) {
      envContent = envContent.replace(
        /REACT_APP_ENABLE_DDD=.*/,
        'REACT_APP_ENABLE_DDD=true'
      );
    } else {
      envContent += '\\n# DDD Architecture Mode\\nREACT_APP_ENABLE_DDD=true\\n';
    }
    
    fs.writeFileSync(envPath, envContent);
    
    console.log('✅ DDD模式已启用');
    console.log('🔄 请重启应用以使更改生效');
    
    return true;
  } catch (error) {
    console.error('❌ 启用DDD模式失败:', error.message);
    return false;
  }
}

function disableDDDMode() {
  console.log('🏛️ 禁用DDD架构模式...');
  
  try {
    // 检查是否有备份
    const backupPath = APP_PATH + '.legacy.backup';
    
    if (fs.existsSync(backupPath)) {
      // 恢复备份
      fs.copyFileSync(backupPath, APP_PATH);
      console.log('📄 已从备份恢复原始App.tsx');
    } else {
      console.warn('⚠️ 未找到备份文件，请手动检查App.tsx');
    }
    
    // 更新环境变量
    const envPath = path.join(__dirname, '../.env');
    
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      envContent = envContent.replace(
        /REACT_APP_ENABLE_DDD=.*/,
        'REACT_APP_ENABLE_DDD=false'
      );
      fs.writeFileSync(envPath, envContent);
    }
    
    console.log('✅ DDD模式已禁用');
    console.log('🔄 请重启应用以使更改生效');
    
    return true;
  } catch (error) {
    console.error('❌ 禁用DDD模式失败:', error.message);
    return false;
  }
}

function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'enable':
      enableDDDMode();
      break;
      
    case 'disable':
      disableDDDMode();
      break;
      
    case 'status':
      showStatus();
      break;
      
    case 'help':
    case '--help':
    case '-h':
      showUsage();
      break;
      
    default:
      console.log('❌ 未知命令:', command);
      showUsage();
      process.exit(1);
  }
}

if (require.main === module) {
  main();
}