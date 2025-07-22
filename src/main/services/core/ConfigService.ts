import { app } from 'electron'
import { join } from 'path'
import { promises as fs } from 'fs'
import { AppConfig } from '../../../shared/types/index'

export class ConfigService {
  private configPath: string

  constructor() {
    const userDataPath = app.getPath('userData')
    this.configPath = join(userDataPath, 'config.json')
  }

  async getConfig(): Promise<AppConfig | null> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8')
      return JSON.parse(configData)
    } catch (error: any) {
      // 如果配置文件不存在，返回null
      if (error.code === 'ENOENT') {
        return null
      }
      throw error
    }
  }

  async setConfig(config: AppConfig): Promise<void> {
    try {
      // 确保目录存在
      const userDataPath = app.getPath('userData')
      await fs.mkdir(userDataPath, { recursive: true })
      
      // 保存配置
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8')
    } catch (error) {
      console.error('保存配置失败:', error)
      throw error
    }
  }

  async resetConfig(): Promise<void> {
    try {
      await fs.unlink(this.configPath)
    } catch (error: any) {
      // 如果文件不存在，忽略错误
      if (error.code !== 'ENOENT') {
        throw error
      }
    }
  }
}
