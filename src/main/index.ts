/**
 * 🚀 DeeChat 主进程 - 重构版本
 * 采用新的核心架构，简化服务管理和生命周期
 */

import { app, BrowserWindow, ipcMain } from 'electron'
import * as path from 'path'
const { join } = path
import * as fs from 'fs'
import { ServiceManager } from './core/ServiceManager'

// 导入旧的IPC处理器
import { registerLangChainHandlers, unregisterLangChainHandlers } from './ipc/langchainHandlers'
import { unregisterMCPHandlers } from './ipc/mcpHandlers'
import { registerPromptXHandlers } from './ipc/promptxHandlers'
import { getPromptXLocalService } from './services/promptx/PromptXLocalService'

// 导入核心服务
import { ConfigService } from './services/core/ConfigService'
import { ChatService } from './services/core/ChatService'
import { LLMService } from './services/llm/LLMService'
import { ModelService } from './services/model/ModelService'
import { LocalStorageService } from './services/core/LocalStorageService'
import { FrontendUserPreferenceRepository } from './repositories/FrontendUserPreferenceRepository'
import { UserPreferenceEntity } from '../shared/entities/UserPreferenceEntity'

// 开发环境检测
const isDev = process.env.NODE_ENV === 'development'

// 移除复杂的端口检测，使用标准的Vite环境变量方案

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
  let localStorageService: LocalStorageService
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
      // 🎯 使用标准的Vite环境变量方案，自动适配端口变化
      if (process.env.VITE_DEV_SERVER_URL) {
        console.log('🔧 [开发模式] 加载Vite开发服务器:', process.env.VITE_DEV_SERVER_URL)
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
      } else {
        // 降级到默认URL（通常不会执行到这里）
        const fallbackUrl = 'http://localhost:5173'
        console.log('⚠️ [开发模式] VITE_DEV_SERVER_URL未设置，使用默认URL:', fallbackUrl)
        mainWindow.loadURL(fallbackUrl)
      }
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
      // 🔥 旧的SystemRoleManager初始化已删除，使用智能分层提示词系统代替

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
   * 确保MCP服务已初始化（简化版本）
   * 
   * 注意：ServiceManager已在启动时初始化，这里只是确认MCP服务状态
   */
  async function ensureMCPServices(): Promise<void> {
    const callId = Math.random().toString(36).substr(2, 8)
    console.log(`🔥 [TRACE-${callId}] ensureMCPServices被调用`)
    
    if (!serviceManager) {
      console.log(`❌ [TRACE-${callId}] ServiceManager未初始化`)
      throw new Error('ServiceManager未初始化')
    }

    // 检查MCP服务状态
    const mcpStatus = serviceManager.getServiceStatus('mcp')
    console.log(`🔍 [TRACE-${callId}] MCP状态检查结果:`, mcpStatus)
    
    if (mcpStatus && mcpStatus.status === 'ready') {
      console.log(`✅ [TRACE-${callId}] MCP服务已就绪`)
      return
    }

    // 如果MCP服务未就绪，等待一段时间
    console.log(`⏳ [TRACE-${callId}] MCP服务未就绪，等待初始化完成...`)
    
    return new Promise((resolve, reject) => {
      let attempts = 0
      const maxAttempts = 100 // 10秒超时
      
      const checkInterval = setInterval(() => {
        attempts++
        const status = serviceManager?.getServiceStatus('mcp')
        
        if (status && status.status === 'ready') {
          clearInterval(checkInterval)
          console.log(`✅ [TRACE-${callId}] MCP服务已就绪`)
          resolve()
        } else if (attempts >= maxAttempts) {
          clearInterval(checkInterval)
          console.log(`⏰ [TRACE-${callId}] 等待MCP服务超时`)
          reject(new Error('MCP服务初始化超时'))
        } else {
          console.log(`🔄 [TRACE-${callId}] 等待MCP服务就绪... (${attempts}/${maxAttempts})`)
        }
      }, 100)
    })
  }

/**
 * 初始化PromptX工作区
 */
