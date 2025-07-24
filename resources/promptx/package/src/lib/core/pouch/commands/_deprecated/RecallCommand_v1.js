const BasePouchCommand = require('../BasePouchCommand')
const fs = require('fs-extra')
const path = require('path')
const { COMMANDS } = require('../../../../constants')
const { getGlobalResourceManager } = require('../../resource')
const { getDirectoryService } = require('../../../utils/DirectoryService')
const logger = require('../../../utils/logger')

/**
 * 记忆检索锦囊命令
 * 负责从记忆库中检索相关知识和经验
 */
class RecallCommand extends BasePouchCommand {
  constructor () {
    super()
    this.lastSearchCount = 0
    // 复用ActionCommand的ResourceManager方式
    this.resourceManager = getGlobalResourceManager()
    this.directoryService = getDirectoryService()
  }

  getPurpose () {
    return 'AI主动检索记忆中的专业知识、最佳实践和历史经验'
  }

  async getContent (args) {
    const [query] = args

    logger.step('🧠 [RecallCommand] 开始记忆检索流程')
    logger.info(`🔍 [RecallCommand] 查询内容: ${query ? `"${query}"` : '全部记忆'}`)

    try {
      const memories = await this.getAllMemories(query)

      logger.success(`✅ [RecallCommand] 记忆检索完成 - 找到 ${memories.length} 条匹配记忆`)

      if (memories.length === 0) {
        if (query) {
          logger.warn(`⚠️ [RecallCommand] 未找到匹配查询"${query}"的记忆`)
          // 针对特定查询的优化提示
          return `🔍 记忆检索结果：未找到匹配"${query}"的相关记忆

💡 优化建议：
1. **扩大查询范围**：尝试使用更通用的关键词
2. **换个角度查询**：尝试相关词汇或概念
3. **检查拼写**：确认关键词拼写正确
4. **查看全部记忆**：不使用查询参数，浏览所有记忆寻找灵感

🔄 下一步行动：
- 不带参数再次使用 recall 工具查看全部记忆
- 使用 remember 工具记录新的相关知识
- 使用 learn 工具学习相关资源后再检索`
        } else {
          logger.warn('⚠️ [RecallCommand] 记忆体系为空')
          // 无记忆的情况
          return `🧠 AI记忆体系中暂无内容。
💡 建议：
1. 使用 MCP PromptX remember 工具内化新知识
2. 使用 MCP PromptX learn 工具学习后再内化
3. 开始构建AI的专业知识体系`
        }
      }

      const formattedMemories = this.formatRetrievedKnowledge(memories, query)

      return `🧠 AI记忆体系 ${query ? `检索"${query}"` : '全部记忆'} (${memories.length}条)：
${formattedMemories}
💡 记忆运用建议：
1. 结合当前任务场景灵活运用
2. 根据实际情况调整和变通
3. 持续学习和增强记忆能力`
    } catch (error) {
      logger.error(`❌ [RecallCommand] 记忆检索失败: ${error.message}`)
      logger.debug(`🐛 [RecallCommand] 错误堆栈: ${error.stack}`)
      return `❌ 检索记忆时出错：${error.message}`
    }
  }

  getPATEOAS (args) {
    const [query] = args
    const currentState = query ? `recalled-${query}` : 'recall-waiting'

    return {
      currentState,
      availableTransitions: ['welcome', 'remember', 'learn', 'recall'],
      nextActions: [
        {
          name: '选择角色',
          description: '选择专业角色来应用检索到的知识',
          method: 'MCP PromptX welcome 工具'
        },
        {
          name: '记忆新知识',
          description: '继续内化更多专业知识',
          method: 'MCP PromptX remember 工具'
        },
        {
          name: '学习资源',
          description: '学习相关专业资源',
          method: 'MCP PromptX learn 工具'
        },
        {
          name: '继续检索',
          description: '检索其他相关记忆',
          method: 'MCP PromptX recall 工具'
        }
      ],
      metadata: {
        query: query || null,
        resultCount: this.lastSearchCount || 0,
        searchTime: new Date().toISOString(),
        hasResults: (this.lastSearchCount || 0) > 0
      }
    }
  }

