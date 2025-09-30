/**
 * McpToolsModal - MCP工具列表弹窗组件
 *
 * 职责: 展示指定服务器的工具列表
 */

import React from 'react'
import { Modal, List, Space, Typography, Collapse } from 'antd'
import { ToolOutlined } from '@ant-design/icons'

interface ToolInfo {
  name: string
  description?: string
  inputSchema?: any
}

interface McpToolsModalProps {
  visible: boolean
  serverName: string
  tools: ToolInfo[]
  loading: boolean
  onClose: () => void
}

/**
 * 工具列表弹窗组件
 */
const McpToolsModal: React.FC<McpToolsModalProps> = ({
  visible,
  serverName,
  tools,
  loading,
  onClose
}) => {
  return (
    <Modal
      title={
        <Space>
          <ToolOutlined style={{ color: '#1890ff' }} />
          <span>{serverName} - 工具列表</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
      centered
    >
      <div style={{ marginTop: '20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Space direction="vertical">
              <div style={{ fontSize: '16px' }}>🔄 加载工具列表中...</div>
            </Space>
          </div>
        ) : tools.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Space direction="vertical">
              <div style={{ fontSize: '24px' }}>🚫</div>
              <div style={{ fontSize: '16px', color: '#666' }}>该服务器暂无可用工具</div>
            </Space>
          </div>
        ) : (
          <List
            dataSource={tools}
            renderItem={(tool: ToolInfo) => (
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
  )
}

export default McpToolsModal