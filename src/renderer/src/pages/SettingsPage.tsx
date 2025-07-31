import React from 'react'
import { Tabs } from 'antd'
import { DatabaseOutlined, ToolOutlined } from '@ant-design/icons'
import ModelManagement from './ModelManagement'
import MCPManagement from './MCPManagement'

export const SettingsPage: React.FC = () => {
  const settingsTabs = [
    {
      key: 'models',
      label: (
        <span>
          <DatabaseOutlined />
          模型配置
        </span>
      ),
      children: <ModelManagement />
    },
    {
      key: 'plugins', 
      label: (
        <span>
          <ToolOutlined />
          插件市场
        </span>
      ),
      children: <MCPManagement />
    }
  ]

  return (
    <div style={{ height: '100%', padding: '24px' }}>
      <Tabs
        type="card"
        size="large"
        items={settingsTabs}
        defaultActiveKey="models"
        style={{ height: '100%' }}
        tabBarStyle={{
          marginBottom: '24px'
        }}
      />
    </div>
  )
}

export default SettingsPage