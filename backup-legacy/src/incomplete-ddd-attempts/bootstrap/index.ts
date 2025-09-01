/**
 * DeeChat应用程序入口
 * 替代原有的 src/main/index.ts
 */

import { DeeChatApplication } from './Application'

// 创建应用实例
const app = new DeeChatApplication()

// 启动应用
app.start().catch((error) => {
  console.error('💥 [Bootstrap] 应用启动失败:', error)
  process.exit(1)
})

// 导出应用实例（用于测试或外部访问）
export { app as deeChatApp }

// 全局错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 [Bootstrap] 未处理的Promise拒绝:', reason)
  console.error('Promise:', promise)
})

process.on('uncaughtException', (error) => {
  console.error('💥 [Bootstrap] 未捕获的异常:', error)
  process.exit(1)
})