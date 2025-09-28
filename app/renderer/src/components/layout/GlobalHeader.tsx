import React from 'react'
import { Layout, Button, Space, Typography } from 'antd'
import { MenuOutlined, SettingOutlined, MinusOutlined, CloseOutlined } from '@ant-design/icons'

const { Header } = Layout
const { Text } = Typography

interface GlobalHeaderProps {
  title?: string
  onMenuClick?: () => void
  onSettingsClick?: () => void
}

const GlobalHeader: React.FC<GlobalHeaderProps> = ({
  title = 'DeeChat',
  onMenuClick,
  onSettingsClick
}) => {
  return (
    <Header style={{
      background: '#fff',
      padding: '0 16px',
      borderBottom: '1px solid #f0f0f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '48px',
      minHeight: '48px'
    }}>
      {/* 左侧：应用标识 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 24,
          height: 24,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '12px',
          fontWeight: 'bold'
        }}>
          D
        </div>
        <Text strong style={{ fontSize: '16px', color: '#1f2937' }}>
          {title}
        </Text>
      </div>

      {/* 右侧：操作按钮 */}
      <Space size={8}>
        {onMenuClick && (
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={onMenuClick}
            style={{ color: '#6b7280' }}
          />
        )}
        {onSettingsClick && (
          <Button
            type="text"
            icon={<SettingOutlined />}
            onClick={onSettingsClick}
            style={{ color: '#6b7280' }}
          />
        )}
        <Button
          type="text"
          icon={<MinusOutlined />}
          style={{ color: '#6b7280' }}
          onClick={() => window.electronAPI?.window?.minimize?.()}
        />
        <Button
          type="text"
          icon={<CloseOutlined />}
          style={{ color: '#ef4444' }}
          onClick={() => window.electronAPI?.window?.close?.()}
        />
      </Space>
    </Header>
  )
}

export default GlobalHeader