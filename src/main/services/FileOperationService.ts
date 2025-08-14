import * as fs from 'fs/promises'
import * as path from 'path'
import { BaseService, ServiceEvent } from '../core/BaseService'
import log from 'electron-log'
import * as mammoth from 'mammoth'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import * as XLSX from 'xlsx'
// import * as ExcelJS from 'exceljs' // Reserved for future use

export interface FileContent {
  type: 'text' | 'binary' | 'structured'
  content: string | Buffer | any
  metadata?: {
    encoding?: string
    format?: string
    [key: string]: any
  }
}

/**
 * 统一的文件操作服务
 * 支持各种文件格式的读取、写入和编辑
 */
export class FileOperationService extends BaseService {
  
  constructor() {
    super('FileOperationService')
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing FileOperationService')
    this.emit(ServiceEvent.READY)
    this.logger.info('FileOperationService initialized')
  }

  /**
   * 统一的文件读取接口
   */
  async readFile(filePath: string): Promise<FileContent> {
    try {
      const ext = path.extname(filePath).toLowerCase()
      const stats = await fs.stat(filePath)
      
      log.info(`📖 [FileOperation] 读取文件: ${filePath}, 扩展名: ${ext}, 大小: ${stats.size}`)

      switch (ext) {
        case '.md':
        case '.markdown':
        case '.txt':
        case '.html':
        case '.htm':
        case '.css':
        case '.js':
        case '.ts':
        case '.jsx':
        case '.tsx':
        case '.json':
        case '.xml':
        case '.yml':
        case '.yaml':
          return await this.readTextFile(filePath)
        
        case '.docx':
        case '.doc':
          return await this.readWordDocument(filePath)
        
        case '.xlsx':
        case '.xls':
          return await this.readExcelDocument(filePath)
        
        case '.pptx':
        case '.ppt':
          return await this.readPowerPointDocument(filePath)
        
        case '.pdf':
          return await this.readPDFDocument(filePath)
        
        default:
          // 尝试作为文本文件读取
          return await this.readTextFile(filePath)
      }
    } catch (error) {
      log.error(`❌ [FileOperation] 读取文件失败: ${filePath}`, error)
      throw new Error(`读取文件失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 统一的文件写入接口
   */
  async writeFile(filePath: string, content: FileContent): Promise<void> {
    try {
      const ext = path.extname(filePath).toLowerCase()
      
      log.info(`💾 [FileOperation] 写入文件: ${filePath}, 类型: ${content.type}`)

      switch (ext) {
        case '.md':
        case '.markdown':
        case '.txt':
        case '.html':
        case '.htm':
        case '.css':
        case '.js':
        case '.ts':
        case '.jsx':
        case '.tsx':
        case '.json':
        case '.xml':
        case '.yml':
        case '.yaml':
          await this.writeTextFile(filePath, content.content as string)
          break
        
        case '.docx':
        case '.doc':
          if (content.type === 'binary') {
            await this.writeBinaryFile(filePath, content.content)
          } else {
            await this.writeWordDocument(filePath, content)
          }
          break
        
        case '.xlsx':
        case '.xls':
          await this.writeExcelDocument(filePath, content)
          break
        
        case '.pptx':
        case '.ppt':
          await this.writePowerPointDocument(filePath, content)
          break
        
        default:
          if (content.type === 'binary') {
            await this.writeBinaryFile(filePath, content.content)
          } else {
            await this.writeTextFile(filePath, content.content as string)
          }
      }
      
      log.info(`✅ [FileOperation] 文件写入成功: ${filePath}`)
    } catch (error) {
      log.error(`❌ [FileOperation] 写入文件失败: ${filePath}`, error)
      throw new Error(`写入文件失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 检查文件是否可编辑
   */
  isEditable(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase()
    const editableExtensions = [
      '.md', '.markdown', '.txt', '.html', '.htm', '.css',
      '.js', '.ts', '.jsx', '.tsx', '.json', '.xml', '.yml', '.yaml',
      '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt'
    ]
    return editableExtensions.includes(ext)
  }

  /**
   * 获取文件的编辑器类型
   */
  getEditorType(filePath: string): 'text' | 'markdown' | 'code' | 'word' | 'excel' | 'powerpoint' | 'pdf' {
    const ext = path.extname(filePath).toLowerCase()
    
    switch (ext) {
      case '.md':
      case '.markdown':
        return 'markdown'
      
      case '.js':
      case '.ts':
      case '.jsx':
      case '.tsx':
      case '.css':
      case '.json':
      case '.xml':
      case '.yml':
      case '.yaml':
        return 'code'
      
      case '.docx':
      case '.doc':
        return 'word'
      
      case '.xlsx':
      case '.xls':
        return 'excel'
      
      case '.pptx':
      case '.ppt':
        return 'powerpoint'
      
      case '.pdf':
        return 'pdf'
      
      default:
        return 'text'
    }
  }

  // ========== 私有方法：具体文件格式处理 ==========

  private async readTextFile(filePath: string): Promise<FileContent> {
    const content = await fs.readFile(filePath, 'utf-8')
    return {
      type: 'text',
      content,
      metadata: { encoding: 'utf-8' }
    }
  }

  private async writeTextFile(filePath: string, content: string): Promise<void> {
    await fs.writeFile(filePath, content, 'utf-8')
  }

  private async writeBinaryFile(filePath: string, content: any): Promise<void> {
    // 处理各种二进制数据格式
    let buffer: Buffer
    
    if (Buffer.isBuffer(content)) {
      buffer = content
    } else if (content instanceof Uint8Array) {
      buffer = Buffer.from(content)
    } else if (content instanceof ArrayBuffer) {
      buffer = Buffer.from(content)
    } else if (typeof content === 'string') {
      // 假设是base64编码
      buffer = Buffer.from(content, 'base64')
    } else {
      throw new Error('不支持的二进制数据格式')
    }
    
    await fs.writeFile(filePath, buffer)
  }

  private async readWordDocument(filePath: string): Promise<FileContent> {
    try {
      log.info(`🔄 [FileOperation] 开始处理Word文档: ${filePath}`)
      
      // 检查文件是否存在
      const stats = await fs.stat(filePath)
      log.info(`📁 [FileOperation] 文件信息: 大小=${stats.size} bytes, 修改时间=${stats.mtime}`)
      
      // 使用 mammoth.js 将 Word 文档转换为 HTML
      log.info(`🔄 [FileOperation] 开始使用mammoth转换HTML...`)
      const result = await mammoth.convertToHtml({ path: filePath })
      
      // 提取纯文本用于编辑
      log.info(`🔄 [FileOperation] 开始使用mammoth提取文本...`)
      const textResult = await mammoth.extractRawText({ path: filePath })
      
      log.info(`✨ [FileOperation] Word转换结果: HTML长度=${result.value?.length}, 文本长度=${textResult.value?.length}`)
      
      // 详细记录转换内容
      if (result.value) {
        log.info(`🔍 [FileOperation] HTML预览: ${result.value.substring(0, 300)}${result.value.length > 300 ? '...' : ''}`)
      } else {
        log.error(`❌ [FileOperation] HTML转换结果为空或undefined`)
      }
      
      if (textResult.value) {
        log.info(`📝 [FileOperation] 文本预览: ${textResult.value.substring(0, 200)}${textResult.value.length > 200 ? '...' : ''}`)
      } else {
        log.error(`❌ [FileOperation] 文本提取结果为空或undefined`)
      }
      
      if (result.messages && result.messages.length > 0) {
        log.warn('⚠️ [FileOperation] Word转换警告:', result.messages)
      }
      
      // 检查转换结果是否有效
      if (!result.value || result.value.trim() === '') {
        log.warn('⚠️ [FileOperation] HTML转换结果为空，检查文本结果...')
        
        if (textResult.value && textResult.value.trim() !== '') {
          // 如果有文本内容，包装成简单的HTML
          const wrappedHtml = `<div style="white-space: pre-wrap; font-family: serif;">${textResult.value.replace(/\n/g, '<br>')}</div>`
          log.info(`🔧 [FileOperation] 使用文本内容生成HTML: ${wrappedHtml.substring(0, 200)}...`)
          
          return {
            type: 'structured',
            content: {
              html: wrappedHtml,
              text: textResult.value,
              messages: result.messages || []
            },
            metadata: { 
              format: 'word', 
              originalPath: filePath,
              encoding: 'utf-8',
              convertedFromText: true
            }
          }
        } else {
          log.error('❌ [FileOperation] HTML和文本转换都失败，返回错误信息')
          return {
            type: 'text',
            content: 'Word文档内容无法解析，可能是文档格式不受支持或文档已损坏',
            metadata: { 
              format: 'word', 
              originalPath: filePath,
              encoding: 'utf-8',
              fallback: true,
              error: 'No content extracted'
            }
          }
        }
      }
      
      log.info(`✅ [FileOperation] Word转换成功，返回结构化内容`)
      return {
        type: 'structured',
        content: {
          html: result.value,
          text: textResult.value,
          messages: result.messages // 转换消息和警告
        },
        metadata: { 
          format: 'word', 
          originalPath: filePath,
          encoding: 'utf-8'
        }
      }
    } catch (error) {
      log.error(`❌ [FileOperation] 读取Word文档失败: ${filePath}`, error)
      log.error(`❌ [FileOperation] 错误详情: ${error instanceof Error ? error.stack : String(error)}`)
      
      // 尝试读取为二进制文件作为降级方案
      try {
        const buffer = await fs.readFile(filePath)
        log.warn(`⚠️ [FileOperation] 降级处理：将Word文档作为二进制文件读取，大小: ${buffer.length} bytes`)
        
        // 尝试显示前100个字节的十六进制表示，看看是否是有效的docx文件
        const hexPreview = buffer.slice(0, 100).toString('hex')
        log.info(`🔍 [FileOperation] 文件头部十六进制: ${hexPreview}`)
        
        return {
          type: 'text',
          content: `Word文档读取失败\n\n文件大小: ${buffer.length} bytes\n错误信息: ${error instanceof Error ? error.message : '未知错误'}\n\n这可能是由于：\n1. 文档格式不受支持\n2. 文档文件已损坏\n3. mammoth.js库无法解析此文档\n\n请尝试使用其他工具打开此文档。`,
          metadata: { 
            format: 'word', 
            originalPath: filePath,
            error: error instanceof Error ? error.message : '未知错误',
            fallback: true
          }
        }
      } catch (fallbackError) {
        log.error(`❌ [FileOperation] 降级读取也失败: ${fallbackError}`)
        throw new Error(`读取Word文档失败: ${error instanceof Error ? error.message : '未知错误'}`)
      }
    }
  }

  private async writeWordDocument(filePath: string, content: FileContent): Promise<void> {
    try {
      // 创建新的Word文档
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            // 如果content是结构化数据，使用其text内容；否则使用content.content
            new Paragraph({
              children: [
                new TextRun(
                  typeof content.content === 'object' && content.content.text 
                    ? content.content.text 
                    : String(content.content)
                )
              ]
            })
          ]
        }]
      })
      
