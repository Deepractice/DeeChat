/**
 * ConfigPage - 配置页面容器组件 (重构版)
 *
 * 职责:
 * 1. 组件组合和布局
 * 2. 事件协调
 * 3. 通过 useConfigPageLogic Hook 管理业务逻辑
 *
 * 架构模式: 参考 ChatPage
 * - 容器组件: ConfigPage (当前文件)
 * - 业务逻辑: useConfigPageLogic Hook
 * - 展示组件: ConfigList, ConfigModal
 */

import React, { useState, useEffect } from 'react'
import { Tabs } from 'antd'
import { SettingOutlined, ToolOutlined } from '@ant-design/icons'
import { useConfigPageLogic } from '../hooks/useConfigPageLogic'
import ConfigList from './config/ConfigList'
import ConfigModal from './config/ConfigModal'
import { McpConfigPage } from './mcp'

interface ConfigPageProps {
  onConfigChange?: () => void
  onStartChat?: () => void
  onMcpConfig?: () => void
  hasConfigs?: boolean
  currentPage?: 'config' | 'mcp-config'
}

/**
 * ConfigPage - 重构版
 * 职责：组件组合和事件协调
 * 业务逻辑已抽取到 useConfigPageLogic Hook
 */
const ConfigPage: React.FC<ConfigPageProps> = ({
  onConfigChange,
  onStartChat,
  onMcpConfig,
  hasConfigs = false,
  currentPage = 'config'
}) => {
  // ==================== 使用业务逻辑Hook ====================
  const logic = useConfigPageLogic({ onConfigChange })

  // ==================== 标签页状态 ====================
  const [activeTab, setActiveTab] = useState(
    currentPage === 'mcp-config' ? 'mcp-config' : 'ai-config'
  )

  // ==================== 同步currentPage变化 ====================
  useEffect(() => {
    if (currentPage === 'mcp-config') {
      setActiveTab('mcp-config')
    } else {
      setActiveTab('ai-config')
    }
  }, [currentPage])

  // ==================== 标签页配置 ====================
  const tabItems = [
    {
      key: 'ai-config',
      label: (
        <span>
          <SettingOutlined style={{ marginRight: 8 }} />
          AI 配置
        </span>
      ),
      children: (
        <ConfigList
          configs={logic.configs}
          loading={logic.loading}
          onRefresh={logic.loadConfigs}
          onAdd={logic.openCreateModal}
          onEdit={logic.handleEdit}
          onDelete={logic.deleteConfig}
        />
      )
    },
    {
      key: 'mcp-config',
      label: (
        <span>
          <ToolOutlined style={{ marginRight: 8 }} />
          MCP 工具
        </span>
      ),
      children: (
        <McpConfigPage onBack={() => {}} />
      )
    }
  ]

  // ==================== 渲染 ====================
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#fafafa'
    }}>
      {/* 主内容区 */}
      <div style={{
        flex: 1,
        padding: '24px',
        overflow: 'auto'
      }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="large"
          style={{
            background: '#fff',
            borderRadius: '8px',
            padding: '0 24px 0 24px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e8e8e8'
          }}
        />
      </div>

      {/* 配置表单弹窗 */}
      <ConfigModal
        visible={logic.modalVisible}
        editingConfig={logic.editingConfig}
        showRealApiKey={logic.showRealApiKey}
        form={logic.form}
        onSubmit={logic.handleFormSubmit}
        onCancel={logic.closeModal}
        onToggleApiKeyVisibility={logic.toggleApiKeyVisibility}
      />
    </div>
  )
}

export default ConfigPage