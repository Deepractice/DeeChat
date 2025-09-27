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
  Card,
  Collapse,
  List
} from 'antd'
import {
  DeleteOutlined,
  ReloadOutlined,
  LinkOutlined,
  DisconnectOutlined,
  ToolOutlined,
  FileTextOutlined,
  SettingOutlined,
  ImportOutlined,
  RobotOutlined
} from '@ant-design/icons'
import { useMcp } from '../contexts/McpContext'

const { Title } = Typography
const { TextArea } = Input

interface McpServerConfig {
  id: string
  name: string
  description?: string
  transport: {
    type: 'stdio' | 'http' | 'websocket' | 'streamable-http'
    command: string
    args?: string[]
    env?: Record<string, string>
    cwd?: string
    url?: string
    headers?: Record<string, string>
    sessionId?: string
    enableDnsRebindingProtection?: boolean
    allowedHosts?: string[]
    reconnectDelay?: number
    maxReconnectAttempts?: number
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
  promptCount?: number
  lastError?: string
  connectedAt?: Date
}

interface McpConfigPageProps {
  onBack?: () => void
}

const McpConfigPage: React.FC<McpConfigPageProps> = ({ onBack }) => {
  const [servers, setServers] = useState<McpServerWithStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [jsonConfig, setJsonConfig] = useState('')

  // 工具列表弹窗相关状态
  const [toolsModalVisible, setToolsModalVisible] = useState(false)
  const [currentServerTools, setCurrentServerTools] = useState<any[]>([])
  const [currentServerName, setCurrentServerName] = useState('')
  const [toolsLoading, setToolsLoading] = useState(false)

  // 使用MCP Context
  const {
    tools,
    roles,
    servers: mcpServers,
    loading: mcpLoading,
    refreshMcpData,
    getToolsByServer,
    getRolesByServer,
    isDataStale,
    lastUpdated
  } = useMcp()

  // 加载所有MCP服务器（现在使用MCP Context）
  const loadServers = async () => {
    setLoading(true)
    try {
      console.log('🔄 使用MCP Context刷新数据...')
      await refreshMcpData()
      setServers(mcpServers)
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

  // 显示服务器工具列表
  const showServerTools = async (serverId: string, serverName: string) => {
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
          <Space direction="vertical" size="small">
            {getStatusBadge(status)}
            {status === 'connected' && (
              <Space size="small" style={{ fontSize: '12px', color: '#666' }}>
                {serverTools.length > 0 && (
                  <Tooltip title={`工具: ${serverTools.map(t => t._meta.originalName).join(', ')}`}>
                    <span><ToolOutlined /> {serverTools.length}</span>
                  </Tooltip>
                )}
                {serverRoles.length > 0 && (
                  <Tooltip title={`角色: ${serverRoles.map(r => r.name).join(', ')}`}>
                    <span><RobotOutlined /> {serverRoles.length}</span>
                  </Tooltip>
                )}
                {record.resourceCount !== undefined && (
                  <span><FileTextOutlined /> {record.resourceCount}</span>
                )}
                {record.promptCount !== undefined && (
                  <span>💬 {record.promptCount}</span>
                )}
              </Space>
            )}
          </Space>
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
                onClick={() => showServerTools(record.id, record.name)}
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
            </>
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

  // 同步MCP Context的服务器数据到本地状态
  useEffect(() => {
    setServers(mcpServers)
  }, [mcpServers])

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

        {/* MCP工具和角色详细展示 */}
        {(tools.length > 0 || roles.length > 0) && (
          <div style={{
            marginTop: '24px',
            background: '#ffffff',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e8e8e8'
          }}>
            <div style={{
              padding: '16px 24px',
              borderBottom: '1px solid #f0f0f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ color: '#6b7280', fontSize: '14px' }}>
                MCP资源详情 ({tools.length} 工具, {roles.length} 角色)
                {lastUpdated && (
                  <span style={{ marginLeft: '12px', fontSize: '12px', color: '#999' }}>
                    更新时间: {lastUpdated.toLocaleString()}
                    {isDataStale && <Tag color="orange" style={{ marginLeft: '8px' }}>数据过期</Tag>}
                  </span>
                )}
              </div>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => refreshMcpData()}
                loading={mcpLoading}
                size="small"
              >
                刷新数据
              </Button>
            </div>

            <Collapse
              defaultActiveKey={tools.length > 0 ? ['tools'] : []}
              style={{ border: 'none' }}
              items={[
                ...(tools.length > 0 ? [{
                  key: 'tools',
                  label: (
                    <span>
                      <ToolOutlined style={{ marginRight: '8px' }} />
                      可用工具 ({tools.length})
                    </span>
                  ),
                  children: (
                    <List
                      dataSource={tools}
                      renderItem={(tool) => (
                        <List.Item>
                          <List.Item.Meta
                            avatar={<ToolOutlined style={{ color: '#1890ff' }} />}
                            title={
                              <Space>
                                <code style={{ fontSize: '13px' }}>{tool.function.name}</code>
                                <Tag size="small" color="blue">{tool._meta.serverName}</Tag>
                              </Space>
                            }
                            description={tool.function.description}
                          />
                        </List.Item>
                      )}
                      pagination={{
                        pageSize: 5,
                        size: 'small',
                        showSizeChanger: false
                      }}
                    />
                  )
                }] : []),
                ...(roles.length > 0 ? [{
                  key: 'roles',
                  label: (
                    <span>
                      <RobotOutlined style={{ marginRight: '8px' }} />
                      可用角色 ({roles.length})
                    </span>
                  ),
                  children: (
                    <List
                      dataSource={roles}
                      renderItem={(role) => (
                        <List.Item>
                          <List.Item.Meta
                            avatar={<RobotOutlined style={{ color: '#52c41a' }} />}
                            title={
                              <Space>
                                <strong>{role.name}</strong>
                                <Tag size="small" color="green">{role.serverName}</Tag>
                              </Space>
                            }
                            description={role.description || `来自 ${role.serverName} 的角色`}
                          />
                        </List.Item>
                      )}
                      pagination={{
                        pageSize: 5,
                        size: 'small',
                        showSizeChanger: false
                      }}
                    />
                  )
                }] : [])
              ]}
            />
          </div>
        )}
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

      {/* 工具列表弹窗 */}
      <Modal
        title={
          <Space>
            <ToolOutlined style={{ color: '#1890ff' }} />
            <span>{currentServerName} - 工具列表</span>
          </Space>
        }
        open={toolsModalVisible}
        onCancel={() => setToolsModalVisible(false)}
        footer={null}
        width={800}
        centered
      >
        <div style={{ marginTop: '20px' }}>
          {toolsLoading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Space direction="vertical">
                <div style={{ fontSize: '16px' }}>🔄 加载工具列表中...</div>
              </Space>
            </div>
          ) : currentServerTools.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Space direction="vertical">
                <div style={{ fontSize: '24px' }}>🚫</div>
                <div style={{ fontSize: '16px', color: '#666' }}>该服务器暂无可用工具</div>
              </Space>
            </div>
          ) : (
            <List
              dataSource={currentServerTools}
              renderItem={(tool: any) => (
                <List.Item style={{ border: '1px solid #f0f0f0', borderRadius: '8px', marginBottom: '8px', padding: '16px' }}>
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <Space>
                          <ToolOutlined style={{ color: '#1890ff' }} />
                          <Typography.Text strong style={{ fontSize: '16px' }}>
                            {tool.name}
                          </Typography.Text>
                        </Space>
                      </div>
                    </div>

                    {tool.description && (
                      <div style={{ marginBottom: '12px', color: '#666', fontSize: '14px' }}>
                        {tool.description}
                      </div>
                    )}

                    {tool.inputSchema && (
                      <Collapse
                        size="small"
                        ghost
                        items={[{
                          key: 'schema',
                          label: (
                            <Space>
                              <Typography.Text style={{ fontSize: '12px', color: '#666' }}>
                                📋 参数结构
                              </Typography.Text>
                            </Space>
                          ),
                          children: (
                            <pre style={{
                              background: '#f8f9fa',
                              padding: '12px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              overflow: 'auto',
                              maxHeight: '200px',
                              margin: 0
                            }}>
                              {JSON.stringify(tool.inputSchema, null, 2)}
                            </pre>
                          )
                        }]}
                      />
                    )}
                  </div>
                </List.Item>
              )}
              style={{ maxHeight: '500px', overflow: 'auto' }}
            />
          )}
        </div>
      </Modal>
    </div>
  )
}

export default McpConfigPage