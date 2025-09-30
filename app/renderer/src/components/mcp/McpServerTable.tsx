/**
 * McpServerTable - MCP服务器表格组件
 *
 * 职责: 展示服务器列表表格
 */

import React from 'react'
import { Table, Tag, Space, Button, Popconfirm, Typography } from 'antd'
import {
  DeleteOutlined,
  LinkOutlined,
  DisconnectOutlined,
  ToolOutlined
} from '@ant-design/icons'
import McpServerStatus from './McpServerStatus'
import type { McpServerWithStatus } from '../../contexts/McpContext'

interface McpServerTableProps {
  servers: McpServerWithStatus[]
  loading: boolean
  onConnect: (serverId: string) => void
  onDisconnect: (serverId: string) => void
  onDelete: (serverId: string) => void
  onShowTools: (serverId: string, serverName: string) => void
  getToolsByServer: (serverId: string) => any[]
  getRolesByServer: (serverId: string) => any[]
}

/**
 * 服务器表格组件
 */
const McpServerTable: React.FC<McpServerTableProps> = ({
  servers,
  loading,
  onConnect,
  onDisconnect,
  onDelete,
  onShowTools,
  getToolsByServer,
  getRolesByServer
}) => {
  // 表格列定义
  const columns = [
    {
      title: '服务器名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: McpServerWithStatus) => (
        <Space direction="vertical" size="small">
          <div>
            <span style={{ fontWeight: 500, color: '#2c3e50' }}>{name}</span>
            {!record.enabled && (
              <Tag color="default" style={{ marginLeft: '8px' }}>已禁用</Tag>
            )}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            ID: {record.id}
          </div>
          {record.description && (
            <div style={{ fontSize: '12px', color: '#999' }}>
              {record.description}
            </div>
          )}
        </Space>
      )
    },
    {
      title: '传输类型',
      dataIndex: ['transport', 'type'],
      key: 'transportType',
      width: 100,
      render: (type: string) => {
        const getColor = (t: string) => {
          switch (t) {
            case 'stdio': return 'blue'
            case 'http': return 'green'
            case 'websocket': return 'orange'
            case 'streamable-http': return 'purple'
            default: return 'default'
          }
        }
        return (
          <Tag color={getColor(type)}>
            {type === 'streamable-http' ? 'STREAM-HTTP' : type.toUpperCase()}
          </Tag>
        )
      }
    },
    {
      title: '命令/地址',
      dataIndex: 'transport',
      key: 'command',
      render: (transport: any) => (
        <code style={{
          fontSize: '12px',
          background: '#f8f9fa',
          padding: '4px 8px',
          borderRadius: '4px',
          border: '1px solid #e9ecef',
          color: '#495057',
          wordBreak: 'break-all'
        }}>
          {transport.type === 'stdio'
            ? `${transport.command} ${transport.args?.join(' ') || ''}`
            : transport.url || transport.command
          }
        </code>
      )
    },
    {
      title: '状态',
      dataIndex: 'connectionStatus',
      key: 'status',
      width: 180,
      render: (status: string, record: McpServerWithStatus) => {
        const serverTools = getToolsByServer(record.id)
        const serverRoles = getRolesByServer(record.id)

        return (
          <McpServerStatus
            status={status as any}
            toolCount={record.toolCount}
            resourceCount={record.resourceCount}
            promptCount={record.promptCount}
            tools={serverTools}
            roles={serverRoles}
          />
        )
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (record: McpServerWithStatus) => (
        <Space size="small" wrap>
          {record.connectionStatus === 'connected' ? (
            <>
              <Button
                type="text"
                icon={<ToolOutlined />}
                size="small"
                onClick={() => onShowTools(record.id, record.name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px 8px',
                  color: '#1890ff'
                }}
              >
                工具
              </Button>
              <Button
                type="text"
                icon={<DisconnectOutlined />}
                size="small"
                onClick={() => onDisconnect(record.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px 8px',
                  color: '#ff4d4f'
                }}
              >
                断开
              </Button>
            </>
          ) : (
            <Button
              type="text"
              icon={<LinkOutlined />}
              size="small"
              onClick={() => onConnect(record.id)}
              disabled={!record.enabled}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '4px 8px',
                color: '#52c41a'
              }}
            >
              连接
            </Button>
          )}

          <Popconfirm
            title="删除MCP服务器"
            description="确定要删除这个MCP服务器吗？此操作无法撤销。"
            onConfirm={() => onDelete(record.id)}
            okText="删除"
            cancelText="取消"
            okType="danger"
          >
            <Button
              type="text"
              icon={<DeleteOutlined />}
              danger
              size="small"
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '4px 8px'
              }}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <Table
      columns={columns}
      dataSource={servers}
      loading={loading}
      rowKey="id"
      pagination={{
        pageSize: 10,
        showSizeChanger: true,
        showQuickJumper: true,
        showTotal: (total) => `共 ${total} 条记录`,
        style: { padding: '16px 24px' }
      }}
      locale={{ emptyText: '暂无MCP服务器，点击"导入配置"开始添加' }}
      style={{ border: 'none' }}
    />
  )
}

export default McpServerTable