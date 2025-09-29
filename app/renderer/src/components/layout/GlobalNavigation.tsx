import React from 'react'
import { Layout, Button, Space } from 'antd'
import { SettingOutlined, MessageOutlined, HomeOutlined } from '@ant-design/icons'

const { Header } = Layout

export interface GlobalNavigationProps {
  // 当前页面信息
  currentPage: 'config' | 'role-selector' | 'chat' | 'mcp-config'

  // 导航回调
  onNavigateToConfig: () => void
  onNavigateToRoleSelector: () => void
  onNavigateToChat: () => void
  onNavigateToMcpConfig: () => void

  // 其他状态
  hasConfigs?: boolean
  selectedRoleName?: string
}

const GlobalNavigation: React.FC<GlobalNavigationProps> = ({
  currentPage,
  onNavigateToConfig,
  onNavigateToRoleSelector,
  hasConfigs = false
}) => {
  // 判断当前页面是否为聊天相关页面（包括角色选择）
  const isChatMode = currentPage === 'chat' || currentPage === 'role-selector'

  // 判断当前页面是否为配置相关页面（包括MCP配置）
  const isConfigMode = currentPage === 'config' || currentPage === 'mcp-config'

  // 处理聊天导航点击
  const handleChatNavigation = () => {
    if (hasConfigs) {
      // 如果已经在聊天模式，不做任何操作
      if (currentPage === 'chat') return
      // 如果在角色选择页面，也不做任何操作
      if (currentPage === 'role-selector') return
      // 否则进入角色选择
      onNavigateToRoleSelector()
    }
  }

  // 处理配置导航点击
  const handleConfigNavigation = () => {
    // 统一导航到主配置页面（AI配置）
    onNavigateToConfig()
  }

  return (
    <Header style={{
      background: '#fff',
      padding: '0 24px',
      borderBottom: '1px solid #f0f0f0',
      height: '64px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)'
    }}>
      {/* 左侧：品牌标识 */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <HomeOutlined style={{ fontSize: '20px', color: '#1890ff', marginRight: '12px' }} />
        <div style={{
          fontSize: '20px',
          fontWeight: 600,
          color: '#1f2937',
          lineHeight: 1
        }}>
          DeeChat
        </div>
      </div>

      {/* 右侧：固定导航按钮 */}
      <div>
        <Space size={12}>
          <Button
            type={isChatMode ? 'primary' : 'default'}
            icon={<MessageOutlined />}
            onClick={handleChatNavigation}
            disabled={!hasConfigs}
            size="middle"
            style={{
              borderRadius: '6px',
              fontWeight: isChatMode ? 600 : 400
            }}
          >
            聊天
          </Button>
          <Button
            type={isConfigMode ? 'primary' : 'default'}
            icon={<SettingOutlined />}
            onClick={handleConfigNavigation}
            size="middle"
            style={{
              borderRadius: '6px',
              fontWeight: isConfigMode ? 600 : 400
            }}
          >
            配置
          </Button>
        </Space>
      </div>
    </Header>
  )
}

export default GlobalNavigation