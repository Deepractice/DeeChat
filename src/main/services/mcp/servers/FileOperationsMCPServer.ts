/**
 * 跨平台文件操作MCP服务器
 * 
 * DeeChat内置的标准MCP文件操作服务器，完全符合MCP协议规范
 * 支持Windows、macOS、Linux等所有主流平台
 * 
 * 核心特性：
 * 1. 完全符合MCP协议标准 (JSON-RPC 2.0, 标准工具定义)
 * 2. 跨平台路径处理 (统一Windows和Unix系统差异)
 * 3. 安全路径验证 (防止目录遍历攻击)
 * 4. 完整类型安全 (TypeScript + Zod验证)
 * 5. 标准化响应格式 (符合MCP Tool Result规范)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'
import log from 'electron-log'
import { platform } from 'os'

/**
 * 跨平台路径工具类
 * 统一处理Windows和Unix系统的路径差异
 */
class CrossPlatformPathUtils {
  /**
   * 规范化路径分隔符 (统一转换为当前系统格式)
   */
  static normalizePath(inputPath: string): string {
    return path.resolve(inputPath)
  }

  /**
   * 检查是否为绝对路径 (跨平台兼容)
   */
  static isAbsolutePath(inputPath: string): boolean {
    return path.isAbsolute(inputPath)
  }

  /**
   * 安全路径连接 (防止路径遍历)
   */
  static safePath(basePath: string, relativePath: string): string {
    const resolved = path.resolve(basePath, relativePath)
    
    // 确保解析后的路径仍在基础路径下
    if (!resolved.startsWith(path.resolve(basePath))) {
      throw new Error(`路径遍历被阻止: ${relativePath}`)
    }
    
    return resolved
  }

  /**
   * 获取跨平台的用户数据目录
   */
  static getUserDataPaths(): string[] {
    try {
      // Electron环境
      return [
        app.getPath('userData'),
        path.join(app.getPath('userData'), 'deechat-workspace'), // DeeChat混合工作区根目录
        path.join(app.getPath('userData'), 'deechat-workspace', 'ai-generated'), // AI生成文件目录
        path.join(app.getPath('userData'), 'deechat-workspace', 'temp'), // 临时文件目录
        path.join(app.getPath('userData'), 'promptx-workspace'), // PromptX专用工作目录
        path.join(app.getPath('userData'), 'attachments'),
        path.join(app.getPath('documents'), 'DeeChat'),
        app.getPath('desktop'), // 用户桌面(引用模式)
        app.getPath('downloads'), // 用户下载目录(引用模式)
        app.getPath('documents') // 用户文档目录(引用模式)
      ]
    } catch {
      // Node.js测试环境
      const homeDir = process.env.HOME || process.env.USERPROFILE || '/tmp'
      
      return [
        path.join(homeDir, '.deechat'),
        path.join(homeDir, '.deechat', 'deechat-workspace'), // DeeChat混合工作区根目录
        path.join(homeDir, '.deechat', 'deechat-workspace', 'ai-generated'), // AI生成文件目录
        path.join(homeDir, '.deechat', 'deechat-workspace', 'temp'), // 临时文件目录
        path.join(homeDir, '.deechat', 'attachments'),
        path.join(homeDir, 'Desktop'), // 用户桌面
        path.join(homeDir, 'Downloads'), // 用户下载目录
        process.cwd()
      ]
    }
  }

  /**
   * 跨平台的文件大小格式化
   */
  static formatFileSize(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0) return '0 B'
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }
}

/**
 * 标准MCP文件操作服务器
 * 
 * 使用官方@modelcontextprotocol/sdk实现，完全符合MCP协议规范
 */
/**
 * 文件操作服务器配置选项
 */
interface FileOperationsConfig {
  /** 是否启用沙箱模式 (默认: true, 安全) */
  sandboxMode?: boolean
  /** 自定义允许的路径 (沙箱模式下使用) */
  allowedPaths?: string[]
  /** 是否允许访问系统敏感目录 (非沙箱模式警告) */
  allowSystemAccess?: boolean
}

export class FileOperationsMCPServer {
  private server: McpServer
  private allowedPaths: string[]
  private isInitialized: boolean = false
  private config: Required<FileOperationsConfig>

  constructor(config: FileOperationsConfig = {}) {
    // 创建标准MCP服务器实例
    this.server = new McpServer({
      name: 'deechat-file-operations',
      version: '2.0.0'
    })

    // 合并默认配置
    this.config = {
      sandboxMode: config.sandboxMode ?? true, // 默认启用沙箱模式
      allowedPaths: config.allowedPaths ?? CrossPlatformPathUtils.getUserDataPaths(),
      allowSystemAccess: config.allowSystemAccess ?? false
    }

    // 根据配置初始化允许的路径
    if (this.config.sandboxMode) {
      this.allowedPaths = this.config.allowedPaths
      log.info('[FileOperations MCP] 🔒 沙箱模式已启用')
      log.info('[FileOperations MCP] 🔒 安全路径:', this.allowedPaths)
    } else {
      // 非沙箱模式：不需要预定义路径，直接在验证时允许
      this.allowedPaths = [] // 空数组，表示不使用路径限制
      log.warn('[FileOperations MCP] ⚠️  沙箱模式已禁用 - 允许系统级访问')
      log.warn('[FileOperations MCP] ⚠️  安全风险：可访问整个文件系统')
      
      if (!this.config.allowSystemAccess) {
        log.error('[FileOperations MCP] ❌ 系统访问被拒绝：需要设置 allowSystemAccess: true')
        throw new Error('系统级访问需要明确授权。请设置 allowSystemAccess: true')
      }
    }
    
    log.info('[FileOperations MCP] 🚀 标准MCP文件操作服务器初始化完成')
    log.info('[FileOperations MCP] 🖥️  运行平台:', platform())
  }

