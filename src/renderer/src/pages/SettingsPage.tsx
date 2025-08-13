import React, { useEffect } from 'react'
import { ToolOutlined } from '@ant-design/icons'
import MCPManagement from './MCPManagement'

export const SettingsPage: React.FC = () => {
  // 🎯 DeeChat专属提示词上下文设置
  useEffect(() => {
    // 设置设置页面上下文（MCP管理模式）
    const setupMCPManagementContext = async () => {
      try {
        // 通过IPC通知主进程设置设置模式上下文
        // Legacy API call - may not be available in current implementation
        // if (window.electronAPI?.llm?.setFeatureContext) {
        //   await window.electronAPI.llm.setFeatureContext('mcp-management')
        // }
        console.log('⚙️ [SettingsPage] MCP管理上下文已设置')
      } catch (error) {
        console.error('❌ [SettingsPage] 设置MCP管理上下文失败:', error)
      }
    }

    setupMCPManagementContext()
  }, []) // 只在组件挂载时执行一次
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