import { app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'

interface FileRecord {
  id: string
  name: string
  size: number
  mimeType: string
  ext: string
  createdAt: number
}

class SimpleDatabase {
  private dbPath: string
  private data: { files: FileRecord[] } = { files: [] }

  constructor() {
    this.dbPath = path.join(app.getPath('userData'), 'file-metadata.json')
  }

  async initialize(): Promise<void> {
    try {
      const content = await fs.readFile(this.dbPath, 'utf-8')
      this.data = JSON.parse(content)
    } catch {
      // 文件不存在，使用默认数据
      await this.save()
    }
  }

  private async save(): Promise<void> {
    await fs.writeFile(this.dbPath, JSON.stringify(this.data, null, 2))
  }

  // 模拟SQL的exec（这里只用于创建表，所以什么都不做）
  async exec(_sql: string): Promise<void> {
    // 忽略CREATE TABLE语句
  }

  // 模拟SQL的run（INSERT）
  async run(sql: string, params: any[]): Promise<void> {
    if (sql.includes('INSERT INTO files')) {
      // params顺序: [id, name, size, mimeType, ext, createdAt]
      const record: FileRecord = {
        id: params[0],
        name: params[1],
        size: params[2],
        mimeType: params[3],
        ext: params[4],
        createdAt: params[5]
      }
      this.data.files.push(record)
      await this.save()
    } else if (sql.includes('DELETE FROM files')) {
      // params: [id]
      this.data.files = this.data.files.filter(f => f.id !== params[0])
      await this.save()
    }
  }

  // 模拟SQL的get（SELECT单条）
  async get(sql: string, params: any[]): Promise<any> {
    if (sql.includes('SELECT * FROM files WHERE id = ?')) {
      return this.data.files.find(f => f.id === params[0]) || null
    }
    return null
  }

  // 模拟SQL的all（SELECT多条）
  async all(sql: string, params: any[]): Promise<any[]> {
    if (sql.includes('SELECT * FROM files WHERE createdAt < ?')) {
      return this.data.files.filter(f => f.createdAt < params[0])
    }
    return this.data.files
  }
}

// 导出单例实例
const db = new SimpleDatabase()
export default db