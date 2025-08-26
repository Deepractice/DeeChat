#!/usr/bin/env node
/**
 * 智能Electron开发启动脚本
 * 自动检测Vite服务器端口并启动Electron
 */

const { spawn } = require('child_process')
const http = require('http')

// 检测端口是否可用并且是DeeChat的Vite服务器
function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}`, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        req.destroy()
        // 检查是否包含DeeChat相关内容或Vite标识
        const isDeeChat = data.includes('DeeChat') || 
                         data.includes('__vite__') || 
                         res.headers['server']?.includes('vite')
        resolve(isDeeChat)
      })
    })
    
    req.on('error', () => {
      resolve(false)
    })
    
    req.setTimeout(2000, () => {
      req.destroy()
      resolve(false)
    })
  })
}

// 等待Vite服务器启动
async function waitForViteServer() {
  const commonPorts = [5173, 5174, 5175, 5176, 5177]
  
  console.log('🔍 [开发启动] 正在检测Vite服务器...')
  
  // 最多等待30秒
  for (let i = 0; i < 60; i++) {
    for (const port of commonPorts) {
      const isAvailable = await checkPort(port)
      if (isAvailable) {
        const viteUrl = `http://localhost:${port}`
        console.log(`✅ [开发启动] 发现Vite服务器: ${viteUrl}`)
        
        // 设置环境变量
        process.env.VITE_DEV_SERVER_URL = viteUrl
        return viteUrl
      }
    }
    
    // 等待500ms再重试
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  throw new Error('❌ [开发启动] 30秒内未检测到Vite服务器')
}

// 启动Electron
function startElectron() {
  console.log('🚀 [开发启动] 启动Electron主进程...')
  
  const electronProcess = spawn('electron', ['dist/main/main/index.js'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      NODE_OPTIONS: '--experimental-modules --es-module-specifier-resolution=node'  // 🔥 支持ES模块
    }
  })
  
  electronProcess.on('close', (code) => {
    console.log(`🔚 [开发启动] Electron进程退出，代码: ${code}`)
    process.exit(code)
  })
  
  electronProcess.on('error', (error) => {
    console.error('❌ [开发启动] Electron启动失败:', error)
    process.exit(1)
  })
}

// 主函数
async function main() {
  try {
    await waitForViteServer()
    startElectron()
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}

main()