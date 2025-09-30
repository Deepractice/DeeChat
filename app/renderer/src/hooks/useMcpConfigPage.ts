/**
 * McpConfigPage 业务逻辑 Hook
 *
 * 职责:
 * 1. MCP服务器数据加载和管理
 * 2. 服务器连接/断开/删除操作
 * 3. 工具列表查询
 * 4. JSON配置导入
 * 5. Modal状态管理
 */

import { useState, useEffect, useCallback } from 'react'
import { message } from 'antd'
import { useMcp } from '../contexts/McpContext'
import type { McpServerConfig } from '../types/preload'
import type { McpServerWithStatus } from '../contexts/McpContext'

export const useMcpConfigPage = () => {
  // ==================== Context ====================
  const {
    tools,
    roles,
    servers: mcpServers,
    loading: mcpLoading,
    refreshMcpData,
    getToolsByServer,
    getRolesByServer
  } = useMcp()

  // ==================== 状态管理 ====================
  const [servers, setServers] = useState<McpServerWithStatus[]>([])
  const [loading, setLoading] = useState(false)

  // Modal状态
  const [toolsModalVisible, setToolsModalVisible] = useState(false)
  const [importModalVisible, setImportModalVisible] = useState(false)

  // 工具列表相关状态
  const [currentServerTools, setCurrentServerTools] = useState<any[]>([])
  const [currentServerName, setCurrentServerName] = useState('')
  const [toolsLoading, setToolsLoading] = useState(false)

  // ==================== 数据加载 ====================

  /**
   * 加载所有MCP服务器
   */
  const loadServers = useCallback(async () => {
    setLoading(true)
    try {
      console.log('🔄 使用MCP Context刷新数据...')
      await refreshMcpData()
      setServers(mcpServers)
    } catch (error) {
      console.error('获取MCP服务器异常:', error)
      message.error('获取MCP服务器异常: ' + error)
    } finally {
      setLoading(false)
    }
  }, [refreshMcpData, mcpServers])

  // ==================== 服务器操作 ====================

  /**
   * 连接服务器
   */
  const connectServer = useCallback(async (serverId: string) => {
    try {
      console.log('🔗 连接MCP服务器:', serverId)
      const result = await window.electronAPI.mcp.connect(serverId)

      if (result.success) {
        message.success('✅ 连接成功！')
        await loadServers() // 重新加载列表以更新状态
      } else {
        message.error('❌ 连接失败: ' + result.error)
      }
    } catch (error) {
      console.error('连接MCP服务器异常:', error)
      message.error('❌ 连接异常: ' + error)
    }
  }, [loadServers])

  /**
   * 断开服务器
   */
  const disconnectServer = useCallback(async (serverId: string) => {
    try {
      console.log('🔌 断开MCP服务器:', serverId)
      const result = await window.electronAPI.mcp.disconnect(serverId)

      if (result.success) {
        message.success('✅ 断开成功！')
        await loadServers()
      } else {
        message.error('❌ 断开失败: ' + result.error)
      }
    } catch (error) {
      console.error('断开MCP服务器异常:', error)
      message.error('❌ 断开异常: ' + error)
    }
  }, [loadServers])

  /**
   * 删除服务器
   */
  const deleteServer = useCallback(async (serverId: string) => {
    try {
      console.log('🗑️ 发送删除MCP服务器请求:', serverId)

      const result = await window.electronAPI.mcp.removeServer(serverId)
      console.log('📥 删除响应:', result)

      if (result.success) {
        message.success('✅ MCP服务器删除成功！')
        await loadServers()
      } else {
        message.error('❌ 删除失败: ' + result.error)
      }
    } catch (error) {
      console.error('删除MCP服务器异常:', error)
      message.error('❌ 删除异常: ' + error)
    }
  }, [loadServers])

  // ==================== 工具相关操作 ====================

  /**
   * 显示服务器工具列表
   */
  const showServerTools = useCallback(async (serverId: string, serverName: string) => {
    try {
      setToolsLoading(true)
      setCurrentServerName(serverName)
      setToolsModalVisible(true)

      console.log('🔧 获取服务器工具列表:', serverId)
      const result = await window.electronAPI.mcp.listTools(serverId)

      if (result.success) {
        setCurrentServerTools(result.data || [])
      } else {
        message.error('❌ 获取工具列表失败: ' + result.error)
        setCurrentServerTools([])
      }
    } catch (error) {
      console.error('获取工具列表异常:', error)
      message.error('❌ 获取工具列表异常: ' + error)
      setCurrentServerTools([])
    } finally {
      setToolsLoading(false)
    }
  }, [])

  // ==================== JSON导入 ====================

  /**
   * JSON导入功能
   */
  const importFromJson = useCallback(async (jsonConfig: string): Promise<boolean> => {
    try {
      if (!jsonConfig.trim()) {
        message.error('请输入JSON配置')
        return false
      }

      // 解析JSON
      let config
      try {
        config = JSON.parse(jsonConfig)
      } catch (error) {
        message.error('JSON格式错误，请检查格式')
        return false
      }

      // 验证是否有mcpServers字段
      if (!config.mcpServers || typeof config.mcpServers !== 'object') {
        message.error('配置必须包含 mcpServers 字段')
        return false
      }

      console.log('📤 解析的配置:', config)

      // 将Claude Desktop格式转换为内部格式并逐个导入
      const mcpServers = config.mcpServers
      let successCount = 0
      let failCount = 0

      for (const [serverId, serverConfig] of Object.entries(mcpServers)) {
        try {
          const serverConfigTyped = serverConfig as any

          // 支持的传输类型映射
          const normalizeTransportType = (type: string): 'stdio' | 'http' | 'websocket' | 'streamable-http' => {
            switch (type) {
              case 'streamable-http':
                return 'streamable-http'
              case 'http':
                return 'http'
              case 'websocket':
              case 'ws':
                return 'websocket'
              case 'stdio':
              default:
                return 'stdio'
            }
          }

          const transportType = normalizeTransportType(serverConfigTyped.type || 'stdio')

          // 构建服务器配置
          const mcpServerConfig: McpServerConfig = {
            id: serverId,
            name: serverConfigTyped.name || serverId,
            description: serverConfigTyped.description,
            transport: {
              type: transportType,
              command: serverConfigTyped.command || '',
              args: serverConfigTyped.args || [],
              env: serverConfigTyped.env,
              cwd: serverConfigTyped.cwd,
              url: serverConfigTyped.url
            },
            enabled: serverConfigTyped.enabled !== false,
            autoReconnect: serverConfigTyped.autoReconnect !== false,
            timeout: serverConfigTyped.timeout || 30000,
            tags: serverConfigTyped.tags || []
          }

          const result = await window.electronAPI.mcp.addServer(mcpServerConfig)

          if (result.success) {
            successCount++
          } else {
            failCount++
            console.error(`❌ 导入服务器 ${serverId} 失败:`, result.error)
          }
        } catch (error) {
          failCount++
          console.error(`❌ 处理服务器 ${serverId} 异常:`, error)
        }
      }

      // 显示导入结果
      if (successCount > 0) {
        message.success(`✅ 成功导入 ${successCount} 个服务器${failCount > 0 ? `，失败 ${failCount} 个` : ''}`)
        setImportModalVisible(false)
        await loadServers() // 重新加载列表
        return true
      } else {
        message.error(`❌ 导入失败，所有 ${failCount} 个服务器都导入失败`)
        return false
      }

    } catch (error) {
      console.error('JSON导入异常:', error)
      message.error('❌ 导入异常: ' + error)
      return false
    }
  }, [loadServers])

  // ==================== 副作用 ====================

  // 同步MCP Context的服务器数据到本地状态
  useEffect(() => {
    setServers(mcpServers)
  }, [mcpServers])

  // 初始化加载
  useEffect(() => {
    loadServers()
  }, [loadServers])

  // ==================== 返回接口 ====================
  return {
    // 状态
    servers,
    loading,
    toolsModalVisible,
    importModalVisible,
    currentServerTools,
    currentServerName,
    toolsLoading,

    // Context数据
    getToolsByServer,
    getRolesByServer,

    // 方法
    loadServers,
    connectServer,
    disconnectServer,
    deleteServer,
    showServerTools,
    importFromJson,

    // Modal控制
    setToolsModalVisible,
    setImportModalVisible
  }
}