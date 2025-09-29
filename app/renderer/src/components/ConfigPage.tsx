import React, { useState, useEffect } from 'react'
import {
  Button,
  Table,
  Modal,
  Form,
  Input,
  message,
  Popconfirm,
  Space,
  Badge,
  Typography,
  Tabs
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  MessageOutlined,
  SettingOutlined,
  EditOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  ToolOutlined
} from '@ant-design/icons'
import McpConfigPage from './McpConfigPage'

const { Title } = Typography

interface AIConfig {
  id: number
  name: string
  api_key: string
  base_url: string
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

interface ConfigPageProps {
  onConfigChange?: () => void
  onStartChat?: () => void
  onMcpConfig?: () => void
  hasConfigs?: boolean
  currentPage?: 'config' | 'mcp-config'
}

const ConfigPage: React.FC<ConfigPageProps> = ({
  onConfigChange,
  onStartChat,
  onMcpConfig,
  hasConfigs = false,
  currentPage = 'config'
}) => {
  const [configs, setConfigs] = useState<AIConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingConfig, setEditingConfig] = useState<AIConfig | null>(null)
  const [showRealApiKey, setShowRealApiKey] = useState(false)
  const [activeTab, setActiveTab] = useState(currentPage === 'mcp-config' ? 'mcp-config' : 'ai-config')
  const [form] = Form.useForm()

  // 加载所有配置
  const loadConfigs = async () => {
    setLoading(true)
    try {
      console.log('🔄 请求获取配置列表...')
      const result = await window.electronAPI.aiConfig.getAll()
      console.log('📥 后端响应:', result)
      
      if (result.success) {
        setConfigs(result.data || [])
      } else {
        message.error('获取配置失败: ' + result.error)
      }
    } catch (error) {
      console.error('获取配置异常:', error)
      message.error('获取配置异常: ' + error)
    }
    setLoading(false)
  }

  // 创建配置
  const createConfig = async (values: any) => {
    try {
      console.log('📤 发送创建配置请求:', values)
      
      const input = {
        name: values.name,
        api_key: values.api_key,
        base_url: values.base_url || 'https://api.openai.com/v1',
        is_default: values.is_default || false,
        is_active: true
      }

      const result = await window.electronAPI.aiConfig.create(input)
      console.log('📥 创建响应:', result)
      
      if (result.success) {
        message.success('✅ 配置创建成功！')
        setModalVisible(false)
        form.resetFields()
        loadConfigs() // 重新加载列表
        onConfigChange?.() // 通知父组件配置变化
      } else {
        message.error('❌ 创建失败: ' + result.error)
      }
    } catch (error) {
      console.error('创建配置异常:', error)
      message.error('❌ 创建异常: ' + error)
    }
  }

  // 更新配置
  const updateConfig = async (values: any) => {
    if (!editingConfig) return

    try {
      console.log('📤 发送更新配置请求:', values)
      
      // 只包含实际变更的字段
      const input: any = {}
      if (values.name !== editingConfig.name) input.name = values.name
      
      // API Key 逻辑：
      // 1. 如果是掩码，说明用户没有修改，不更新
      // 2. 如果不是掩码但与原始值相同，说明用户只是查看了，不更新
      // 3. 只有当不是掩码且与原始值不同时才更新
      if (values.api_key && 
          values.api_key !== '••••••••••••••••' && 
          values.api_key.trim() &&
          values.api_key !== editingConfig.api_key) {
        input.api_key = values.api_key
      }
      
      if (values.base_url !== editingConfig.base_url) input.base_url = values.base_url

      const result = await window.electronAPI.aiConfig.update(editingConfig.id, input)
      console.log('📥 更新响应:', result)
      
      if (result.success) {
        message.success('✅ 配置更新成功！')
        setModalVisible(false)
        setEditingConfig(null)
        setShowRealApiKey(false)
        form.resetFields()
        loadConfigs() // 重新加载列表
        onConfigChange?.() // 通知父组件配置变化
      } else {
        message.error('❌ 更新失败: ' + result.error)
      }
    } catch (error) {
      console.error('更新配置异常:', error)
      message.error('❌ 更新异常: ' + error)
    }
  }

  // 编辑配置
  const handleEdit = (record: AIConfig) => {
    setEditingConfig(record)
    setShowRealApiKey(false) // 默认显示掩码
    form.setFieldsValue({
      name: record.name,
      api_key: '••••••••••••••••', // 显示掩码表示已有密钥
      base_url: record.base_url
    })
    setModalVisible(true)
  }

  // 切换API Key显示状态
  const toggleApiKeyVisibility = () => {
    if (!editingConfig) return
    
    if (showRealApiKey) {
      // 从显示真实值切换回掩码
      form.setFieldsValue({
        api_key: '••••••••••••••••'
      })
      setShowRealApiKey(false)
    } else {
      // 从掩码切换到真实值
      form.setFieldsValue({
        api_key: editingConfig.api_key
      })
      setShowRealApiKey(true)
    }
  }

