import React from 'react'
import { ToolOutlined } from '@ant-design/icons'
import MCPManagement from './MCPManagement'

export const SettingsPage: React.FC = () => {
  return (
    <div style={{ height: '100%', padding: '24px' }}>
      <div style={{
        marginBottom: '24px',
        paddingBottom: '16px',
        borderBottom: '1px solid #f0f0f0'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '18px',
          fontWeight: '500'
        }}>
          <ToolOutlined />
          插件市场
        </div>
        <div style={{
          color: '#666',
          fontSize: '14px',
          marginTop: '4px'
        }}>
          管理和配置MCP工具插件
        </div>
      </div>
      <MCPManagement />
    </div>
  )
}

export default SettingsPage