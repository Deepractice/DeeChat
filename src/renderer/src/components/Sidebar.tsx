import React from 'react'
import {
  Button,
  Space,
  Tooltip
} from 'antd'
import {
  MessageOutlined,
  SettingOutlined
} from '@ant-design/icons'

interface SidebarProps {
  activeView?: 'chat' | 'settings'
  onViewChange?: (view: 'chat' | 'settings') => void
}

const Sidebar: React.FC<SidebarProps> = ({ 
  activeView = 'chat', 
  onViewChange 
}) => {
  const handleChatClick = () => {
    onViewChange?.('chat')
  }

  const handleSettingsClick = () => {
    onViewChange?.('settings')
  }

  return (
    <div style={{ 
      padding: '24px 0', 
      textAlign: 'center',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      backgroundColor: '#1a1a1a'
    }}>
      {/* DeeChat Logo */}
      <div style={{ marginBottom: '32px' }}>
        <div 
          style={{ 
            width: '32px', 
            height: '32px',
            borderRadius: '8px',
            backgroundColor: '#1890ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontSize: '18px',
            fontWeight: 'bold',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}
        >
          D
        </div>
      </div>
      
      {/* 功能图标按钮 */}
      <Space direction="vertical" size="middle">
        <Tooltip title="对话" placement="right">
          <Button 
            type={activeView === 'chat' ? 'primary' : 'text'}
            icon={<MessageOutlined />} 
            size="large"
            onClick={handleChatClick}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeView === 'chat' ? '#1890ff' : 'transparent',
              color: activeView === 'chat' ? '#ffffff' : '#999999',
              transition: 'all 0.2s ease',
              boxShadow: activeView === 'chat' ? '0 2px 8px rgba(24, 144, 255, 0.3)' : 'none'
            }}
            onMouseEnter={(e) => {
              if (activeView !== 'chat') {
                e.currentTarget.style.backgroundColor = '#2a2a2a'
                e.currentTarget.style.color = '#ffffff'
              }
            }}
            onMouseLeave={(e) => {
              if (activeView !== 'chat') {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = '#999999'
              }
            }}
          />
        </Tooltip>
        <Tooltip title="设置" placement="right">
          <Button 
            type={activeView === 'settings' ? 'primary' : 'text'}
            icon={<SettingOutlined />} 
            size="large"
            onClick={handleSettingsClick}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeView === 'settings' ? '#1890ff' : 'transparent',
              color: activeView === 'settings' ? '#ffffff' : '#999999',
              transition: 'all 0.2s ease',
              boxShadow: activeView === 'settings' ? '0 2px 8px rgba(24, 144, 255, 0.3)' : 'none'
            }}
            onMouseEnter={(e) => {
              if (activeView !== 'settings') {
                e.currentTarget.style.backgroundColor = '#2a2a2a'
                e.currentTarget.style.color = '#ffffff'
              }
            }}
            onMouseLeave={(e) => {
              if (activeView !== 'settings') {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = '#999999'
              }
            }}
          />
        </Tooltip>
      </Space>
    </div>
  )
}

export default Sidebar
