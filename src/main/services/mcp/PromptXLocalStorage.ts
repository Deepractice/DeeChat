import { app } from 'electron'
import { join } from 'path'
import { promises as fs } from 'fs'
import { execSync } from 'child_process'

/**
 * PromptX本地化存储服务
 * 负责PromptX的本地缓存、版本管理和静默更新
 */
export class PromptXLocalStorage {
  private readonly localDir: string
  private readonly configFile: string
  private readonly tempDir: string

  constructor() {
    this.localDir = join(app.getPath('userData'), '.promptx-local')
    this.configFile = join(this.localDir, 'version-info.json')
    this.tempDir = join(this.localDir, 'temp')
  }

  /**
   * 初始化本地存储目录
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.localDir, { recursive: true })
      await fs.mkdir(this.tempDir, { recursive: true })
      console.log('✅ [PromptX本地存储] 初始化完成:', this.localDir)
    } catch (error) {
      console.error('❌ [PromptX本地存储] 初始化失败:', error)
      throw error
    }
  }

  /**
   * 检查本地是否有可用的PromptX版本
   */
  async hasLocalVersion(): Promise<boolean> {
    try {
      const config = await this.getVersionConfig()
      if (!config || !config.currentVersion) {
        return false
      }

      const versionPath = join(this.localDir, config.currentVersion)
      const stat = await fs.stat(versionPath)
      if (!stat.isDirectory()) {
        return false
      }

      // 🔥 验证入口文件是否存在
      try {
        await this.findPromptXEntry(versionPath)
        return true
      } catch (error) {
        console.log('🔍 [PromptX本地存储] 本地版本存在但入口文件缺失:', error instanceof Error ? error.message : String(error))
        return false
      }
    } catch (error) {
      console.log('🔍 [PromptX本地存储] 检查本地版本失败:', error instanceof Error ? error.message : String(error))
      return false
    }
  }

