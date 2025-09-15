#!/usr/bin/env node

/**
 * 测试 wa-sqlite WASM 文件路径解析方案
 */

console.log('🧪 测试 wa-sqlite WASM 文件路径解析...\n');

// 方案1: 使用 require.resolve() 
try {
  console.log('📦 方案1: 使用 createRequire + resolve');
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  
  const wasmPath = require.resolve('wa-sqlite/dist/wa-sqlite.wasm');
  console.log('✅ WASM路径:', wasmPath);
  
  // 验证文件是否存在
  const fs = await import('fs');
  const exists = fs.existsSync(wasmPath);
  console.log('✅ 文件存在:', exists);
  
  if (exists) {
    const stats = fs.statSync(wasmPath);
    console.log('✅ 文件大小:', stats.size, 'bytes');
  }
} catch (error) {
  console.error('❌ 方案1失败:', error.message);
}

console.log('\n---\n');

// 方案2: 使用 import.meta.resolve() (Node.js 20+)
try {
  console.log('📦 方案2: 使用 import.meta.resolve (Node.js 20+)');
  
  // 检查是否支持 import.meta.resolve
  if (typeof import.meta.resolve === 'function') {
    const wasmUrl = import.meta.resolve('wa-sqlite/dist/wa-sqlite.wasm');
    console.log('✅ WASM URL:', wasmUrl);
    
    // 转换为文件路径
    const { fileURLToPath } = await import('url');
    const wasmPath = fileURLToPath(wasmUrl);
    console.log('✅ WASM路径:', wasmPath);
    
    // 验证文件
    const fs = await import('fs');
    const exists = fs.existsSync(wasmPath);
    console.log('✅ 文件存在:', exists);
  } else {
    console.log('⚠️ 当前Node.js版本不支持 import.meta.resolve');
  }
} catch (error) {
  console.error('❌ 方案2失败:', error.message);
}

console.log('\n---\n');

// 方案3: 查找 node_modules 路径
try {
  console.log('📦 方案3: 智能查找 node_modules');
  const path = await import('path');
  const fs = await import('fs');
  const { fileURLToPath } = await import('url');
  
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  // 向上查找 node_modules
  function findNodeModules(startPath) {
    let currentPath = startPath;
    
    while (currentPath !== path.parse(currentPath).root) {
      const nodeModulesPath = path.join(currentPath, 'node_modules');
      if (fs.existsSync(nodeModulesPath)) {
        return nodeModulesPath;
      }
      currentPath = path.dirname(currentPath);
    }
    return null;
  }
  
  const nodeModulesPath = findNodeModules(__dirname);
  if (nodeModulesPath) {
    const wasmPath = path.join(nodeModulesPath, 'wa-sqlite', 'dist', 'wa-sqlite.wasm');
    console.log('✅ WASM路径:', wasmPath);
    
    const exists = fs.existsSync(wasmPath);
    console.log('✅ 文件存在:', exists);
  } else {
    console.log('❌ 找不到 node_modules 目录');
  }
} catch (error) {
  console.error('❌ 方案3失败:', error.message);
}

console.log('\n🏁 测试完成');