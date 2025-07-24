const BasePouchCommand = require('../BasePouchCommand')
const fs = require('fs-extra')
const path = require('path')
const { COMMANDS } = require('../../../../constants')
const { getGlobalResourceManager } = require('../../resource')
const { getDirectoryService } = require('../../../utils/DirectoryService')
const logger = require('../../../utils/logger')

/**
 * 记忆保存锦囊命令
 * 负责将知识、经验和最佳实践保存到记忆库中
 * 支持XML格式和Markdown格式，自动迁移legacy数据
 */
class RememberCommand extends BasePouchCommand {
  constructor () {
    super()
    // 复用ActionCommand的ResourceManager方式
    this.resourceManager = getGlobalResourceManager()
    this.directoryService = getDirectoryService()
  }

  getPurpose () {
    return '增强AI长期记忆能力，主动内化专业知识、最佳实践和项目经验'
  }

  async getContent (args) {
    const content = args.join(' ')

    if (!content) {
      return this.getUsageHelp()
    }

    try {
      logger.step('🧠 [RememberCommand] 开始记忆保存流程')
      logger.info(`📝 [RememberCommand] 记忆内容: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`)
      
      const memoryEntry = await this.saveMemory(content)

      logger.success(`✅ [RememberCommand] 记忆保存完成 - 格式: ${memoryEntry.format}, 路径: ${memoryEntry.filePath}`)
      return this.formatSaveResponse(content, memoryEntry)
    } catch (error) {
      logger.error(`❌ [RememberCommand] 记忆保存失败: ${error.message}`)
      logger.debug(`🐛 [RememberCommand] 错误堆栈: ${error.stack}`)
      
      return `❌ 记忆内化失败：${error.message}

💡 可能的原因：
- AI记忆体系目录权限不足
- 磁盘空间不够
- 记忆内容格式问题

🔧 解决方案：
1. 检查 .promptx 目录权限
2. 确保磁盘空间充足
3. 检查记忆内容是否包含特殊字符`
    }
  }

  /**
   * 将知识内化到AI记忆体系（XML格式优先）
   */
  async saveMemory (value) {
    logger.step('🔧 [RememberCommand] 执行saveMemory方法')
    
    // 1. 确保AI记忆体系目录存在
    logger.info('📁 [RememberCommand] 确保记忆目录存在...')
    const memoryDir = await this.ensureMemoryDirectory()
    logger.info(`📁 [RememberCommand] 记忆目录路径: ${memoryDir}`)

    // 2. 检查是否需要从legacy格式迁移
    logger.info('🔄 [RememberCommand] 检查legacy数据迁移需求...')
    await this.migrateLegacyMemoriesIfNeeded(memoryDir)

    // 3. 使用XML格式保存记忆
    const xmlFile = path.join(memoryDir, 'memory.xml')
    logger.info(`📄 [RememberCommand] XML文件路径: ${xmlFile}`)
    
    // 4. 格式化为XML记忆项
    logger.info('🏷️ [RememberCommand] 格式化XML记忆项...')
    const memoryItem = this.formatXMLMemoryItem(value)
    logger.debug(`🏷️ [RememberCommand] 记忆项ID: ${memoryItem.id}, 时间戳: ${memoryItem.timestamp}`)
    logger.debug(`🏷️ [RememberCommand] 记忆标签: ${memoryItem.rawTags}`)

    // 5. 追加到XML文件
    logger.info('💾 [RememberCommand] 保存到XML文件...')
    const action = await this.appendToXMLFile(xmlFile, memoryItem)
    logger.success(`💾 [RememberCommand] XML保存操作: ${action}`)

    return {
      value,
      filePath: xmlFile,
      action,
      timestamp: new Date().toISOString(),
      format: 'xml'
    }
  }

  /**
   * 确保AI记忆体系目录存在（使用ResourceManager路径获取）
   */
  async ensureMemoryDirectory () {
    logger.debug('🔍 [RememberCommand] 初始化ResourceManager...')
    
    // 确保ResourceManager已初始化（就像ActionCommand那样）
    if (!this.resourceManager.initialized) {
      logger.info('⚙️ [RememberCommand] ResourceManager未初始化，正在初始化...')
      await this.resourceManager.initializeWithNewArchitecture()
      logger.success('⚙️ [RememberCommand] ResourceManager初始化完成')
    }
    
    // 通过ResourceManager获取项目路径（与ActionCommand一致）
    const projectPath = await this.getProjectPath()
    logger.info(`📍 [RememberCommand] 项目根路径: ${projectPath}`)
    
    const memoryDir = path.join(projectPath, '.promptx', 'memory')
    logger.info(`📁 [RememberCommand] 创建记忆目录: ${memoryDir}`)
    
    await fs.ensureDir(memoryDir)
    logger.success(`📁 [RememberCommand] 记忆目录确保完成: ${memoryDir}`)
    
    return memoryDir
  }