  /**
   * 初始化服务器 - 注册所有工具
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      log.warn('[FileOperations MCP] ⚠️  服务器已经初始化')
      return
    }

    try {
      // 确保允许的目录存在
      await this.ensureAllowedDirectories()

      // 注册工作区发现工具
      this.registerWorkspaceDiscoveryTool()
      
      // 注册9个标准文件操作工具
      this.registerFileReadTool()
      this.registerFileWriteTool() 
      this.registerDirectoryListTool()
      this.registerDirectoryCreateTool()
      this.registerFileDeleteTool()
      this.registerFileMoveRename()
      this.registerFileCopyTool()
      this.registerFileInfoTool()
      this.registerFileSearchTool()

      this.isInitialized = true
      log.info('[FileOperations MCP] ✅ 所有工具注册完成，服务器就绪')
    } catch (error) {
      log.error('[FileOperations MCP] ❌ 初始化失败:', error)
      throw error
    }
  }

  /**
   * 启动服务器 (DeeChat集成所需的接口)
   */
  async start(): Promise<void> {
    try {
      await this.initialize()
      log.info('[FileOperations MCP] ✅ 服务器启动完成')
    } catch (error) {
      log.error('[FileOperations MCP] ❌ 服务器启动失败:', error)
      throw error
    }
  }

  /**
   * 获取MCP服务器实例 (供DeeChat集成使用)
   */
  getServer(): McpServer {
    return this.server
  }

