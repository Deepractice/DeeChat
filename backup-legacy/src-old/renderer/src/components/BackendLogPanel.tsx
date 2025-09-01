import React, { useState, useEffect, useRef } from 'react'
import { Card, Badge, Button, Space, Typography } from 'antd'
import { ClearOutlined, DownOutlined, UpOutlined } from '@ant-design/icons'

const { Text } = Typography

interface LogMessage {
  level: 'info' | 'warn' | 'error' | 'debug'
  source: string
  message: string
  timestamp: string
  data?: any
}

export const BackendLogPanel: React.FC = () => {
  const [logs, setLogs] = useState<LogMessage[]>([])
  const [isVisible, setIsVisible] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const logContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // 监听后端日志
    const handleBackendLog = (event: any, log: LogMessage) => {
      setLogs(prevLogs => {
        const newLogs = [...prevLogs, log]
        // 只保留最近100条日志
        return newLogs.slice(-100)
      })
    }

    window.electronAPI?.onBackendLog?.(handleBackendLog)

    return () => {
      // 清理监听器
      window.electronAPI?.removeAllListeners?.('backend-log')
    }
  }, [])

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const clearLogs = () => {
    setLogs([])
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return '#ff4d4f'
      case 'warn':
        return '#faad14'
      case 'info':
        return '#1890ff'
      case 'debug':
        return '#722ed1'
      default:
        return '#666'
    }
  }

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'error':
        return <Badge status="error" text="ERROR" />
      case 'warn':
        return <Badge status="warning" text="WARN" />
      case 'info':
        return <Badge status="processing" text="INFO" />
      case 'debug':
        return <Badge status="default" text="DEBUG" />
      default:
        return <Badge status="default" text={level.toUpperCase()} />
    }
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  if (!isVisible) {
    return (
      <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000 }}>
        <Button
          type="primary"
          size="small"
          onClick={() => setIsVisible(true)}
          icon={<UpOutlined />}
        >
          后端日志 {logs.length > 0 && `(${logs.length})`}
        </Button>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000 }}>
      <Card
        title={
          <Space>
            <span>后端日志</span>
            <Badge count={logs.length} showZero />
          </Space>
        }
        size="small"
        style={{ width: 600, height: 400 }}
        extra={
          <Space>
            <Button
              size="small"
              onClick={() => setAutoScroll(!autoScroll)}
              type={autoScroll ? 'primary' : 'default'}
            >
              自动滚动
            </Button>
            <Button size="small" onClick={clearLogs} icon={<ClearOutlined />}>
              清空
            </Button>
            <Button
              size="small"
              onClick={() => setIsVisible(false)}
              icon={<DownOutlined />}
            >
              隐藏
            </Button>
          </Space>
        }
      >
        <div
          ref={logContainerRef}
          style={{
            height: 300,
            overflow: 'auto',
            backgroundColor: '#f5f5f5',
            padding: 8,
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
            fontSize: 12,
            lineHeight: 1.4
          }}
        >
          {logs.length === 0 ? (
            <div style={{ color: '#999', textAlign: 'center', padding: 20 }}>
              暂无日志
            </div>
          ) : (
            logs.map((log, index) => (
              <div
                key={index}
                style={{
                  marginBottom: 8,
                  padding: 6,
                  backgroundColor: '#fff',
                  borderRadius: 4,
                  borderLeft: `3px solid ${getLevelColor(log.level)}`
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: 10, color: '#666', marginRight: 8 }}>
                    {formatTimestamp(log.timestamp)}
                  </Text>
                  {getLevelBadge(log.level)}
                  <Badge
                    color="blue"
                    text={log.source}
                    style={{ marginLeft: 8 }}
                  />
                </div>
                <div style={{ color: '#333', wordBreak: 'break-all' }}>
                  {log.message}
                </div>
                {log.data && (
                  <details style={{ marginTop: 4 }}>
                    <summary style={{ fontSize: 10, color: '#666', cursor: 'pointer' }}>
                      详细数据
                    </summary>
                    <pre style={{ 
                      fontSize: 10, 
                      color: '#666', 
                      margin: '4px 0 0 0',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all'
                    }}>
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}

export default BackendLogPanel