  /**
   * 获取项目路径（复用ActionCommand逻辑）
   */
  async getProjectPath() {
    logger.debug('📍 [RememberCommand] 获取项目路径...')
    
    // 🔍 增加详细的路径诊断日志
    logger.warn('🔍 [RememberCommand-DIAGNOSIS] ===== 路径诊断开始 =====')
    logger.warn(`🔍 [RememberCommand-DIAGNOSIS] process.cwd(): ${process.cwd()}`)
    logger.warn(`🔍 [RememberCommand-DIAGNOSIS] process.argv: ${JSON.stringify(process.argv)}`)
    logger.warn(`🔍 [RememberCommand-DIAGNOSIS] PROMPTX_WORKSPACE: ${process.env.PROMPTX_WORKSPACE || 'undefined'}`)
    logger.warn(`🔍 [RememberCommand-DIAGNOSIS] WORKSPACE_FOLDER_PATHS: ${process.env.WORKSPACE_FOLDER_PATHS || 'undefined'}`)
    logger.warn(`🔍 [RememberCommand-DIAGNOSIS] PWD: ${process.env.PWD || 'undefined'}`)
    
    // 使用DirectoryService统一获取项目路径（与InitCommand保持一致）
    const context = {
      startDir: process.cwd(),
      platform: process.platform,
      avoidUserHome: true
    }
    logger.warn(`🔍 [RememberCommand-DIAGNOSIS] DirectoryService context: ${JSON.stringify(context)}`)
    
    const projectPath = await this.directoryService.getProjectRoot(context)
    logger.warn(`🔍 [RememberCommand-DIAGNOSIS] DirectoryService结果: ${projectPath}`)
    logger.warn('🔍 [RememberCommand-DIAGNOSIS] ===== 路径诊断结束 =====')
    
    logger.debug(`📍 [RememberCommand] 项目路径解析结果: ${projectPath}`)
    
    return projectPath
  }

  /**
   * 格式化为XML记忆项
   */
  formatXMLMemoryItem (value) {
    logger.debug('🏷️ [RememberCommand] 开始格式化XML记忆项...')
    
    const now = new Date()
    const timestamp = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const id = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    logger.debug(`🏷️ [RememberCommand] 生成记忆ID: ${id}`)
    logger.debug(`🏷️ [RememberCommand] 时间戳: ${timestamp}`)

    // 自动生成标签
    const tags = this.generateTags(value)
    logger.debug(`🏷️ [RememberCommand] 自动生成标签: ${tags}`)

    // XML转义
    const escapedContent = this.escapeXML(value)
    const escapedTags = this.escapeXML(tags)
    
    logger.debug(`🏷️ [RememberCommand] XML转义完成 - 内容长度: ${escapedContent.length}`)
    if (escapedContent !== value) {
      logger.info('🔄 [RememberCommand] 检测到特殊字符，已进行XML转义')
    }

    return {
      id,
      timestamp,
      content: escapedContent,
      tags: escapedTags,
      rawContent: value,
      rawTags: tags
    }
  }

  /**
   * XML转义函数
   */
  escapeXML (text) {
    if (typeof text !== 'string') {
      return text
    }
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
  }

  /**
   * 格式化内容缩进（添加适当的缩进让XML更美观）
   */
  formatContentWithIndent (content, indentLevel = 3) {
    if (typeof content !== 'string') {
      return content
    }
    
    // 基础缩进字符串（每级2个空格）
    const baseIndent = '  '.repeat(indentLevel)
    
    // 分割内容为行
    const lines = content.split('\n')
    
    // 格式化每一行，添加缩进
    const formattedLines = lines.map((line, index) => {
      // 第一行和最后一行特殊处理
      if (index === 0 && index === lines.length - 1) {
        // 单行内容
        return line.trim() ? `\n${baseIndent}${line.trim()}\n    ` : line
      } else if (index === 0) {
        // 第一行
        return line.trim() ? `\n${baseIndent}${line.trim()}` : `\n${baseIndent}`
      } else if (index === lines.length - 1) {
        // 最后一行
        return line.trim() ? `${baseIndent}${line.trim()}\n    ` : `\n    `
      } else {
        // 中间行
        return line.trim() ? `${baseIndent}${line.trim()}` : baseIndent.substring(2) // 空行保持基础缩进
      }
    })
    
    return formattedLines.join('\n')
  }

