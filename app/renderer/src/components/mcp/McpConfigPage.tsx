/**
 * McpConfigPage - MCP配置页容器组件 (重构版)
 *
 * 职责:
 * 1. 组件组合和布局
 * 2. 事件协调
 * 3. 通过 useMcpConfigPage Hook 管理业务逻辑
 *
 * 架构模式: 参考 ChatPage 和 RoleManager
 * - 容器组件: McpConfigPage (当前文件)
 * - 业务逻辑: useMcpConfigPage Hook
 * - 展示组件: McpConfigHeader, McpServerTable, McpToolsModal, McpImportModal
 */

import React from 'react'
import { useMcpConfigPage } from '../../hooks/useMcpConfigPage'
import McpConfigHeader from './McpConfigHeader'
import McpServerTable from './McpServerTable'
import McpToolsModal from './McpToolsModal'
import McpImportModal from './McpImportModal'

interface McpConfigPageProps {
  onBack?: () => void
}

/**
 * McpConfigPage - 重构版
 * 职责: 组件组合和事件协调
 * 业务逻辑已抽取到 useMcpConfigPage Hook
 */
const McpConfigPage: React.FC<McpConfigPageProps> = ({ onBack }) => {
  // ==================== 使用业务逻辑Hook ====================
  const logic = useMcpConfigPage()

  // ==================== 渲染 ====================

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fafafa' }}>
      {/* 主内容区域 */}
      <div style={{
        flex: 1,
        padding: '24px',
        overflow: 'auto'
      }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e8e8e8'
        }}>
          {/* 头部操作栏 */}
          <McpConfigHeader
            serverCount={logic.servers.length}
            onRefresh={logic.loadServers}
            onImport={() => logic.setImportModalVisible(true)}
            loading={logic.loading}
          />

          {/* 服务器表格 */}
          <McpServerTable
            servers={logic.servers}
            loading={logic.loading}
            onConnect={logic.connectServer}
            onDisconnect={logic.disconnectServer}
            onDelete={logic.deleteServer}
            onShowTools={logic.showServerTools}
            getToolsByServer={logic.getToolsByServer}
            getRolesByServer={logic.getRolesByServer}
          />
        </div>
      </div>

      {/* 工具列表弹窗 */}
      <McpToolsModal
        visible={logic.toolsModalVisible}
        serverName={logic.currentServerName}
        tools={logic.currentServerTools}
        loading={logic.toolsLoading}
        onClose={() => logic.setToolsModalVisible(false)}
      />

      {/* JSON导入弹窗 */}
      <McpImportModal
        visible={logic.importModalVisible}
        onImport={logic.importFromJson}
        onClose={() => logic.setImportModalVisible(false)}
      />
    </div>
  )
}

export default McpConfigPage