async function initializePromptXWorkspace(): Promise<void> {
  console.log('🎯 [主进程] 开始初始化PromptX工作区...')
  
  try {
    const promptxService = getPromptXLocalService()
    const workspacePath = path.join(app.getPath('userData'), 'promptx-workspace')
    
    // 确保工作区目录存在
    if (!fs.existsSync(workspacePath)) {
      fs.mkdirSync(workspacePath, { recursive: true })
    }
    
    // 初始化PromptX工作区（PromptXLocalService 将在首次使用时自动初始化）
    const result = await promptxService.initWorkspace(workspacePath, 'electron')
    
    if (result.success) {
      console.log('✅ [主进程] PromptX工作区初始化成功:', workspacePath)
    } else {
      console.warn('⚠️ [主进程] PromptX工作区初始化失败:', result.error)
      // 不抛出错误，允许应用继续运行
    }
  } catch (error) {
    console.error('❌ [主进程] PromptX工作区初始化异常:', error)
    // 不抛出错误，允许应用继续运行
  }
}

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

  // 文件服务API
  console.log('🔧 [调试] 注册文件服务API...')
  ipcMain.handle('file:upload', async (_event, fileBuffer: Buffer, metadata: { name: string; mimeType: string }) => {
    try {
      const fileService = (global as any).fileService
      if (!fileService) {
        return { success: false, error: '文件服务未初始化' }
      }
      
      const fileId = await fileService.saveAttachment(fileBuffer, metadata)
      return { success: true, data: { fileId } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  ipcMain.handle('file:get', async (_event, fileId: string) => {
    try {
      const fileService = (global as any).fileService
      if (!fileService) {
        return { success: false, error: '文件服务未初始化' }
      }
      
      const fileData = await fileService.getAttachment(fileId)
      return { success: true, data: fileData }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  ipcMain.handle('file:getContent', async (_event, fileId: string) => {
    try {
      const fileService = (global as any).fileService
      if (!fileService) {
        return { success: false, error: '文件服务未初始化' }
      }
      
      const content = await fileService.getAttachmentContent(fileId)
      return { success: true, data: content }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  ipcMain.handle('file:delete', async (_event, fileId: string) => {
    try {
      const fileService = (global as any).fileService
      if (!fileService) {
        return { success: false, error: '文件服务未初始化' }
      }
      
      await fileService.deleteAttachment(fileId)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  // ResourcesPage需要的文件管理API
  ipcMain.handle('file:list', async (_event, options?: { category?: string }) => {
    try {
      const fileService = (global as any).fileService
      if (!fileService) {
        console.error('❌ [文件列表] FileService未初始化')
        return []
      }
      
      console.log('📋 [文件列表] ResourcesPage请求文件列表:', options)
      const fileList = await fileService.scanPromptXResources(options?.category)
      console.log(`✅ [文件列表] 返回 ${fileList.length} 个文件`)
      
      return fileList
    } catch (error) {
      console.error('❌ [文件列表] 获取失败:', error)
      return []
    }
  })

  ipcMain.handle('file:tree', async (_event, category?: string) => {
    try {
      const fileService = (global as any).fileService
      if (!fileService) {
        console.error('❌ [文件树] FileService未初始化')
        return []
      }
      
      console.log('🌳 [文件树] ResourcesPage请求文件树:', category)
      const tree = await fileService.buildFileTree(category)
      console.log(`✅ [文件树] 返回 ${tree.length} 个根节点`)
      
      return tree
    } catch (error) {
      console.error('❌ [文件树] 获取失败:', error)
      return []
    }
  })

  ipcMain.handle('file:stats', async () => {
    try {
      const fileService = (global as any).fileService
      if (!fileService) {
        console.error('❌ [文件统计] FileService未初始化')
        return {
          totalFiles: 0,
          totalSize: 0,
          byCategory: {},
          byType: {}
        }
      }
      
      console.log('📊 [文件统计] ResourcesPage请求统计信息')
      const stats = await fileService.getFileStats()
      console.log(`✅ [文件统计] 返回统计信息: ${stats.totalFiles} 个文件`)
      
      return stats
    } catch (error) {
      console.error('❌ [文件统计] 获取失败:', error)
      return {
        totalFiles: 0,
        totalSize: 0,
        byCategory: {},
        byType: {}
      }
    }
  })

  // 添加文件内容读取和更新API，支持ResourcesPage的编辑功能
  ipcMain.handle('file:read', async (_event, fileId: string) => {
    try {
      const fileService = (global as any).fileService
      if (!fileService) {
        throw new Error('FileService未初始化')
      }
      
      console.log(`📖 [文件读取] 读取文件内容: ${fileId}`)
      const content = await fileService.readFileContent(fileId)
      console.log(`✅ [文件读取] 成功读取文件，长度: ${content.length} 字符`)
      
      return content
    } catch (error) {
      console.error(`❌ [文件读取] 读取失败: ${fileId}`, error)
      throw error
    }
  })

  ipcMain.handle('file:updateContent', async (_event, fileId: string, content: string) => {
    try {
      const fileService = (global as any).fileService
      if (!fileService) {
        throw new Error('FileService未初始化')
      }
      
      console.log(`✍️ [文件更新] 更新文件内容: ${fileId}，长度: ${content.length} 字符`)
      await fileService.updateFileContent(fileId, content)
      console.log(`✅ [文件更新] 成功更新文件: ${fileId}`)
      
      return { success: true }
    } catch (error) {
      console.error(`❌ [文件更新] 更新失败: ${fileId}`, error)
      throw error
    }
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
    console.log('📞 [IPC] mcp:getServers被调用')
    try {
      console.log('📞 [IPC] mcp:getServers调用ensureMCPServices')
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
    console.log('📞 [IPC] mcp:getTools被调用')
    try {
      console.log('📞 [IPC] mcp:getTools调用ensureMCPServices')
      await ensureMCPServices() // 🔥 懒加载MCP服务
      if (!serviceManager || !serviceManager.getAllServiceStatuses().some(s => s.name === 'mcp' && s.status === 'ready')) {
        return { success: false, error: 'MCP服务未就绪: 集成服务未初始化' }
      }
    } catch (error) {
      return { success: false, error: `MCP服务启动失败: ${error instanceof Error ? error.message : '未知错误'}` }
    }

    try {
      const mcpCoordinator = serviceManager.getMCPCoordinator()
      const tools = await mcpCoordinator.getAllAvailableTools()
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
      const { MCPConfigService } = await import('./services/mcp/client/MCPConfigService')
      const configService = new MCPConfigService()
      const servers = await configService.getAllServerConfigs()
      const serverData = servers.map(server => server.toData())
      console.log('🔍 [新架构Debug] 发送到前端的服务器数据:', JSON.stringify(serverData, null, 2));
      return { success: true, data: serverData }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  // 🔥 采用官方SDK标准方式 - 按需获取工具，无需复杂初始化
  ipcMain.handle('mcp:getAllTools', async () => {
    try {
      console.log('📡 [主进程] 收到前端getAllTools请求，开始处理...')
      
      // 直接获取MCPIntegrationService实例（按需初始化）
      const { MCPIntegrationService } = await import('./services/mcp/client/MCPIntegrationService')
      const mcpService = MCPIntegrationService.getInstance()
      
      // 确保服务初始化（仅在需要时）
      console.log('🔧 [主进程] 确保MCP服务已初始化...')
      await mcpService.initialize()
      
      // 获取所有工具
      console.log('🔍 [主进程] 获取所有缓存工具...')
      const tools = await mcpService.getAllTools()
      console.log(`📦 [主进程] 从MCPIntegrationService获取到 ${tools.length} 个工具`)
      
      // 转换为前端数据格式
      const toolData = tools.map(tool => tool.toData())
      console.log('📡 [主进程] 工具列表响应:', { success: true, count: toolData.length })
      
      // 详细输出工具信息用于调试
      if (toolData.length > 0) {
        console.log('🔧 [主进程] 工具详情（前3个）:')
        toolData.slice(0, 3).forEach((tool, index) => {
          console.log(`  ${index + 1}. ${tool.name} - ${tool.description || '无描述'}`)
        })
      } else {
        console.log('⚠️ [主进程] 没有找到任何工具')
      }
      
      return { success: true, data: toolData }
    } catch (error) {
      console.error('❌ [主进程] getAllTools处理失败:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误',
        details: error instanceof Error ? error.stack : undefined
      }
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
      const { MCPIntegrationService } = await import('./services/mcp/client/MCPIntegrationService')
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
      const { MCPIntegrationService } = await import('./services/mcp/client/MCPIntegrationService')
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
      const { MCPIntegrationService } = await import('./services/mcp/client/MCPIntegrationService')
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
  
  // LLM相关IPC（启用MCP工具支持）
  ipcMain.handle('llm:sendMessage', async (_, message: string, config: any) => {
    try {
      // 🔥 启用MCP工具支持让AI能主动调用PromptX工具
      console.log('🔧 [IPC] 使用MCP工具发送消息，配置:', JSON.stringify(config, null, 2))
      
      // 提取配置参数
      const { 
        configId = 'default',
        sessionId = `session_${Date.now()}`,
        currentRole,
        systemPrompt 
      } = config || {}
      
      // 构建LLMRequest对象
      const llmRequest = {
        message: message,
        sessionId: sessionId,
        activeRole: currentRole?.id, // 传递当前激活的角色ID
        systemPrompt: systemPrompt,
        attachmentIds: []
      }
      
      // 使用带MCP工具支持的方法
      const response = await langChainService.sendMessageWithMCPTools(
        llmRequest,
        configId,
        true, // 启用MCP工具
        [] // 暂时不传历史消息
      )
      
      console.log('✅ [IPC] MCP工具消息发送成功')
      return { success: true, data: { content: response.content, model: response.model } }
    } catch (error) {
      console.error('❌ [IPC] MCP工具消息发送失败:', error)
      
      // 降级到传统方法
      try {
        console.log('⚠️ [IPC] 降级到传统消息发送方法')
        const response = await langChainService.sendMessageLegacy(message, config)
        return { success: true, data: response }
      } catch (fallbackError) {
        console.error('❌ [IPC] 降级方法也失败:', fallbackError)
        return { success: false, error: fallbackError instanceof Error ? fallbackError.message : '未知错误' }
      }
    }
  })

  // 🔥 旧的SystemRoleManager IPC处理器已删除，使用智能分层提示词系统代替

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
  const userPreferenceRepository = new FrontendUserPreferenceRepository(localStorageService)
  
  ipcMain.handle('preference:get', async () => {
    try {
      const preferences = await userPreferenceRepository.get()
      return { success: true, data: preferences.toData() }
    } catch (error) {
      console.error('获取用户偏好失败:', error)
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  ipcMain.handle('preference:save', async (_, preferencesData: any) => {
    try {
      const preferences = new UserPreferenceEntity(preferencesData)
      await userPreferenceRepository.save(preferences)
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
      
      return { success: true, data: { status: 'legacy_system_removed' } }
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
      
      return { success: true, message: 'legacy_system_removed' }
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

  // 🎯 预先设置PromptX环境变量，避免ProjectManager路径解析错误
  const promptxWorkspacePath = path.join(app.getPath('userData'), 'promptx-workspace')
  process.env.PROMPTX_PROJECT_PATH = promptxWorkspacePath
  process.env.PROMPTX_WORKSPACE = promptxWorkspacePath
  process.env.PROJECT_ROOT = promptxWorkspacePath
  process.env.WORKSPACE_ROOT = promptxWorkspacePath
  // 确保工作区目录存在
  if (!fs.existsSync(promptxWorkspacePath)) {
    fs.mkdirSync(promptxWorkspacePath, { recursive: true })
  }
  console.log(`🎯 [主进程] 预设PromptX工作区路径: ${promptxWorkspacePath}`)

  // 0. 初始化ServiceManager和核心服务（现在app已准备就绪）
  console.log('🔧 [主进程] 通过ServiceManager初始化核心服务...')
  
  try {
    // 创建ServiceManager并初始化基础设施
    serviceManager = ServiceManager.getInstance()
    
    // 注册ServiceManager事件监听器
    serviceManager.on('service-status-change', (status) => {
      console.log(`📊 [主进程] 服务状态变化: ${status.name} - ${status.status}`)
      
      // 向渲染进程发送状态更新
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('service-status-update', status)
      }
    })

    serviceManager.on('process-event', (event) => {
      console.log(`🔧 [主进程] 进程事件: ${event.type} - ${event.processId}`)
    })

    serviceManager.on('mcp-event', (event) => {
      console.log(`🔌 [主进程] MCP事件: ${event.type} - ${event.serverId}`)
      
      // 🔥 当PromptX连接成功时，通知前端可以使用PromptX功能
      if (event.type === 'connected' && event.serverId?.includes('promptx')) {
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('promptx-ready', { 
            status: 'ready',
            message: 'PromptX服务已就绪，可以立即使用专业角色功能' 
          })
        }
      }
    })
    
    // 初始化ServiceManager
    await serviceManager.initialize()
    
    // ServiceManager已初始化完成
    
    // 创建服务实例（它们内部会连接到SQLite数据库）
    localStorageService = new LocalStorageService() // 这个服务将被逐步淘汰
    configService = new ConfigService()
    chatService = new ChatService()
    langChainService = new LLMService()
    modelManagementService = new ModelService()
    
    console.log('✅ [主进程] 核心服务实例创建完成（已连接SQLite数据库）')
  } catch (error) {
    console.error('❌ [主进程] 核心服务初始化失败:', error)
    // 发送错误到渲染进程  
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('service-init-error', {
        error: error instanceof Error ? error.message : '未知错误'
      })
    }
  }

  // 1. 注册IPC处理器
  registerIPCHandlers()
  
  // 2. 注册旧的IPC处理器（兼容现有前端）
  registerLangChainHandlers()
  
  // 3. 注册PromptX本地调用处理器
  registerPromptXHandlers()
  
  // 4. 初始化PromptX工作区
  await initializePromptXWorkspace()
  
  // 注意：MCP IPC处理器已通过新架构在registerIPCHandlers()中注册

  // 5. 创建主窗口
  createWindow()

  // 6. 异步初始化基础服务（不阻塞界面显示）
  setTimeout(() => {
    initializeBasicServices().catch(error => {
      console.error('❌ [主进程] 基础服务初始化失败:', error)
    })
  }, 1000) // 延迟1秒，让界面先显示

  // 7. 初始化文件管理服务（基础服务，独立于MCP）
  try {
    // 先初始化数据库
    const db = (await import('./db')).default
    await db.initialize()
    console.log('💾 [主进程] 数据库已初始化')
    
    // 初始化文件服务
    const { FileService } = await import('./services/FileService')
    const fileService = new FileService()
    await fileService.initialize()
    
    // 将fileService存储为全局变量以便IPC使用
    ;(global as any).fileService = fileService
    
    console.log('📁 [主进程] 文件管理服务已初始化（独立基础服务）')
  } catch (error) {
    console.error('❌ [主进程] 文件管理服务初始化失败:', error)
  }

  // 6. 🔥 PromptX改为真正的按需加载（避免启动时多进程）
  // 移除自动预加载，改为用户首次使用PromptX时再启动
  console.log('💡 [主进程] PromptX设为按需加载模式，将在用户首次使用时启动')
  
  // 🎯 暂时禁用后台预加载，避免循环初始化问题
  console.log('⏸️ [主进程] 后台预加载已禁用，仅在用户主动使用时启动MCP服务')
  // setTimeout(() => {
  //   console.log('🔄 [主进程] 用户空闲时后台预加载PromptX...')
  //   ensureMCPServices().catch(error => {
  //     console.log('ℹ️ [主进程] PromptX后台预加载跳过，将在用户使用时启动:', error.message)
  //   })
  // }, 10000) // 延迟10秒，让用户先熟悉界面

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