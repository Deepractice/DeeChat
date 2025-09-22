import React, { useState, useEffect } from 'react'
import {
  Button,
  Table,
  Modal,
  Input,
  message,
  Popconfirm,
  Space,
  Badge,
  Typography,
  Tooltip,
  Tag,
  Card
} from 'antd'
import {
  DeleteOutlined,
  ReloadOutlined,
  LinkOutlined,
  DisconnectOutlined,
  ToolOutlined,
  FileTextOutlined,
  SettingOutlined,
  ImportOutlined
} from '@ant-design/icons'

const { Title } = Typography
const { TextArea } = Input

interface McpServerConfig {
  id: string
  name: string
  description?: string
  transport: {
    type: 'stdio' | 'http' | 'websocket'
    command: string
    args?: string[]
    env?: Record<string, string>
    cwd?: string
    url?: string
  }
  enabled: boolean
  autoReconnect?: boolean
  timeout?: number
  tags?: string[]
  createdAt?: string
  updatedAt?: string
}

interface McpServerWithStatus extends McpServerConfig {
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error'
  toolCount?: number
  resourceCount?: number
  lastError?: string
}

interface McpConfigPageProps {
  onBack?: () => void
}

const McpConfigPage: React.FC<McpConfigPageProps> = ({ onBack }) => {
  const [servers, setServers] = useState<McpServerWithStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [jsonConfig, setJsonConfig] = useState('')

  // 加载所有MCP服务器
  const loadServers = async () => {
    setLoading(true)
    try {
      console.log('🔄 请求获取MCP服务器列表...')
      const result = await window.electronAPI.mcp.listServers()
      console.log('📥 后端响应:', result)

      if (result.success) {
        setServers(result.data || [])
      } else {
        message.error('获取MCP服务器失败: ' + result.error)
      }
    } catch (error) {
      console.error('获取MCP服务器异常:', error)
      message.error('获取MCP服务器异常: ' + error)
    }
    setLoading(false)
  }


  // JSON导入功能
  const importFromJson = async () => {
    try {
      if (!jsonConfig.trim()) {
        message.error('请输入JSON配置')
        return
      }

      // 解析JSON
      let config
      try {
        config = JSON.parse(jsonConfig)
      } catch (error) {
        message.error('JSON格式错误，请检查格式')
        return
      }

      // 验证是否有mcpServers字段
      if (!config.mcpServers || typeof config.mcpServers !== 'object') {
        message.error('配置必须包含 mcpServers 字段')
        return
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
          const normalizeTransportType = (type: string): 'stdio' | 'http' | 'websocket' => {
            switch (type) {
              case 'streamable-http':
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
        setModalVisible(false)
        setJsonConfig('')
        loadServers() // 重新加载列表
      } else {
        message.error(`❌ 导入失败，所有 ${failCount} 个服务器都导入失败`)
      }

    } catch (error) {
      console.error('JSON导入异常:', error)
      message.error('❌ 导入异常: ' + error)
    }
  }


  // 删除服务器
  const deleteServer = async (serverId: string) => {
    try {
      console.log('🗑️ 发送删除MCP服务器请求:', serverId)

      const result = await window.electronAPI.mcp.removeServer(serverId)
      console.log('📥 删除响应:', result)

      if (result.success) {
        message.success('✅ MCP服务器删除成功！')
        loadServers() // 重新加载列表
      } else {
        message.error('❌ 删除失败: ' + result.error)
      }
    } catch (error) {
      console.error('删除MCP服务器异常:', error)
      message.error('❌ 删除异常: ' + error)
    }
  }

  // 连接服务器
  const connectServer = async (serverId: string) => {
    try {
      console.log('🔗 连接MCP服务器:', serverId)
      const result = await window.electronAPI.mcp.connect(serverId)

      if (result.success) {
        message.success('✅ 连接成功！')
        loadServers() // 重新加载列表以更新状态
      } else {
        message.error('❌ 连接失败: ' + result.error)
      }
    } catch (error) {
      console.error('连接MCP服务器异常:', error)
      message.error('❌ 连接异常: ' + error)
    }
  }

  // 断开服务器
  const disconnectServer = async (serverId: string) => {
    try {
      console.log('🔌 断开MCP服务器:', serverId)
      const result = await window.electronAPI.mcp.disconnect(serverId)

      if (result.success) {
        message.success('✅ 断开成功！')
        loadServers() // 重新加载列表以更新状态
      } else {
        message.error('❌ 断开失败: ' + result.error)
      }
    } catch (error) {
      console.error('断开MCP服务器异常:', error)
      message.error('❌ 断开异常: ' + error)
    }
  }

  // 获取连接状态标识
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
      render: (type: string) => (
        <Tag color={type === 'stdio' ? 'blue' : type === 'http' ? 'green' : 'orange'}>
          {type.toUpperCase()}
        </Tag>
      )
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
      width: 120,
      render: (status: string, record: McpServerWithStatus) => (
        <Space direction="vertical" size="small">
          {getStatusBadge(status)}
          {status === 'connected' && (
            <Space size="small" style={{ fontSize: '12px', color: '#666' }}>
              {record.toolCount !== undefined && (
                <span><ToolOutlined /> {record.toolCount}</span>
              )}
              {record.resourceCount !== undefined && (
                <span><FileTextOutlined /> {record.resourceCount}</span>
              )}
            </Space>
          )}
          {record.lastError && (
            <Tooltip title={record.lastError}>
              <div style={{ fontSize: '12px', color: '#ff4d4f', cursor: 'pointer' }}>
                错误信息
              </div>
            </Tooltip>
          )}
        </Space>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (record: McpServerWithStatus) => (
        <Space size="small" wrap>
          {record.connectionStatus === 'connected' ? (
            <Button
              type="text"
              icon={<DisconnectOutlined />}
              size="small"
              onClick={() => disconnectServer(record.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '4px 8px',
                color: '#ff4d4f'
              }}
            >
              断开
            </Button>
          ) : (
            <Button
              type="text"
              icon={<LinkOutlined />}
              size="small"
              onClick={() => connectServer(record.id)}
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
            onConfirm={() => deleteServer(record.id)}
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

  useEffect(() => {
    loadServers()
  }, [])

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#fafafa' }}>
      {/* 顶部栏 */}
      <div style={{
        background: '#ffffff',
        padding: '16px 24px',
        borderBottom: '1px solid #e8e8e8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {onBack && (
            <Button
              type="text"
              onClick={onBack}
              style={{ marginRight: '12px' }}
            >
              ← 返回
            </Button>
          )}
          <SettingOutlined style={{ fontSize: '20px', color: '#666', marginRight: '12px' }} />
          <Title level={4} style={{ margin: 0, color: '#2c3e50' }}>
            MCP 服务器管理
          </Title>
        </div>
      </div>

      {/* 主内容区域 */}
      <div style={{
        flex: 1,
        padding: '24px',
        overflow: 'auto'
      }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e8e8e8'
        }}>
          {/* 操作栏 */}
          <div style={{
            padding: '16px 24px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ color: '#6b7280', fontSize: '14px' }}>
              MCP服务器列表 ({servers.length} 项)
            </div>
            <Space size="small">
              <Button
                icon={<ReloadOutlined />}
                onClick={loadServers}
                loading={loading}
                style={{ borderRadius: '6px' }}
              >
                刷新
              </Button>
              <Button
                type="primary"
                icon={<ImportOutlined />}
                onClick={() => {
                  setJsonConfig('')
                  setModalVisible(true)
                }}
                style={{
                  background: '#1890ff',
                  borderColor: '#1890ff',
                  borderRadius: '6px'
                }}
              >
                导入配置
              </Button>
            </Space>
          </div>

          {/* 表格区域 */}
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
        </div>
      </div>

      {/* JSON导入Modal */}
      <Modal
        title="导入 MCP 服务器配置"
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          setJsonConfig('')
        }}
        footer={null}
        width={700}
        centered
      >
        <div style={{ marginTop: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <Typography.Text type="secondary">
              粘贴 Claude Desktop 格式的 JSON 配置，支持批量导入多个服务器：
            </Typography.Text>
          </div>

          <Card
            size="small"
            style={{
              marginBottom: '16px',
              backgroundColor: '#f8f9fa',
              border: '1px solid #e9ecef'
            }}
          >
            <Typography.Text code style={{ fontSize: '12px' }}>
{`{
  "mcpServers": {
    "promptx": {
      "command": "npx",
      "args": ["-y", "@promptx/mcp-server"]
    },
    "http-server": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    },
    "websocket-server": {
      "type": "websocket",
      "url": "ws://localhost:8080/mcp"
    }
  }
}`}
            </Typography.Text>
          </Card>

          <TextArea
            value={jsonConfig}
            onChange={(e) => setJsonConfig(e.target.value)}
            placeholder="在此粘贴 JSON 配置..."
            rows={12}
            style={{
              borderRadius: '6px',
              fontFamily: 'Monaco, Consolas, "Courier New", monospace',
              fontSize: '13px'
            }}
          />

          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            marginTop: '16px'
          }}>
            <Button
              onClick={() => {
                setModalVisible(false)
                setJsonConfig('')
              }}
              style={{ borderRadius: '6px' }}
            >
              取消
            </Button>
            <Button
              type="primary"
              icon={<ImportOutlined />}
              onClick={importFromJson}
              disabled={!jsonConfig.trim()}
              style={{
                background: '#1890ff',
                borderColor: '#1890ff',
                borderRadius: '6px'
              }}
            >
              导入配置
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default McpConfigPage