  /**
   * 确保本地版本可用，首次启动时同步下载
   */
  async ensureLocalVersionAvailable(): Promise<void> {
    if (await this.hasLocalVersion()) {
      console.log('✅ [PromptX本地存储] 本地版本已可用')
      return
    }

    console.log('🔥 [PromptX本地存储] 首次启动，开始同步下载PromptX...')
    try {
      await this.downloadToLocal('beta')
      console.log('✅ [PromptX本地存储] 首次下载完成')
    } catch (error) {
      console.error('❌ [PromptX本地存储] 首次下载失败:', error)
      throw new Error(`PromptX初始化失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 获取本地PromptX版本信息
   */
  async getLocalVersion(): Promise<string | null> {
    try {
      const config = await this.getVersionConfig()
      return config?.currentVersion || null
    } catch (error) {
      console.log('🔍 [PromptX本地存储] 获取本地版本失败:', error instanceof Error ? error.message : String(error))
      return null
    }
  }

  /**
   * 使用本地版本启动PromptX MCP服务器
   */
  async startFromLocal(): Promise<{ command: string; args: string[]; workingDirectory: string }> {
    const config = await this.getVersionConfig()
    if (!config || !config.currentVersion) {
      throw new Error('本地版本不存在')
    }

    const versionPath = join(this.localDir, config.currentVersion)
    
    // 🔥 动态查找正确的入口文件
    const entryPath = await this.findPromptXEntry(versionPath)
    
    console.log('🚀 [PromptX本地存储] 使用本地版本:', config.currentVersion)
    console.log('🎯 [PromptX本地存储] 入口文件:', entryPath)
    
    return {
      command: 'node',
      args: [entryPath, 'mcp-server'],
      workingDirectory: versionPath
    }
  }

  /**
   * 动态查找PromptX的入口文件
   */
  private async findPromptXEntry(versionPath: string): Promise<string> {
    // 可能的入口文件路径
    const possibleEntries = [
      join(versionPath, 'dist', 'mcp-server.js'),
      join(versionPath, 'src', 'bin', 'promptx.js'),
      join(versionPath, 'bin', 'promptx.js'),
      join(versionPath, 'lib', 'mcp-server.js'),
      join(versionPath, 'index.js')
    ]

    for (const entryPath of possibleEntries) {
      try {
        await fs.access(entryPath)
        console.log(`✅ [PromptX本地存储] 找到入口文件: ${entryPath}`)
        return entryPath
      } catch (error) {
        // 继续查找下一个路径
      }
    }

    throw new Error(`未找到PromptX入口文件，搜索目录: ${versionPath}`)
  }

  /**
   * 下载并安装PromptX到本地（包含依赖）
   */
  async downloadToLocal(version: string = 'beta'): Promise<void> {
    console.log(`📥 [PromptX本地存储] 开始下载 dpml-prompt@${version}...`)
    
    try {
      // 清理临时目录
      await this.cleanupTemp()

      // 🔥 在临时目录中创建完整的npm项目
      const tempProjectDir = join(this.tempDir, 'promptx-install')
      await fs.mkdir(tempProjectDir, { recursive: true })

      // 创建package.json
      const packageJson = {
        name: 'promptx-local-install',
        version: '1.0.0',
        dependencies: {
          [`dpml-prompt`]: version
        }
      }
      await fs.writeFile(
        join(tempProjectDir, 'package.json'), 
        JSON.stringify(packageJson, null, 2)
      )

      console.log('🔧 [PromptX本地存储] 开始安装包和依赖...')

      // 使用npm install安装包和所有依赖
      const installCommand = `cd "${tempProjectDir}" && npm install --registry https://registry.npmmirror.com --no-fund --no-audit`
      
      execSync(installCommand, { 
        stdio: 'pipe',
        timeout: 120000, // 增加超时时间用于安装依赖
        env: { ...process.env }
      })

      // 找到安装的包目录
      const installedPackageDir = join(tempProjectDir, 'node_modules', 'dpml-prompt')
      
      try {
        await fs.access(installedPackageDir)
        console.log('✅ [PromptX本地存储] dpml-prompt包安装成功')
        
        // 复制完整包（包含依赖解析后的代码）到本地存储
        await this.copyToLocal(installedPackageDir, version)
        
        // 🔥 复制整个node_modules目录到目标位置（确保所有依赖可用）
        const targetPath = join(this.localDir, version)
        const nodeModulesSource = join(tempProjectDir, 'node_modules')
        const nodeModulesTarget = join(targetPath, 'node_modules')
        
        console.log('🔧 [PromptX本地存储] 开始复制完整依赖树...')
        try {
          await this.copyDirectory(nodeModulesSource, nodeModulesTarget)
          console.log('✅ [PromptX本地存储] 完整依赖树复制完成')
        } catch (error) {
          console.error('❌ [PromptX本地存储] 依赖复制失败:', error)
          throw error; // 依赖复制失败时应该抛出错误
        }
        
        // 更新版本配置
        await this.updateVersionConfig(version)
        
        console.log(`✅ [PromptX本地存储] 下载完成: dpml-prompt@${version}`)
      } catch (accessError) {
        console.error('❌ [PromptX本地存储] 安装的包目录不存在:', accessError)
        throw new Error('安装的包目录不存在')
      }

    } catch (error) {
      console.error('❌ [PromptX本地存储] 下载失败:', error)
      await this.cleanupTemp()
      throw error
    }
  }

  /**
   * 静默检查并更新PromptX
   */
  async checkAndUpdateSilently(): Promise<void> {
    try {
      // 检查是否需要更新
      if (!await this.shouldCheckForUpdates()) {
        console.log('🔍 [PromptX本地存储] 跳过更新检查 (距离上次检查时间过短)')
        return
      }

      console.log('🔄 [PromptX本地存储] 开始静默更新检查...')

      const localVersion = await this.getLocalVersion()
      console.log('📍 [PromptX本地存储] 当前本地版本:', localVersion || '无')

      // 尝试获取最新版本信息
      const latestVersion = await this.getLatestRemoteVersion()
      console.log('📍 [PromptX本地存储] 最新远程版本:', latestVersion)

      if (latestVersion && localVersion !== latestVersion) {
        console.log(`🆕 [PromptX本地存储] 发现新版本: ${localVersion} → ${latestVersion}`)
        await this.downloadToLocal(latestVersion)
        console.log('✅ [PromptX本地存储] 静默更新完成，下次启动生效')
      } else {
        console.log('✨ [PromptX本地存储] 已是最新版本，无需更新')
      }

      // 更新最后检查时间
      await this.updateLastCheckTime()

    } catch (error) {
      console.warn('⚠️ [PromptX本地存储] 静默更新失败，继续使用当前版本:', error instanceof Error ? error.message : String(error))
    }
  }

  // ================== 私有方法 ==================

  /**
   * 获取版本配置信息
   */
  private async getVersionConfig(): Promise<any> {
    try {
      const configData = await fs.readFile(this.configFile, 'utf-8')
      return JSON.parse(configData)
    } catch (error) {
      return null
    }
  }

  /**
   * 更新版本配置信息
   */
  private async updateVersionConfig(version: string): Promise<void> {
    const config = {
      currentVersion: version,
      lastUpdate: Date.now(),
      lastCheck: Date.now()
    }

    await fs.writeFile(this.configFile, JSON.stringify(config, null, 2))
  }


  /**
   * 复制包文件到本地存储
   */
  private async copyToLocal(sourcePath: string, version: string): Promise<void> {
    const targetPath = join(this.localDir, version)
    
    try {
      // 清理目标目录
      await fs.rm(targetPath, { recursive: true, force: true })
      
      // 复制文件
      await this.copyDirectory(sourcePath, targetPath)
      
      console.log('📋 [PromptX本地存储] 复制完成:', targetPath)
    } catch (error) {
      console.error('📋 [PromptX本地存储] 复制失败:', error)
      throw error
    }
  }

  /**
   * 递归复制目录
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true })
    
    const entries = await fs.readdir(src, { withFileTypes: true })
    
    for (const entry of entries) {
      const srcPath = join(src, entry.name)
      const destPath = join(dest, entry.name)
      
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath)
      } else {
        await fs.copyFile(srcPath, destPath)
      }
    }
  }

  /**
   * 获取最新的远程版本号
   */
  private async getLatestRemoteVersion(): Promise<string | null> {
    try {
      const result = execSync('npm view dpml-prompt@beta version --registry https://registry.npmmirror.com', {
        encoding: 'utf-8',
        timeout: 10000
      })
      
      return result.trim()
    } catch (error) {
      console.warn('🔍 [PromptX本地存储] 获取远程版本失败:', error instanceof Error ? error.message : String(error))
      return null
    }
  }

  /**
   * 检查是否应该进行更新检查
   */
  private async shouldCheckForUpdates(): Promise<boolean> {
    try {
      const config = await this.getVersionConfig()
      if (!config || !config.lastCheck) {
        return true
      }

      const now = Date.now()
      const lastCheck = config.lastCheck
      const checkInterval = 24 * 60 * 60 * 1000 // 24小时

      return (now - lastCheck) > checkInterval
    } catch (error) {
      return true // 出错时默认允许检查
    }
  }

  /**
   * 更新最后检查时间
   */
  private async updateLastCheckTime(): Promise<void> {
    try {
      const config = await this.getVersionConfig() || {}
      config.lastCheck = Date.now()
      await fs.writeFile(this.configFile, JSON.stringify(config, null, 2))
    } catch (error) {
      console.warn('⚠️ [PromptX本地存储] 更新检查时间失败:', error)
    }
  }

  /**
   * 清理临时目录
   */
  private async cleanupTemp(): Promise<void> {
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true })
      await fs.mkdir(this.tempDir, { recursive: true })
    } catch (error) {
      console.warn('🧹 [PromptX本地存储] 清理临时目录失败:', error)
    }
  }
}