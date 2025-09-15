// CommonJS启动器，用于兼容Electron
// 动态导入ESM格式的主模块

(async () => {
  try {
    console.log('🚀 启动DeeChat...')
    // 动态导入ESM格式的主入口文件
    // 这个文件会在导入时自动执行，不需要调用函数
    await import('./dist/main/index.js')
  } catch (error) {
    console.error('❌ DeeChat启动失败:', error)
    process.exit(1)
  }
})()