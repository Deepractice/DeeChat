/**
 * 🚀 DeeChat 主进程 - 重构版本
 * 采用新的核心架构，简化服务管理和生命周期
 */

// 🔥 配置Node.js支持ES模块（用于PromptX的FastMCP）
// 在主进程启动时就设置ES模块支持
process.env.NODE_OPTIONS = '--experimental-modules --es-module-specifier-resolution=node'
// 同时也直接在当前进程中启用实验性功能
;(global as any).__experimental_modules = true

import { app, BrowserWindow, ipcMain } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
const { join } = path
import { ServiceManager } from './core/ServiceManager'
import { LogForwardingService } from './services/core/LogForwardingService'

// 导入旧的IPC处理器
import { registerPromptXHandlers } from './ipc/promptxHandlers'
import { getPromptXLocalService } from './services/promptx/PromptXLocalService'

// 导入核心服务
import { ConfigService } from './services/core/ConfigService'
import { ChatService } from './services/core/ChatService'
import { CoreLLMService } from './services/llm/CoreLLMService'
import { CoreLLMServiceFactory } from './services/llm/CoreLLMServiceFactory'
import { ModelService } from './services/model/ModelService'
import { LocalStorageService } from './services/core/LocalStorageService'
import { FrontendUserPreferenceRepository } from './repositories/FrontendUserPreferenceRepository'
import { UserPreferenceEntity } from '../shared/entities/UserPreferenceEntity'
// WebContentsView服务已禁用，不再需要

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
  
  // 🔥 关键改进：所有初始化代码都在else分支内
  let mainWindow: BrowserWindow | null = null
  let serviceManager: ServiceManager | null = null
  let isCreatingWindow = false // 🔥 添加窗口创建状态标志

  // 延迟初始化核心服务实例（避免在app.whenReady之前调用app.getPath）
  let localStorageService: LocalStorageService
  let configService: ConfigService
  let chatService: ChatService  
  let langChainService: CoreLLMService
  let modelManagementService: ModelService


  /**
   * 创建主窗口
   */
  // @ts-ignore TS6133
  function createWindow(): void {
    console.log('🖼️ [主进程] 创建主窗口...')

    // 🔥 防止重复创建窗口
    if (isCreatingWindow || mainWindow) {
      console.log('⚠️ [主进程] 窗口正在创建中或已存在，跳过创建')
      return
    }

    isCreatingWindow = true // 🔥 设置创建状态

    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      title: 'DeeChat',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webviewTag: true, // 启用webview标签
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
      // 🔧 开发者工具可选打开（避免双窗口困扰）
      // 如需开发者工具，可以手动按 Cmd+Option+I 或 F12 打开
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
      isCreatingWindow = false // 🔥 窗口创建完成，重置状态
      
      // 设置日志转发服务的窗口引用
      if (mainWindow) {
        LogForwardingService.getInstance().setMainWindow(mainWindow)
      }
    })

    // 窗口关闭事件
    mainWindow.on('closed', () => {
      mainWindow = null
      isCreatingWindow = false // 🔥 窗口关闭时重置状态
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
 * 获取统一的项目根目录路径
 */
function getProjectRoot(): string {
  if (process.env.NODE_ENV === 'development') {
    // 开发环境：相对于编译后的目录找到项目根
    // 当前__dirname: /Users/macmima1234/Desktop/DeeChat/dist/main/main
    // 需要回到: /Users/macmima1234/Desktop/DeeChat
    const projectRoot = path.resolve(__dirname, '../../..')
    console.log(`🔧 [getProjectRoot] 开发环境__dirname: ${__dirname}`)
    console.log(`🔧 [getProjectRoot] 计算项目根目录: ${projectRoot}`)
    return projectRoot
  } else {
    // 生产环境：根据不同平台确定项目根目录
    if (process.platform === 'darwin') {
      // macOS: DeeChat.app/Contents/Resources/app.asar -> DeeChat.app/Contents
      return path.resolve(process.resourcesPath, '..')
    } else if (process.platform === 'win32') {
      // Windows: 可执行文件所在目录
      return path.dirname(process.execPath)
    } else {
      // Linux: 可执行文件所在目录
      return path.dirname(process.execPath)
    }
  }
}

// ✅ 删除了 initializePromptXWorkspace 函数
// PromptX 将在首次使用时自动初始化，不需要显式调用 init

/**
 * 注册IPC处理器
 */
function registerIPCHandlers(): void {

  // 基础应用API
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion()
  })

  // 🔧 文件操作API已移除，请使用PromptX的@file://协议

  // 📁 文件写入API已移除，请使用PromptX的@file://协议

  // ✏️ 文件编辑检查API已移除，请使用PromptX的@file://协议
  
  // 📁 文件上传API已移除，请使用PromptX的@file://协议

  // 📂 文件获取API已移除，请使用PromptX的@file://协议

  // 📜 文件内容读取API已移除，请使用PromptX的@file://协议

  // 🗑️ 文件删除API已移除，请使用PromptX的@file://协议

  // ResourcesPage需要的PromptX文件管理API - 委托给PromptXResourceService
  ipcMain.handle('file:list', async (_event, options?: { category?: string }) => {
    try {
      if (!serviceManager || !serviceManager.isReady()) {
        console.error('❌ [文件列表] ServiceManager未初始化')
        return []
      }
      
      const promptxResourceService = serviceManager.getPromptXResourceService()
      console.log('📋 [文件列表] ResourcesPage请求PromptX文件列表:', options)
      const fileList = await promptxResourceService.scanPromptXResources(options?.category)
      console.log(`✅ [文件列表] 返回 ${fileList.length} 个PromptX资源文件`)
      
      return fileList
    } catch (error) {
      console.error('❌ [文件列表] 获取失败:', error)
      return []
    }
  })

  ipcMain.handle('file:tree', async (_event, category?: string) => {
    try {
      if (!serviceManager || !serviceManager.isReady()) {
        console.error('❌ [文件树] ServiceManager未初始化')
        return []
      }
      
      const promptxResourceService = serviceManager.getPromptXResourceService()
      console.log('🌳 [文件树] ResourcesPage请求PromptX文件树:', category)
      const tree = await promptxResourceService.getPromptXResourceTree(category)
      console.log(`✅ [文件树] 返回 ${tree.length} 个根节点`)
      
      return tree
    } catch (error) {
      console.error('❌ [文件树] 获取失败:', error)
      return []
    }
  })

  ipcMain.handle('file:stats', async () => {
    try {
      if (!serviceManager || !serviceManager.isReady()) {
        console.error('❌ [文件统计] ServiceManager未初始化')
        return {
          totalFiles: 0,
          totalSize: 0,
          byCategory: {},
          byType: {}
        }
      }
      
      const promptxResourceService = serviceManager.getPromptXResourceService()
      console.log('📊 [文件统计] ResourcesPage请求PromptX统计信息')
      const resources = await promptxResourceService.scanPromptXResources()
      const stats = {
        totalFiles: resources.length,
        totalSize: resources.reduce((sum, file) => sum + file.size, 0),
        byCategory: {} as Record<string, number>,
        byType: {} as Record<string, number>
      }
      
      // 按分类统计
      resources.forEach(resource => {
        stats.byCategory[resource.category] = (stats.byCategory[resource.category] || 0) + 1
        stats.byType[resource.type] = (stats.byType[resource.type] || 0) + 1
      })
      
      console.log(`✅ [文件统计] 返回PromptX统计信息: ${stats.totalFiles} 个文件`)
      
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

  // PromptX文件内容读取和更新API，支持ResourcesPage的编辑功能
  ipcMain.handle('file:read', async (_event, fileId: string) => {
    try {
      if (!serviceManager || !serviceManager.isReady()) {
        throw new Error('ServiceManager未初始化')
      }
      
      const promptxResourceService = serviceManager.getPromptXResourceService()
      console.log(`📖 [文件读取] 读取PromptX资源文件内容: ${fileId}`)
      const content = await promptxResourceService.readPromptXResource(fileId)
      console.log(`✅ [文件读取] 成功读取PromptX文件，长度: ${content.length} 字符`)
      
      return content
    } catch (error) {
      console.error(`❌ [文件读取] 读取失败: ${fileId}`, error)
      throw error
    }
  })

  ipcMain.handle('file:updateContent', async (_event, fileId: string, content: string) => {
    try {
      if (!serviceManager || !serviceManager.isReady()) {
        throw new Error('ServiceManager未初始化')
      }
      
      const promptxResourceService = serviceManager.getPromptXResourceService()
      console.log(`✍️ [文件更新] 更新PromptX资源文件内容: ${fileId}，长度: ${content.length} 字符`)
      await promptxResourceService.updatePromptXResource(fileId, content)
      console.log(`✅ [文件更新] 成功更新PromptX文件: ${fileId}`)
      
      return { success: true }
    } catch (error) {
      console.error(`❌ [文件更新] 更新失败: ${fileId}`, error)
      throw error
    }
  })

  // 工作区文件操作API
  ipcMain.handle('file:write', async (_event, filePath: string, content: string) => {
    try {
      console.log(`📝 [工作区文件] 写入文件: ${filePath}，长度: ${content.length} 字符`)
      
      if (!serviceManager || !serviceManager.isReady()) {
        throw new Error('ServiceManager未初始化')
      }
      
      const fileService = serviceManager.getFileService()
      await fileService.saveFile(Buffer.from(content, 'utf-8'), filePath)
      
      console.log(`✅ [工作区文件] 成功写入文件: ${filePath}`)
      return { success: true }
    } catch (error) {
      console.error(`❌ [工作区文件] 写入失败: ${filePath}`, error)
      throw error
    }
  })

  ipcMain.handle('file:readFile', async (_event, filePath: string) => {
    try {
      console.log(`📖 [工作区文件] 读取文件: ${filePath}`)
      
      if (!serviceManager || !serviceManager.isReady()) {
        throw new Error('ServiceManager未初始化')
      }
      
      const fileService = serviceManager.getFileService()
      const content = await fileService.readFile(filePath)
      
      console.log(`✅ [工作区文件] 成功读取文件: ${filePath}，长度: ${content.length} 字符`)
      return content
    } catch (error) {
      console.error(`❌ [工作区文件] 读取失败: ${filePath}`, error)
      throw error
    }
  })

  ipcMain.handle('file:ensureDir', async (_event, dirPath: string) => {
    try {
      console.log(`📁 [工作区目录] 确保目录存在: ${dirPath}`)
      
      await require('fs').promises.mkdir(dirPath, { recursive: true })
      
      console.log(`✅ [工作区目录] 目录已存在: ${dirPath}`)
      return { success: true }
    } catch (error) {
      console.error(`❌ [工作区目录] 创建失败: ${dirPath}`, error)
      throw error
    }
  })

  ipcMain.handle('file:getPromptXWorkspacePath', async () => {
    try {
      // 返回PromptX的全局资源目录，前端可以用来显示资源信息
      const { PROMPTX_HOME_DIR } = require('../shared/constants/promptx')
      const promptxPath = process.env.PROMPTX_WORKSPACE || PROMPTX_HOME_DIR
      console.log(`📍 [工作区路径] PromptX全局资源目录: ${promptxPath}`)
      return promptxPath
    } catch (error) {
      console.error('❌ [工作区路径] 获取PromptX路径失败:', error)
      throw error
    }
  })

  ipcMain.handle('file:getAppDataPath', async () => {
    try {
      const appDataPath = app.getPath('userData')
      console.log(`📍 [应用路径] 应用数据目录: ${appDataPath}`)
      return appDataPath
    } catch (error) {
      console.error('❌ [应用路径] 获取应用数据路径失败:', error)
      throw error
    }
  })

  ipcMain.handle('file:getProjectPath', async () => {
    try {
      const isDev = process.env.NODE_ENV === 'development'
      const projectRoot = isDev 
        ? path.resolve(__dirname, '../../..') // 开发环境：从dist/main/main回到项目根目录
        : process.cwd() // 生产环境：使用当前工作目录
      console.log(`📍 [应用路径] 项目根目录: ${projectRoot}`)
      return projectRoot
    } catch (error) {
      console.error('❌ [应用路径] 获取项目根路径失败:', error)
      throw error
    }
  })

  // 文件对话框API - 用于导出功能
  ipcMain.handle('file:showSaveDialog', async (_event, options) => {
    try {
      const { dialog } = require('electron')
      console.log(`💾 [文件对话框] 显示保存对话框:`, options)
      
      const result = await dialog.showSaveDialog(mainWindow, options)
      console.log(`💾 [文件对话框] 保存对话框结果:`, result)
      
      return result
    } catch (error) {
      console.error('❌ [文件对话框] 保存对话框失败:', error)
      throw error
    }
  })

  ipcMain.handle('file:showOpenDialog', async (_event, options) => {
    try {
      const { dialog } = require('electron')
      console.log(`📂 [文件对话框] 显示打开对话框:`, options)
      
      const result = await dialog.showOpenDialog(mainWindow, options)
      console.log(`📂 [文件对话框] 打开对话框结果:`, result)
      
      return result
    } catch (error) {
      console.error('❌ [文件对话框] 打开对话框失败:', error)
      throw error
    }
  })

  // DeeChat工作区文件操作API
  ipcMain.handle('file:delete', async (_event, filePath: string) => {
    try {
      const fs = require('fs/promises')
      await fs.unlink(filePath)
      console.log(`🗑️ [DeeChat] 删除文件: ${filePath}`)
      return true
    } catch (error) {
      console.error('❌ [DeeChat] 删除文件失败:', error)
      throw error
    }
  })

  ipcMain.handle('file:showInFolder', async (_event, filePath: string) => {
    try {
      const { shell } = require('electron')
      shell.showItemInFolder(filePath)
      console.log(`📂 [DeeChat] 在文件夹中显示: ${filePath}`)
      return true
    } catch (error) {
      console.error('❌ [DeeChat] 在文件夹中显示失败:', error)
      throw error
    }
  })

  // 服务管理API
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
      // 直接使用MCPClient获取连接的服务器
      // TODO: 实现获取已连接服务器的功能
      return { success: true, data: [] }
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
      // 直接使用MCPClient获取工具列表
      // TODO: 实现获取所有可用工具的功能
      return { success: true, data: [] }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  ipcMain.handle('mcp:callTool', async (_, _serverId: string, _toolName: string, _parameters: any) => {
    try {
      await ensureMCPServices() // 🔥 懒加载MCP服务
      if (!serviceManager || !serviceManager.getAllServiceStatuses().some(s => s.name === 'mcp' && s.status === 'ready')) {
        return { success: false, error: 'MCP服务未就绪: 集成服务未初始化' }
      }
    } catch (error) {
      return { success: false, error: `MCP服务启动失败: ${error instanceof Error ? error.message : '未知错误'}` }
    }

    try {
      // 直接使用MCPClient调用工具
      // TODO: 实现工具调用功能
      return { success: true, data: { success: true, result: 'Tool call placeholder' } }
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
      
      // 获取ServiceManager中已连接的MCPClient
      if (!serviceManager) {
        throw new Error('ServiceManager未初始化')
      }
      const mcpClient = serviceManager.getMCPClient()
      const connectedServers = mcpClient.getConnectedServers()
      console.log(`🔍 [主进程] 发现 ${connectedServers.length} 个已连接的MCP服务器:`, connectedServers)
      
      // 从所有连接的服务器获取工具
      const tools: any[] = []
      for (const serverId of connectedServers) {
        try {
          console.log(`🔧 [主进程] 从服务器 ${serverId} 获取工具列表...`)
          const serverTools = await mcpClient.listTools(serverId)
          console.log(`📋 [主进程] 服务器 ${serverId} 返回 ${serverTools.length} 个工具`)
          
          // 为每个工具添加服务器信息
          const toolsWithServer = serverTools.map((tool: any) => ({
            ...tool,
            serverId: serverId,
            serverName: serverId === 'promptx-builtin' ? 'PromptX (内置)' : serverId
          }))
          
          tools.push(...toolsWithServer)
        } catch (error) {
          console.error(`❌ [主进程] 从服务器 ${serverId} 获取工具失败:`, error)
        }
      }
      
      console.log(`📦 [主进程] 总共获取到 ${tools.length} 个工具`)
      
      // 转换为前端数据格式
      const toolData = tools.map((tool: any) => tool.toData ? tool.toData() : tool)
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
  ipcMain.handle('mcp:updateServerConfig', async (_) => {
    try {
      await ensureMCPServices() // 🔥 懒加载MCP服务
      if (!serviceManager || !serviceManager.getAllServiceStatuses().some(s => s.name === 'mcp' && s.status === 'ready')) {
        return { success: false, error: 'MCP服务未就绪: 集成服务未初始化' }
      }
    } catch (error) {
      return { success: false, error: `MCP服务启动失败: ${error instanceof Error ? error.message : '未知错误'}` }
    }

    try {
      // 简化的MCPClient不支持复杂的服务器管理
      console.log('⚠️ [主进程] MCPClient不支持服务器配置更新，功能已简化')
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
      // 简化的MCPClient不支持复杂的服务器管理
      console.log('⚠️ [主进程] MCPClient不支持服务器添加，功能已简化')
      
      // 创建服务器实体（用于配置保存）
      const { MCPServerEntity } = await import('../shared/entities/MCPServerEntity')
      const server = MCPServerEntity.create({
        ...serverConfig,
        id: serverConfig.id || `server-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      
      // TODO: 实现添加服务器功能
      console.log('Adding server:', server)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  ipcMain.handle('mcp:removeServer', async (_, _serverId: string) => {
    try {
      await ensureMCPServices() // 🔥 懒加载MCP服务
      if (!serviceManager || !serviceManager.getAllServiceStatuses().some(s => s.name === 'mcp' && s.status === 'ready')) {
        return { success: false, error: 'MCP服务未就绪: 集成服务未初始化' }
      }
    } catch (error) {
      return { success: false, error: `MCP服务启动失败: ${error instanceof Error ? error.message : '未知错误'}` }
    }

    try {
      // 简化的MCPClient不支持复杂的服务器管理
      console.log('⚠️ [主进程] MCPClient不支持服务器删除，功能已简化')
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  // 🎭 角色系统API（统一使用PromptX）
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
      // 🎭 使用PromptX系统获取角色列表
      const promptxService = getPromptXLocalService()
      const rolesData = await promptxService.getAvailableRoles()
      return { success: true, data: rolesData }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  ipcMain.handle('role:activate', async (_, roleId: string) => {
    try {
      await ensureMCPServices() // 🔥 懒加载MCP服务
      if (!serviceManager) {
        return { success: false, error: '服务管理器未初始化' }
      }
    } catch (error) {
      return { success: false, error: `服务启动失败: ${error instanceof Error ? error.message : '未知错误'}` }
    }

    try {
      // 🎭 使用PromptX系统激活角色
      const promptxService = getPromptXLocalService()
      const result = await promptxService.activateRole(roleId)
      return { success: true, data: result }
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
      // 🎭 PromptX系统中角色是基于工具调用的，没有显式停用概念
      // 角色状态由对话上下文管理，这里仅做记录
      console.log(`🎭 [角色管理] 角色停用请求: ${roleId} (PromptX系统中角色由上下文管理)`)
      return { success: true, message: '角色已停用' }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  // 添加所有缺失的核心IPC处理器
  
  // LLM相关IPC（启用MCP工具支持 + 流式更新）
  ipcMain.handle('llm:sendMessage', async (event, message: string, config: any) => {
    try {
      // 🔥 启用MCP工具支持让AI能主动调用PromptX工具
      console.log('🔧 [IPC-DEBUG] 收到AI消息请求!')
      console.log('🔧 [IPC-DEBUG] 消息内容:', message)
      console.log('🔧 [IPC-DEBUG] 配置:', JSON.stringify(config, null, 2))
      
      // 提取配置参数
      const { 
        configId = 'default',
        sessionId = `session_${Date.now()}`,
        currentRole,
        systemPrompt 
      } = config || {}
      
      // 🎯 移除未使用的onStreamUpdate变量（已在下面的callback中内联处理）
      
      // ✅ 直接传递参数，不需要构建 LLMRequest对象
      
      // 🔥 发送开始事件
      event.sender.send('llm:stream-start', { sessionId })
      
      // 移除未使用的llmRequest对象
      
      // 🎯 使用LLMService的正确3参数streamMessage方法
      const llmRequest = {
        message: message,
        sessionId: sessionId,
        activeRole: currentRole?.id,
        systemPrompt: systemPrompt,
        uiContext: undefined,
        chatHistory: undefined
      }
      
      const response = await langChainService.streamMessage(
        llmRequest,                 // request: LLMRequest
        configId,                   // configId: string
        undefined,                  // onChunk: StreamCallback (未使用)
        // 🌊 简化回调：接收简单的chunk字符串
        (chunk: string) => {
          // 发送流式更新到前端
          event.sender.send('ai:streamChunk', {
            type: 'generating',
            partialContent: chunk,
            sessionId: sessionId,
            stage: 'AI正在生成回复...'
          });
        }
      )
      
      console.log('✅ [IPC] MCP工具消息发送成功')
      
      // 🔥 发送完成事件
      event.sender.send('llm:stream-complete', { 
        sessionId,
        response: { content: response }
      })
      
      return { success: true, data: { content: response } }
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

  // 删除会话API
  ipcMain.handle('chat:deleteSession', async (_, sessionId: string) => {
    try {
      await chatService.deleteSession(sessionId)
      return { success: true }
    } catch (error) {
      console.error('删除会话失败:', error)
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

  ipcMain.handle('model:get', async (_, id: string) => {
    try {
      const config = await modelManagementService.getConfigById(id)
      return { success: true, data: config }
    } catch (error) {
      console.error('获取单个模型配置失败:', error)
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

  // AI服务流式消息API - 修复流式输出问题的关键处理器！
  ipcMain.handle('ai:streamMessage', async (event, request: any) => {
    try {
      // console.log('🚨 [DEBUG-IPC] ai:streamMessage 被调用!');
      // console.log('🚨 [DEBUG-IPC] request结构:', Object.keys(request));
      // console.log('🚨 [DEBUG-IPC] llmRequest存在:', !!request.llmRequest);
      // console.log('🚨 [DEBUG-IPC] enableMCPTools:', request.enableMCPTools);
      // console.log('🚨 [DEBUG-IPC] systemPrompt存在:', !!request.llmRequest?.systemPrompt);
      // console.log('🚨 [DEBUG-IPC] systemPrompt长度:', request.llmRequest?.systemPrompt?.length || 0);
      // console.log('🌊 IPC: AI流式消息发送:', request.llmRequest?.message?.substring(0, 50) + '...');
      // console.log('🌊 IPC: 配置ID:', request.configId);
      // console.log('🌊 IPC: 启用MCP工具:', request.enableMCPTools);
      // console.log('🌊 IPC: 历史消息数量:', request.chatHistory?.length || 0);
      // console.log('🌊 IPC: 会话ID:', request.sessionId || '未提供');
      // console.log('🌊 IPC: 激活角色:', request.llmRequest?.activeRole || '未选择'); // 🔥 新增角色日志
      // console.log('🎭 IPC: 系统提示词前200字符:', request.llmRequest?.systemPrompt?.substring(0, 200) || '未提供');

      // 🔥 发送流式开始事件
      // console.log('🚨🚨🚨 [DEBUG-STREAM] 发送start事件到前端...');
      event.sender.send('ai:streamChunk', {
        type: 'start',
        sessionId: request.sessionId
      });
      // console.log('🚨🚨🚨 [DEBUG-STREAM] start事件发送完成');

      // 🌊 使用LLMService的流式方法，传递修正后的LLMRequest对象
      const enhancedRequest = {
        ...request.llmRequest,
        sessionId: request.sessionId,        // 确保会话ID传递
        activeRole: request.llmRequest?.activeRole  // 🔥 修复：确保角色传递
        // systemPrompt已经在request.llmRequest中，无需重复赋值
      };
      
      
      // 🎯 统一流式架构：使用支持StreamChunk的streamMessage调用
      // console.log('🚨 [DEBUG-IPC] 准备调用 langChainService.streamMessage');
      // console.log('🚨 [DEBUG-IPC] enhancedRequest:', enhancedRequest);
      // console.log('🚨 [DEBUG-IPC] langChainService存在:', !!langChainService);
      const response = await langChainService.streamMessage(
        enhancedRequest,                          // request: LLMRequest
        request.configId,                         // configId: string
        // 🔥 新的统一StreamChunk回调函数
        (chunk: import('../shared/streaming/StreamTypes').StreamChunk) => {
          // console.log('🌊 [IPC-统一回调] 收到chunk类型:', chunk.type);
          
          // 🔥 新的简化事件发送逻辑
          switch (chunk.type) {
            case 'text':
              event.sender.send('ai:streamChunk', chunk);
              break;
            
            case 'tool_start':
              event.sender.send('ai:streamChunk', chunk);
              break;
            
            case 'tool_result':
              event.sender.send('ai:streamChunk', chunk);
              break;
            
            case 'complete':
              event.sender.send('ai:streamChunk', chunk);
              break;
            
            case 'error':
              event.sender.send('ai:streamChunk', chunk);
              break;
          }
        }
      );

      // 🔥 发送完成事件 (streamMessage返回字符串)
      event.sender.send('ai:streamChunk', {
        type: 'complete',
        content: response,
        sessionId: request.sessionId
      });

      console.log('🌊 IPC: AI流式消息发送成功');
      return { success: true, data: { content: response } }
    } catch (error) {
      console.error('🌊 IPC: AI流式消息发送失败:', error)
      
      // 发送错误事件
      event.sender.send('ai:streamChunk', {
        type: 'error',
        error: error instanceof Error ? error.message : '未知错误',
        sessionId: request.sessionId
      });
      
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

  // 窗口大小调整处理器
  ipcMain.handle('window:resize', async (_, width: number, height: number) => {
    try {
      if (mainWindow) {
        const currentSize = mainWindow.getSize()
        console.log(`🖼️ [窗口调整] 当前大小: ${currentSize[0]}x${currentSize[1]}, 目标大小: ${width}x${height}`)
        
        // 平滑调整窗口大小
        mainWindow.setSize(width, height, true)
        
        return { success: true, currentSize: currentSize, newSize: [width, height] }
      }
      return { success: false, error: '主窗口不存在' }
    } catch (error) {
      console.error('调整窗口大小失败:', error)
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  // 获取当前窗口大小
  ipcMain.handle('window:getSize', async () => {
    try {
      if (mainWindow) {
        const size = mainWindow.getSize()
        return { success: true, width: size[0], height: size[1] }
      }
      return { success: false, error: '主窗口不存在' }
    } catch (error) {
      console.error('获取窗口大小失败:', error)
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  console.log('✅ [主进程] 所有IPC处理器注册完成')
}

/**
 * 应用启动流程
 */
app.whenReady().then(async () => {
  console.log('🚀 [主进程] 应用启动流程开始...')
  console.log(`🔧 [主进程] 环境: ${isDev ? '开发' : '生产'}`)
  console.log(`🔧 [主进程] Node版本: ${process.version}`)
  console.log(`🔧 [主进程] 平台: ${process.platform}`)

  // 🌐 WebContentsView需要BaseWindow架构，暂时跳过，使用iframe方案
  console.log('ℹ️ [主进程] 跳过WebContentsView初始化，使用iframe浏览器方案')
  // WebContentsView与BrowserWindow不兼容，需要BaseWindow架构
  // 当前保持BrowserWindow架构，使用iframe作为浏览器工作区

  // ✅ 删除了 PromptX 环境变量设置
  // PromptX 将使用全局模式，不需要强制指定项目路径

  // 0. 初始化ServiceManager和核心服务（现在app已准备就绪）
  
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
    
    // 🏗️ 初始化DeeChat独立目录服务
    console.log('🏗️ [主进程] 初始化DeeChat独立目录结构...')
    try {
      const { DeeChatDirectoryService } = await import('../shared/services/DeeChatDirectoryService')
      const deechatDirService = DeeChatDirectoryService.getInstance()
      await deechatDirService.initialize()
      console.log('✅ [主进程] DeeChat目录服务初始化完成')
    } catch (error) {
      console.error('❌ [主进程] DeeChat目录服务初始化失败:', error)
      // 不抛出错误，允许应用继续运行
    }
    
    // ServiceManager已初始化完成
    
    // 创建服务实例（它们内部会连接到SQLite数据库）
    localStorageService = new LocalStorageService() // 这个服务将被逐步淘汰
    configService = new ConfigService()
    chatService = new ChatService()
    // 使用ServiceManager中已连接的MCPClient实例
    const mcpClient = serviceManager.getMCPClient()
    langChainService = CoreLLMServiceFactory.create(mcpClient)
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
  
  // 3. 注册旧的IPC处理器（兼容现有前端）
  // LangChain handlers已移除，使用ai:接口
  
  // 4. 注册PromptX本地调用处理器
  registerPromptXHandlers()
  
  // ✅ 删除了 PromptX 工作区初始化调用
  // PromptX 将在首次使用时自动初始化，简化启动流程
  
  // 注意：MCP IPC处理器已通过新架构在registerIPCHandlers()中注册

  // 6. 创建主窗口
  createWindow()

  // 7. 异步初始化基础服务（不阻塞界面显示）
  setTimeout(() => {
    initializeBasicServices().catch(error => {
      console.error('❌ [主进程] 基础服务初始化失败:', error)
    })
  }, 1000) // 延迟1秒，让界面先显示

  // 8. 文件管理服务已通过ServiceManager统一管理，无需独立初始化
  console.log('📁 [主进程] 文件管理服务已通过ServiceManager统一管理')

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

  // macOS 特有行为：只有当没有窗口且应用已完全启动时才创建新窗口
  app.on('activate', () => {
    console.log('🍎 [macOS] activate事件触发，当前窗口数量:', BrowserWindow.getAllWindows().length)
    console.log('🍎 [macOS] mainWindow状态:', mainWindow ? 'exists' : 'null')
    console.log('🍎 [macOS] isCreatingWindow状态:', isCreatingWindow)

    // 🔥 修复双窗口问题：严格的窗口存在检查
    // 只有在完全没有窗口的情况下才创建新窗口
    const allWindows = BrowserWindow.getAllWindows()
    const hasAnyWindow = allWindows.length > 0 || mainWindow !== null || isCreatingWindow

    console.log('🍎 [macOS] 窗口状态详细检查:')
    console.log(`  - BrowserWindow.getAllWindows().length: ${allWindows.length}`)
    console.log(`  - mainWindow !== null: ${mainWindow !== null}`)
    console.log(`  - isCreatingWindow: ${isCreatingWindow}`)
    console.log(`  - hasAnyWindow: ${hasAnyWindow}`)

    if (!hasAnyWindow) {
      // 延迟500ms再次检查，确保不在启动过程中
      setTimeout(() => {
        const recheckAllWindows = BrowserWindow.getAllWindows()
        const recheckHasAnyWindow = recheckAllWindows.length > 0 || mainWindow !== null || isCreatingWindow

        console.log('🍎 [macOS] 延迟检查窗口状态:')
        console.log(`  - BrowserWindow.getAllWindows().length: ${recheckAllWindows.length}`)
        console.log(`  - mainWindow !== null: ${mainWindow !== null}`)
        console.log(`  - isCreatingWindow: ${isCreatingWindow}`)
        console.log(`  - recheckHasAnyWindow: ${recheckHasAnyWindow}`)

        if (!recheckHasAnyWindow) {
          console.log('🍎 [macOS] 确认没有任何窗口，创建新窗口')
          createWindow()
        } else {
          console.log('🍎 [macOS] 延迟检查：发现窗口存在，跳过创建')
        }
      }, 500)
    } else {
      console.log('🍎 [macOS] 检测到窗口存在，跳过创建')
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

  // WebContentsView服务已禁用，无需清理
  console.log('ℹ️ [主进程] WebContentsView服务未启用，跳过清理')

  // 注销旧的IPC处理器
  // LangChain handlers已移除
  // unregisterMCPHandlers() // 已删除

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

// ✅ 删除了 ensureDeeChatRoleTemplateAvailable 和 copyDirectoryRecursive 函数
// 角色文件将在安装/部署阶段处理，不在运行时复制

} // else分支结束