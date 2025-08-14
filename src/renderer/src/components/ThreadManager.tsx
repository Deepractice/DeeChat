/**
 * 🧵 线程管理UI组件
 * 提供实时的线程状态监控和管理功能
 */

import React, { useState, useEffect } from 'react'
import { 
  Card, 
  Table, 
  Tag, 
  Button, 
  Progress, 
  Statistic, 
  Row, 
  Col, 
  Space, 
  Popconfirm, 
  message,
  Alert,
  Descriptions,
  Modal,
  Typography,
  Badge,
  Tooltip,
  Drawer,
  Switch,
  InputNumber
} from 'antd'
import { 
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  ReloadOutlined,
  EyeOutlined,
  SettingOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  TrophyOutlined,
  FireOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'

const { Title, Text, Paragraph } = Typography

// 线程状态类型定义（与后端保持一致）
enum ThreadStatus {
  IDLE = 'idle',
  BUSY = 'busy',
  WAITING = 'waiting',
  ERROR = 'error',
  TIMEOUT = 'timeout',
  TERMINATED = 'terminated'
}

enum ThreadPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

interface ThreadInfo {
  sessionId: string
  status: ThreadStatus
  priority: ThreadPriority
  createdAt: number
  lastActiveAt: number
  currentTaskId?: string
  modelId?: string
  roleId?: string
  stats: {
    totalRequests: number
    successfulRequests: number
    failedRequests: number
    averageResponseTime: number
    totalTokensUsed: number
    lastResponseTime: number
  }
  resources: {
    memoryUsage: number
    modelCacheSize: number
    activeConnections: number
  }
  lastError?: {
    message: string
    timestamp: number
    errorType: string
  }
}

interface SystemStats {
  totalThreads: number
  activeThreads: number
  idleThreads: number
  busyThreads: number
  errorThreads: number
  queueLength: number
  averageResponseTime: number
  totalTokensUsed: number
  totalMemoryUsage: number
  uptime: number
}

interface Alert {
  id: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  timestamp: number
  acknowledged: boolean
}

interface ThreadManagerProps {
  visible?: boolean
  onClose?: () => void
}

const ThreadManager: React.FC<ThreadManagerProps> = ({ visible = true, onClose }) => {
  const [threads, setThreads] = useState<ThreadInfo[]>([])
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedThread, setSelectedThread] = useState<ThreadInfo | null>(null)
  const [detailVisible, setDetailVisible] = useState(false)
  const [settingsVisible, setSettingsVisible] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(5)

  // 获取线程状态颜色
  const getStatusColor = (status: ThreadStatus): string => {
    switch (status) {
      case ThreadStatus.IDLE: return 'default'
      case ThreadStatus.BUSY: return 'processing'
      case ThreadStatus.WAITING: return 'warning'
      case ThreadStatus.ERROR: return 'error'
      case ThreadStatus.TIMEOUT: return 'error'
      case ThreadStatus.TERMINATED: return 'default'
      default: return 'default'
    }
  }

  // 获取优先级标签
  const getPriorityTag = (priority: ThreadPriority) => {
    const configs = {
      [ThreadPriority.LOW]: { color: 'default', text: '低' },
      [ThreadPriority.NORMAL]: { color: 'blue', text: '正常' },
      [ThreadPriority.HIGH]: { color: 'orange', text: '高' },
      [ThreadPriority.CRITICAL]: { color: 'red', text: '紧急' }
    }
    const config = configs[priority] || configs[ThreadPriority.NORMAL]
    return <Tag color={config.color}>{config.text}</Tag>
  }

  // 格式化时间
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN')
  }

  // 格式化持续时间
  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    if (minutes > 0) {
      return `${minutes}分${seconds}秒`
    }
    return `${seconds}秒`
  }

  // 加载线程数据
  const loadThreadData = async () => {
    setLoading(true)
    try {
      // 模拟API调用 - 实际应该调用window.electronAPI.threadManager.getOverview()
      const mockThreads: ThreadInfo[] = [
        {
          sessionId: 'session_001',
          status: ThreadStatus.BUSY,
          priority: ThreadPriority.NORMAL,
          createdAt: Date.now() - 300000,
          lastActiveAt: Date.now() - 1000,
          modelId: 'gpt-4o',
          roleId: 'assistant',
          stats: {
            totalRequests: 15,
            successfulRequests: 14,
            failedRequests: 1,
            averageResponseTime: 2500,
            totalTokensUsed: 45000,
            lastResponseTime: 1800
          },
          resources: {
            memoryUsage: 256.8,
            modelCacheSize: 2,
            activeConnections: 1
          }
        },
        {
          sessionId: 'session_002',
          status: ThreadStatus.IDLE,
          priority: ThreadPriority.HIGH,
          createdAt: Date.now() - 600000,
          lastActiveAt: Date.now() - 30000,
          modelId: 'claude-3-opus',
          roleId: 'copywriter',
          stats: {
            totalRequests: 8,
            successfulRequests: 8,
            failedRequests: 0,
            averageResponseTime: 1200,
            totalTokensUsed: 28000,
            lastResponseTime: 900
          },
          resources: {
            memoryUsage: 189.5,
            modelCacheSize: 1,
            activeConnections: 0
          }
        },
        {
          sessionId: 'session_003',
          status: ThreadStatus.ERROR,
          priority: ThreadPriority.NORMAL,
          createdAt: Date.now() - 900000,
          lastActiveAt: Date.now() - 120000,
          modelId: 'gpt-3.5-turbo',
          stats: {
            totalRequests: 3,
            successfulRequests: 2,
            failedRequests: 1,
            averageResponseTime: 3500,
            totalTokensUsed: 12000,
            lastResponseTime: 0
          },
          resources: {
            memoryUsage: 145.2,
            modelCacheSize: 1,
            activeConnections: 0
          },
          lastError: {
            message: 'API rate limit exceeded',
            timestamp: Date.now() - 120000,
            errorType: 'RateLimitError'
          }
        }
      ]

      const mockStats: SystemStats = {
        totalThreads: 3,
        activeThreads: 2,
        idleThreads: 1,
        busyThreads: 1,
        errorThreads: 1,
        queueLength: 2,
        averageResponseTime: 2400,
        totalTokensUsed: 85000,
        totalMemoryUsage: 591.5,
        uptime: Date.now() - (Date.now() - 3600000)
      }

      const mockAlerts: Alert[] = [
        {
          id: 'alert_001',
          severity: 'warning',
          message: '线程 session_003 出现错误，建议检查',
          timestamp: Date.now() - 120000,
          acknowledged: false
        },
        {
          id: 'alert_002',
          severity: 'info',
          message: '系统运行正常，当前有1个繁忙线程',
          timestamp: Date.now() - 60000,
          acknowledged: true
        }
      ]

      setThreads(mockThreads)
      setSystemStats(mockStats)
      setAlerts(mockAlerts)
      
    } catch (error) {
      message.error('加载线程数据失败')
      console.error('加载线程数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 线程操作方法
  const handleThreadAction = async (action: string, sessionId: string) => {
    try {
      setLoading(true)
      // 实际应该调用对应的API
      // await window.electronAPI.threadManager[action](sessionId)
      message.success(`${action}操作成功`)
      await loadThreadData()
    } catch (error) {
      message.error(`${action}操作失败`)
    } finally {
      setLoading(false)
    }
  }

  // 确认告警
  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      // await window.electronAPI.threadManager.acknowledgeAlert(alertId)
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      ))
      message.success('告警已确认')
    } catch (error) {
      message.error('确认告警失败')
    }
  }

  // 自动刷新效果
  useEffect(() => {
    if (autoRefresh && visible) {
      const interval = setInterval(loadThreadData, refreshInterval * 1000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval, visible])

  // 初始加载
  useEffect(() => {
    if (visible) {
      loadThreadData()
    }
  }, [visible])

  // 线程表格列定义
  const columns = [
    {
      title: '会话ID',
      dataIndex: 'sessionId',
      key: 'sessionId',
      render: (id: string) => (
        <Text code style={{ fontSize: '12px' }}>
          {id.slice(0, 8)}...
        </Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: ThreadStatus) => (
        <Tag color={getStatusColor(status)}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: ThreadPriority) => getPriorityTag(priority),
    },
    {
      title: '模型',
      dataIndex: 'modelId',
      key: 'modelId',
      render: (modelId?: string) => modelId || '-',
    },
    {
      title: '角色',
      dataIndex: 'roleId',
      key: 'roleId',
      render: (roleId?: string) => roleId || '-',
    },
    {
      title: '内存使用',
      dataIndex: ['resources', 'memoryUsage'],
      key: 'memoryUsage',
      render: (usage: number) => `${usage.toFixed(1)}MB`,
    },
    {
      title: '请求数',
      key: 'requests',
      render: (record: ThreadInfo) => (
        <Space>
          <Text>{record.stats.totalRequests}</Text>
          <Text type="success">({record.stats.successfulRequests})</Text>
          {record.stats.failedRequests > 0 && (
            <Text type="danger">({record.stats.failedRequests})</Text>
          )}
        </Space>
      ),
    },
    {
      title: '平均响应时间',
      dataIndex: ['stats', 'averageResponseTime'],
      key: 'averageResponseTime',
      render: (time: number) => `${time.toFixed(0)}ms`,
    },
    {
      title: '最后活跃',
      dataIndex: 'lastActiveAt',
      key: 'lastActiveAt',
      render: (timestamp: number) => {
        const ago = Date.now() - timestamp
        return (
          <Tooltip title={formatTime(timestamp)}>
            {formatDuration(ago)}前
          </Tooltip>
        )
      },
    },
    {
      title: '操作',
      key: 'actions',
      render: (record: ThreadInfo) => (
        <Space>
          <Tooltip title="查看详情">
            <Button 
              size="small" 
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedThread(record)
                setDetailVisible(true)
              }}
            />
          </Tooltip>
          
          {record.status === ThreadStatus.IDLE && (
            <Tooltip title="暂停线程">
              <Button
                size="small"
                icon={<PauseCircleOutlined />}
                onClick={() => handleThreadAction('pause', record.sessionId)}
              />
            </Tooltip>
          )}
          
          {record.status === ThreadStatus.WAITING && (
            <Tooltip title="恢复线程">
              <Button
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => handleThreadAction('resume', record.sessionId)}
              />
            </Tooltip>
          )}
          
          <Tooltip title="重启线程">
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => handleThreadAction('restart', record.sessionId)}
            />
          </Tooltip>
          
          <Popconfirm
            title="确定要清理这个线程吗？"
            onConfirm={() => handleThreadAction('cleanup', record.sessionId)}
          >
            <Tooltip title="清理线程">
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const renderContent = () => (
    <div style={{ padding: '24px' }}>
      {/* 系统概览 */}
      {systemStats && (
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="总线程数"
                value={systemStats.totalThreads}
                prefix={<ThunderboltOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="活跃线程"
                value={systemStats.activeThreads}
                prefix={<FireOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="平均响应时间"
                value={systemStats.averageResponseTime}
                suffix="ms"
                prefix={<TrophyOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="总内存使用"
                value={systemStats.totalMemoryUsage}
                suffix="MB"
                precision={1}
              />
              <Progress
                percent={Math.min((systemStats.totalMemoryUsage / 2048) * 100, 100)}
                size="small"
                showInfo={false}
                style={{ marginTop: '8px' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 告警信息 */}
      {alerts.filter(a => !a.acknowledged).length > 0 && (
        <Row style={{ marginBottom: '16px' }}>
          <Col span={24}>
            {alerts.filter(a => !a.acknowledged).map(alert => (
              <Alert
                key={alert.id}
                type={alert.severity === 'critical' ? 'error' : alert.severity === 'warning' ? 'warning' : 'info'}
                message={alert.message}
                showIcon
                closable
                action={
                  <Button
                    size="small"
                    type="text"
                    onClick={() => handleAcknowledgeAlert(alert.id)}
                  >
                    确认
                  </Button>
                }
                style={{ marginBottom: '8px' }}
              />
            ))}
          </Col>
        </Row>
      )}

      {/* 线程列表 */}
      <Card
        title={
          <Space>
            <span>线程管理</span>
            <Badge count={threads.filter(t => t.status === ThreadStatus.BUSY).length} showZero>
              <Tag>繁忙</Tag>
            </Badge>
            <Badge count={threads.filter(t => t.status === ThreadStatus.ERROR).length} showZero>
              <Tag color="red">错误</Tag>
            </Badge>
          </Space>
        }
        extra={
          <Space>
            <Switch
              checkedChildren="自动刷新"
              unCheckedChildren="手动刷新"
              checked={autoRefresh}
              onChange={setAutoRefresh}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={loadThreadData}
              loading={loading}
            >
              刷新
            </Button>
            <Button
              icon={<SettingOutlined />}
              onClick={() => setSettingsVisible(true)}
            >
              设置
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={threads}
          rowKey="sessionId"
          loading={loading}
          size="small"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 个线程`
          }}
        />
      </Card>

      {/* 线程详情模态框 */}
      <Modal
        title="线程详情"
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={800}
      >
        {selectedThread && (
          <div>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="会话ID">
                <Text code>{selectedThread.sessionId}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={getStatusColor(selectedThread.status)}>
                  {selectedThread.status.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="优先级">
                {getPriorityTag(selectedThread.priority)}
              </Descriptions.Item>
              <Descriptions.Item label="模型ID">
                {selectedThread.modelId || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="角色ID">
                {selectedThread.roleId || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {formatTime(selectedThread.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="最后活跃">
                {formatTime(selectedThread.lastActiveAt)}
              </Descriptions.Item>
              <Descriptions.Item label="内存使用">
                {selectedThread.resources.memoryUsage.toFixed(1)}MB
              </Descriptions.Item>
              <Descriptions.Item label="模型缓存数">
                {selectedThread.resources.modelCacheSize}
              </Descriptions.Item>
              <Descriptions.Item label="总请求数">
                {selectedThread.stats.totalRequests}
              </Descriptions.Item>
              <Descriptions.Item label="成功/失败">
                <Space>
                  <Text type="success">{selectedThread.stats.successfulRequests}</Text>
                  <Text>/</Text>
                  <Text type="danger">{selectedThread.stats.failedRequests}</Text>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="平均响应时间">
                {selectedThread.stats.averageResponseTime.toFixed(0)}ms
              </Descriptions.Item>
              <Descriptions.Item label="总Token使用">
                {selectedThread.stats.totalTokensUsed.toLocaleString()}
              </Descriptions.Item>
            </Descriptions>

            {selectedThread.lastError && (
              <div style={{ marginTop: '16px' }}>
                <Title level={5}>最近错误</Title>
                <Alert
                  type="error"
                  message={selectedThread.lastError.errorType}
                  description={
                    <div>
                      <Paragraph>{selectedThread.lastError.message}</Paragraph>
                      <Text type="secondary">
                        发生时间: {formatTime(selectedThread.lastError.timestamp)}
                      </Text>
                    </div>
                  }
                  showIcon
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 设置抽屉 */}
      <Drawer
        title="线程管理设置"
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        width={400}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>刷新间隔 (秒)</Text>
            <InputNumber
              value={refreshInterval}
              onChange={(value) => setRefreshInterval(value || 5)}
              min={1}
              max={60}
              style={{ width: '100%', marginTop: '8px' }}
            />
          </div>
          
          <div>
            <Text strong>自动清理设置</Text>
            <div style={{ marginTop: '8px' }}>
              <Switch defaultChecked /> 启用自动清理
            </div>
          </div>

          <div>
            <Text strong>告警设置</Text>
            <div style={{ marginTop: '8px' }}>
              <Space direction="vertical">
                <Switch defaultChecked /> 高错误率告警
                <Switch defaultChecked /> 队列积压告警
                <Switch defaultChecked /> 响应时间告警
                <Switch defaultChecked /> 内存使用告警
              </Space>
            </div>
          </div>
        </Space>
      </Drawer>
    </div>
  )

  // 如果是模态框模式
  if (onClose) {
    return (
      <Modal
        title="线程管理器"
        visible={visible}
        onCancel={onClose}
        footer={null}
        width={1200}
        style={{ top: 20 }}
      >
        {renderContent()}
      </Modal>
    )
  }

  // 直接渲染模式
  return <div>{renderContent()}</div>
}

export default ThreadManager