  /**
   * 追加到XML文件
   */
  async appendToXMLFile (xmlFile, memoryItem) {
    logger.debug(`💾 [RememberCommand] 检查XML文件是否存在: ${xmlFile}`)
    
    // 格式化内容缩进
    const formattedContent = this.formatContentWithIndent(memoryItem.content)
    
    // 检查文件是否存在以及是否为空
    const fileExists = await fs.pathExists(xmlFile)
    let fileIsEmpty = false
    
    if (fileExists) {
      const stats = await fs.stat(xmlFile)
      fileIsEmpty = stats.size === 0
      logger.debug(`💾 [RememberCommand] XML文件状态检查 - 存在: ${fileExists}, 大小: ${stats.size}字节, 为空: ${fileIsEmpty}`)
    }
    
    // 初始化XML文件（如果不存在或为空）
    if (!fileExists || fileIsEmpty) {
      if (fileIsEmpty) {
        logger.info('📄 [RememberCommand] XML文件存在但为空，重新初始化...')
      } else {
        logger.info('📄 [RememberCommand] XML文件不存在，创建新文件...')
      }
      
      const initialXML = `<?xml version="1.0" encoding="UTF-8"?>
<memory>
  <item id="${memoryItem.id}" time="${memoryItem.timestamp}">
    <content>${formattedContent}</content>
    <tags>${memoryItem.tags}</tags>
  </item>
</memory>`
      
      await fs.writeFile(xmlFile, initialXML, 'utf8')
      logger.success('📄 [RememberCommand] XML文件初始化完成')
      logger.debug(`📄 [RememberCommand] 初始XML内容长度: ${initialXML.length}字符`)
      
      return 'created'
    }

    logger.info('📄 [RememberCommand] XML文件已存在且有内容，追加新记忆项...')
    
    // 读取现有XML并添加新项
    const content = await fs.readFile(xmlFile, 'utf8')
    logger.debug(`📄 [RememberCommand] 读取现有XML文件 - 长度: ${content.length}字符`)
    
    // 验证XML文件格式
    if (!content.includes('</memory>')) {
      logger.warn('📄 [RememberCommand] XML文件格式异常，缺少</memory>标签，重新初始化...')
      // 重新初始化文件
      const initialXML = `<?xml version="1.0" encoding="UTF-8"?>
<memory>
  <item id="${memoryItem.id}" time="${memoryItem.timestamp}">
    <content>${formattedContent}</content>
    <tags>${memoryItem.tags}</tags>
  </item>
</memory>`
      
      await fs.writeFile(xmlFile, initialXML, 'utf8')
      logger.success('📄 [RememberCommand] XML文件重新初始化完成')
      return 'created'
    }
    
    // 找到</memory>标签的位置，在它之前插入新的记忆项
    const newItem = `  <item id="${memoryItem.id}" time="${memoryItem.timestamp}">
    <content>${formattedContent}</content>
    <tags>${memoryItem.tags}</tags>
  </item>`
    
    const updatedContent = content.replace('</memory>', `${newItem}
</memory>`)
    
    logger.debug(`📄 [RememberCommand] 新XML内容长度: ${updatedContent.length}字符`)
    logger.debug(`📄 [RememberCommand] 新增记忆项ID: ${memoryItem.id}`)
    
    await fs.writeFile(xmlFile, updatedContent, 'utf8')
    logger.success('📄 [RememberCommand] XML文件追加完成')
    
    return 'created'
  }