      // 生成buffer
      const buffer = await Packer.toBuffer(doc)
      
      // 写入文件
      await fs.writeFile(filePath, buffer)
      
      log.info(`✅ [FileOperation] Word文档写入成功: ${filePath}`)
    } catch (error) {
      log.error(`写入Word文档失败: ${filePath}`, error)
      throw new Error(`写入Word文档失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  private async readExcelDocument(filePath: string): Promise<FileContent> {
    try {
      // 读取Excel文件
      const workbook = XLSX.readFile(filePath)
      
      // 获取所有工作表名称
      const sheetNames = workbook.SheetNames
      
      // 转换为JSON格式的数据
      const sheetsData: { [key: string]: any[] } = {}
      const sheetsText: string[] = []
      
      sheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
        sheetsData[sheetName] = jsonData
        
        // 生成文本表示
        const csvText = XLSX.utils.sheet_to_csv(worksheet)
        sheetsText.push(`[工作表: ${sheetName}]\n${csvText}\n`)
      })
      
      return {
        type: 'structured',
        content: {
          sheets: sheetsData,
          text: sheetsText.join('\n'),
          workbook: workbook,
          sheetNames: sheetNames
        },
        metadata: { 
          format: 'excel', 
          originalPath: filePath,
          sheetCount: sheetNames.length,
          encoding: 'binary'
        }
      }
    } catch (error) {
      log.error(`读取Excel文档失败: ${filePath}`, error)
      throw new Error(`读取Excel文档失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  private async writeExcelDocument(filePath: string, content: FileContent): Promise<void> {
    try {
      let workbook: XLSX.WorkBook
      
      if (typeof content.content === 'object' && content.content.workbook) {
        // 如果是从Excel读取的结构化数据，保持原有结构
        workbook = content.content.workbook
      } else {
        // 创建新的工作簿
        workbook = XLSX.utils.book_new()
        
        // 从文本内容创建工作表
        const textContent = typeof content.content === 'object' && content.content.text 
          ? content.content.text 
          : String(content.content)
        
        // 尝试解析CSV格式的文本
        const lines = textContent.split('\n').filter((line: string) => line.trim())
        const data = lines.map((line: string) => line.split(','))
        
        // 创建工作表
        const worksheet = XLSX.utils.aoa_to_sheet(data)
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
      }
      
      // 写入文件
      XLSX.writeFile(workbook, filePath)
      
      log.info(`✅ [FileOperation] Excel文档写入成功: ${filePath}`)
    } catch (error) {
      log.error(`写入Excel文档失败: ${filePath}`, error)
      throw new Error(`写入Excel文档失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  private async readPowerPointDocument(filePath: string): Promise<FileContent> {
    // TODO: 集成 PPT 处理库
    return {
      type: 'structured',
      content: 'PowerPoint文档编辑功能开发中...\n\n将集成相关库实现 PPT 文档的解析和编辑功能。',
      metadata: { format: 'powerpoint', originalPath: filePath }
    }
  }

  private async writePowerPointDocument(_filePath: string, _content: FileContent): Promise<void> {
    // TODO: 集成 PPT 生成库
    throw new Error('PowerPoint文档编辑功能正在开发中')
  }

  private async readPDFDocument(filePath: string): Promise<FileContent> {
    // TODO: 集成 PDF 处理库
    return {
      type: 'structured',
      content: 'PDF文档预览功能开发中...\n\n将集成 PDF.js 实现 PDF 文档的预览功能。',
      metadata: { format: 'pdf', originalPath: filePath }
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down FileOperationService')
  }
}