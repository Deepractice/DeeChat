import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { message } from 'antd'

// MCP工具类型定义
export interface McpTool {
  type: 'function'
  function: {
    name: string // serverId.toolName 格式
    description: string
    parameters: Record<string, any>
  }
  _meta: {
    serverId: string
    serverName: string
    originalName: string
  }
}

// MCP角色类型定义
export interface McpRole {
  id: string
  name: string
  description?: string
  serverId: string
  serverName: string
}

// MCP服务器状态类型
export interface McpServerStatus {
  id: string
  name: string
  description?: string
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error'
  toolCount?: number
  resourceCount?: number
  promptCount?: number
  lastError?: string
}

// 存储在localStorage中的数据结构
interface McpStorageData {
  tools: McpTool[]
  roles: McpRole[]
  servers: McpServerStatus[]
  lastUpdated: string
}

// Context类型定义
interface McpContextType {
  // 数据状态
  tools: McpTool[]
  roles: McpRole[]
  servers: McpServerStatus[]
  loading: boolean

  // 操作方法
  refreshMcpData: () => Promise<void>
  getToolsByServer: (serverId: string) => McpTool[]
  getRolesByServer: (serverId: string) => McpRole[]
  clearMcpData: () => void

  // 工具状态
  isDataStale: boolean
  lastUpdated: Date | null
}

// 创建Context
const McpContext = createContext<McpContextType | undefined>(undefined)

// Provider组件属性
interface McpProviderProps {
  children: ReactNode
}

// localStorage key
const MCP_STORAGE_KEY = 'mcp_data_cache'
const CACHE_EXPIRE_TIME = 5 * 60 * 1000 // 5分钟过期

