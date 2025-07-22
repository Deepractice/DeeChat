import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
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
