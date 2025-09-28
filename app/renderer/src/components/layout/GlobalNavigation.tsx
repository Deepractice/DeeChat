import React from 'react'
import { Layout, Button, Typography, Space } from 'antd'
import { SettingOutlined, MessageOutlined, UserOutlined, ArrowLeftOutlined } from '@ant-design/icons'

const { Header } = Layout
const { Text } = Typography

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
  onNavigateToChat,
  onNavigateToMcpConfig,
  hasConfigs = false,
  selectedRoleName
}) => {
  // 获取当前页面的标题和描述
  const getPageInfo = () => {
    switch (currentPage) {
      case 'config':
        return {
          title: 'AI配置管理',
          description: '配置AI服务商的API密钥和基础设置'
        }
      case 'mcp-config':
        return {
          title: 'MCP工具配置',
          description: '管理AI工具和扩展功能'
        }
      case 'role-selector':
        return {
          title: '角色选择',
          description: '选择适合当前任务的AI助手角色'
        }
      case 'chat':
        return {
          title: selectedRoleName ? `与 ${selectedRoleName} 对话` : '聊天会话',
          description: '与AI助手进行对话交流'
        }
      default:
        return {
          title: 'DeeChat',
          description: ''
        }
    }
  }

  const pageInfo = getPageInfo()

  // 获取导航按钮
  const getNavigationButtons = () => {
    const buttons: React.ReactNode[] = []

    // 根据当前页面显示不同的导航选项
    switch (currentPage) {
      case 'config':
        // 配置页面：显示MCP配置和开始聊天按钮
        buttons.push(
          <Button
            key="mcp"
            icon={<SettingOutlined />}
            onClick={onNavigateToMcpConfig}
            size="small"
          >
            MCP工具
          </Button>
        )
        if (hasConfigs) {
          buttons.push(
            <Button
              key="start"
              type="primary"
              icon={<MessageOutlined />}
              onClick={onNavigateToRoleSelector}
              size="small"
            >
              开始聊天
            </Button>
          )
        }
        break

      case 'mcp-config':
        // MCP配置页面：显示返回设置按钮
        buttons.push(
          <Button
            key="back"
            icon={<ArrowLeftOutlined />}
            onClick={onNavigateToConfig}
            size="small"
          >
            返回设置
          </Button>
        )
        break

      case 'role-selector':
        // 角色选择页面：显示设置按钮
        buttons.push(
          <Button
            key="config"
            icon={<SettingOutlined />}
            onClick={onNavigateToConfig}
            size="small"
          >
            设置
          </Button>
        )
        break

      case 'chat':
        // 聊天页面：显示切换角色和设置按钮
        buttons.push(
          <Button
            key="role"
            icon={<UserOutlined />}
            onClick={onNavigateToRoleSelector}
            size="small"
          >
            切换角色
          </Button>,
          <Button
            key="config"
            icon={<SettingOutlined />}
            onClick={onNavigateToConfig}
            size="small"
          >
            设置
          </Button>
        )
        break
    }

    return buttons
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
      {/* 左侧：标题和描述 */}
      <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
        <div>
          <div style={{
            fontSize: '18px',
            fontWeight: 600,
            color: '#1f2937',
            lineHeight: 1.2
          }}>
            {pageInfo.title}
          </div>
          {pageInfo.description && (
            <Text style={{
              fontSize: '12px',
              color: '#6b7280',
              lineHeight: 1.2
            }}>
              {pageInfo.description}
            </Text>
          )}
        </div>
      </div>

      {/* 右侧：导航按钮 */}
      <div>
        <Space size={8}>
          {getNavigationButtons()}
        </Space>
      </div>
    </Header>
  )
}

export default GlobalNavigation