  /**
   * 直接调用工具 (DeeChat集成所需的接口)
   */
  async callTool(toolName: string, args: Record<string, any>): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('文件操作服务器未初始化')
    }

    // 获取工具处理器
    const toolHandler = this.getToolHandler(toolName)
    if (!toolHandler) {
      throw new Error(`未找到工具: ${toolName}`)
    }

    try {
      const result = await toolHandler(args)
      log.info(`[FileOperations MCP] ✅ 工具调用成功: ${toolName}`)
      return result
    } catch (error) {
      log.error(`[FileOperations MCP] ❌ 工具调用失败: ${toolName}`, error)
      throw error
    }
  }

  /**
   * 获取工具定义列表 (DeeChat集成所需的接口)
   */
  getToolDefinitions(): any[] {
    // 获取关键路径信息用于工具描述
    const { app } = require('electron')
    const userDataPath = app.getPath('userData')
    const workspaceRoot = `${userDataPath}/deechat-workspace`
    const aiGeneratedPath = `${workspaceRoot}/ai-generated`
    const tempPath = `${workspaceRoot}/temp`
    const desktopPath = app.getPath('desktop')
    const downloadsPath = app.getPath('downloads')
    
    // 🎯 获取当前工作区的实际文件路径列表
    const workspaceFiles = this.getCurrentWorkspaceFiles()
    
    const tools = [
      {
        name: 'discover_workspace',
        description: `🎯 发现DeeChat工作区 (🔍开始文件操作前必读)

📋 **工作区概览**：
• 工作区根目录：${workspaceRoot}
• AI生成文件目录：${aiGeneratedPath}  
• 临时文件目录：${tempPath}
• 用户常用目录：${desktopPath}, ${downloadsPath}

🔍 **快速探索**：
此工具帮你了解工作区结构和现有文件，建议在开始任何文件操作前先调用！

💡 **返回信息**：
• 工作区目录结构
• 各目录的文件数量
• 推荐的文件操作路径
• 用户文件和AI文件的区别说明`,
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'read_file',
        description: `📖 读取文件内容 (🎯DeeChat工作区智能读取)

📂 **当前工作区文件** - 可直接使用这些路径：
${workspaceFiles.userFiles.length > 0 ? workspaceFiles.userFiles.map(path => `• ${path}`).join('\n') : '• (暂无用户引用文件)'}

🤖 **AI生成文件** - 当前可用：
${workspaceFiles.aiFiles.length > 0 ? workspaceFiles.aiFiles.map(path => `• ${path}`).join('\n') : '• (暂无AI生成文件)'}

⏰ **临时文件** - 当前可用：
${workspaceFiles.tempFiles.length > 0 ? workspaceFiles.tempFiles.map(path => `• ${path}`).join('\n') : '• (暂无临时文件)'}

📁 **创建新文件推荐路径**：
• AI生成文件：${aiGeneratedPath}/your_file.ext
• 临时文件：${tempPath}/temp_file.ext

💡 **使用说明**：
1. 优先使用上面列出的具体文件路径
2. 支持所有常见格式：txt、md、pdf、docx、csv、json、py、js等
3. 用户拖拽新文件后，路径会自动更新到此列表`,
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '文件绝对路径 - 用户文件的完整路径或AI生成文件路径' },
            encoding: { type: 'string', enum: ['utf8', 'base64'], default: 'utf8', description: '文件编码格式' }
          },
          required: ['path']
        }
      },
      {
        name: 'write_file',
        description: `✏️ 写入文件内容 (🎯DeeChat工作区智能写入)

📝 **创建AI生成文件** (推荐)：
• AI报告/分析：${aiGeneratedPath}/analysis_report.md
• 代码文件：${aiGeneratedPath}/generated_code.py
• 数据处理：${aiGeneratedPath}/processed_data.csv

⏰ **创建临时文件**：
• 临时处理：${tempPath}/temp_analysis.txt
• 临时输出：${tempPath}/temp_result.json

⚠️ **更新现有文件**：
• 可以修改AI生成的文件
• 不建议修改用户引用文件的源文件

💡 **命名建议**：
• 使用描述性文件名：summary_report.md
• 包含时间戳：analysis_20250814.txt
• 指明文件类型：.md .txt .py .json .csv`,
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '文件路径 - 推荐使用AI生成目录或临时目录' },
            content: { type: 'string', description: '文件内容' },
            encoding: { type: 'string', enum: ['utf8', 'base64'], default: 'utf8', description: '文件编码格式' }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'list_directory',
        description: `📁 列出目录内容 (🎯DeeChat工作区导航)

🎯 **当前工作区目录**：
• 工作区根目录：${workspaceRoot}
• AI生成文件目录：${aiGeneratedPath}
• 临时文件目录：${tempPath}

📂 **用户文件目录** (从当前引用文件推断)：
${workspaceFiles.userFiles.length > 0 ? 
  [...new Set(workspaceFiles.userFiles.map(path => path.substring(0, path.lastIndexOf('/'))))].slice(0, 3).map(dir => `• ${dir}/`).join('\n') 
  : '• (用户尚未拖拽文件，可浏览桌面或下载目录)'}

🔍 **常用用户目录**：
• 用户桌面：${desktopPath}
• 用户下载：${downloadsPath}

💡 **推荐操作**：
1. 查看工作区结构：list_directory("${workspaceRoot}")
2. 浏览AI生成文件：list_directory("${aiGeneratedPath}")
3. 探索用户文件目录：使用上述用户文件目录路径`,
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '目录路径 - 工作区路径、用户常用目录或任意允许的路径' },
            recursive: { type: 'boolean', default: false, description: '是否递归列出子目录' },
            includeHidden: { type: 'boolean', default: false, description: '是否包含隐藏文件' }
          },
          required: ['path']
        }
      },
      {
        name: 'create_directory',
        description: '📂 创建目录 (🎯混合工作区支持) - 在AI生成目录、临时目录或其他允许位置创建新目录，支持递归创建',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '目录路径，必须在允许的目录范围内' },
            recursive: { type: 'boolean', default: true, description: '是否递归创建父目录' }
          },
          required: ['path']
        }
      },
      {
        name: 'delete_file',
        description: '🗑️ 删除文件或目录 (⚠️谨慎使用) - 可删除AI生成文件、临时文件或其他允许位置的文件，用户引用文件请谨慎',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '文件或目录路径，必须在允许的目录范围内' },
            recursive: { type: 'boolean', default: false, description: '如果是目录，是否递归删除' }
          },
          required: ['path']
        }
      },
      {
        name: 'move_file',
        description: '🚚 移动/重命名文件 (🎯混合工作区) - 移动或重命名AI生成文件/目录，用户引用文件不建议移动',
        inputSchema: {
          type: 'object',
          properties: {
            source: { type: 'string', description: '源文件路径' },
            destination: { type: 'string', description: '目标文件路径' }
          },
          required: ['source', 'destination']
        }
      },
      {
        name: 'copy_file',
        description: '📄 复制文件或目录 (🎯混合工作区) - 复制用户引用文件到AI生成目录，或复制AI生成文件',
        inputSchema: {
          type: 'object',
          properties: {
            source: { type: 'string', description: '源文件路径' },
            destination: { type: 'string', description: '目标文件路径' },
            recursive: { type: 'boolean', default: false, description: '如果是目录，是否递归复制' }
          },
          required: ['source', 'destination']
        }
      },
      {
        name: 'get_file_info',
        description: '📊 获取文件信息 (🎯混合工作区) - 查看用户引用文件、AI生成文件或其他文件的详细信息（大小、修改时间等）',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '文件或目录路径' }
          },
          required: ['path']
        }
      },
      {
        name: 'search_files',
        description: '🔍 搜索文件 (🎯混合工作区全覆盖) - 在用户目录、AI生成目录、临时目录中搜索文件，支持文件名和内容搜索',
        inputSchema: {
          type: 'object',
          properties: {
            directory: { type: 'string', description: '搜索目录' },
            pattern: { type: 'string', description: '文件名模式（支持glob）' },
            content: { type: 'string', description: '文件内容搜索关键词' },
            recursive: { type: 'boolean', default: true, description: '是否递归搜索' }
          },
          required: ['directory']
        }
      }
    ]

    return tools
  }

  /**
   * 确保允许的目录存在
   */
  private async ensureAllowedDirectories(): Promise<void> {
    for (const allowedPath of this.allowedPaths) {
      try {
        await fs.access(allowedPath)
      } catch {
        await fs.mkdir(allowedPath, { recursive: true })
        log.info(`[FileOperations MCP] 📁 创建目录: ${allowedPath}`)
      }
    }
  }


  /**
   * 路径安全验证 (支持沙箱和非沙箱模式)
   */
  private validatePath(inputPath: string): string {
    const normalizedPath = CrossPlatformPathUtils.normalizePath(inputPath)
    
    // 非沙箱模式：进行基础安全检查，但允许访问整个文件系统
    if (!this.config.sandboxMode) {
      // 基础安全检查：确保是有效的文件路径
      if (!this.isValidSystemPath(normalizedPath)) {
        throw new Error(`无效的文件路径: ${normalizedPath}`)
      }
      
      log.debug(`[FileOperations MCP] 🌐 系统级访问: ${normalizedPath}`)
      return normalizedPath
    }
    
    // 沙箱模式：检查是否在允许的路径范围内
    const isAllowed = this.allowedPaths.some(allowedPath => {
      const resolvedAllowed = CrossPlatformPathUtils.normalizePath(allowedPath)
      return normalizedPath.startsWith(resolvedAllowed)
    })

    if (!isAllowed) {
      throw new Error(`路径访问被拒绝: ${normalizedPath}. 允许的路径: ${this.allowedPaths.join(', ')}`)
    }

    return normalizedPath
  }

  /**
   * 验证是否为有效的系统路径（跨平台）
   */
  private isValidSystemPath(filePath: string): boolean {
    try {
      const os = platform()
      
      // 基础检查：路径不能为空
      if (!filePath || filePath.trim() === '') {
        return false
      }
      
      // 检查危险字符（不同平台有不同的限制）
      const dangerousChars = os === 'win32' ? 
        /[<>:"|?*\x00-\x1f]/ :  // Windows禁用字符
        /[\x00]/                 // Unix只禁用null字符
      
      if (dangerousChars.test(filePath)) {
        log.warn(`[FileOperations MCP] ⚠️  路径包含危险字符: ${filePath}`)
        return false
      }
      
      // Windows特殊检查
      if (os === 'win32') {
        // 检查是否为保留名称
        const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i
        const filename = path.basename(filePath)
        if (reservedNames.test(filename)) {
          log.warn(`[FileOperations MCP] ⚠️  Windows保留文件名: ${filename}`)
          return false
        }
        
        // 检查路径长度（Windows限制）
        if (filePath.length > 260) {
          log.warn(`[FileOperations MCP] ⚠️  Windows路径过长: ${filePath.length} > 260`)
          return false
        }
      }
      
      // Unix特殊检查
      if (os !== 'win32') {
        // 检查路径长度（大多数Unix系统限制）
        if (filePath.length > 4096) {
          log.warn(`[FileOperations MCP] ⚠️  Unix路径过长: ${filePath.length} > 4096`)
          return false
        }
        
        // 检查单个文件名长度
        const filename = path.basename(filePath)
        if (filename.length > 255) {
          log.warn(`[FileOperations MCP] ⚠️  文件名过长: ${filename.length} > 255`)
          return false
        }
      }
      
      return true
      
    } catch (error) {
      log.error(`[FileOperations MCP] 路径验证异常: ${filePath}`, error)
      return false
    }
  }

  // ==================== 工具注册方法 ====================

  /**
   * 1. 注册文件读取工具
   */
  private registerFileReadTool(): void {
    this.server.registerTool(
      'read_file',
      {
        title: '读取文件',
        description: '读取文件内容，支持文本文件和二进制文件的base64编码',
        inputSchema: {
          path: z.string().describe('文件路径，必须在允许的目录范围内'),
          encoding: z.enum(['utf8', 'base64']).default('utf8').describe('文件编码格式')
        }
      },
      async ({ path: filePath, encoding = 'utf8' }) => {
        try {
          const safePath = this.validatePath(filePath)
          
          if (encoding === 'base64') {
            const buffer = await fs.readFile(safePath)
            const stats = await fs.stat(safePath)
            
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  content: buffer.toString('base64'),
                  encoding: 'base64',
                  size: buffer.length,
                  sizeFormatted: CrossPlatformPathUtils.formatFileSize(buffer.length),
                  path: safePath,
                  lastModified: stats.mtime.toISOString()
                }, null, 2)
              }]
            }
          } else {
            const content = await fs.readFile(safePath, 'utf8')
            const stats = await fs.stat(safePath)
            
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  content,
                  encoding: 'utf8',
                  size: Buffer.byteLength(content, 'utf8'),
                  sizeFormatted: CrossPlatformPathUtils.formatFileSize(Buffer.byteLength(content, 'utf8')),
                  path: safePath,
                  lastModified: stats.mtime.toISOString()
                }, null, 2)
              }]
            }
          }
        } catch (error: any) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `读取文件失败: ${error.message}`,
                path: filePath
              }, null, 2)
            }],
            isError: true
          }
        }
      }
    )
  }

  /**
   * 2. 注册文件写入工具
   */
  private registerFileWriteTool(): void {
    this.server.registerTool(
      'write_file',
      {
        title: '写入文件',
        description: '写入文件内容，如果文件不存在会创建新文件',
        inputSchema: {
          path: z.string().describe('文件路径，必须在允许的目录范围内'),
          content: z.string().describe('文件内容'),
          encoding: z.enum(['utf8', 'base64']).default('utf8').describe('文件编码格式')
        }
      },
      async ({ path: filePath, content, encoding = 'utf8' }) => {
        try {
          const safePath = this.validatePath(filePath)
          
          // 确保父目录存在
          await fs.mkdir(path.dirname(safePath), { recursive: true })
          
          if (encoding === 'base64') {
            const buffer = Buffer.from(content, 'base64')
            await fs.writeFile(safePath, buffer)
            
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: '文件写入成功（base64）',
                  path: safePath,
                  size: buffer.length,
                  sizeFormatted: CrossPlatformPathUtils.formatFileSize(buffer.length),
                  timestamp: new Date().toISOString()
                }, null, 2)
              }]
            }
          } else {
            await fs.writeFile(safePath, content, 'utf8')
            const size = Buffer.byteLength(content, 'utf8')
            
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: '文件写入成功',
                  path: safePath,
                  size,
                  sizeFormatted: CrossPlatformPathUtils.formatFileSize(size),
                  timestamp: new Date().toISOString()
                }, null, 2)
              }]
            }
          }
        } catch (error: any) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `写入文件失败: ${error.message}`,
                path: filePath
              }, null, 2)
            }],
            isError: true
          }
        }
      }
    )
  }

  /**
   * 3. 注册目录列举工具
   */
  private registerDirectoryListTool(): void {
    this.server.registerTool(
      'list_directory',
      {
        title: '列出目录',
        description: '列出目录中的文件和子目录',
        inputSchema: {
          path: z.string().describe('目录路径，必须在允许的目录范围内'),
          recursive: z.boolean().default(false).describe('是否递归列出子目录'),
          includeHidden: z.boolean().default(false).describe('是否包含隐藏文件')
        }
      },
      async ({ path: dirPath, recursive = false, includeHidden = false }) => {
        try {
          const safePath = this.validatePath(dirPath)
          const items: any[] = []
          
          if (recursive) {
            await this.listDirectoryRecursive(safePath, items, includeHidden)
          } else {
            const entries = await fs.readdir(safePath, { withFileTypes: true })
            
            for (const entry of entries) {
              if (!includeHidden && entry.name.startsWith('.')) {
                continue
              }
              
              const fullPath = path.join(safePath, entry.name)
              const stats = await fs.stat(fullPath)
              
              items.push({
                name: entry.name,
                path: fullPath,
                type: entry.isDirectory() ? 'directory' : 'file',
                size: entry.isFile() ? stats.size : undefined,
                sizeFormatted: entry.isFile() ? CrossPlatformPathUtils.formatFileSize(stats.size) : undefined,
                createdAt: stats.birthtime.toISOString(),
                modifiedAt: stats.mtime.toISOString()
              })
            }
          }
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                path: safePath,
                items,
                count: items.length,
                recursive,
                includeHidden,
                timestamp: new Date().toISOString()
              }, null, 2)
            }]
          }
        } catch (error: any) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `列出目录失败: ${error.message}`,
                path: dirPath
              }, null, 2)
            }],
            isError: true
          }
        }
      }
    )
  }

  /**
   * 4. 注册目录创建工具
   */
  private registerDirectoryCreateTool(): void {
    this.server.registerTool(
      'create_directory',
      {
        title: '创建目录',
        description: '创建目录，支持递归创建',
        inputSchema: {
          path: z.string().describe('目录路径，必须在允许的目录范围内'),
          recursive: z.boolean().default(true).describe('是否递归创建父目录')
        }
      },
      async ({ path: dirPath, recursive = true }) => {
        try {
          const safePath = this.validatePath(dirPath)
          
          await fs.mkdir(safePath, { recursive })
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: '目录创建成功',
                path: safePath,
                recursive,
                timestamp: new Date().toISOString()
              }, null, 2)
            }]
          }
        } catch (error: any) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `创建目录失败: ${error.message}`,
                path: dirPath
              }, null, 2)
            }],
            isError: true
          }
        }
      }
    )
  }

  /**
   * 5. 注册文件删除工具
   */
  private registerFileDeleteTool(): void {
    this.server.registerTool(
      'delete_file',
      {
        title: '删除文件或目录',
        description: '删除文件或目录（谨慎使用）',
        inputSchema: {
          path: z.string().describe('文件或目录路径，必须在允许的目录范围内'),
          recursive: z.boolean().default(false).describe('如果是目录，是否递归删除')
        },
        annotations: {
          destructiveHint: true,
          idempotentHint: true
        }
      },
      async ({ path: filePath, recursive = false }) => {
        try {
          const safePath = this.validatePath(filePath)
          const stats = await fs.stat(safePath)
          
          if (stats.isDirectory()) {
            if (recursive) {
              await fs.rm(safePath, { recursive: true, force: true })
            } else {
              await fs.rmdir(safePath)
            }
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: '目录删除成功',
                  path: safePath,
                  type: 'directory',
                  recursive,
                  timestamp: new Date().toISOString()
                }, null, 2)
              }]
            }
          } else {
            await fs.unlink(safePath)
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: '文件删除成功',
                  path: safePath,
                  type: 'file',
                  timestamp: new Date().toISOString()
                }, null, 2)
              }]
            }
          }
        } catch (error: any) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `删除失败: ${error.message}`,
                path: filePath
              }, null, 2)
            }],
            isError: true
          }
        }
      }
    )
  }

  /**
   * 6. 注册文件移动/重命名工具
   */
  private registerFileMoveRename(): void {
    this.server.registerTool(
      'move_file',
      {
        title: '移动或重命名文件',
        description: '移动或重命名文件/目录',
        inputSchema: {
          source: z.string().describe('源文件路径'),
          destination: z.string().describe('目标文件路径')
        }
      },
      async ({ source, destination }) => {
        try {
          const safeSource = this.validatePath(source)
          const safeDestination = this.validatePath(destination)
          
          // 确保目标目录存在
          await fs.mkdir(path.dirname(safeDestination), { recursive: true })
          
          await fs.rename(safeSource, safeDestination)
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: '文件移动成功',
                source: safeSource,
                destination: safeDestination,
                timestamp: new Date().toISOString()
              }, null, 2)
            }]
          }
        } catch (error: any) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `移动文件失败: ${error.message}`,
                source,
                destination
              }, null, 2)
            }],
            isError: true
          }
        }
      }
    )
  }

  /**
   * 7. 注册文件复制工具
   */
  private registerFileCopyTool(): void {
    this.server.registerTool(
      'copy_file',
      {
        title: '复制文件或目录',
        description: '复制文件或目录',
        inputSchema: {
          source: z.string().describe('源文件路径'),
          destination: z.string().describe('目标文件路径'),
          recursive: z.boolean().default(false).describe('如果是目录，是否递归复制')
        }
      },
      async ({ source, destination, recursive = false }) => {
        try {
          const safeSource = this.validatePath(source)
          const safeDestination = this.validatePath(destination)
          
          // 确保目标目录存在
          await fs.mkdir(path.dirname(safeDestination), { recursive: true })
          
          const stats = await fs.stat(safeSource)
          
          if (stats.isDirectory()) {
            if (!recursive) {
              throw new Error('复制目录需要设置 recursive=true')
            }
            await this.copyDirectoryRecursive(safeSource, safeDestination)
          } else {
            await fs.copyFile(safeSource, safeDestination)
          }
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: stats.isDirectory() ? '目录复制成功' : '文件复制成功',
                source: safeSource,
                destination: safeDestination,
                type: stats.isDirectory() ? 'directory' : 'file',
                recursive: stats.isDirectory() ? recursive : undefined,
                timestamp: new Date().toISOString()
              }, null, 2)
            }]
          }
        } catch (error: any) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `复制失败: ${error.message}`,
                source,
                destination
              }, null, 2)
            }],
            isError: true
          }
        }
      }
    )
  }

  /**
   * 8. 注册文件信息工具
   */
  private registerFileInfoTool(): void {
    this.server.registerTool(
      'get_file_info',
      {
        title: '获取文件信息',
        description: '获取文件或目录的详细信息',
        inputSchema: {
          path: z.string().describe('文件或目录路径')
        },
        annotations: {
          readOnlyHint: true
        }
      },
      async ({ path: filePath }) => {
        try {
          const safePath = this.validatePath(filePath)
          const stats = await fs.stat(safePath)
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                path: safePath,
                name: path.basename(safePath),
                type: stats.isDirectory() ? 'directory' : 'file',
                size: stats.size,
                sizeFormatted: CrossPlatformPathUtils.formatFileSize(stats.size),
                createdAt: stats.birthtime.toISOString(),
                modifiedAt: stats.mtime.toISOString(),
                accessedAt: stats.atime.toISOString(),
                permissions: {
                  mode: stats.mode,
                  octal: (stats.mode & parseInt('777', 8)).toString(8)
                },
                platform: platform(),
                isReadable: true,
                isWritable: true,
                timestamp: new Date().toISOString()
              }, null, 2)
            }]
          }
        } catch (error: any) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `获取文件信息失败: ${error.message}`,
                path: filePath
              }, null, 2)
            }],
            isError: true
          }
        }
      }
    )
  }

  /**
   * 9. 注册文件搜索工具
   */
  private registerFileSearchTool(): void {
    this.server.registerTool(
      'search_files',
      {
        title: '搜索文件',
        description: '在指定目录中搜索文件',
        inputSchema: {
          directory: z.string().describe('搜索目录'),
          pattern: z.string().optional().describe('文件名模式（支持glob）'),
          content: z.string().optional().describe('文件内容搜索关键词'),
          recursive: z.boolean().default(true).describe('是否递归搜索')
        },
        annotations: {
          readOnlyHint: true,
          openWorldHint: false
        }
      },
      async ({ directory, pattern, content, recursive = true }) => {
        try {
          const safeDir = this.validatePath(directory)
          const results: any[] = []
          
          await this.searchInDirectory(safeDir, pattern, content, recursive, results)
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                directory: safeDir,
                pattern,
                content,
                recursive,
                results,
                count: results.length,
                timestamp: new Date().toISOString()
              }, null, 2)
            }]
          }
        } catch (error: any) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `文件搜索失败: ${error.message}`,
                directory
              }, null, 2)
            }],
            isError: true
          }
        }
      }
    )
  }

  // ==================== 辅助方法 ====================

  /**
   * 递归列出目录
   */
  private async listDirectoryRecursive(dirPath: string, items: any[], includeHidden = false): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    
    for (const entry of entries) {
      if (!includeHidden && entry.name.startsWith('.')) {
        continue
      }
      
      const fullPath = path.join(dirPath, entry.name)
      const stats = await fs.stat(fullPath)
      
      items.push({
        name: entry.name,
        path: fullPath,
        type: entry.isDirectory() ? 'directory' : 'file',
        size: entry.isFile() ? stats.size : undefined,
        sizeFormatted: entry.isFile() ? CrossPlatformPathUtils.formatFileSize(stats.size) : undefined,
        createdAt: stats.birthtime.toISOString(),
        modifiedAt: stats.mtime.toISOString()
      })
      
      if (entry.isDirectory()) {
        await this.listDirectoryRecursive(fullPath, items, includeHidden)
      }
    }
  }

  /**
   * 递归复制目录
   */
  private async copyDirectoryRecursive(source: string, destination: string): Promise<void> {
    await fs.mkdir(destination, { recursive: true })
    const entries = await fs.readdir(source, { withFileTypes: true })
    
    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name)
      const destinationPath = path.join(destination, entry.name)
      
      if (entry.isDirectory()) {
        await this.copyDirectoryRecursive(sourcePath, destinationPath)
      } else {
        await fs.copyFile(sourcePath, destinationPath)
      }
    }
  }

  /**
   * 在目录中搜索
   */
  private async searchInDirectory(directory: string, pattern?: string, content?: string, recursive = true, results: any[] = []): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name)
      
      if (entry.isDirectory() && recursive) {
        await this.searchInDirectory(fullPath, pattern, content, recursive, results)
      } else if (entry.isFile()) {
        let matches = true
        
        // 文件名模式匹配
        if (pattern && !this.matchGlob(entry.name, pattern)) {
          matches = false
        }
        
        // 内容搜索
        if (matches && content) {
          try {
            const fileContent = await fs.readFile(fullPath, 'utf8')
            if (!fileContent.includes(content)) {
              matches = false
            }
          } catch {
            matches = false // 无法读取的文件不匹配
          }
        }
        
        if (matches) {
          const stats = await fs.stat(fullPath)
          results.push({
            name: entry.name,
            path: fullPath,
            size: stats.size,
            sizeFormatted: CrossPlatformPathUtils.formatFileSize(stats.size),
            createdAt: stats.birthtime.toISOString(),
            modifiedAt: stats.mtime.toISOString()
          })
        }
      }
    }
  }

  /**
   * 简单的glob模式匹配
   */
  private matchGlob(filename: string, pattern: string): boolean {
    const regex = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
    
    return new RegExp(`^${regex}$`, 'i').test(filename)
  }

  /**
   * 获取工具处理器 (支持直接调用)
   */
  private getToolHandler(toolName: string): ((args: any) => Promise<any>) | null {
    const toolHandlers: Record<string, (args: any) => Promise<any>> = {
      'read_file': async ({ path: filePath, encoding = 'utf8' }) => {
        const safePath = this.validatePath(filePath)
        
        if (encoding === 'base64') {
          const buffer = await fs.readFile(safePath)
          const stats = await fs.stat(safePath)
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                content: buffer.toString('base64'),
                encoding: 'base64',
                size: buffer.length,
                sizeFormatted: CrossPlatformPathUtils.formatFileSize(buffer.length),
                path: safePath,
                lastModified: stats.mtime.toISOString()
              }, null, 2)
            }]
          }
        } else {
          const content = await fs.readFile(safePath, 'utf8')
          const stats = await fs.stat(safePath)
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                content,
                encoding: 'utf8',
                size: Buffer.byteLength(content, 'utf8'),
                sizeFormatted: CrossPlatformPathUtils.formatFileSize(Buffer.byteLength(content, 'utf8')),
                path: safePath,
                lastModified: stats.mtime.toISOString()
              }, null, 2)
            }]
          }
        }
      },

      'write_file': async ({ path: filePath, content, encoding = 'utf8' }) => {
        const safePath = this.validatePath(filePath)
        
        // 确保父目录存在
        await fs.mkdir(path.dirname(safePath), { recursive: true })
        
        if (encoding === 'base64') {
          const buffer = Buffer.from(content, 'base64')
          await fs.writeFile(safePath, buffer)
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: '文件写入成功（base64）',
                path: safePath,
                size: buffer.length,
                sizeFormatted: CrossPlatformPathUtils.formatFileSize(buffer.length),
                timestamp: new Date().toISOString()
              }, null, 2)
            }]
          }
        } else {
          await fs.writeFile(safePath, content, 'utf8')
          const size = Buffer.byteLength(content, 'utf8')
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: '文件写入成功',
                path: safePath,
                size,
                sizeFormatted: CrossPlatformPathUtils.formatFileSize(size),
                timestamp: new Date().toISOString()
              }, null, 2)
            }]
          }
        }
      },

      'list_directory': async ({ path: dirPath, recursive = false, includeHidden = false }) => {
        const safePath = this.validatePath(dirPath)
        const items: any[] = []
        
        if (recursive) {
          await this.listDirectoryRecursive(safePath, items, includeHidden)
        } else {
          const entries = await fs.readdir(safePath, { withFileTypes: true })
          
          for (const entry of entries) {
            if (!includeHidden && entry.name.startsWith('.')) {
              continue
            }
            
            const fullPath = path.join(safePath, entry.name)
            const stats = await fs.stat(fullPath)
            
            items.push({
              name: entry.name,
              path: fullPath,
              type: entry.isDirectory() ? 'directory' : 'file',
              size: entry.isFile() ? stats.size : undefined,
              sizeFormatted: entry.isFile() ? CrossPlatformPathUtils.formatFileSize(stats.size) : undefined,
              createdAt: stats.birthtime.toISOString(),
              modifiedAt: stats.mtime.toISOString()
            })
          }
        }
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              path: safePath,
              items,
              count: items.length,
              recursive,
              includeHidden,
              timestamp: new Date().toISOString()
            }, null, 2)
          }]
        }
      },

      'create_directory': async ({ path: dirPath, recursive = true }) => {
        const safePath = this.validatePath(dirPath)
        
        await fs.mkdir(safePath, { recursive })
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: '目录创建成功',
              path: safePath,
              recursive,
              timestamp: new Date().toISOString()
            }, null, 2)
          }]
        }
      },

      'delete_file': async ({ path: filePath, recursive = false }) => {
        const safePath = this.validatePath(filePath)
        const stats = await fs.stat(safePath)
        
        if (stats.isDirectory()) {
          if (recursive) {
            await fs.rm(safePath, { recursive: true, force: true })
          } else {
            await fs.rmdir(safePath)
          }
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: '目录删除成功',
                path: safePath,
                type: 'directory',
                recursive,
                timestamp: new Date().toISOString()
              }, null, 2)
            }]
          }
        } else {
          await fs.unlink(safePath)
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: '文件删除成功',
                path: safePath,
                type: 'file',
                timestamp: new Date().toISOString()
              }, null, 2)
            }]
          }
        }
      },

      'move_file': async ({ source, destination }) => {
        const safeSource = this.validatePath(source)
        const safeDestination = this.validatePath(destination)
        
        // 确保目标目录存在
        await fs.mkdir(path.dirname(safeDestination), { recursive: true })
        
        await fs.rename(safeSource, safeDestination)
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: '文件移动成功',
              source: safeSource,
              destination: safeDestination,
              timestamp: new Date().toISOString()
            }, null, 2)
          }]
        }
      },

      'copy_file': async ({ source, destination, recursive = false }) => {
        const safeSource = this.validatePath(source)
        const safeDestination = this.validatePath(destination)
        
        // 确保目标目录存在
        await fs.mkdir(path.dirname(safeDestination), { recursive: true })
        
        const stats = await fs.stat(safeSource)
        
        if (stats.isDirectory()) {
          if (!recursive) {
            throw new Error('复制目录需要设置 recursive=true')
          }
          await this.copyDirectoryRecursive(safeSource, safeDestination)
        } else {
          await fs.copyFile(safeSource, safeDestination)
        }
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: stats.isDirectory() ? '目录复制成功' : '文件复制成功',
              source: safeSource,
              destination: safeDestination,
              type: stats.isDirectory() ? 'directory' : 'file',
              recursive: stats.isDirectory() ? recursive : undefined,
              timestamp: new Date().toISOString()
            }, null, 2)
          }]
        }
      },

      'get_file_info': async ({ path: filePath }) => {
        const safePath = this.validatePath(filePath)
        const stats = await fs.stat(safePath)
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              path: safePath,
              name: path.basename(safePath),
              type: stats.isDirectory() ? 'directory' : 'file',
              size: stats.size,
              sizeFormatted: CrossPlatformPathUtils.formatFileSize(stats.size),
              createdAt: stats.birthtime.toISOString(),
              modifiedAt: stats.mtime.toISOString(),
              accessedAt: stats.atime.toISOString(),
              permissions: {
                mode: stats.mode,
                octal: (stats.mode & parseInt('777', 8)).toString(8)
              },
              platform: platform(),
              isReadable: true,
              isWritable: true,
              timestamp: new Date().toISOString()
            }, null, 2)
          }]
        }
      },

      'search_files': async ({ directory, pattern, content, recursive = true }) => {
        const safeDir = this.validatePath(directory)
        const results: any[] = []
        
        await this.searchInDirectory(safeDir, pattern, content, recursive, results)
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              directory: safeDir,
              pattern,
              content,
              recursive,
              results,
              count: results.length,
              timestamp: new Date().toISOString()
            }, null, 2)
          }]
        }
      }
    }

    return toolHandlers[toolName] || null
  }

  /**
   * 获取当前工作区的实际文件路径列表
   */
  private getCurrentWorkspaceFiles(): { userFiles: string[], aiFiles: string[], tempFiles: string[] } {
    try {
      // 尝试获取ServiceManager实例并获取工作区服务
      const ServiceManager = require('../../core/ServiceManager').ServiceManager
      const serviceManager = ServiceManager.getInstance()
      
      if (serviceManager?.isInitialized) {
        const workspaceService = serviceManager.getWorkspaceService()
        
        // 获取不同类型的文件
        const userFiles = workspaceService.getUserFiles().map((ref: any) => ref.originalPath).slice(0, 5) // 最多显示5个
        const aiFiles = workspaceService.getAIFiles().map((ref: any) => ref.originalPath).slice(0, 5) 
        const tempFiles = workspaceService.getTempFiles().map((ref: any) => ref.originalPath).slice(0, 5)
        
        return { userFiles, aiFiles, tempFiles }
      }
    } catch (error) {
      // 如果获取失败，返回空列表
      console.log('[FileOperations MCP] 📝 工作区服务尚未初始化，将显示示例路径')
    }
    
    // 返回空列表作为默认值
    return { userFiles: [], aiFiles: [], tempFiles: [] }
  }

  /**
   * 注册工作区发现工具
   */
  private registerWorkspaceDiscoveryTool(): void {
    this.server.registerTool(
      'discover_workspace',
      {
        title: '发现工作区文件结构',
        description: '获取当前工作区的文件列表和路径信息',
        inputSchema: {}
      },
      async () => {
        try {
          const { app } = require('electron')
          const userDataPath = app.getPath('userData')
          const workspaceRoot = `${userDataPath}/deechat-workspace`
          const aiGeneratedPath = `${workspaceRoot}/ai-generated`
          const tempPath = `${workspaceRoot}/temp`
          
          const workspaceFiles = this.getCurrentWorkspaceFiles()
          
          const discoveryInfo = {
            success: true,
            message: '🎯 DeeChat工作区发现完成',
            workspace: {
              root: workspaceRoot,
              aiGenerated: aiGeneratedPath,
              temp: tempPath
            },
            currentFiles: {
              userFiles: workspaceFiles.userFiles,
              aiFiles: workspaceFiles.aiFiles,
              tempFiles: workspaceFiles.tempFiles
            },
            recommendations: {
              forReading: [
                ...workspaceFiles.userFiles,
                ...workspaceFiles.aiFiles
              ],
              forWriting: [
                `${aiGeneratedPath}/your_analysis.md`,
                `${aiGeneratedPath}/generated_code.py`,
                `${tempPath}/temp_output.txt`
              ]
            },
            usage: {
              userFiles: '用户拖拽的文件，只读引用，不占用额外空间',
              aiFiles: 'AI生成的文件，保存在专用目录，可读写',
              tempFiles: '临时文件，会自动过期清理'
            },
            timestamp: new Date().toISOString()
          }

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(discoveryInfo, null, 2)
            }]
          }
        } catch (error: any) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `工作区发现失败: ${error.message}`
              }, null, 2)
            }],
            isError: true
          }
        }
      }
    )
  }
}