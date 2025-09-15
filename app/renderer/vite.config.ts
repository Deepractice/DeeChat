import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { DEV_CONFIG } from '../main/config/dev.config'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist'
  },
  server: {
    host: DEV_CONFIG.VITE.HOST,
    port: DEV_CONFIG.VITE.PORT,
    strictPort: true, // 🔒 强制使用指定端口，不自动寻找其他端口
    open: DEV_CONFIG.VITE.OPEN,
    cors: true,
    // 🔧 预设 HMR 配置优化开发体验  
    hmr: {
      overlay: true
    }
  },
  // 🚀 优化构建配置
  optimizeDeps: {
    include: ['react', 'react-dom', 'antd']
  }
})