  /**
   * 获取所有记忆（支持XML和Markdown格式，优先XML）
   */
  async getAllMemories (query) {
    logger.step('🔧 [RecallCommand] 执行getAllMemories方法')
    
    this.lastSearchCount = 0
    const memories = []

    logger.debug('🔍 [RecallCommand] 初始化ResourceManager...')
    
    // 确保ResourceManager已初始化（就像ActionCommand那样）
    if (!this.resourceManager.initialized) {
      logger.info('⚙️ [RecallCommand] ResourceManager未初始化，正在初始化...')
      await this.resourceManager.initializeWithNewArchitecture()
      logger.success('⚙️ [RecallCommand] ResourceManager初始化完成')
    }
    
    // 通过ResourceManager获取项目路径（与ActionCommand一致）
    const projectPath = await this.getProjectPath()
    logger.info(`📍 [RecallCommand] 项目根路径: ${projectPath}`)
    
    const memoryDir = path.join(projectPath, '.promptx', 'memory')
    logger.info(`📁 [RecallCommand] 记忆目录路径: ${memoryDir}`)
    
    // 优先尝试XML格式
    const xmlFile = path.join(memoryDir, 'memory.xml')
    const legacyFile = path.join(memoryDir, 'declarative.md')
    
    logger.debug(`📄 [RecallCommand] XML文件路径: ${xmlFile}`)
    logger.debug(`📄 [RecallCommand] Legacy文件路径: ${legacyFile}`)

    try {
      // 优先读取XML格式
      if (await fs.pathExists(xmlFile)) {
        logger.info('📄 [RecallCommand] 检测到XML格式记忆文件，使用XML模式')
        const xmlMemories = await this.readXMLMemories(xmlFile, query)
        memories.push(...xmlMemories)
        logger.success(`📄 [RecallCommand] XML记忆读取完成 - ${xmlMemories.length} 条记忆`)
      } else if (await fs.pathExists(legacyFile)) {
        logger.info('📄 [RecallCommand] 检测到Legacy Markdown格式，使用兼容模式')
        // 向后兼容：读取legacy Markdown格式
        const legacyMemories = await this.readLegacyMemories(legacyFile, query)
        memories.push(...legacyMemories)
        logger.success(`📄 [RecallCommand] Legacy记忆读取完成 - ${legacyMemories.length} 条记忆`)
      } else {
        logger.warn('📄 [RecallCommand] 未找到任何记忆文件')
      }
    } catch (error) {
      logger.error(`❌ [RecallCommand] 读取记忆文件时发生错误: ${error.message}`)
      logger.debug(`🐛 [RecallCommand] 读取错误堆栈: ${error.stack}`)
    }

    this.lastSearchCount = memories.length
    logger.info(`📊 [RecallCommand] 最终记忆检索统计 - 总计: ${memories.length} 条`)
    
    return memories
  }

  /**
   * 获取项目路径（复用ActionCommand逻辑）
   */
  async getProjectPath() {
    logger.debug('📍 [RecallCommand] 获取项目路径...')
    
    // 🔍 增加详细的路径诊断日志
    logger.warn('🔍 [RecallCommand-DIAGNOSIS] ===== 路径诊断开始 =====')
    logger.warn(`🔍 [RecallCommand-DIAGNOSIS] process.cwd(): ${process.cwd()}`)
    logger.warn(`🔍 [RecallCommand-DIAGNOSIS] process.argv: ${JSON.stringify(process.argv)}`)
    logger.warn(`🔍 [RecallCommand-DIAGNOSIS] PROMPTX_WORKSPACE: ${process.env.PROMPTX_WORKSPACE || 'undefined'}`)
    logger.warn(`🔍 [RecallCommand-DIAGNOSIS] WORKSPACE_FOLDER_PATHS: ${process.env.WORKSPACE_FOLDER_PATHS || 'undefined'}`)
    logger.warn(`🔍 [RecallCommand-DIAGNOSIS] PWD: ${process.env.PWD || 'undefined'}`)
    
    // 使用DirectoryService统一获取项目路径（与InitCommand保持一致）
    const context = {
      startDir: process.cwd(),
      platform: process.platform,
      avoidUserHome: true
    }
    logger.warn(`🔍 [RecallCommand-DIAGNOSIS] DirectoryService context: ${JSON.stringify(context)}`)
    
    const projectPath = await this.directoryService.getProjectRoot(context)
    logger.warn(`🔍 [RecallCommand-DIAGNOSIS] DirectoryService结果: ${projectPath}`)
    logger.warn('🔍 [RecallCommand-DIAGNOSIS] ===== 路径诊断结束 =====')
    
    logger.debug(`📍 [RecallCommand] 项目路径解析结果: ${projectPath}`)
    
    return projectPath
  }