export const McpProvider: React.FC<McpProviderProps> = ({ children }) => {
  const [tools, setTools] = useState<McpTool[]>([])
  const [roles, setRoles] = useState<McpRole[]>([])
  const [servers, setServers] = useState<McpServerStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // 检查数据是否过期
  const isDataStale = React.useMemo(() => {
    if (!lastUpdated) return true
    return Date.now() - lastUpdated.getTime() > CACHE_EXPIRE_TIME
  }, [lastUpdated])

  // 从localStorage加载缓存数据
  const loadFromCache = () => {
    try {
      const cached = localStorage.getItem(MCP_STORAGE_KEY)
      if (cached) {
        const data: McpStorageData = JSON.parse(cached)
        const cacheDate = new Date(data.lastUpdated)

        // 检查缓存是否过期
        if (Date.now() - cacheDate.getTime() < CACHE_EXPIRE_TIME) {
          setTools(data.tools || [])
          setRoles(data.roles || [])
          setServers(data.servers || [])
          setLastUpdated(cacheDate)
          console.log('📦 从缓存加载MCP数据:', {
            tools: data.tools.length,
            roles: data.roles.length,
            servers: data.servers.length
          })
          return true
        } else {
          console.log('⏰ MCP缓存已过期，将重新获取')
        }
      }
    } catch (error) {
      console.error('❌ 加载MCP缓存失败:', error)
    }
    return false
  }

  // 保存到localStorage
  const saveToCache = (data: Omit<McpStorageData, 'lastUpdated'>) => {
    try {
      const storageData: McpStorageData = {
        ...data,
        lastUpdated: new Date().toISOString()
      }
      localStorage.setItem(MCP_STORAGE_KEY, JSON.stringify(storageData))
      console.log('💾 MCP数据已保存到缓存')
    } catch (error) {
      console.error('❌ 保存MCP缓存失败:', error)
    }
  }

  // 刷新MCP数据的核心方法
  const refreshMcpData = async () => {
    setLoading(true)
    try {
      console.log('🔄 开始刷新MCP数据...')

      // 1. 获取所有服务器状态
      const serversResult = await window.electronAPI.mcp.listServers()
      if (!serversResult.success || !serversResult.data) {
        console.log('📭 没有MCP服务器或获取失败:', serversResult.error)
        setServers([])
        setTools([])
        setRoles([])
        return
      }

      const serversList = serversResult.data
      console.log('🖥️ 找到', serversList.length, '个MCP服务器')
      setServers(serversList)

      // 2. 并行获取所有已连接服务器的工具和角色
      const allTools: McpTool[] = []
      const allRoles: McpRole[] = []

      const promises = serversList
        .filter(server => server.connectionStatus === 'connected')
        .map(async (server) => {
          console.log('🔍 获取服务器数据:', server.id)

          const serverTools: McpTool[] = []
          const serverRoles: McpRole[] = []

          try {
            // 获取工具列表
            const toolsResult = await window.electronAPI.mcp.listTools(server.id)
            if (toolsResult.success && toolsResult.data) {
              const tools = toolsResult.data.map((tool: any) => ({
                type: 'function',
                function: {
                  name: `${server.id}.${tool.name}`,
                  description: tool.description || `Tool from ${server.name || server.id}`,
                  parameters: tool.inputSchema || {}
                },
                _meta: {
                  serverId: server.id,
                  serverName: server.name || server.id,
                  originalName: tool.name
                }
              }))
              serverTools.push(...tools)
              console.log(`✅ 从服务器 ${server.id} 获取到 ${tools.length} 个工具`)
            }

            // 如果是PromptX服务器，获取角色列表
            if (server.id === 'promptx') {
              try {
                const rolesResult = await window.electronAPI.promptx.discover('roles')
                if (rolesResult.success && rolesResult.data?.roles) {
                  const roles = rolesResult.data.roles.map((role: any) => ({
                    id: role.id,
                    name: role.name,
                    description: role.description,
                    serverId: server.id,
                    serverName: server.name || server.id
                  }))
                  serverRoles.push(...roles)
                  console.log(`🎭 从服务器 ${server.id} 获取到 ${roles.length} 个角色`)
                }
              } catch (error) {
                console.error(`❌ 获取服务器 ${server.id} 角色异常:`, error)
              }
            }

          } catch (error) {
            console.error(`❌ 获取服务器 ${server.id} 数据异常:`, error)
          }

          return { tools: serverTools, roles: serverRoles }
        })

      const results = await Promise.all(promises)

      // 合并所有结果
      results.forEach(({ tools, roles }) => {
        allTools.push(...tools)
        allRoles.push(...roles)
      })

      console.log('🎯 刷新完成:', {
        tools: allTools.length,
        roles: allRoles.length,
        servers: serversList.length
      })

      // 更新状态
      setTools(allTools)
      setRoles(allRoles)
      setLastUpdated(new Date())

      // 保存到缓存
      saveToCache({
        tools: allTools,
        roles: allRoles,
        servers: serversList
      })

    } catch (error) {
      console.error('💥 刷新MCP数据异常:', error)
      message.error('刷新MCP数据失败: ' + error)
    } finally {
      setLoading(false)
    }
  }

  // 按服务器ID获取工具
  const getToolsByServer = (serverId: string): McpTool[] => {
    return tools.filter(tool => tool._meta.serverId === serverId)
  }

  // 按服务器ID获取角色
  const getRolesByServer = (serverId: string): McpRole[] => {
    return roles.filter(role => role.serverId === serverId)
  }

  // 清除MCP数据
  const clearMcpData = () => {
    setTools([])
    setRoles([])
    setServers([])
    setLastUpdated(null)
    localStorage.removeItem(MCP_STORAGE_KEY)
    console.log('🗑️ MCP数据已清除')
  }

  // 组件挂载时加载数据
  useEffect(() => {
    const hasCache = loadFromCache()

    // 如果没有缓存或缓存过期，立即刷新数据
    if (!hasCache || isDataStale) {
      refreshMcpData()
    }
  }, [])

  const contextValue: McpContextType = {
    // 数据状态
    tools,
    roles,
    servers,
    loading,

    // 操作方法
    refreshMcpData,
    getToolsByServer,
    getRolesByServer,
    clearMcpData,

    // 工具状态
    isDataStale,
    lastUpdated
  }

  return (
    <McpContext.Provider value={contextValue}>
      {children}
    </McpContext.Provider>
  )
}

// Hook for using MCP context
export const useMcp = (): McpContextType => {
  const context = useContext(McpContext)
  if (context === undefined) {
    throw new Error('useMcp must be used within a McpProvider')
  }
  return context
}

export default McpContext