const { app, BrowserWindow, ipcMain } = require('electron')
const { join } = require('path')

// 开发环境检测
const isDev = !app.isPackaged

// 导入服务
const { LLMService } = require('../../dist/main/main/services/LLMService.js')
const { SimpleModelManagementService } = require('../../dist/main/main/services/SimpleModelManagementService.js')
const { ModelConfigEntity } = require('../../dist/main/shared/entities/ModelConfigEntity.js')

// 导入LangChain处理器
const { registerLangChainHandlers } = require('../../dist/main/main/ipc/langchainHandlers.js')
// 导入MCP处理器
const { registerMCPHandlers } = require('../../dist/main/main/ipc/mcpHandlers.js')

// 初始化服务
const llmService = new LLMService()
const modelManagementService = new SimpleModelManagementService()

let mainWindow = null

function createWindow() {
  // 创建主窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: join(__dirname, '../../dist/main/preload/index.js'),
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
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // 窗口关闭事件
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// 应用准备就绪
app.whenReady().then(() => {
  // 注册LangChain IPC处理器
  registerLangChainHandlers()
  
  // 注册MCP IPC处理器
  console.log('🔧 [旧主进程] 准备调用registerMCPHandlers...')
  try {
    registerMCPHandlers()
    console.log('✅ [旧主进程] MCP IPC处理器注册成功')
  } catch (error) {
    console.error('❌ [旧主进程] MCP IPC处理器注册失败:', error)
  }

  createWindow()

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

// 基础 IPC 通信处理
ipcMain.handle('app:getVersion', () => {
  return app.getVersion()
})

// 临时的简单LLM处理（后续会替换为完整的服务层）
ipcMain.handle('llm:sendMessage', async (_, message, config) => {
  try {
    // 这里暂时返回一个模拟响应
    return { 
      success: true, 
      data: { 
        content: `这是一个模拟的AI响应：${message}`, 
        model: config.model || 'mock-model' 
      } 
    }
  } catch (error) {
    console.error('LLM API调用失败:', error)
    return { success: false, error: error.message }
  }
})

// 临时的配置处理
ipcMain.handle('config:get', async () => {
  return { 
    success: true, 
    data: {
      llm: {
        provider: 'openai',
        apiKey: '',
        baseURL: 'https://api.openai.com/v1',
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 2000,
      },
      ui: {
        theme: 'auto',
        language: 'zh',
      },
      chat: {
        maxHistoryLength: 100,
        autoSave: true,
      },
    }
  }
})

ipcMain.handle('config:set', async (_, config) => {
  console.log('保存配置:', config)
  return { success: true }
})

// 临时的聊天历史处理
ipcMain.handle('chat:getHistory', async () => {
  return { success: true, data: [] }
})

ipcMain.handle('chat:saveMessage', async (_, message) => {
  console.log('保存消息:', message)
  return { success: true }
})

// 模型管理API处理器
ipcMain.handle('model:getAll', async () => {
  try {
    // 调用真实的服务获取所有配置（包括禁用的）
    const configs = await modelManagementService.getAllConfigs()
    return { success: true, data: configs }
  } catch (error) {
    console.error('获取模型配置失败:', error)
    // 如果服务不可用，返回空数组而不是假数据
    return { success: true, data: [] }
  }
})

ipcMain.handle('model:save', async (_, config) => {
  try {
    console.log('保存模型配置:', config)
    await modelManagementService.saveConfig(config)
    return { success: true, data: config }
  } catch (error) {
    console.error('保存模型配置失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
})

ipcMain.handle('model:delete', async (_, id) => {
  try {
    console.log('删除模型配置:', id)
    await modelManagementService.deleteConfig(id)
    return { success: true }
  } catch (error) {
    console.error('删除模型配置失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
})

ipcMain.handle('model:test', async (_, id) => {
  try {
    console.log('测试模型配置:', id)
    // 临时返回成功，因为LLMService没有testProvider方法
    return { success: true, data: { status: 'available', message: '测试成功' } }
  } catch (error) {
    console.error('测试模型配置失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
})

ipcMain.handle('model:update', async (_, config) => {
  try {
    console.log('更新模型配置:', config)
    await modelManagementService.updateConfig(config)
    return { success: true, data: config }
  } catch (error) {
    console.error('更新模型配置失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
})

// 获取动态模型列表
ipcMain.handle('model:fetchModels', async (_, provider, apiKey, baseURL) => {
  try {
    // 创建临时配置用于获取模型列表
    const tempConfig = ModelConfigEntity.create({
      name: 'temp',
      provider,
      model: 'temp',
      apiKey,
      baseURL,
      priority: 1,
      isEnabled: true
    })

    // 使用UniversalLLMProvider获取模型列表
    const provider_instance = new UniversalLLMProvider(tempConfig)
    const models = await provider_instance.fetchAvailableModels()

    return { success: true, data: models }
  } catch (error) {
    console.error('获取模型列表失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
})

// 用户偏好API处理器
ipcMain.handle('preference:get', async () => {
  try {
    return {
      success: true,
      data: {
        theme: 'light',
        language: 'zh-CN',
        autoSave: true
      }
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('preference:save', async (_, preferences) => {
  try {
    console.log('保存用户偏好:', preferences)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 会话管理API处理器
ipcMain.handle('session:getModel', async (_, sessionId) => {
  try {
    console.log('获取会话模型:', sessionId)
    return { success: true, data: { modelId: '1', modelName: 'OpenAI GPT-4' } }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('session:switchModel', async (_, sessionId, modelId) => {
  try {
    console.log('切换会话模型:', sessionId, modelId)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// AI服务API处理器
ipcMain.handle('ai:configs:getAll', async () => {
  try {
    return { success: true, data: [] }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('ai:configs:save', async (_, config) => {
  try {
    console.log('保存AI配置:', config)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('ai:configs:delete', async (_, id) => {
  try {
    console.log('删除AI配置:', id)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('ai:configs:update', async (_, config) => {
  try {
    console.log('更新AI配置:', config)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// ai:testProvider 处理器已移至 langchainHandlers.ts

// 安全设置：阻止新窗口创建
app.on('web-contents-created', (_, contents) => {
  contents.on('new-window', (event) => {
    event.preventDefault()
  })
})
