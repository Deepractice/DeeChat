/**
 * 应用配置管理
 * 统一管理所有配置信息，支持环境变量和配置文件
 */

import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'

export interface DatabaseConfig {
  path: string
  backupPath?: string
  maxConnections?: number
}

export interface LLMConfig {
  defaultProvider: string
  apiKeys: Record<string, string>
  timeout: number
}

export interface PromptXConfig {
  enabled: boolean
  serverUrl?: string
  workspacePath?: string
}

export interface AppConfig {
  database: DatabaseConfig
  llm: LLMConfig
  promptx: PromptXConfig
  window: {
    width: number
    height: number
    minWidth: number
    minHeight: number
  }
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error'
    filePath?: string
  }
  development: {
    devTools: boolean
    hotReload: boolean
  }
}

export class Configuration {
  private config: AppConfig
  private configPath: string
  private loaded = false

  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'config.json')
    this.config = this.getDefaultConfig()
  }

  /**
   * 加载配置
   */
  async load(): Promise<void> {
    try {
      console.log('📋 [Configuration] 加载配置文件:', this.configPath)

      // 尝试从文件加载配置
      const configExists = await this.fileExists(this.configPath)
      if (configExists) {
        const fileContent = await fs.readFile(this.configPath, 'utf-8')
        const fileConfig = JSON.parse(fileContent)
        this.config = this.mergeConfig(this.config, fileConfig)
        console.log('✅ [Configuration] 从文件加载配置成功')
      } else {
        console.log('📝 [Configuration] 配置文件不存在，使用默认配置')
        await this.save() // 保存默认配置
      }

      // 应用环境变量覆盖
      this.applyEnvironmentVariables()

      // 验证配置
      this.validateConfig()

      this.loaded = true
      console.log('✅ [Configuration] 配置加载完成')

    } catch (error) {
      console.error('❌ [Configuration] 配置加载失败:', error)
      console.log('🔄 [Configuration] 使用默认配置')
      this.config = this.getDefaultConfig()
      this.loaded = true
    }
  }

  /**
   * 保存配置到文件
   */
  async save(): Promise<void> {
    try {
      const configDir = path.dirname(this.configPath)
      await fs.mkdir(configDir, { recursive: true })
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2))
      console.log('✅ [Configuration] 配置保存成功')
    } catch (error) {
      console.error('❌ [Configuration] 配置保存失败:', error)
    }
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(): AppConfig {
    const userDataPath = app.getPath('userData')
    const isDevelopment = process.env.NODE_ENV === 'development'

    return {
      database: {
        path: path.join(userDataPath, 'deechat.db'),
        backupPath: path.join(userDataPath, 'backup', 'deechat.db'),
        maxConnections: 5
      },
      llm: {
        defaultProvider: 'openai',
        apiKeys: {},
        timeout: 30000
      },
      promptx: {
        enabled: true,
        workspacePath: process.cwd()
      },
      window: {
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600
      },
      logging: {
        level: isDevelopment ? 'debug' : 'info',
        filePath: path.join(userDataPath, 'logs', 'deechat.log')
      },
      development: {
        devTools: isDevelopment,
        hotReload: isDevelopment
      }
    }
  }

  /**
   * 应用环境变量
   */
  private applyEnvironmentVariables(): void {
    // LLM API Keys
    if (process.env.OPENAI_API_KEY) {
      this.config.llm.apiKeys.openai = process.env.OPENAI_API_KEY
    }
    if (process.env.CLAUDE_API_KEY) {
      this.config.llm.apiKeys.claude = process.env.CLAUDE_API_KEY
    }

    // PromptX配置
    if (process.env.PROMPTX_SERVER_URL) {
      this.config.promptx.serverUrl = process.env.PROMPTX_SERVER_URL
    }

    // 开发配置
    if (process.env.NODE_ENV === 'development') {
      this.config.development.devTools = true
      this.config.development.hotReload = true
      this.config.logging.level = 'debug'
    }

    console.log('🌍 [Configuration] 应用环境变量完成')
  }

  /**
   * 验证配置
   */
  private validateConfig(): void {
    // 验证数据库路径
    if (!this.config.database.path) {
      throw new Error('数据库路径不能为空')
    }

    // 验证窗口尺寸
    if (this.config.window.width < this.config.window.minWidth) {
      this.config.window.width = this.config.window.minWidth
    }
    if (this.config.window.height < this.config.window.minHeight) {
      this.config.window.height = this.config.window.minHeight
    }

    console.log('✅ [Configuration] 配置验证通过')
  }

  /**
   * 合并配置对象
   */
  private mergeConfig(defaultConfig: AppConfig, userConfig: Partial<AppConfig>): AppConfig {
    return {
      database: { ...defaultConfig.database, ...userConfig.database },
      llm: { 
        ...defaultConfig.llm, 
        ...userConfig.llm,
        apiKeys: { ...defaultConfig.llm.apiKeys, ...userConfig.llm?.apiKeys }
      },
      promptx: { ...defaultConfig.promptx, ...userConfig.promptx },
      window: { ...defaultConfig.window, ...userConfig.window },
      logging: { ...defaultConfig.logging, ...userConfig.logging },
      development: { ...defaultConfig.development, ...userConfig.development }
    }
  }

  /**
   * 检查文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  // Getter方法
  get database(): DatabaseConfig { return this.config.database }
  get llm(): LLMConfig { return this.config.llm }
  get promptx(): PromptXConfig { return this.config.promptx }
  get window() { return this.config.window }
  get logging() { return this.config.logging }
  get development() { return this.config.development }

  /**
   * 获取完整配置
   */
  getAll(): AppConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  async update(updates: Partial<AppConfig>): Promise<void> {
    this.config = this.mergeConfig(this.config, updates)
    await this.save()
    console.log('✅ [Configuration] 配置更新完成')
  }

  /**
   * 获取配置状态
   */
  getStatus() {
    return {
      loaded: this.loaded,
      configPath: this.configPath,
      hasApiKeys: Object.keys(this.config.llm.apiKeys).length > 0,
      isDevelopment: this.config.development.devTools
    }
  }
}