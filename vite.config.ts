import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// 自定义插件：为Electron设置开发服务器URL环境变量
function electronDevServerPlugin() {
  return {
    name: 'electron-dev-server',
    configureServer(server: any) {
      const protocol = server.config.server.https ? 'https' : 'http'
      const host = server.config.server.host || 'localhost'
      const port = server.config.server.port || 5173
      
      // 设置环境变量供Electron主进程使用
      process.env.VITE_DEV_SERVER_URL = `${protocol}://${host}:${port}`
      
      server.middlewares.use('/', (_req: any, _res: any, next: any) => {
        // 确保环境变量在服务器运行期间保持设置
        process.env.VITE_DEV_SERVER_URL = `${protocol}://${host}:${port}`
        next()
      })
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    electronDevServerPlugin()
  ],
  root: 'src/renderer/src',
  base: './',
  build: {
    outDir: '../../../dist/renderer',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/shared': resolve(__dirname, 'src/shared'),
      '@/renderer': resolve(__dirname, 'src/renderer'),
      '@/main': resolve(__dirname, 'src/main'),
    },
  },
  server: {
    port: 5173,
  },
  define: {
    // 为浏览器环境提供crypto polyfill
    global: 'globalThis',
    // 解决"process is not defined"错误
    'process.env': JSON.stringify(process.env),
    'process.platform': JSON.stringify(process.platform),
    'process.version': JSON.stringify(process.version),
    'process.cwd': JSON.stringify(process.cwd()),
  },
  optimizeDeps: {
    include: ['crypto-js']
  }
})
