import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'

console.log('🔧 [主进程] 开始导入LangChain处理器...')
import { registerLangChainHandlers, unregisterLangChainHandlers } from './ipc/langchainHandlers'
console.log('✅ [主进程] LangChain处理器导入成功')

console.log('🔧 [主进程] 开始导入MCP处理器...')
import { registerMCPHandlers, unregisterMCPHandlers, preRegisterMCPHandlersOnly } from './ipc/mcpHandlers'
console.log('✅ [主进程] MCP处理器导入成功')

console.log('🔧 [主进程] 所有IPC处理器模块导入完成')
console.log('🔧 [主进程] registerMCPHandlers函数类型:', typeof registerMCPHandlers)

// 开发环境检测
const isDev = process.env.NODE_ENV === 'development'

let mainWindow: BrowserWindow | null = null

// 🔥 添加主进程日志转发到渲染进程的功能
const forwardLogToRenderer = (level: 'log' | 'error' | 'warn', ...args: any[]) => {
  if (mainWindow && mainWindow.webContents) {
    try {
      // 🔥 改进对象序列化，特别处理Error对象
      const serializedArgs = args.map(arg => {
        if (arg instanceof Error) {
          return `Error: ${arg.message} (${arg.name})${arg.stack ? '\n' + arg.stack : ''}`;
        } else if (typeof arg === 'object' && arg !== null) {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            return `[Object: ${Object.prototype.toString.call(arg)}]`;
          }
        } else {
          return String(arg);
        }
      });

      mainWindow.webContents.executeJavaScript(`
        console.${level}('[主进程]', ${JSON.stringify(serializedArgs)});
      `).catch(() => {
        // 忽略执行失败的情况（可能是窗口还没准备好）
      });
    } catch (error) {
      // 忽略错误
    }
  }
};

// 🔥 重写console方法，同时输出到主进程和渲染进程
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = (...args: any[]) => {
  originalConsoleLog(...args);
  forwardLogToRenderer('log', ...args);
};

console.error = (...args: any[]) => {
  originalConsoleError(...args);
  forwardLogToRenderer('error', ...args);
};

console.warn = (...args: any[]) => {
  originalConsoleWarn(...args);
  forwardLogToRenderer('warn', ...args);
};

function createWindow(): void {
  // 创建主窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'DeeChat',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, '../preload/index.js'),
    },
    titleBarStyle: 'default',
    show: false, // 先隐藏，等加载完成后显示
  })

  // 加载应用
  if (isDev) {
    const devUrl = 'http://localhost:5173'
    console.log('🔧 [开发模式] 加载开发服务器:', devUrl)
    mainWindow.loadURL(devUrl)
    // 开发环境下打开开发者工具
    mainWindow.webContents.openDevTools()
  } else {
    const htmlPath = join(__dirname, '../../renderer/index.html')
    console.log('🔧 [生产模式] 加载HTML文件:', htmlPath)
    console.log('🔧 [生产模式] __dirname:', __dirname)
    mainWindow.loadFile(htmlPath)
    // 🔥 生产模式下也打开开发者工具，用于调试MCP连接问题
    mainWindow.webContents.openDevTools()
  }

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    console.log('✅ [主进程] 窗口准备完成，显示窗口')
    mainWindow?.show()
  })

  // 添加错误处理
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('❌ [主进程] 页面加载失败:', {
      errorCode,
      errorDescription,
      validatedURL
    })
  })

  // 窗口关闭事件
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

/**
 * 异步初始化后台服务（MCP和系统角色）
 * 不阻塞界面显示，提升启动速度
 */
async function initializeBackgroundServices() {
  console.log('🔧 [后台服务] 开始异步初始化后台服务...')

  // 向渲染进程发送状态更新
  const sendStatus = (service: string, status: 'initializing' | 'ready' | 'error', message: string) => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('background-service-status', { service, status, message })
    }
  }

  // 1. 初始化MCP服务
  try {
    sendStatus('mcp', 'initializing', 'PromptX工具加载中...')
    
    await registerMCPHandlers()
    
    console.log(`✅ [后台服务] MCP服务初始化完成`)
    sendStatus('mcp', 'ready', 'PromptX工具已就绪')
  } catch (error) {
    console.error('❌ [后台服务] MCP服务初始化失败:', error)
    if (error instanceof Error) {
      console.error('❌ [后台服务] 错误名称:', error.name)
      console.error('❌ [后台服务] 错误消息:', error.message)
      console.error('❌ [后台服务] 错误堆栈:', error.stack)
    }
    sendStatus('mcp', 'error', 'PromptX工具加载失败，部分功能可能受限')
  }

  // 2. 初始化系统角色
  try {
    sendStatus('system-role', 'initializing', '系统角色激活中...')
    console.log('🤖 [后台服务] 开始静默激活系统角色...')
    
    await silentSystemRoleManager.initializeOnStartup()
    
    console.log('✅ [后台服务] 系统角色静默激活完成')
    sendStatus('system-role', 'ready', '系统角色已激活')
  } catch (error) {
    console.error('❌ [后台服务] 系统角色激活失败:', error)
    sendStatus('system-role', 'error', '系统角色激活失败')
    // 不阻塞应用启动，稍后重试
  }

  console.log('✅ [后台服务] 所有后台服务初始化完成')
}

