/**
 * PromptX Welcome响应解析工具
 * 用于解析promptx welcome命令返回的角色列表数据
 */

export interface ParsedRole {
  id: string
  name: string
  description: string
  source: 'system' | 'project' | 'user'
  sourceIcon: string
  isActive?: boolean
}

export interface PromptXWelcomeResponse {
  roles: ParsedRole[]
  tools: any[]
  metadata: {
    totalRoles: number
    totalTools: number
    timestamp: string
  }
}

/**
 * 解析PromptX Welcome响应
 */
export function parsePromptXWelcome(welcomeData: any): PromptXWelcomeResponse {
  console.log('[PromptXParser] 开始解析welcome数据:', typeof welcomeData)
  console.log('[PromptXParser] 原始数据预览:', welcomeData?.substring ? welcomeData.substring(0, 200) : welcomeData)
  
  if (typeof welcomeData === 'string') {
    // 解析文本格式的响应
    return parseWelcomeText(welcomeData)
  }
  
  // 如果已经是结构化数据
  if (welcomeData && typeof welcomeData === 'object') {
    console.log('[PromptXParser] 数据是对象，检查结构')
    if (welcomeData.roles && Array.isArray(welcomeData.roles)) {
      console.log('[PromptXParser] 找到roles数组，直接返回')
      return welcomeData
    }
    
    // 如果是其他格式的对象，尝试从data字段获取
    if (welcomeData.data && typeof welcomeData.data === 'string') {
      console.log('[PromptXParser] 从data字段解析文本')
      return parseWelcomeText(welcomeData.data)
    }
    
    // 检查是否是包含toString方法的对象
    if (welcomeData.toString && typeof welcomeData.toString === 'function') {
      console.log('[PromptXParser] 使用toString方法转换')
      return parseWelcomeText(welcomeData.toString())
    }
  }
  
  console.warn('[PromptXParser] 无法识别的数据格式，返回空结果', welcomeData)
  return {
    roles: [],
    tools: [],
    metadata: { 
      totalRoles: 0, 
      totalTools: 0,
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * 解析文本格式的Welcome响应
 */
function parseWelcomeText(text: string): PromptXWelcomeResponse {
  console.log('[PromptXParser] 解析文本格式数据，长度:', text.length)
  console.log('[PromptXParser] 文本前1000字符:', text.substring(0, 1000))
  
  const roles: ParsedRole[] = []
  const lines = text.split('\n')
  console.log('[PromptXParser] 总行数:', lines.length)
  
  let currentSection = ''
  let currentSource: 'system' | 'project' | 'user' = 'system'
  
  // 先查看是否有"可用角色列表"部分
  const hasRoleSection = text.includes('可用角色列表') || text.includes('Available Roles')
  console.log('[PromptXParser] 文本中包含角色列表部分:', hasRoleSection)
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()
    
    // 跳过空行
    if (!trimmedLine) continue
    
    // 检测"可用角色列表"标题
    if (trimmedLine.includes('可用角色列表') || trimmedLine.includes('Available Roles')) {
      currentSection = 'roles'
      console.log('[PromptXParser] 找到角色列表标题')
      continue
    }
    
    // 检测角色分类标题
    if (trimmedLine.includes('系统角色') || trimmedLine.includes('System Roles') || trimmedLine.includes('📦 系统角色')) {
      currentSection = 'roles'
      currentSource = 'system'
      console.log('[PromptXParser] 进入系统角色区域')
      continue
    }
    
    if (trimmedLine.includes('项目角色') || trimmedLine.includes('Project Roles') || trimmedLine.includes('🏗️ 项目角色')) {
      currentSection = 'roles'
      currentSource = 'project'
      console.log('[PromptXParser] 进入项目角色区域')
      continue
    }
    
    if (trimmedLine.includes('用户角色') || trimmedLine.includes('User Roles') || trimmedLine.includes('👤 用户角色')) {
      currentSection = 'roles'
      currentSource = 'user'
      console.log('[PromptXParser] 进入用户角色区域')
      continue
    }
    
    // 检测工具区域标题
    if (trimmedLine.includes('可用工具') || trimmedLine.includes('Available Tools') || trimmedLine.includes('🔧 可用工具')) {
      currentSection = 'tools'
      console.log('[PromptXParser] 进入工具区域')
      continue
    }
    
    // 在检查角色匹配前，先检查我们是否在正确的区域
    if (currentSection === 'roles' && trimmedLine.includes('`') && trimmedLine.includes('-')) {
      console.log(`[PromptXParser] 检查可能的角色行: "${trimmedLine}"`)
    }
    
    // 解析角色信息 - 格式: #### N. `role-id` - Role Name
    const roleMatch = trimmedLine.match(/^####?\s*\d+\.\s*`([^`]+)`\s*-\s*(.+)/)
    if (roleMatch && currentSection === 'roles') {
      const [, roleId, roleName] = roleMatch
      console.log(`[PromptXParser] 匹配到角色行: roleId=${roleId}, roleName=${roleName}`)
      
      // 寻找接下来几行的专业能力描述
      let description = '专业角色，提供特定领域的专业能力'
      
      // 向前查找最多3行，寻找专业能力描述
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const nextLine = lines[j].trim()
        const abilityMatch = nextLine.match(/\*\*专业能力\*\*:\s*(.+)/)
        if (abilityMatch) {
          description = abilityMatch[1]
          break
        }
      }
      
      const role: ParsedRole = {
        id: roleId,
        name: roleName.trim(),
        description,
        source: currentSource,
        sourceIcon: getSourceIcon(currentSource),
        isActive: false
      }
      
      roles.push(role)
      console.log(`[PromptXParser] 解析到角色: ${roleId} (${roleName}) - ${currentSource}`)
    } else if (currentSection === 'roles' && trimmedLine.includes('`') && trimmedLine.includes('-')) {
      console.log(`[PromptXParser] 未匹配的角色行: "${trimmedLine}"`)
    }
  }
  
  console.log(`[PromptXParser] 解析完成，共找到 ${roles.length} 个角色`)
  
  return {
    roles,
    tools: [], // 暂时不解析工具
    metadata: {
      totalRoles: roles.length,
      totalTools: 0,
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * 获取来源图标
 */
function getSourceIcon(source: 'system' | 'project' | 'user'): string {
  switch (source) {
    case 'system': return '📦'
    case 'project': return '🏗️'
    case 'user': return '👤'
    default: return '🤖'
  }
}

/**
 * 获取来源显示名称
 */
export function getSourceDisplayName(source: 'system' | 'project' | 'user'): string {
  switch (source) {
    case 'system': return '系统角色'
    case 'project': return '项目角色'
    case 'user': return '用户角色'
    default: return '未知类型'
  }
}

/**
 * 角色信息缓存类
 */
export class RoleCache {
  private static CACHE_KEY = 'promptx_roles_cache'
  private static CACHE_TTL = 5 * 60 * 1000 // 5分钟

  static save(data: PromptXWelcomeResponse): void {
    try {
      const cacheData = {
        data,
        timestamp: Date.now()
      }
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData))
      console.log(`[RoleCache] 缓存已保存，${data.roles.length} 个角色`)
    } catch (error) {
      console.error('[RoleCache] 缓存保存失败:', error)
    }
  }

  static load(): PromptXWelcomeResponse | null {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY)
      if (!cached) return null

      const cacheData = JSON.parse(cached)
      const age = Date.now() - cacheData.timestamp

      if (age > this.CACHE_TTL) {
        console.log('[RoleCache] 缓存已过期，清除缓存')
        this.clear()
        return null
      }

      console.log(`[RoleCache] 从缓存加载 ${cacheData.data.roles.length} 个角色`)
      return cacheData.data
    } catch (error) {
      console.error('[RoleCache] 缓存加载失败:', error)
      this.clear()
      return null
    }
  }

  static clear(): void {
    try {
      localStorage.removeItem(this.CACHE_KEY)
      console.log('[RoleCache] 缓存已清除')
    } catch (error) {
      console.error('[RoleCache] 缓存清除失败:', error)
    }
  }
}