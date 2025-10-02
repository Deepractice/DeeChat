import React, { useRef } from 'react'
import { Button, Select } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { MessageList, MessageInput, StreamingMessage } from '../message'
import type { StreamingMessageRef } from '../message'
import { RoleDropdownSelector } from '../role'
import type { ConversationSession, ConversationMessage, AIConfig } from '../../types/preload'
import type { Role } from '../../types/role'

interface ChatMainContentProps {
  // 会话状态
  currentSession: ConversationSession | null
  messages: ConversationMessage[]

  // AI配置
  aiConfigs: AIConfig[]
  selectedConfig: string
  availableModels: any[]
  currentDisplayModel: string

  // 角色配置
  internalSelectedRole: Role | null

  // 加载状态
  sendingMessage: boolean
  loadingCurrentModel: boolean
  loadingModels: boolean
  loading: boolean
  isCallingTool: boolean

  // 流式消息
  streamingMessageId: string | null
  streamingTimeline: any[]  // 新增：timeline数据
  streamingMessageRef: React.RefObject<StreamingMessageRef>
  messageListRef: React.RefObject<HTMLDivElement>

  // MCP工具
  toolCount: number

  // 方法
  onConfigChange: (value: string) => void
  onModelSelect: (model: string) => void
  onRoleSelect: (role: Role | null, activationResult?: any) => void
  onSendMessage: (content: string) => void
  onCreateSession: () => void
  onStreamStart?: () => void
  onStreamComplete?: (content: string) => void
  onStreamError?: (error: string) => void
}

/**
 * 聊天主内容区域组件
 * 负责展示消息列表、输入框和配置选择
 */
const ChatMainContent: React.FC<ChatMainContentProps> = ({
  currentSession,
  messages,
  aiConfigs,
  selectedConfig,
  availableModels,
  currentDisplayModel,
  internalSelectedRole,
  sendingMessage,
  loadingCurrentModel,
  loadingModels,
  loading,
  isCallingTool,
  streamingMessageId,
  streamingTimeline,
  streamingMessageRef,
  messageListRef,
  toolCount,
  onConfigChange,
  onModelSelect,
  onRoleSelect,
  onSendMessage,
  onCreateSession,
  onStreamStart,
  onStreamComplete,
  onStreamError
}) => {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden'
    }}>
      {currentSession ? (
        <>
          {/* 消息列表区域 */}
          <div
            ref={messageListRef}
            style={{ flex: 1, overflow: 'hidden' }}
          >
            <MessageList
              messages={messages}
              loading={sendingMessage}
              streamingMessage={
                streamingMessageId ? (
                  <StreamingMessage
                    ref={streamingMessageRef}
                    messageId={streamingMessageId}
                    timeline={streamingTimeline}
                    scrollContainer={messageListRef}
                    onStreamStart={onStreamStart}
                    onStreamComplete={onStreamComplete}
                    onError={onStreamError}
                  />
                ) : undefined
              }
            />
          </div>

          {/* 消息输入区域 */}
          <div style={{
            borderTop: '1px solid #f0f0f0',
            padding: '16px'
          }}>
            {/* 配置和模型选择器 */}
            <div style={{
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              maxWidth: '800px',
              margin: '0 auto 12px auto',
              flexWrap: 'wrap'
            }}>
              {/* AI配置选择 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '14px',
                  color: '#666',
                  minWidth: '40px'
                }}>
                  配置:
                </span>
                <Select
                  value={selectedConfig}
                  onChange={onConfigChange}
                  style={{ minWidth: '120px' }}
                  placeholder="选择配置"
                  disabled={sendingMessage}
                  size="middle"
                  options={aiConfigs.map(config => ({
                    value: config.name,
                    label: config.name,
                    title: `${config.name} - ${config.base_url}`
                  }))}
                />
              </div>

              {/* AI模型选择 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '14px',
                  color: '#666',
                  minWidth: '40px'
                }}>
                  模型:
                </span>
                <Select
                  value={currentDisplayModel}
                  onChange={onModelSelect}
                  style={{
                    minWidth: '200px',
                    flex: 1
                  }}
                  placeholder="选择AI模型"
                  loading={loadingCurrentModel || loadingModels}
                  disabled={sendingMessage || !selectedConfig}
                  size="middle"
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={availableModels.map(model => ({
                    value: model.id,
                    label: model.name || model.id,
                    title: model.description
                  }))}
                />
              </div>

              {/* AI角色选择 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <span style={{
                  fontSize: '14px',
                  color: '#666',
                  minWidth: '40px',
                  flexShrink: 0
                }}>
                  角色:
                </span>
                <RoleDropdownSelector
                  selectedRole={internalSelectedRole}
                  onRoleSelect={onRoleSelect}
                  disabled={sendingMessage}
                  style={{ flex: 1, minWidth: 0 }}
                  placeholder="选择AI角色"
                />
              </div>
            </div>

            <MessageInput
              onSendMessage={onSendMessage}
              disabled={sendingMessage}
              placeholder={sendingMessage ? 'AI正在思考中...' : '输入消息...'}
              toolCount={toolCount}
              isCallingTool={isCallingTool}
            />
          </div>
        </>
      ) : (
        // 欢迎界面
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          textAlign: 'center',
          color: '#666'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '24px' }}>💬</div>
          <h2 style={{ color: '#666', marginBottom: '16px' }}>
            欢迎使用 DeeChat
          </h2>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={onCreateSession}
            loading={loading}
            disabled={!selectedConfig}
          >
            创建新会话
          </Button>
        </div>
      )}
    </div>
  )
}

export default ChatMainContent