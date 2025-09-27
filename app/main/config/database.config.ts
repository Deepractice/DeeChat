/**
 * DatabaseConfig - 数据库配置管理
 * 
 * 核心职责：
 * - 管理数据库文件路径的统一配置
 * - 解决相对路径在不同运行环境下的问题
 * - 提供标准的用户数据目录支持
 * - 支持开发和生产环境的路径差异化
 * 
 * 架构优势：
 * - 使用Electron标准的userData目录
 * - 路径与工作目录无关，确保稳定性
 * - 支持用户数据隔离和备份
 * - 兼容打包后的应用环境
 */

import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

/**
 * 数据库配置管理器
 * 
 * 采用单例模式，确保整个应用使用统一的数据库路径配置
 */
export class DatabaseConfig {
  private static instance: DatabaseConfig
  private dbPath: string
  private userDataPath: string
  
  /**
   * 私有构造函数，确保单例模式
   * 
   * @throws {Error} 如果在app.ready()之前调用
   */
  private constructor() {
    // 确保Electron app已经ready，否则getUserDataPath会失败
    if (!app.isReady()) {
      throw new Error('DatabaseConfig must be initialized after app.ready(). Call this in app.whenReady() or later.')
    }
    
    this.userDataPath = app.getPath('userData')
    this.dbPath = this.resolveDatabasePath()
    
    // 确保数据库目录存在
    this.ensureDirectoryExists()
    
    console.log('🗄️ 数据库配置初始化完成:')
    console.log(`   用户数据目录: ${this.userDataPath}`)
    console.log(`   数据库路径: ${this.dbPath}`)
    console.log(`   运行环境: ${process.env.NODE_ENV || 'production'}`)
  }
  
  /**
   * 获取单例实例
   * 
   * @returns DatabaseConfig实例
   * @throws {Error} 如果在app.ready()之前调用
   */
  static getInstance(): DatabaseConfig {
    if (!this.instance) {
      this.instance = new DatabaseConfig()
    }
    return this.instance
  }
  
  /**
   * 获取数据库文件的完整路径
   * 
   * @returns 数据库文件路径
   */
  getDatabasePath(): string {
    return this.dbPath
  }
  
  /**
   * 获取用户数据目录路径
   * 
   * @returns 用户数据目录路径
   */
  getUserDataPath(): string {
    return this.userDataPath
  }
  
  /**
   * 解析数据库路径
   * 
   * 根据运行环境决定数据库文件的存放位置：
   * - 开发环境：使用 deechat-dev.db，避免与生产数据冲突
   * - 生产环境：使用 deechat.db
   * 
   * @returns 解析后的数据库文件路径
   * @private
   */
  private resolveDatabasePath(): string {
    const isDevelopment = process.env.NODE_ENV === 'development'
    const dbFileName = isDevelopment ? 'deechat-dev.db' : 'deechat.db'
    
    return path.join(this.userDataPath, dbFileName)
  }
  
  /**
   * 确保数据库所在目录存在
   * 
   * 如果用户数据目录不存在，则创建它
   * 
   * @private
   */
  private ensureDirectoryExists(): void {
    try {
      if (!fs.existsSync(this.userDataPath)) {
        fs.mkdirSync(this.userDataPath, { recursive: true })
        console.log(`✅ 创建用户数据目录: ${this.userDataPath}`)
      }
    } catch (error) {
      console.error('❌ 创建用户数据目录失败:', error)
      throw error
    }
  }
  
  /**
   * 检查数据库文件是否存在
   * 
   * @returns 数据库文件是否存在
   */
  databaseExists(): boolean {
    return fs.existsSync(this.dbPath)
  }
  
  /**
   * 获取数据库文件信息
   * 
   * @returns 数据库文件统计信息，如果文件不存在返回null
   */
  getDatabaseStats(): fs.Stats | null {
    try {
      if (this.databaseExists()) {
        return fs.statSync(this.dbPath)
      }
      return null
    } catch (error) {
      console.error('❌ 获取数据库文件信息失败:', error)
      return null
    }
  }
  
  /**
   * 数据迁移：从旧路径迁移数据库到新路径
   * 
   * 这个方法用于将现有的数据库文件迁移到标准的userData目录
   * 
   * @param oldDbPath 旧数据库文件路径
   * @returns 是否成功迁移
   */
  async migrateFromOldPath(oldDbPath: string): Promise<boolean> {
    try {
      // 检查旧文件是否存在
      if (!fs.existsSync(oldDbPath)) {
        console.log(`📝 旧数据库文件不存在，无需迁移: ${oldDbPath}`)
        return false
      }
      
      // 检查新位置是否已有文件
      if (this.databaseExists()) {
        console.log(`📝 目标位置已有数据库文件，跳过迁移: ${this.dbPath}`)
        return false
      }
      
      // 获取旧文件大小
      const oldStats = fs.statSync(oldDbPath)
      if (oldStats.size === 0) {
        console.log(`📝 旧数据库文件为空，跳过迁移: ${oldDbPath}`)
        return false
      }
      
      // 执行文件拷贝
      fs.copyFileSync(oldDbPath, this.dbPath)
      
      // 验证迁移结果
      const newStats = fs.statSync(this.dbPath)
      if (newStats.size === oldStats.size) {
        console.log(`✅ 数据库迁移成功:`)
        console.log(`   源文件: ${oldDbPath} (${oldStats.size} bytes)`)
        console.log(`   目标文件: ${this.dbPath} (${newStats.size} bytes)`)
        return true
      } else {
        throw new Error(`文件大小不匹配: 源文件 ${oldStats.size} bytes, 目标文件 ${newStats.size} bytes`)
      }
      
    } catch (error) {
      console.error(`❌ 数据库迁移失败:`, error)
      // 清理可能的不完整文件
      if (fs.existsSync(this.dbPath)) {
        try {
          fs.unlinkSync(this.dbPath)
        } catch (cleanupError) {
          console.error('❌ 清理不完整迁移文件失败:', cleanupError)
        }
      }
      return false
    }
  }
  
  /**
   * 自动迁移常见的旧路径
   * 
   * 尝试从项目中常见的旧数据库位置迁移数据
   * 
   * @returns 迁移结果摘要
   */
  async autoMigrateFromCommonPaths(): Promise<{
    attempted: string[]
    successful: string[]
    failed: string[]
  }> {
    const result = {
      attempted: [] as string[],
      successful: [] as string[],
      failed: [] as string[]
    }
    
    // 常见的旧路径列表
    const commonOldPaths = [
      './deechat.db',                    // 相对路径（当前工作目录）
      path.join(process.cwd(), 'deechat.db'),           // 项目根目录
      path.join(process.cwd(), 'app', 'deechat.db')     // app子目录
    ]
    
    for (const oldPath of commonOldPaths) {
      result.attempted.push(oldPath)
      
      try {
        const migrated = await this.migrateFromOldPath(oldPath)
        if (migrated) {
          result.successful.push(oldPath)
          break // 只迁移第一个找到的有效数据库
        }
      } catch (error) {
        result.failed.push(oldPath)
        console.error(`❌ 从 ${oldPath} 迁移失败:`, error)
      }
    }
    
    console.log('📋 数据迁移摘要:')
    console.log(`   尝试迁移: ${result.attempted.length} 个路径`)
    console.log(`   成功迁移: ${result.successful.length} 个路径`)
    console.log(`   失败迁移: ${result.failed.length} 个路径`)
    
    return result
  }
  
  /**
   * 重置数据库配置（主要用于测试）
   * 
   * @private
   */
  static resetInstance(): void {
    DatabaseConfig.instance = undefined as any
  }
}