// 应用准备就绪
app.whenReady().then(async () => {
  // 🔥 添加环境检测
  console.log('🔧 [主进程] 应用启动环境检测:')
  console.log(`  - 开发模式: ${isDev}`)
  console.log(`  - Node版本: ${process.version}`)
  console.log(`  - 平台: ${process.platform}`)
  console.log(`  - 当前PATH前200字符: ${process.env.PATH?.substring(0, 200)}...`)

  // 🔥 测试基础命令可用性
  try {
    const { execSync } = require('child_process')
    console.log('🔧 [主进程] 测试基础命令可用性:')

    try {
      const nodeVersion = execSync('node --version', { encoding: 'utf8', timeout: 3000 }).trim()
      console.log(`  - node: ✅ ${nodeVersion}`)
    } catch (e) {
      console.log(`  - node: ❌ 不可用`)
    }

    try {
      const npmVersion = execSync('npm --version', { encoding: 'utf8', timeout: 3000 }).trim()
      console.log(`  - npm: ✅ ${npmVersion}`)
    } catch (e) {
      console.log(`  - npm: ❌ 不可用`)
    }

    try {
      const npxVersion = execSync('npx --version', { encoding: 'utf8', timeout: 3000 }).trim()
      console.log(`  - npx: ✅ ${npxVersion}`)
    } catch (e) {
      console.log(`  - npx: ❌ 不可用`)
    }
  } catch (error) {
    console.error('❌ [主进程] 命令可用性检测失败:', error)
  }

  // 注册LangChain IPC处理器
  registerLangChainHandlers()

  // 🔥 预注册MCP handlers，避免界面加载后出现"No handler registered"错误
  console.log('🔧 [主进程] 预注册MCP IPC处理器...')
  try {
    // 只预注册handlers，不初始化服务
    preRegisterMCPHandlersOnly()
    console.log('✅ [主进程] MCP IPC处理器预注册完成')
  } catch (error) {
    console.error('❌ [主进程] MCP IPC处理器预注册失败:', error)
    // 不阻塞应用启动
  }

  // 先创建窗口，让用户立即看到界面
  createWindow()

  // 异步初始化MCP服务和系统角色，不阻塞界面显示
  initializeBackgroundServices()

  // 注意：不再自动初始化默认模型配置，让用户手动添加
  // 这样首次安装时界面会是空白状态
  console.log('✅ [主进程] 模型管理服务已准备就绪，等待用户配置')

  app.on('activate', () => {
    // macOS 特有行为：点击 dock 图标时重新创建窗口
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// 所有窗口关闭时退出应用（除了 macOS）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 导入服务
import { ConfigService } from './services/core/ConfigService.js'
import { ChatService } from './services/core/ChatService.js'
import { LLMService } from './services/llm/LLMService.js'
import { ModelService } from './services/model/ModelService.js'
import { silentSystemRoleManager } from './services/core/SilentSystemRoleManager.js'

// 初始化服务
const configService = new ConfigService()
const chatService = new ChatService()
const langChainService = new LLMService() // 使用LLM服务
const modelManagementService = new ModelService()

// IPC 通信处理
ipcMain.handle('app:getVersion', () => {
  return app.getVersion()
})

// LLM相关IPC（兼容旧版本）
ipcMain.handle('llm:sendMessage', async (_, message: string, config: any) => {
  try {
    // 使用LangChain集成服务
    const response = await langChainService.sendMessageLegacy(message, config)
    return { success: true, data: response }
  } catch (error) {
    console.error('LangChain API调用失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
})

// 配置相关IPC
ipcMain.handle('config:get', async () => {
  try {
    const config = await configService.getConfig()
    return { success: true, data: config }
  } catch (error) {
    console.error('获取配置失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
})

ipcMain.handle('config:set', async (_, config: any) => {
  try {
    await configService.setConfig(config)
    return { success: true }
  } catch (error) {
    console.error('保存配置失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
})

// 聊天历史相关IPC
ipcMain.handle('chat:getHistory', async () => {
  try {
    const history = await chatService.getChatHistory()
    return { success: true, data: history }
  } catch (error) {
    console.error('获取聊天历史失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
})

ipcMain.handle('chat:saveMessage', async (_, message: any) => {
  try {
    await chatService.saveMessage(message)
    return { success: true }
  } catch (error) {
    console.error('保存消息失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
})

// 新架构：模型管理API
ipcMain.handle('model:getAll', async () => {
  try {
    const configs = await modelManagementService.getAllConfigs()
    return { success: true, data: configs }
  } catch (error) {
    console.error('获取模型配置失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
})

ipcMain.handle('model:save', async (_, config: any) => {
  try {
    await modelManagementService.saveConfig(config)
    return { success: true }
  } catch (error) {
    console.error('保存模型配置失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
})

ipcMain.handle('model:delete', async (_, id: string) => {
  try {
    await modelManagementService.deleteConfig(id)
    return { success: true }
  } catch (error) {
    console.error('删除模型配置失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
})

ipcMain.handle('model:update', async (_, config: any) => {
  try {
    await modelManagementService.updateConfig(config)
    return { success: true }
  } catch (error) {
    console.error('更新模型配置失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
})

ipcMain.handle('model:test', async (_, id: string) => {
  try {
    const result = await langChainService.testProvider(id)
    return { success: true, data: result }
  } catch (error) {
    console.error('测试模型配置失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
})

// 获取动态模型列表
ipcMain.handle('model:fetchModels', async (_, provider: string, apiKey: string, baseURL: string) => {
  try {
    // 创建临时配置用于获取模型列表
    const { ModelConfigEntity } = await import('../shared/entities/ModelConfigEntity.js')
    const { LLMService } = await import('./services/llm/LLMService.js')

    // 使用ModelConfigEntity.create创建实例
    const tempConfig = ModelConfigEntity.create({
      name: 'temp',
      provider,
      model: 'temp',
      apiKey,
      baseURL,
      priority: 1,
      isEnabled: true
    })

    // 使用LangChain架构获取模型列表
    const langChainService = new LLMService()
    const models = await langChainService.getAvailableModels(tempConfig)

    return { success: true, data: models }
  } catch (error) {
    console.error('获取模型列表失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
})

// AI服务API已移至langchainHandlers.ts中统一管理

// 新增：LangChain流式消息API
ipcMain.handle('ai:streamMessage', async (_, request: any) => {
  try {
    // 注意：这里需要特殊处理流式响应，可能需要使用事件发送
    const response = await langChainService.streamMessage(
      request.llmRequest,
      request.configId,
      (chunk: string) => {
        // 发送流式chunk到渲染进程
        mainWindow?.webContents.send('ai:streamChunk', {
          requestId: request.requestId,
          chunk
        })
      }
    )
    return { success: true, data: { content: response } }
  } catch (error) {
    console.error('LangChain流式消息失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
})

// 新增：LangChain批量消息API
ipcMain.handle('ai:batchMessages', async (_, request: any) => {
  try {
    const responses = await langChainService.batchMessages(request.requests, request.configId)
    return { success: true, data: responses }
  } catch (error) {
    console.error('LangChain批量消息失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
})

// 用户偏好管理API
ipcMain.handle('preference:get', async () => {
  try {
    // TODO: 实现用户偏好获取逻辑
    const preferences = {
      theme: 'light',
      language: 'zh-CN',
      autoSave: true
    }
    return { success: true, data: preferences }
  } catch (error) {
    console.error('获取用户偏好失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
})

// 🤖 系统角色调试API（总是注册，但在生产环境中限制功能）
ipcMain.handle('debug:getSystemRoleStatus', async () => {
  try {
    if (!isDev) {
      // 生产环境返回基础状态信息
      return { 
        success: true, 
        data: { 
          status: 'production_mode',
          message: '生产环境不提供详细调试信息'
        } 
      }
    }
    
    const status = silentSystemRoleManager.getSystemRoleStatus()
    return { success: true, data: status }
  } catch (error) {
    console.error('获取系统角色状态失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
})

ipcMain.handle('debug:resetSystemRole', async () => {
  try {
    if (!isDev) {
      // 生产环境不允许重置
      return { 
        success: false, 
        error: '生产环境不支持系统角色重置' 
      }
    }
    
    silentSystemRoleManager.resetSystemRoleState()
    return { success: true }
  } catch (error) {
    console.error('重置系统角色失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
})

ipcMain.handle('preference:save', async (_, _preferences: any) => {
  try {
    // TODO: 实现用户偏好保存逻辑
    // console.log('保存用户偏好:', _preferences)
    return { success: true }
  } catch (error) {
    console.error('保存用户偏好失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
})

// 会话管理API
ipcMain.handle('session:getModel', async (_, _sessionId: string) => {
  try {
    // TODO: 实现会话模型获取逻辑
    // console.log('获取会话模型:', _sessionId)
    return { success: true, data: null }
  } catch (error) {
    console.error('获取会话模型失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
})

ipcMain.handle('session:switchModel', async (_, _sessionId: string, _modelId: string) => {
  try {
    // TODO: 实现会话模型切换逻辑
    // console.log('切换会话模型:', _sessionId, _modelId)
    return { success: true }
  } catch (error) {
    console.error('切换会话模型失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
})

// 安全设置：阻止新窗口创建
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' }
  })
})

// 应用退出前清理
app.on('before-quit', () => {
  console.log('应用即将退出，清理资源...')
  // 注销LangChain IPC处理器
  unregisterLangChainHandlers()
  // 注销MCP IPC处理器
  unregisterMCPHandlers()
})
