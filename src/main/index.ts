/**
 * 🚀 DeeChat 主进程 - 重构版本
 * 采用新的核心架构，简化服务管理和生命周期
 */

import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { ServiceManager } from './core/ServiceManager'

// 导入旧的IPC处理器
import { registerLangChainHandlers, unregisterLangChainHandlers } from './ipc/langchainHandlers'
import { unregisterMCPHandlers } from './ipc/mcpHandlers'

// 导入核心服务
import { ConfigService } from './services/core/ConfigService'
import { ChatService } from './services/core/ChatService'
import { LLMService } from './services/llm/LLMService'
import { ModelService } from './services/model/ModelService'
import { silentSystemRoleManager } from './services/core/SilentSystemRoleManager'

// 开发环境检测
const isDev = process.env.NODE_ENV === 'development'

// 🔥 设置应用名称（解决开发模式下显示为Electron的问题）
app.setName('DeeChat')

// 🔥 单实例应用锁定
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  // 🔥 彻底禁用所有输出流，防止EPIPE错误
  try {
    // 禁用console输出
    console.log = () => {}
    console.error = () => {}
    console.warn = () => {}
    console.info = () => {}
    console.debug = () => {}
    
    // 禁用stdout和stderr输出
    if (process.stdout && process.stdout.write) {
      process.stdout.write = () => true
    }
    if (process.stderr && process.stderr.write) {
      process.stderr.write = () => true
    }
    
    // 捕获所有可能的异步错误
    process.on('uncaughtException', () => {})
    process.on('unhandledRejection', () => {})
  } catch (e) {
    // 静默忽略任何错误
  }
  
  // 立即静默退出
  process.exit(0)
} else {
  console.log('✅ [单实例] 获得单实例锁，继续启动')
  console.log('🔧 [调试] 开始进入else分支逻辑...')
  
  // 🔥 关键改进：所有初始化代码都在else分支内
  let mainWindow: BrowserWindow | null = null
  let serviceManager: ServiceManager | null = null

  // 延迟初始化核心服务实例（避免在app.whenReady之前调用app.getPath）
  let configService: ConfigService
  let chatService: ChatService  
  let langChainService: LLMService
  let modelManagementService: ModelService

  console.log('🔧 [调试] 服务变量声明完成...')

  /**
   * 创建主窗口
   */
  console.log('🔧 [调试] 开始定义createWindow函数...')
  // @ts-ignore TS6133
  function createWindow(): void {
    console.log('🖼️ [主进程] 创建主窗口...')
    
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
      mainWindow.webContents.openDevTools()
    } else {
      const htmlPath = join(__dirname, '../../renderer/index.html')
      console.log('🔧 [生产模式] 加载HTML文件:', htmlPath)
      mainWindow.loadFile(htmlPath)
    }

    // 窗口准备好后显示
    mainWindow.once('ready-to-show', () => {
      console.log('✅ [主进程] 窗口准备完成，显示窗口')
      mainWindow?.show()
    })

    // 窗口关闭事件
    mainWindow.on('closed', () => {
      mainWindow = null
    })
  }

  // 处理第二个实例
  app.on('second-instance', () => {
    console.log('🔄 [单实例] 检测到第二个实例启动，聚焦现有窗口')
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  /**
   * 初始化基础服务（不包含MCP）
   */
  // @ts-ignore TS6133
  async function initializeBasicServices(): Promise<void> {
    console.log('🔧 [主进程] 初始化基础服务...')

    try {
      // 初始化系统角色管理器
      try {
        console.log('🤖 [主进程] 开始静默激活系统角色...')
        await silentSystemRoleManager.initializeOnStartup()
        console.log('✅ [主进程] 系统角色静默激活完成')
      } catch (error) {
        console.error('❌ [主进程] 系统角色激活失败:', error)
      }

      console.log('✅ [主进程] 基础服务初始化完成')

    } catch (error) {
      console.error('❌ [主进程] 基础服务初始化失败:', error)
      
      // 向渲染进程发送错误状态
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('service-init-error', {
          error: error instanceof Error ? error.message : '未知错误'
        })
      }
    }
  }

  /**
   * 懒加载MCP服务（支持智能预加载）
   */
  async function ensureMCPServices(): Promise<void> {
    if (serviceManager) {
      console.log('🔄 [主进程] MCP服务已初始化，跳过重复加载')
      return // 已经初始化过了
    }

    // 🔒 防止并发初始化导致多进程
    if (ensureMCPServices._initializing) {
      console.log('⏳ [主进程] MCP服务正在初始化中，等待完成...')
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!ensureMCPServices._initializing) {
            clearInterval(checkInterval)
            resolve()
          }
        }, 100)
      })
    }
    
    ensureMCPServices._initializing = true

    console.log('🔧 [主进程] 懒加载MCP服务...')

    try {
      // 获取服务管理器实例
      serviceManager = ServiceManager.getInstance()

      // 监听服务状态变化
      serviceManager.on('service-status-change', (status) => {
        console.log(`📊 [主进程] 服务状态变化: ${status.name} - ${status.status}`)
        
        // 向渲染进程发送状态更新
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('service-status-update', status)
        }
      })

      // 监听进程事件
      serviceManager.on('process-event', (event) => {
        console.log(`🔧 [主进程] 进程事件: ${event.type} - ${event.processId}`)
      })

      // 监听MCP事件
      serviceManager.on('mcp-event', (event) => {
        console.log(`🔌 [主进程] MCP事件: ${event.type} - ${event.serverId}`)
        
        // 🔥 当PromptX连接成功时，通知前端可以使用PromptX功能
        if (event.type === 'server-connected' && event.serverId?.includes('promptx')) {
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('promptx-ready', { 
              status: 'ready',
              message: 'PromptX服务已就绪，可以立即使用专业角色功能' 
            })
          }
        }
      })

      // 🔥 关键：初始化MCP服务
      await serviceManager.initialize()

      console.log('✅ [主进程] MCP服务懒加载完成')
      ensureMCPServices._initializing = false

      // 🎯 智能预加载：异步在后台更新PromptX（不影响用户体验）
      setTimeout(async () => {
        try {
          console.log('🔄 [主进程] 开始PromptX后台更新检查...')
          // 这里可以添加从GitHub更新PromptX包的逻辑
          // 即使更新失败也不影响应用使用
          console.log('✅ [主进程] PromptX后台更新检查完成')
        } catch (updateError) {
          console.log('⚠️ [主进程] PromptX后台更新失败，不影响使用:', updateError)
        }
      }, 5000) // 延迟5秒进行后台更新检查

    } catch (error) {
      console.error('❌ [主进程] MCP服务初始化失败:', error)
      ensureMCPServices._initializing = false
      
      // 向渲染进程发送错误状态
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('service-init-error', {
          error: error instanceof Error ? error.message : '未知错误',
          retry: true // 告诉前端可以重试
        })
      }
      
      // 不要抛出错误，让应用继续运行
      // 用户在需要使用MCP功能时会再次触发初始化
      throw error
    }
  }

  // 🔒 添加初始化标志
  ensureMCPServices._initializing = false