  // 处理表单提交
  const handleFormSubmit = (values: any) => {
    if (editingConfig) {
      updateConfig(values)
    } else {
      createConfig(values)
    }
  }

  // 删除配置
  const deleteConfig = async (nameOrId: string | number) => {
    try {
      console.log('🗑️ 发送删除请求:', nameOrId)
      
      const result = await window.electronAPI.aiConfig.delete(nameOrId)
      console.log('📥 删除响应:', result)
      
      if (result.success) {
        message.success('✅ 配置删除成功！')
        loadConfigs() // 重新加载列表
        onConfigChange?.() // 通知父组件配置变化
      } else {
        message.error('❌ 删除失败: ' + result.error)
      }
    } catch (error) {
      console.error('删除配置异常:', error)
      message.error('❌ 删除异常: ' + error)
    }
  }

  // 表格列定义
  const columns = [
    {
      title: '配置名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: AIConfig) => (
        <Space size="small">
          <span style={{ fontWeight: 500, color: '#2c3e50' }}>{name}</span>
          {record.is_default && (
            <Badge status="success" text="默认" />
          )}
          {!record.is_active && (
            <Badge status="error" text="已禁用" />
          )}
        </Space>
      )
    },
    {
      title: 'API地址',
      dataIndex: 'base_url',
      key: 'base_url',
      render: (url: string) => (
        <code style={{ 
          fontSize: '12px', 
          background: '#f8f9fa', 
          padding: '4px 8px', 
          borderRadius: '4px',
          border: '1px solid #e9ecef',
          color: '#495057'
        }}>
          {url}
        </code>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => {
        if (!text) return <span style={{ color: '#9ca3af' }}>-</span>
        return (
          <span style={{ color: '#6b7280' }}>
            {new Date(text).toLocaleString()}
          </span>
        )
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (record: AIConfig) => (
        <Space size="small">
          <Button 
            type="text" 
            icon={<EditOutlined />} 
            size="small"
            onClick={() => handleEdit(record)}
            style={{ 
              display: 'flex', 
              alignItems: 'center',
              padding: '4px 8px',
              color: '#1890ff'
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="删除配置"
            description="确定要删除这个配置吗？此操作无法撤销。"
            onConfirm={() => deleteConfig(record.name)}
            okText="删除"
            cancelText="取消"
            okType="danger"
          >
            <Button 
              type="text" 
              icon={<DeleteOutlined />} 
              danger
              size="small"
              style={{ 
                display: 'flex', 
                alignItems: 'center',
                padding: '4px 8px'
              }}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]


  useEffect(() => {
    loadConfigs()
  }, [])

  // 根据currentPage同步activeTab
  useEffect(() => {
    if (currentPage === 'mcp-config') {
      setActiveTab('mcp-config')
    } else {
      setActiveTab('ai-config')
    }
  }, [currentPage])

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
        <div style={{
          background: '#ffffff',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e8e8e8'
        }}>
          {/* 操作栏 */}
          <div style={{ 
            padding: '16px 24px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ color: '#6b7280', fontSize: '14px' }}>
              配置列表 ({configs.length} 项)
            </div>
            <Space size="small">
              <Button 
                icon={<ReloadOutlined />}
                onClick={loadConfigs}
                loading={loading}
                style={{ borderRadius: '6px' }}
              >
                刷新
              </Button>
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={() => setModalVisible(true)}
                style={{ 
                  background: '#1890ff',
                  borderColor: '#1890ff',
                  borderRadius: '6px'
                }}
              >
                新增配置
              </Button>
            </Space>
          </div>

          {/* 表格区域 */}
          <Table
            columns={columns}
            dataSource={configs}
            loading={loading}
            rowKey="id"
            pagination={{ 
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条记录`,
              style: { padding: '16px 24px' }
            }}
            locale={{ emptyText: '暂无配置数据，点击"新增配置"开始添加' }}
            style={{ border: 'none' }}
          />
        </div>
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

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fafafa' }}>
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

        {/* AI配置Modal */}
      <Modal
        title={editingConfig ? "编辑 AI 配置" : "新增 AI 配置"}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          setEditingConfig(null)
          setShowRealApiKey(false)
          form.resetFields()
        }}
        footer={null}
        width={500}
        centered
      >        
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFormSubmit}
          style={{ marginTop: '20px' }}
        >
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
                  onClick={toggleApiKeyVisibility}
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

          <Form.Item style={{ marginBottom: 0, marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button 
                onClick={() => setModalVisible(false)}
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
    </div>
  )
}

export default ConfigPage