  /**
   * 解析记忆块（新多行格式）
   */
  parseMemoryBlocks (content) {
    const blocks = []
    const lines = content.split('\n')
    let currentBlock = []
    let inBlock = false

    for (const line of lines) {
      if (line.match(/^- \d{4}\/\d{2}\/\d{2} \d{2}:\d{2} START$/)) {
        // 开始新的记忆块
        if (inBlock && currentBlock.length > 0) {
          blocks.push(currentBlock.join('\n'))
        }
        currentBlock = [line]
        inBlock = true
      } else if (line === '- END' && inBlock) {
        // 结束当前记忆块
        currentBlock.push(line)
        blocks.push(currentBlock.join('\n'))
        currentBlock = []
        inBlock = false
      } else if (inBlock) {
        // 记忆块内容
        currentBlock.push(line)
      }
    }

    // 处理未结束的块
    if (inBlock && currentBlock.length > 0) {
      blocks.push(currentBlock.join('\n'))
    }

    return blocks
  }

  /**
   * 解析单个记忆块
   */
  parseMemoryBlock (blockContent) {
    const lines = blockContent.split('\n')
    
    // 解析开始行：- 2025/06/15 15:58 START
    const startLine = lines[0]
    const startMatch = startLine.match(/^- (\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}) START$/)
    if (!startMatch) return null

    const timestamp = startMatch[1]
    
