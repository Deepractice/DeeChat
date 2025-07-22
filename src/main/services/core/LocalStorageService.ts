import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { ModelConfigEntity, ModelConfigData } from '../../../shared/entities/ModelConfigEntity'
import { ChatSessionEntity, ChatSessionData } from '../../../shared/entities/ChatSessionEntity'
import { UserPreferenceEntity, UserPreferenceData } from '../../../shared/entities/UserPreferenceEntity'

export class LocalStorageService {
  private userDataPath: string
  private configsFilePath: string
  private sessionsFilePath: string
  private preferencesFilePath: string

  constructor() {
    this.userDataPath = app.getPath('userData')
    this.configsFilePath = join(this.userDataPath, 'model-configs.json')
    this.sessionsFilePath = join(this.userDataPath, 'chat-sessions.json')
    this.preferencesFilePath = join(this.userDataPath, 'user-preferences.json')
  }

  // 确保目录存在
  private async ensureDirectoryExists(): Promise<void> {
    try {
      await fs.access(this.userDataPath)
    } catch {
      await fs.mkdir(this.userDataPath, { recursive: true })
    }
  }

  // 安全读取JSON文件
  private async readJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
    try {
      await this.ensureDirectoryExists()
      const data = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      // 文件不存在或解析失败时返回默认值
      console.warn(`读取文件失败 ${filePath}:`, error)
      return defaultValue
    }
  }

  // 安全写入JSON文件
  private async writeJsonFile<T>(filePath: string, data: T): Promise<void> {
    try {
      await this.ensureDirectoryExists()
      const jsonData = JSON.stringify(data, null, 2)
      await fs.writeFile(filePath, jsonData, 'utf-8')
    } catch (error) {
      console.error(`写入文件失败 ${filePath}:`, error)
      throw error
    }
  }

  // 通用的get方法
  async get<T>(key: string, defaultValue: T): Promise<T> {
    const filePath = join(this.userDataPath, `${key}.json`)
    return await this.readJsonFile(filePath, defaultValue)
  }

  // 通用的set方法
  async set<T>(key: string, data: T): Promise<void> {
    const filePath = join(this.userDataPath, `${key}.json`)
    await this.writeJsonFile(filePath, data)
  }

  // 模型配置相关操作
  async saveModelConfigs(configs: ModelConfigEntity[]): Promise<void> {
    const configsData = configs.map(config => config.toData())
    await this.writeJsonFile(this.configsFilePath, configsData)
  }

  async loadModelConfigs(): Promise<ModelConfigEntity[]> {
    const configsData = await this.readJsonFile<ModelConfigData[]>(this.configsFilePath, [])
    return configsData.map(data => new ModelConfigEntity(data))
  }

  // 聊天会话相关操作
  async saveChatSessions(sessions: ChatSessionEntity[]): Promise<void> {
    const sessionsData = sessions.map(session => session.toData())
    await this.writeJsonFile(this.sessionsFilePath, sessionsData)
  }

  async loadChatSessions(): Promise<ChatSessionEntity[]> {
    const sessionsData = await this.readJsonFile<ChatSessionData[]>(this.sessionsFilePath, [])
    return sessionsData.map(data => new ChatSessionEntity(data))
  }

  // 用户偏好相关操作
  async saveUserPreferences(preferences: UserPreferenceEntity): Promise<void> {
    await this.writeJsonFile(this.preferencesFilePath, preferences.toData())
  }

  async loadUserPreferences(): Promise<UserPreferenceEntity> {
    const defaultPreferences = UserPreferenceEntity.createDefault().toData()
    const preferencesData = await this.readJsonFile<UserPreferenceData>(
      this.preferencesFilePath, 
      defaultPreferences
    )
    return new UserPreferenceEntity(preferencesData)
  }

  // 备份和恢复
  async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupDir = join(this.userDataPath, 'backups')
    
    try {
      await fs.mkdir(backupDir, { recursive: true })
    } catch {
      // 目录已存在
    }

    const backupPath = join(backupDir, `backup-${timestamp}`)
    await fs.mkdir(backupPath, { recursive: true })

    // 复制所有数据文件
    const files = [
      { src: this.configsFilePath, dest: join(backupPath, 'model-configs.json') },
      { src: this.sessionsFilePath, dest: join(backupPath, 'chat-sessions.json') },
      { src: this.preferencesFilePath, dest: join(backupPath, 'user-preferences.json') }
    ]

    for (const file of files) {
      try {
        await fs.copyFile(file.src, file.dest)
      } catch (error) {
        console.warn(`备份文件失败 ${file.src}:`, error)
      }
    }

    return backupPath
  }

  // 清空所有数据
  async clearAllData(): Promise<void> {
    const files = [this.configsFilePath, this.sessionsFilePath, this.preferencesFilePath]
    
    for (const file of files) {
      try {
        await fs.unlink(file)
      } catch (error) {
        console.warn(`删除文件失败 ${file}:`, error)
      }
    }
  }

  // 获取数据文件信息
  async getDataFileInfo(): Promise<{
    configs: { exists: boolean; size: number; lastModified: Date | null }
    sessions: { exists: boolean; size: number; lastModified: Date | null }
    preferences: { exists: boolean; size: number; lastModified: Date | null }
  }> {
    const getFileInfo = async (filePath: string) => {
      try {
        const stats = await fs.stat(filePath)
        return {
          exists: true,
          size: stats.size,
          lastModified: stats.mtime
        }
      } catch {
        return {
          exists: false,
          size: 0,
          lastModified: null
        }
      }
    }

    return {
      configs: await getFileInfo(this.configsFilePath),
      sessions: await getFileInfo(this.sessionsFilePath),
      preferences: await getFileInfo(this.preferencesFilePath)
    }
  }
}