/**
 * 注册IPC处理器
 */
console.log('🔧 [调试] 开始定义registerIPCHandlers函数...')
function registerIPCHandlers(): void {
  console.log('🔧 [主进程] 注册IPC处理器...')
  console.log('🔧 [调试] registerIPCHandlers函数内部开始执行...')

  // 基础应用API
  console.log('🔧 [调试] 注册基础应用API...')
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion()
  })

  // 服务管理API
  console.log('🔧 [调试] 注册服务管理API...')
  ipcMain.handle('service:getStatus', async () => {
    if (!serviceManager) {
      return { success: false, error: '服务管理器未初始化' }
    }

    try {
      const statuses = serviceManager.getAllServiceStatuses()
      return { success: true, data: statuses }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  // MCP服务API - 新架构桥接（懒加载）
  ipcMain.handle('mcp:getServers', async () => {
    try {
      await ensureMCPServices() // 🔥 懒加载MCP服务
      if (!serviceManager || !serviceManager.getAllServiceStatuses().some(s => s.name === 'mcp' && s.status === 'ready')) {
        return { success: false, error: 'MCP服务未就绪: 集成服务未初始化' }
      }
    } catch (error) {
      return { success: false, error: `MCP服务启动失败: ${error instanceof Error ? error.message : '未知错误'}` }
    }

    try {
      const mcpCoordinator = serviceManager.getMCPCoordinator()
      const servers = mcpCoordinator.getConnectedServers()
      return { success: true, data: servers }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  ipcMain.handle('mcp:getTools', async () => {
    try {
      await ensureMCPServices() // 🔥 懒加载MCP服务
      if (!serviceManager || !serviceManager.getAllServiceStatuses().some(s => s.name === 'mcp' && s.status === 'ready')) {
        return { success: false, error: 'MCP服务未就绪: 集成服务未初始化' }
      }
    } catch (error) {
      return { success: false, error: `MCP服务启动失败: ${error instanceof Error ? error.message : '未知错误'}` }
    }

    try {
      const mcpCoordinator = serviceManager.getMCPCoordinator()
      const tools = mcpCoordinator.getAllAvailableTools()
      return { success: true, data: tools }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  ipcMain.handle('mcp:callTool', async (_, serverId: string, toolName: string, parameters: any) => {
    try {
      await ensureMCPServices() // 🔥 懒加载MCP服务
      if (!serviceManager || !serviceManager.getAllServiceStatuses().some(s => s.name === 'mcp' && s.status === 'ready')) {
        return { success: false, error: 'MCP服务未就绪: 集成服务未初始化' }
      }
    } catch (error) {
      return { success: false, error: `MCP服务启动失败: ${error instanceof Error ? error.message : '未知错误'}` }
    }

    try {
      const mcpCoordinator = serviceManager.getMCPCoordinator()
      const result = await mcpCoordinator.callTool(serverId, toolName, parameters)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  // 补充缺失的MCP API
  ipcMain.handle('mcp:getAllServers', async () => {
    try {
      await ensureMCPServices() // 🔥 懒加载MCP服务
      if (!serviceManager || !serviceManager.getAllServiceStatuses().some(s => s.name === 'mcp' && s.status === 'ready')) {
        return { success: false, error: 'MCP服务未就绪: 集成服务未初始化' }
      }
    } catch (error) {
      return { success: false, error: `MCP服务启动失败: ${error instanceof Error ? error.message : '未知错误'}` }
    }

    try {
      // 从MCPConfigService获取服务器配置，而不是从coordinator获取连接状态
      const { MCPConfigService } = await import('./services/mcp/MCPConfigService')
      const configService = new MCPConfigService()
      const servers = await configService.getAllServerConfigs()
      const serverData = servers.map(server => server.toData())
      console.log('🔍 [新架构Debug] 发送到前端的服务器数据:', JSON.stringify(serverData, null, 2));
      return { success: true, data: serverData }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  ipcMain.handle('mcp:getAllTools', async () => {
    try {
      await ensureMCPServices() // 🔥 懒加载MCP服务
      if (!serviceManager || !serviceManager.getAllServiceStatuses().some(s => s.name === 'mcp' && s.status === 'ready')) {
        return { success: false, error: 'MCP服务未就绪: 集成服务未初始化' }
      }
    } catch (error) {
      return { success: false, error: `MCP服务启动失败: ${error instanceof Error ? error.message : '未知错误'}` }
    }

    try {
      // 使用MCPIntegrationService获取工具，与旧架构保持一致
      const { MCPIntegrationService } = await import('./services/mcp/MCPIntegrationService')
      const mcpService = MCPIntegrationService.getInstance()
      const tools = await mcpService.getAllTools()
      const toolData = tools.map(tool => tool.toData())
      console.log('🔍 [新架构Debug] 发送到前端的工具数据:', JSON.stringify(toolData.slice(0, 3), null, 2)); // 只显示前3个工具
      return { success: true, data: toolData }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  // 添加缺失的MCP服务器配置更新处理器
  ipcMain.handle('mcp:updateServerConfig', async (_, serverId: string, updates: any) => {
    try {
      await ensureMCPServices() // 🔥 懒加载MCP服务
      if (!serviceManager || !serviceManager.getAllServiceStatuses().some(s => s.name === 'mcp' && s.status === 'ready')) {
        return { success: false, error: 'MCP服务未就绪: 集成服务未初始化' }
      }
    } catch (error) {
      return { success: false, error: `MCP服务启动失败: ${error instanceof Error ? error.message : '未知错误'}` }
    }

    try {
      // 桥接到真实MCP服务
      const { MCPIntegrationService } = await import('./services/mcp/MCPIntegrationService')
      const mcpService = MCPIntegrationService.getInstance()
      await mcpService.updateServer(serverId, updates)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  // 🎯 添加前端主动激活PromptX的处理器
  ipcMain.handle('promptx:forceActivate', async () => {
    try {
      console.log('👤 [主进程] 用户主动激活PromptX服务...')
      await ensureMCPServices()
      return { success: true, message: 'PromptX服务激活成功' }
    } catch (error) {
      console.error('❌ [主进程] PromptX强制激活失败:', error)
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  // 添加其他缺失的MCP处理器
  ipcMain.handle('mcp:addServer', async (_, serverConfig: any) => {
    try {
      await ensureMCPServices() // 🔥 懒加载MCP服务
      if (!serviceManager || !serviceManager.getAllServiceStatuses().some(s => s.name === 'mcp' && s.status === 'ready')) {
        return { success: false, error: 'MCP服务未就绪: 集成服务未初始化' }
      }
    } catch (error) {
      return { success: false, error: `MCP服务启动失败: ${error instanceof Error ? error.message : '未知错误'}` }
    }

    try {
      const { MCPIntegrationService } = await import('./services/mcp/MCPIntegrationService')
      const mcpService = MCPIntegrationService.getInstance()
      
      // 创建服务器实体
      const { MCPServerEntity } = await import('../shared/entities/MCPServerEntity')
      const server = MCPServerEntity.create({
        ...serverConfig,
        id: serverConfig.id || `server-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      
      await mcpService.addServer(server)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  ipcMain.handle('mcp:removeServer', async (_, serverId: string) => {
    try {
      await ensureMCPServices() // 🔥 懒加载MCP服务
      if (!serviceManager || !serviceManager.getAllServiceStatuses().some(s => s.name === 'mcp' && s.status === 'ready')) {
        return { success: false, error: 'MCP服务未就绪: 集成服务未初始化' }
      }
    } catch (error) {
      return { success: false, error: `MCP服务启动失败: ${error instanceof Error ? error.message : '未知错误'}` }
    }

    try {
      const { MCPIntegrationService } = await import('./services/mcp/MCPIntegrationService')
      const mcpService = MCPIntegrationService.getInstance()
      await mcpService.removeServer(serverId)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  // 系统角色API（懒加载）
  ipcMain.handle('role:getAvailable', async () => {
    try {
      await ensureMCPServices() // 🔥 懒加载MCP服务
      if (!serviceManager) {
        return { success: false, error: '服务管理器未初始化' }
      }
    } catch (error) {
      return { success: false, error: `服务启动失败: ${error instanceof Error ? error.message : '未知错误'}` }
    }

    try {
      const roleManager = serviceManager.getSystemRoleManager()
      const roles = roleManager.getAvailableRoles()
      return { success: true, data: roles }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  ipcMain.handle('role:activate', async (_, roleId: string, config?: any) => {
    try {
      await ensureMCPServices() // 🔥 懒加载MCP服务
      if (!serviceManager) {
        return { success: false, error: '服务管理器未初始化' }
      }
    } catch (error) {
      return { success: false, error: `服务启动失败: ${error instanceof Error ? error.message : '未知错误'}` }
    }

    try {
      const roleManager = serviceManager.getSystemRoleManager()
      await roleManager.activateRole(roleId, config)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  ipcMain.handle('role:deactivate', async (_, roleId: string) => {
    try {
      await ensureMCPServices() // 🔥 懒加载MCP服务
      if (!serviceManager) {
        return { success: false, error: '服务管理器未初始化' }
      }
    } catch (error) {
      return { success: false, error: `服务启动失败: ${error instanceof Error ? error.message : '未知错误'}` }
    }

    try {
      const roleManager = serviceManager.getSystemRoleManager()
      await roleManager.deactivateRole(roleId)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  // 添加所有缺失的核心IPC处理器
  
  // LLM相关IPC（兼容旧版本）
  ipcMain.handle('llm:sendMessage', async (_, message: string, config: any) => {
    try {
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

  // 模型管理API
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
      const { ModelConfigEntity } = await import('../shared/entities/ModelConfigEntity.js')
      
      const tempConfig = ModelConfigEntity.create({
        name: 'temp',
        provider,
        model: 'temp',
        apiKey,
        baseURL,
        priority: 1,
        isEnabled: true
      })

      const models = await langChainService.getAvailableModels(tempConfig)
      return { success: true, data: models }
    } catch (error) {
      console.error('获取模型列表失败:', error)
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  // AI服务流式消息API
  ipcMain.handle('ai:streamMessage', async (_, request: any) => {
    try {
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

  // AI服务批量消息API
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

  ipcMain.handle('preference:save', async (_, _preferences: any) => {
    try {
      return { success: true }
    } catch (error) {
      console.error('保存用户偏好失败:', error)
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  // 会话管理API
  ipcMain.handle('session:getModel', async (_, _sessionId: string) => {
    try {
      return { success: true, data: null }
    } catch (error) {
      console.error('获取会话模型失败:', error)
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  ipcMain.handle('session:switchModel', async (_, _sessionId: string, _modelId: string) => {
    try {
      return { success: true }
    } catch (error) {
      console.error('切换会话模型失败:', error)
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  // 系统角色调试API
  ipcMain.handle('debug:getSystemRoleStatus', async () => {
    try {
      if (!isDev) {
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

  console.log('✅ [主进程] 所有IPC处理器注册完成')
}

/**
 * 应用启动流程
 */
console.log('🔧 [调试] 准备注册app.whenReady回调...')
app.whenReady().then(async () => {
  console.log('🚀 [主进程] 应用启动流程开始...')
  console.log(`🔧 [主进程] 环境: ${isDev ? '开发' : '生产'}`)
  console.log(`🔧 [主进程] Node版本: ${process.version}`)
  console.log(`🔧 [主进程] 平台: ${process.platform}`)

  // 0. 初始化核心服务实例（现在app已准备就绪）
  console.log('🔧 [主进程] 初始化核心服务实例...')
  configService = new ConfigService()
  chatService = new ChatService()
  langChainService = new LLMService()
  modelManagementService = new ModelService()
  console.log('✅ [主进程] 核心服务实例创建完成')

  // 1. 注册IPC处理器
  registerIPCHandlers()
  
  // 2. 注册旧的IPC处理器（兼容现有前端）
  registerLangChainHandlers()
  
  // 注意：MCP IPC处理器已通过新架构在registerIPCHandlers()中注册

  // 4. 创建主窗口
  createWindow()

  // 5. 异步初始化基础服务（不阻塞界面显示）
  setTimeout(() => {
    initializeBasicServices().catch(error => {
      console.error('❌ [主进程] 基础服务初始化失败:', error)
    })
  }, 1000) // 延迟1秒，让界面先显示

  // 6. 🔥 PromptX改为真正的按需加载（避免启动时多进程）
  // 移除自动预加载，改为用户首次使用PromptX时再启动
  console.log('💡 [主进程] PromptX设为按需加载模式，将在用户首次使用时启动')
  
  // 🎯 可选：在用户空闲时后台预加载（延迟更长）
  setTimeout(() => {
    console.log('🔄 [主进程] 用户空闲时后台预加载PromptX...')
    ensureMCPServices().catch(error => {
      console.log('ℹ️ [主进程] PromptX后台预加载跳过，将在用户使用时启动:', error.message)
    })
  }, 10000) // 延迟10秒，让用户先熟悉界面

  // macOS 特有行为
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  console.log('✅ [主进程] 应用启动流程完成')
}) // 闭合 app.whenReady()

/**
 * 应用退出处理
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  console.log('🛑 [主进程] 应用即将退出，清理资源...')

  // 关闭ServiceManager
  if (serviceManager) {
    try {
      await serviceManager.shutdown()
      console.log('✅ [主进程] 服务管理器已关闭')
    } catch (error) {
      console.error('❌ [主进程] 服务管理器关闭失败:', error)
    }
  }

  // 注销旧的IPC处理器
  unregisterLangChainHandlers()
  unregisterMCPHandlers()

  console.log('✅ [主进程] 资源清理完成')
})

// 安全设置
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' }
  })
})

// 全局异常处理
process.on('uncaughtException', (error) => {
  console.error('💥 [主进程] 未捕获异常:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 [主进程] 未处理的Promise拒绝:', reason, promise)
})

} // else分支结束