    // 查找标签行：--tags xxx
    let tagsLine = ''
    let contentLines = []
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      if (line.startsWith('--tags ')) {
        tagsLine = line
      } else if (line !== '- END') {
        contentLines.push(line)
      }
    }

    // 提取内容（去除空行）
    const content = contentLines.join('\n').trim()
    
    // 解析标签
    let tags = []
    if (tagsLine) {
      const tagsContent = tagsLine.replace('--tags ', '')
      const hashTags = tagsContent.match(/#[^\s]+/g) || []
      const regularTags = tagsContent.replace(/#[^\s]+/g, '').trim().split(/\s+/).filter(t => t)
      tags = [...regularTags, ...hashTags]
    }

    return {
      timestamp,
      content,
      tags,
      source: 'memory'
    }
  }

  /**
   * 解析记忆行（向下兼容旧格式）
   */
  parseMemoryLine (line) {
    // 修复正则表达式，适配实际的记忆格式
    // 格式：- 2025/05/31 14:30 内容 --tags 标签 ##分类 #评分:8 #有效期:长期
    const match = line.match(/^- (\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}) (.+)$/)
    if (!match) return null

    const [, timestamp, contentAndTags] = match
    
    // 分离内容和标签
    let content = contentAndTags
    let tags = []
    
    // 提取 --tags 后面的内容
    const tagsMatch = contentAndTags.match(/--tags\s+(.*)/)
    if (tagsMatch) {
      const beforeTags = contentAndTags.substring(0, contentAndTags.indexOf('--tags')).trim()
      content = beforeTags
      
      // 解析标签部分，包括 --tags 后的内容和 # 开头的标签
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

    return {
      timestamp,
      content,
      tags,
      source: 'memory'
    }
  }

  /**
   * 检查记忆是否匹配查询 - 增强版匹配算法
   */
  matchesMemory (memory, query) {
    if (!query) return true
    
    logger.debug(`🎯 [RecallCommand] 开始匹配检查 - 查询: "${query}", 记忆: "${memory.content.substring(0, 30)}..."`)
    
    const lowerQuery = query.toLowerCase()
    const lowerContent = memory.content.toLowerCase()
    
    // 1. 完全匹配 - 最高优先级
    if (lowerContent.includes(lowerQuery) || 
        memory.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) {
      logger.debug(`✅ [RecallCommand] 完全匹配成功`)
      return true
    }
    
    // 2. 分词匹配 - 支持多关键词组合查询
    const queryWords = lowerQuery.split(/\s+/).filter(word => word.length > 1)
    if (queryWords.length > 1) {
      const matchedWords = queryWords.filter(word => 
        lowerContent.includes(word) || 
        memory.tags.some(tag => tag.toLowerCase().includes(word))
      )
      // 如果匹配了一半以上的关键词，认为相关
      if (matchedWords.length >= Math.ceil(queryWords.length / 2)) {
        logger.debug(`✅ [RecallCommand] 分词匹配成功 - 匹配词数: ${matchedWords.length}/${queryWords.length}`)
        return true
      }
    }
    
    // 3. 模糊匹配 - 支持常见同义词和缩写
    const synonyms = this.getSynonyms(lowerQuery)
    for (const synonym of synonyms) {
      if (lowerContent.includes(synonym) || 
          memory.tags.some(tag => tag.toLowerCase().includes(synonym))) {
        logger.debug(`✅ [RecallCommand] 同义词匹配成功 - 同义词: "${synonym}"`)
        return true
      }
    }
    
    logger.debug(`❌ [RecallCommand] 无匹配`)
    return false
  }
  
  /**
   * 获取查询词的同义词和相关词
   */
  getSynonyms (query) {
    const synonymMap = {
      'mcp': ['model context protocol', '工具'],
      'promptx': ['prompt-x', '提示词'],
      '测试': ['test', 'testing', 'qa', '质量保证'],
      '工具': ['tool', 'mcp', '功能'],
      '记忆': ['memory', 'recall', '回忆'],
      '学习': ['learn', 'study', '学会'],
      '角色': ['role', 'character', '专家'],
      '产品': ['product', 'pm', '产品经理'],
      '开发': ['develop', 'dev', 'coding', '编程'],
      '前端': ['frontend', 'fe', 'ui'],
      '后端': ['backend', 'be', 'api', '服务端'],
      'github': ['git', '代码仓库', '版本控制'],
      'issue': ['问题', 'bug', '需求'],
      '敏捷': ['agile', 'scrum', '迭代']
    }
    
    const result = [query] // 包含原查询词
    
    // 查找直接同义词
    if (synonymMap[query]) {
      result.push(...synonymMap[query])
    }
    
    // 查找包含关系的同义词
    for (const [key, values] of Object.entries(synonymMap)) {
      if (key.includes(query) || query.includes(key)) {
        result.push(key, ...values)
      }
      if (values.some(v => v.includes(query) || query.includes(v))) {
        result.push(key, ...values)
      }
    }
    
    return [...new Set(result)] // 去重
  }

  matchesQuery (content, query) {
    const lowerContent = content.toLowerCase()
    const lowerQuery = query.toLowerCase()
    const keywords = lowerQuery.split(/\s+/)

    return keywords.some(keyword => lowerContent.includes(keyword))
  }

  /**
   * 格式化检索到的记忆（支持多行显示）
   */
  formatRetrievedKnowledge (memories, query) {
    return memories.map((memory, index) => {
      // 保持完整的记忆内容，不进行截断
      // 陈述性记忆的完整性对于系统价值至关重要
      let content = memory.content
      
      // 只对格式进行优化，但不截断内容
      // 确保换行符正确显示
      content = content.trim()

      return `📝 ${index + 1}. **记忆** (${memory.timestamp})
${content}
${memory.tags.slice(0, 8).join(' ')}  
---`
    }).join('\n')
  }

  extractDomain (query) {
    const domains = ['copywriter', 'scrum', 'developer', 'test', 'prompt']
    const lowerQuery = query.toLowerCase()

    return domains.find(domain => lowerQuery.includes(domain)) || null
  }

  getRelatedQuery (query) {
    const relatedMap = {
      copywriter: 'marketing',
      scrum: 'agile',
      frontend: 'ui',
      backend: 'api',
      test: 'qa'
    }

    for (const [key, value] of Object.entries(relatedMap)) {
      if (query.toLowerCase().includes(key)) {
        return value
      }
    }

    return query + '-advanced'
  }

  /**
   * 读取XML格式记忆
   */
  async readXMLMemories (xmlFile, query) {
    logger.step('📄 [RecallCommand] 开始读取XML格式记忆')
    
    const memories = []
    
    try {
      const xmlContent = await fs.readFile(xmlFile, 'utf8')
      logger.info(`📄 [RecallCommand] XML文件读取成功 - 文件大小: ${xmlContent.length} 字符`)
      
      const xmlMemories = this.parseXMLMemories(xmlContent)
      logger.info(`📄 [RecallCommand] XML解析完成 - 解析出 ${xmlMemories.length} 条记忆`)
      
      for (const memory of xmlMemories) {
        if (!query || this.matchesMemory(memory, query)) {
          memories.push(memory)
          if (query) {
            logger.debug(`🎯 [RecallCommand] 记忆匹配成功: "${memory.content.substring(0, 30)}..."`)
          }
        } else if (query) {
          logger.debug(`❌ [RecallCommand] 记忆不匹配: "${memory.content.substring(0, 30)}..."`)
        }
      }
      
      logger.success(`📄 [RecallCommand] XML记忆筛选完成 - 匹配: ${memories.length}/${xmlMemories.length} 条`)
      
    } catch (error) {
      logger.error(`❌ [RecallCommand] XML记忆读取失败: ${error.message}`)
      logger.debug(`🐛 [RecallCommand] XML读取错误堆栈: ${error.stack}`)
    }
    
    return memories
  }

  /**
   * 读取legacy Markdown格式记忆
   */
  async readLegacyMemories (legacyFile, query) {
    logger.step('📄 [RecallCommand] 开始读取Legacy Markdown格式记忆')
    
    const memories = []
    
    try {
      const content = await fs.readFile(legacyFile, 'utf-8')
      logger.info(`📄 [RecallCommand] Legacy文件读取成功 - 文件大小: ${content.length} 字符`)
      
      const memoryBlocks = this.parseMemoryBlocks(content)
      logger.info(`📄 [RecallCommand] Legacy解析完成 - 解析出 ${memoryBlocks.length} 个记忆块`)

      for (const memoryBlock of memoryBlocks) {
        const memory = this.parseMemoryBlock(memoryBlock)
        if (memory && (!query || this.matchesMemory(memory, query))) {
          memories.push(memory)
          if (query) {
            logger.debug(`🎯 [RecallCommand] Legacy记忆匹配成功: "${memory.content.substring(0, 30)}..."`)
          }
        } else if (memory && query) {
          logger.debug(`❌ [RecallCommand] Legacy记忆不匹配: "${memory.content.substring(0, 30)}..."`)
        }
      }
      
      logger.success(`📄 [RecallCommand] Legacy记忆筛选完成 - 匹配: ${memories.length}/${memoryBlocks.length} 条`)
      
    } catch (error) {
      logger.error(`❌ [RecallCommand] Legacy记忆读取失败: ${error.message}`)
      logger.debug(`🐛 [RecallCommand] Legacy读取错误堆栈: ${error.stack}`)
    }
    
    return memories
  }

  /**
   * 解析XML格式记忆
   */
  parseXMLMemories (xmlContent) {
    logger.debug('🔍 [RecallCommand] 开始解析XML记忆内容')
    
    const memories = []
    
    try {
      // 简单的XML解析（不依赖外部库）
      const itemRegex = /<item\s+id="([^"]*?)"\s+time="([^"]*?)">(.*?)<\/item>/gs
      let match
      let itemCount = 0
      
      while ((match = itemRegex.exec(xmlContent)) !== null) {
        itemCount++
        const [, id, timestamp, itemContent] = match
        
        logger.debug(`🔍 [RecallCommand] 解析记忆项 ${itemCount}: ID=${id}, 时间=${timestamp}`)
        
        // 解析内容和标签
        const contentMatch = itemContent.match(/<content>(.*?)<\/content>/s)
        const tagsMatch = itemContent.match(/<tags>(.*?)<\/tags>/s)
        
        if (contentMatch) {
          const content = this.unescapeXML(contentMatch[1].trim())
          const tagsString = tagsMatch ? this.unescapeXML(tagsMatch[1].trim()) : ''
          const tags = tagsString ? tagsString.split(/\s+/).filter(t => t) : []
          
          logger.debug(`🔍 [RecallCommand] 记忆项内容: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`)
          logger.debug(`🔍 [RecallCommand] 记忆项标签: [${tags.join(', ')}]`)
          
          memories.push({
            id,
            timestamp,
            content,
            tags,
            source: 'xml'
          })
        } else {
          logger.warn(`⚠️ [RecallCommand] 记忆项 ${itemCount} 缺少content标签`)
        }
      }
      
      logger.success(`🔍 [RecallCommand] XML解析完成 - 成功解析 ${memories.length} 条记忆`)
      
    } catch (error) {
      logger.error(`❌ [RecallCommand] XML解析失败: ${error.message}`)
      logger.debug(`🐛 [RecallCommand] XML解析错误堆栈: ${error.stack}`)
    }
    
    return memories
  }

  /**
   * XML反转义函数
   */
  unescapeXML (text) {
    if (typeof text !== 'string') {
      return text
    }
    return text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&amp;/g, '&') // 必须最后处理
  }
}

module.exports = RecallCommand
