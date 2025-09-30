/**
 * McpImportModal - JSON配置导入弹窗组件
 *
 * 职责: 处理JSON配置文件导入
 */

import React, { useState } from 'react'
import { Modal, Button, Input, Typography } from 'antd'
import { ImportOutlined } from '@ant-design/icons'

const { TextArea } = Input

interface McpImportModalProps {
  visible: boolean
  onImport: (jsonConfig: string) => Promise<boolean>
  onClose: () => void
}

/**
 * JSON导入弹窗组件
 */
const McpImportModal: React.FC<McpImportModalProps> = ({
  visible,
  onImport,
  onClose
}) => {
  const [jsonConfig, setJsonConfig] = useState('')
  const [importing, setImporting] = useState(false)

  const handleImport = async () => {
    setImporting(true)
    try {
      const success = await onImport(jsonConfig)
      if (success) {
        setJsonConfig('') // 清空输入框
      }
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    setJsonConfig('')
    onClose()
  }

  return (
    <Modal
      title="导入 MCP 服务器配置"
      open={visible}
      onCancel={handleClose}
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

        <TextArea
          value={jsonConfig}
          onChange={(e) => setJsonConfig(e.target.value)}
          placeholder={`在此粘贴 JSON 配置...

示例格式:
{
  "mcpServers": {
    "server-name": {
      "name": "服务器名称",
      "type": "stdio",
      "command": "node",
      "args": ["path/to/server.js"],
      "description": "服务器描述"
    }
  }
}`}
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
            onClick={handleClose}
            style={{ borderRadius: '6px' }}
          >
            取消
          </Button>
          <Button
            type="primary"
            icon={<ImportOutlined />}
            onClick={handleImport}
            disabled={!jsonConfig.trim()}
            loading={importing}
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
  )
}

export default McpImportModal