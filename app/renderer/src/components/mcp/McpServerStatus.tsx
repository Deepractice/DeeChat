/**
 * McpServerStatus - MCP服务器状态展示组件
 *
 * 职责: 展示服务器连接状态和统计信息
 */

import React from 'react'
import { Badge, Space, Tooltip } from 'antd'
import { ToolOutlined, FileTextOutlined, RobotOutlined } from '@ant-design/icons'

interface ServerTool {
  _meta: {
    originalName: string
  }
  [key: string]: any
}

interface ServerRole {
  name: string
  [key: string]: any
}

interface McpServerStatusProps {
  status: 'connected' | 'disconnected' | 'connecting' | 'error'
  toolCount?: number
  resourceCount?: number
  promptCount?: number
  tools?: ServerTool[]
  roles?: ServerRole[]
}

/**
 * 获取连接状态标识
 */
const getStatusBadge = (status: string) => {
  switch (status) {
    case 'connected':
      return <Badge status="success" text="已连接" />
    case 'connecting':
      return <Badge status="processing" text="连接中" />
    case 'error':
      return <Badge status="error" text="错误" />
    default:
      return <Badge status="default" text="未连接" />
  }
}

/**
 * 服务器状态组件
 */
const McpServerStatus: React.FC<McpServerStatusProps> = ({
  status,
  toolCount,
  resourceCount,
  promptCount,
  tools = [],
  roles = []
}) => {
  return (
    <Space direction="vertical" size="small">
      {getStatusBadge(status)}
      {status === 'connected' && (
        <Space size="small" style={{ fontSize: '12px', color: '#666' }}>
          {tools.length > 0 && (
            <Tooltip title={`工具: ${tools.map(t => t._meta.originalName).join(', ')}`}>
              <span><ToolOutlined /> {tools.length}</span>
            </Tooltip>
          )}
          {roles.length > 0 && (
            <Tooltip title={`角色: ${roles.map(r => r.name).join(', ')}`}>
              <span><RobotOutlined /> {roles.length}</span>
            </Tooltip>
          )}
          {resourceCount !== undefined && (
            <span><FileTextOutlined /> {resourceCount}</span>
          )}
          {promptCount !== undefined && (
            <span>💬 {promptCount}</span>
          )}
        </Space>
      )}
    </Space>
  )
}

export default McpServerStatus