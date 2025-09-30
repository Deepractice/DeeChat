/**
 * McpConfigHeader - MCP配置页头部组件
 *
 * 职责: 展示服务器统计信息和操作按钮
 */

import React from 'react'
import { Button, Space } from 'antd'
import { UploadOutlined, ReloadOutlined } from '@ant-design/icons'

interface McpConfigHeaderProps {
  serverCount: number
  onRefresh: () => void
  onImport: () => void
  loading?: boolean
}

/**
 * 头部组件
 */
const McpConfigHeader: React.FC<McpConfigHeaderProps> = ({
  serverCount,
  onRefresh,
  onImport,
  loading = false
}) => {
  return (
    <div style={{
      padding: '16px 24px',
      borderBottom: '1px solid #f0f0f0',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div style={{ color: '#6b7280', fontSize: '14px' }}>
        MCP服务器列表 ({serverCount} 项)
      </div>
      <Space size="small">
        <Button
          icon={<UploadOutlined />}
          onClick={onImport}
          style={{ borderRadius: '6px' }}
        >
          导入配置
        </Button>
        <Button
          icon={<ReloadOutlined />}
          onClick={onRefresh}
          loading={loading}
          style={{ borderRadius: '6px' }}
        >
          刷新
        </Button>
      </Space>
    </div>
  )
}

export default McpConfigHeader