  /**
   * 从legacy Markdown格式迁移到XML格式
   */
  async migrateLegacyMemoriesIfNeeded (memoryDir) {
    const legacyFile = path.join(memoryDir, 'declarative.md')
    const xmlFile = path.join(memoryDir, 'memory.xml')
    const backupFile = path.join(memoryDir, 'declarative.md.bak')

    logger.debug(`🔄 [RememberCommand] 检查迁移需求 - legacy: ${legacyFile}, xml: ${xmlFile}`)

    // 如果XML文件已存在，说明已经迁移过了
    if (await fs.pathExists(xmlFile)) {
      logger.debug('🔄 [RememberCommand] XML文件已存在，无需迁移')
      return
    }

    // 如果legacy文件不存在，无需迁移
    if (!await fs.pathExists(legacyFile)) {
      logger.debug('🔄 [RememberCommand] Legacy文件不存在，无需迁移')
      return
    }

    logger.step('🔄 [RememberCommand] 正在迁移记忆数据从Markdown到XML格式...')

    try {
      // 读取legacy文件
      const legacyContent = await fs.readFile(legacyFile, 'utf8')
      logger.info(`🔄 [RememberCommand] 读取legacy文件 - 长度: ${legacyContent.length}字符`)
      
      // 解析legacy记忆
      const legacyMemories = this.parseLegacyMemories(legacyContent)
      logger.info(`🔄 [RememberCommand] 解析到 ${legacyMemories.length} 条legacy记忆`)
      
      // 创建XML文件
      let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n<memory>\n'
      
      for (const memory of legacyMemories) {
        const escapedContent = this.escapeXML(memory.content)
        const escapedTags = this.escapeXML(memory.tags.join(' '))
        const id = `legacy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        
        logger.debug(`🔄 [RememberCommand] 迁移记忆项: ${memory.content.substring(0, 30)}...`)
        
        xmlContent += `  <item id="${id}" time="${memory.timestamp}">
    <content>${escapedContent}</content>
    <tags>${escapedTags}</tags>
  </item>
`
      }
      
      xmlContent += '</memory>'
      
      // 写入XML文件
      await fs.writeFile(xmlFile, xmlContent, 'utf8')
      logger.success(`🔄 [RememberCommand] XML文件创建成功 - 长度: ${xmlContent.length}字符`)
      
      // 备份legacy文件
      await fs.move(legacyFile, backupFile)
      logger.success(`🔄 [RememberCommand] Legacy文件备份到: ${backupFile}`)
      
      logger.success(`🔄 [RememberCommand] 成功迁移${legacyMemories.length}条记忆到XML格式`)
      
    } catch (error) {
      logger.error(`🔄 [RememberCommand] 记忆迁移失败: ${error.message}`)
      logger.debug(`🔄 [RememberCommand] 迁移错误堆栈: ${error.stack}`)
      throw new Error(`记忆迁移失败: ${error.message}`)
    }
  }

  /**
   * 解析legacy Markdown格式的记忆
   */
  parseLegacyMemories (content) {
    const memories = []
    const lines = content.split('\n')
    
    for (const line of lines) {
      const trimmedLine = line.trim()
      
      // 解析标准格式：- 2025/01/15 14:30 内容 #标签 #评分:8 #有效期:长期
      const match = trimmedLine.match(/^- (\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}) (.+)$/)
      if (match) {
        const [, timestamp, contentAndTags] = match
        
        // 分离内容和标签
        let content = contentAndTags
        let tags = []
        
        // 提取 --tags 后面的内容
        const tagsMatch = contentAndTags.match(/--tags\s+(.*)/)
        if (tagsMatch) {
          content = contentAndTags.substring(0, contentAndTags.indexOf('--tags')).trim()
          const tagsContent = tagsMatch[1]
          const hashTags = tagsContent.match(/#[^\s]+/g) || []
          const regularTags = tagsContent.replace(/#[^\s]+/g, '').trim().split(/\s+/).filter(t => t)
          tags = [...regularTags, ...hashTags]
        } else {
          // 如果没有 --tags，检查是否有直接的 # 标签
          const hashTags = contentAndTags.match(/#[^\s]+/g) || []
          if (hashTags.length > 0) {
            content = contentAndTags.replace(/#[^\s]+/g, '').trim()
            tags = hashTags
          }
        }
        
        memories.push({
          timestamp,
          content,
          tags
        })
      }
    }
    
    return memories
  }

  /**
   * 自动生成标签
   */
  generateTags (value) {
    const tags = []
    const lowerValue = value.toLowerCase()

    // 基于value生成标签
    if (lowerValue.includes('最佳实践') || lowerValue.includes('规则')) tags.push('#最佳实践')
    if (lowerValue.includes('流程') || lowerValue.includes('步骤')) tags.push('#流程管理')
    if (lowerValue.includes('命令') || lowerValue.includes('工具')) tags.push('#工具使用')

    return tags.join(' ') || '#其他'
  }

  /**
   * 格式化保存响应（XML版本）
   */
  formatSaveResponse (value, memoryEntry) {
    const { action, timestamp, format, filePath } = memoryEntry

    const actionLabels = {
      created: '✅ AI已内化新记忆（XML格式）'
    }

    return `${actionLabels[action]}：${value}

## 📋 记忆详情
- **存储格式**: ${format.toUpperCase()}
- **内化时间**: ${timestamp.split('T')[0]}
- **存储路径**: ${path.basename(filePath)}
- **知识内容**: ${value.length > 100 ? value.substring(0, 100) + '...' : value}

## 🎯 能力增强效果
- ✅ **知识已内化到AI长期记忆（XML结构化存储）**
- ✅ **支持精确的内容检索和标签搜索**
- ✅ **可通过recall命令主动检索**
- ✅ **支持跨会话记忆保持**
- ✅ **自动从legacy格式迁移**

## 🔄 下一步行动：
- 记忆检索: 使用 MCP PromptX recall 工具验证知识内化效果
- 能力强化: 使用 MCP PromptX learn 工具学习相关知识增强记忆
- 应用实践: 使用 MCP PromptX action 工具在实际场景中运用记忆

📍 当前状态：memory_saved_xml`
  }

  /**
   * 获取使用帮助
   */
  getUsageHelp () {
    return `🧠 **Remember锦囊 - AI记忆增强系统（XML版本）**

## 📖 基本用法
通过 MCP PromptX remember 工具内化知识

## 💡 记忆内化示例

### 📝 AI记忆内化
AI学习和内化各种专业知识：
- "构建代码 → 运行测试 → 部署到staging → 验证功能 → 发布生产"
- "用户反馈视频加载慢，排查发现是CDN配置问题，修改后加载速度提升60%"
- "React Hooks允许在函数组件中使用state和其他React特性"
- "每个PR至少需要2个人review，必须包含测试用例"

## 🆕 XML记忆模式特性
- **结构化存储**: 使用XML格式存储，支持更精确的数据管理
- **自动迁移**: 从legacy Markdown格式自动迁移到XML
- **XML转义**: 自动处理特殊字符，确保数据完整性
- **向后兼容**: 继续支持读取legacy格式记忆

## 🔍 记忆检索与应用
- 使用 MCP PromptX recall 工具主动检索记忆
- 使用 MCP PromptX action 工具运用记忆激活角色

🔄 下一步行动：
  - 开始记忆: 使用 MCP PromptX remember 工具内化第一条知识
  - 学习资源: 使用 MCP PromptX learn 工具学习新知识再内化`
  }

  /**
   * 获取PATEOAS导航信息
   */
  getPATEOAS (args) {
    const content = args.join(' ')

    if (!content) {
      return {
        currentState: 'remember_awaiting_input',
        availableTransitions: ['welcome', 'learn', 'recall'],
        nextActions: [
          {
            name: '查看角色',
            description: '选择角色获取专业知识',
            method: 'MCP PromptX welcome 工具',
            priority: 'medium'
          },
          {
            name: '学习资源',
            description: '学习新知识然后保存',
            method: 'MCP PromptX learn 工具',
            priority: 'high'
          }
        ]
      }
    }

    return {
      currentState: 'memory_saved',
      availableTransitions: ['recall', 'learn', 'action', 'remember'],
      nextActions: [
        {
          name: '检索记忆',
          description: '测试记忆是否可检索',
          method: 'MCP PromptX recall 工具',
          priority: 'high'
        },
        {
          name: '学习强化',
          description: '学习相关知识加强记忆',
          method: 'MCP PromptX learn 工具',
          priority: 'medium'
        },
        {
          name: '应用记忆',
          description: '在实际场景中应用记忆',
          method: 'MCP PromptX action 工具',
          priority: 'medium'
        },
        {
          name: '继续内化',
          description: 'AI继续内化更多知识',
          method: 'MCP PromptX remember 工具',
          priority: 'low'
        }
      ],
      metadata: {
        savedMemory: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
        memoryLength: content.length,
        timestamp: new Date().toISOString(),
        systemVersion: '锦囊串联状态机 v1.0'
      }
    }
  }
}

module.exports = RememberCommand
