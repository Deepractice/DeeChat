import React, { useState } from 'react'
import {
  Card,
  Button,
  Space,
  Typography,
  Alert,
  List,
  Tag,
  Progress,
  Divider,
  Row,
  Col,
  Statistic,
  Collapse
} from 'antd'
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  RocketOutlined,
  StopOutlined,
  ApiOutlined
} from '@ant-design/icons'

const { Title, Text } = Typography

interface TestResult {
  name: string
  status: 'pending' | 'running' | 'success' | 'error'
  result?: any
  error?: string
  duration?: number
}

interface TestCase {
  id: string
  name: string
  description: string
  test: () => Promise<any>
}

/**
 * 测试套件组件
 * 用于执行各种API和功能测试
 */
const TestSuite: React.FC = () => {
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({})
  const [isRunning, setIsRunning] = useState(false)
  const [isRunningAll, setIsRunningAll] = useState(false)
  const [currentTestIndex, setCurrentTestIndex] = useState(0)

  // 定义测试用例
  const testCases: TestCase[] = [
    {
      id: 'app-version',
      name: 'getVersion - 应用版本获取',
      description: '测试获取应用版本信息',
      test: async () => {
        const version = await window.electronAPI.getVersion()
        if (!version) throw new Error('版本信息为空')
        return { version }
      }
    },
    {
      id: 'config-get',
      name: 'getConfig - 配置获取',
      description: '测试获取应用配置',
      test: async () => {
        const result = await window.electronAPI.getConfig()
        return result
      }
    },
    {
      id: 'send-message',
      name: 'sendMessage - 发送消息',
      description: '测试发送消息到LLM',
      test: async () => {
        const result = await window.electronAPI.sendMessage('Hello', { model: 'test' })
        return result
      }
    },
    {
      id: 'get-chat-history',
      name: 'getChatHistory - 获取聊天历史',
      description: '测试获取聊天历史记录',
      test: async () => {
        const result = await window.electronAPI.getChatHistory()
        return result
      }
    },
    {
      id: 'model-getall',
      name: 'model.getAll - 模型配置列表',
      description: '测试获取所有模型配置',
      test: async () => {
        const result = await window.electronAPI.model.getAll()
        if (!result.success) throw new Error(result.error)
        return { count: result.data?.length || 0, configs: result.data }
      }
    },
    {
      id: 'model-save',
      name: 'model.save - 保存模型配置',
      description: '测试保存新的模型配置',
      test: async () => {
        const testConfig = {
          name: '测试模型配置',
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          apiKey: 'test-key',
          baseURL: 'https://api.openai.com/v1'
        }
        const result = await window.electronAPI.model.save(testConfig)
        return result
      }
    },
    {
      id: 'model-delete',
      name: 'model.delete - 删除模型配置',
      description: '测试删除模型配置',
      test: async () => {
        const result = await window.electronAPI.model.delete('test-id')
        return result
      }
    },
    {
      id: 'model-test',
      name: 'model.test - 测试模型配置',
      description: '测试模型配置连接',
      test: async () => {
        const result = await window.electronAPI.model.test('mock-openai-1')
        return result
      }
    },
    {
      id: 'model-update',
      name: 'model.update - 更新模型配置',
      description: '测试更新模型配置',
      test: async () => {
        const testConfig = {
          id: 'test-id',
          name: '更新的测试模型',
          provider: 'openai',
          model: 'gpt-4',
          apiKey: 'updated-key'
        }
        const result = await window.electronAPI.model.update(testConfig)
        return result
      }
    },
    {
      id: 'preference-get',
      name: 'preference.get - 获取用户偏好',
      description: '测试获取用户偏好设置',
      test: async () => {
        const result = await window.electronAPI.preference.get()
        return result
      }
    },
    {
      id: 'preference-save',
      name: 'preference.save - 保存用户偏好',
      description: '测试保存用户偏好设置',
      test: async () => {
        const preferences = {
          theme: 'dark',
          language: 'zh-CN',
          autoSave: true
        }
        const result = await window.electronAPI.preference.save(preferences)
        return result
      }
    },
    {
      id: 'session-getmodel',
      name: 'session.getModel - 获取会话模型',
      description: '测试获取指定会话的模型配置',
      test: async () => {
        const result = await window.electronAPI.session.getModel('test-session-id')
        return result
      }
    },
    {
      id: 'session-switchmodel',
      name: 'session.switchModel - 切换会话模型',
      description: '测试切换会话使用的模型',
      test: async () => {
        const result = await window.electronAPI.session.switchModel('test-session-id', 'mock-openai-1')
        return result
      }
    },
    {
      id: 'ai-sendmessage',
      name: 'ai.sendMessage - AI发送消息',
      description: '测试通过AI服务发送消息',
      test: async () => {
        const request = {
          message: 'Hello AI',
          sessionId: 'test-session',
          modelId: 'mock-openai-1'
        }
        const result = await window.electronAPI.ai.sendMessage(request)
        return result
      }
    },
    {
      id: 'ai-testprovider',
      name: 'ai.testProvider - 测试AI提供商',
      description: '测试AI提供商连接',
      test: async () => {
        const result = await window.electronAPI.ai.testProvider('mock-openai-1')
        return result
      }
    }
  ]

  // 执行单个测试
  const runSingleTest = async (testCase: TestCase) => {
    const startTime = Date.now()
    
    setTestResults(prev => ({
      ...prev,
      [testCase.id]: { name: testCase.name, status: 'running' }
    }))

    try {
      const result = await testCase.test()
      const duration = Date.now() - startTime
      
      setTestResults(prev => ({
        ...prev,
        [testCase.id]: {
          name: testCase.name,
          status: 'success',
          result,
          duration
        }
      }))
    } catch (error) {
      const duration = Date.now() - startTime
      
      setTestResults(prev => ({
        ...prev,
        [testCase.id]: {
          name: testCase.name,
          status: 'error',
          error: error instanceof Error ? error.message : '未知错误',
          duration
        }
      }))
    }
  }

  // 执行所有测试
  const runAllTests = async () => {
    if (isRunningAll) return

    setIsRunningAll(true)
    setIsRunning(true)
    setTestResults({})
    setCurrentTestIndex(0)

    try {
      for (let i = 0; i < testCases.length; i++) {
        setCurrentTestIndex(i)
        await runSingleTest(testCases[i])
        // 添加小延迟避免过快执行
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    } catch (error) {
      console.error('运行所有测试时出错:', error)
    } finally {
      setIsRunning(false)
      setIsRunningAll(false)
      setCurrentTestIndex(0)
    }
  }

  // 停止所有测试
  const stopAllTests = () => {
    setIsRunning(false)
    setIsRunningAll(false)
    setCurrentTestIndex(0)
  }

  // 清除所有测试结果
  const clearAllResults = () => {
    setTestResults({})
    setCurrentTestIndex(0)
  }

  // 计算测试统计
  const getTestStats = () => {
    const results = Object.values(testResults)
    const total = testCases.length
    const completed = results.length
    const success = results.filter(r => r.status === 'success').length
    const failed = results.filter(r => r.status === 'error').length
    const running = results.filter(r => r.status === 'running').length
    
    return { total, completed, success, failed, running }
  }

  const stats = getTestStats()
  const progress = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0

  // 渲染测试结果图标
  const renderStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'running':
        return <LoadingOutlined style={{ color: '#1890ff' }} />
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'error':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
      default:
        return null
    }
  }

  return (
    <Card title="API测试套件" style={{ margin: 16 }}>
      {/* 统计信息 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Statistic title="总测试数" value={stats.total} />
        </Col>
        <Col span={6}>
          <Statistic title="已完成" value={stats.completed} />
        </Col>
        <Col span={6}>
          <Statistic title="成功" value={stats.success} valueStyle={{ color: '#3f8600' }} />
        </Col>
        <Col span={6}>
          <Statistic title="失败" value={stats.failed} valueStyle={{ color: '#cf1322' }} />
        </Col>
      </Row>

      {/* 进度条 */}
      <Progress
        percent={Math.round(progress)}
        status={isRunningAll ? 'active' : stats.failed > 0 ? 'exception' : 'normal'}
        style={{ marginBottom: 16 }}
        format={(percent) => `${percent}% (${stats.completed}/${stats.total})`}
      />

      {/* 当前运行的测试 */}
      {isRunningAll && currentTestIndex < testCases.length && (
        <Alert
          message={`正在运行: ${testCases[currentTestIndex]?.name}`}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 控制按钮 */}
      <Space style={{ marginBottom: 16 }} wrap>
        <Button
          type="primary"
          icon={<RocketOutlined />}
          onClick={runAllTests}
          loading={isRunningAll}
          disabled={isRunningAll}
          size="large"
        >
          {isRunningAll ? '运行中...' : '运行所有测试'}
        </Button>

        {isRunningAll && (
          <Button
            danger
            icon={<StopOutlined />}
            onClick={stopAllTests}
          >
            停止测试
          </Button>
        )}

        <Button
          onClick={clearAllResults}
          disabled={isRunningAll}
        >
          清除结果
        </Button>

        <Button
          type="dashed"
          onClick={() => window.location.reload()}
          disabled={isRunningAll}
        >
          刷新页面
        </Button>
      </Space>

      <Divider />

      {/* 测试用例列表 */}
      <Collapse
        defaultActiveKey={[]}
        ghost
        items={[
          {
            key: '1',
            label: `测试用例列表 (${testCases.length}个)`,
            children: (
          <List
            dataSource={testCases}
            renderItem={(testCase, index) => {
              const result = testResults[testCase.id]
              const isCurrentTest = isRunningAll && currentTestIndex === index

              return (
                <List.Item
                  style={{
                    backgroundColor: isCurrentTest ? '#f6ffed' : undefined,
                    border: isCurrentTest ? '1px solid #b7eb8f' : undefined,
                    borderRadius: isCurrentTest ? '6px' : undefined,
                    padding: '12px'
                  }}
                  actions={[
                    <Space>
                      <Button
                        size="small"
                        type={result?.status === 'success' ? 'default' : 'primary'}
                        onClick={() => runSingleTest(testCase)}
                        disabled={isRunningAll}
                        loading={result?.status === 'running'}
                        icon={<PlayCircleOutlined />}
                      >
                        {result?.status === 'success' ? '重新运行' : '运行'}
                      </Button>
                      {result?.status === 'success' && (
                        <Tag color="green" icon={<CheckCircleOutlined />}>
                          通过
                        </Tag>
                      )}
                      {result?.status === 'error' && (
                        <Tag color="red" icon={<CloseCircleOutlined />}>
                          失败
                        </Tag>
                      )}
                    </Space>
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <div style={{ fontSize: '18px' }}>
                        {renderStatusIcon(result?.status || 'pending')}
                      </div>
                    }
                    title={
                      <Space>
                        <Text strong style={{ fontSize: '14px' }}>
                          {index + 1}. {testCase.name}
                        </Text>
                        {result?.duration && (
                          <Tag size="small" color="blue">{result.duration}ms</Tag>
                    )}
                  </Space>
                }
                description={
                  <div>
                    <Text type="secondary">{testCase.description}</Text>
                    {result?.error && (
                      <div style={{ marginTop: 4 }}>
                        <Text type="danger" code style={{ fontSize: 12 }}>
                          {result.error}
                        </Text>
                      </div>
                    )}
                    {result?.result && result.status === 'success' && (
                      <div style={{ marginTop: 4 }}>
                        <Text code style={{ fontSize: 12 }}>
                          {JSON.stringify(result.result, null, 2).slice(0, 100)}
                          {JSON.stringify(result.result).length > 100 ? '...' : ''}
                        </Text>
                      </div>
                    )}
                  </div>
                }
              />
            </List.Item>
          )
        }}
      />
            )
          }
        ]}
      />
    </Card>
  )
}

export default TestSuite
