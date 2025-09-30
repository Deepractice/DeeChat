/**
 * ConfigModal - AI配置表单弹窗组件
 *
 * 职责: 负责新增/编辑配置的表单展示和交互
 */

import React from 'react'
import { Modal, Form, Input, Button, FormInstance } from 'antd'
import { EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons'
import type { AIConfig } from '../../hooks/useConfigPageLogic'

interface ConfigModalProps {
  visible: boolean
  editingConfig: AIConfig | null
  showRealApiKey: boolean
  form: FormInstance
  onSubmit: (values: any) => void
  onCancel: () => void
  onToggleApiKeyVisibility: () => void
}

const ConfigModal: React.FC<ConfigModalProps> = ({
  visible,
  editingConfig,
  showRealApiKey,
  form,
  onSubmit,
  onCancel,
  onToggleApiKeyVisibility
}) => {
  return (
    <Modal
      title={editingConfig ? "编辑 AI 配置" : "新增 AI 配置"}
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={500}
      centered
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onSubmit}
        style={{ marginTop: '20px' }}
      >
        {/* 配置名称 */}
        <Form.Item
          name="name"
          label="配置名称"
          rules={[{ required: true, message: '请输入配置名称' }]}
        >
          <Input
            placeholder="例如: OpenAI, Claude API"
            style={{ borderRadius: '6px' }}
          />
        </Form.Item>

        {/* API Key */}
        <Form.Item
          name="api_key"
          label="API Key"
          rules={[{ required: !editingConfig, message: '请输入API Key' }]}
          help={editingConfig ? "显示掩码表示已有密钥，如需更改请输入新密钥" : undefined}
        >
          {editingConfig ? (
            // 编辑模式：使用完全自定义的输入框和眼睛图标
            <div style={{ position: 'relative' }}>
              <Input
                placeholder="输入新密钥以更改，保持掩码则不修改"
                type={showRealApiKey ? 'text' : 'password'}
                style={{ borderRadius: '6px', paddingRight: '30px' }}
                value={form.getFieldValue('api_key')}
                onChange={(e) => {
                  form.setFieldsValue({ api_key: e.target.value })
                }}
              />
              <div
                onClick={onToggleApiKeyVisibility}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  cursor: 'pointer',
                  color: '#bfbfbf',
                  fontSize: '14px'
                }}
              >
                {showRealApiKey ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              </div>
            </div>
          ) : (
            // 创建模式：使用默认的 Input.Password
            <Input.Password
              placeholder="输入你的API密钥"
              style={{ borderRadius: '6px' }}
            />
          )}
        </Form.Item>

        {/* API地址 */}
        <Form.Item
          name="base_url"
          label="API地址"
          rules={[{ required: true, message: '请输入API地址' }]}
        >
          <Input
            placeholder="https://api.openai.com/v1"
            style={{ borderRadius: '6px' }}
          />
        </Form.Item>

        {/* 提交按钮 */}
        <Form.Item style={{ marginBottom: 0, marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button
              onClick={onCancel}
              style={{ borderRadius: '6px' }}
            >
              取消
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              style={{
                background: '#1890ff',
                borderColor: '#1890ff',
                borderRadius: '6px'
              }}
            >
              {editingConfig ? '保存修改' : '创建配置'}
            </Button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default ConfigModal