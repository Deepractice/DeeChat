import React, { useEffect, useState } from 'react'
import { Modal, List, Avatar, Typography, Tag, Space, Button, message, Divider, Empty, Input, Tabs, Badge } from 'antd'
import {
  RobotOutlined,
  ApiOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  CheckOutlined,
  SearchOutlined
} from '@ant-design/icons'
import { ModelConfigEntity } from '../../../shared/entities/ModelConfigEntity'

// 内置默认配置
const DEFAULT_CONFIG = {
  id: 'default-config',
  name: 'ChatAnywhere (内置)',
  provider: 'openai',
  model: 'gpt-4o-mini',
  apiKey: 'sk-cVZTEb3pLEKqM0gfWPz3QE9jXc8cq9Zyh0Api8rESjkITqto',
  baseURL: 'https://api.chatanywhere.tech/v1/',
  isEnabled: true,
  priority: 10,
  enabledModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']
}

const { Text, Title } = Typography

// 具体的模型选项
interface ModelOption {
  id: string                    // 唯一标识：configId-modelName
  configId: string             // 配置ID
  configName: string           // 配置名称（作为小标题）
  provider: string             // 提供商类型
  modelName: string            // 具体模型名称
  status: string               // 配置状态
  config: ModelConfigEntity    // 完整配置
}

interface ModelSelectionModalProps {
  visible: boolean
  onClose: () => void
  selectedModelId?: string
  onSelectModel: (modelId: string, config: ModelConfigEntity, modelName: string) => void
  onGoToModelManagement?: () => void  // 新增：跳转到模型管理的回调
}

const ModelSelectionModal: React.FC<ModelSelectionModalProps> = ({
  visible,
  onClose,
  selectedModelId,
  onSelectModel,
  onGoToModelManagement
}) => {
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')

  // 获取提供商信息
  const getProviderInfo = (provider: string) => {
    const providerMap = {
      openai: { 
        icon: <RobotOutlined />, 
        color: '#10a37f', 
        name: 'OpenAI',
        bgColor: '#f0fdf4'
      },
      claude: { 
        icon: <ApiOutlined />, 
        color: '#ff6b35', 
        name: 'Claude',
        bgColor: '#fff7ed'
      },
      gemini: { 
        icon: <ThunderboltOutlined />, 
        color: '#4285f4', 
        name: 'Gemini',
        bgColor: '#eff6ff'
      },
      grok: { 
        icon: <RobotOutlined />, 
        color: '#1d4ed8', 
        name: 'Grok',
        bgColor: '#eef2ff'
      },
      custom: { 
        icon: <SettingOutlined />, 
        color: '#6b7280', 
        name: 'Custom',
        bgColor: '#f9fafb'
      }
    }
    return providerMap[provider as keyof typeof providerMap] || providerMap.custom
  }

  // 根据模型名称判断分类
  const getModelCategory = (modelName: string): string => {
    const name = modelName.toLowerCase()
    
    if (name.includes('gpt') || name.includes('o1') || name.includes('o3') || name.includes('o4') || name.includes('chatgpt')) {
      return 'gpt'
    }
    if (name.includes('claude')) {
      return 'claude'
    }
    if (name.includes('gemini')) {
      return 'gemini'
    }
    if (name.includes('deepseek')) {
      return 'deepseek'
    }
    if (name.includes('grok')) {
      return 'grok'
    }
    if (name.includes('qwen') || name.includes('kimi')) {
      return 'chinese'
    }
    return 'other'
  }

  // 根据模型名称判断提供商
  const getModelProvider = (modelName: string): string => {
    const name = modelName.toLowerCase()
    
    if (name.includes('gpt') || name.includes('o1') || name.includes('o3') || name.includes('o4') || name.includes('chatgpt')) {
      return 'openai'
    }
    if (name.includes('claude')) {
      return 'claude'
    }
    if (name.includes('gemini')) {
      return 'gemini'
    }
    if (name.includes('deepseek')) {
      return 'custom'
    }
    if (name.includes('grok')) {
      return 'grok'
    }
    if (name.includes('qwen') || name.includes('kimi')) {
      return 'custom'
    }
    return 'custom'
  }

  // 过滤和搜索模型
  const getFilteredModels = () => {
    let filtered = availableModels

    // 按分类过滤
    if (activeCategory !== 'all') {
      filtered = filtered.filter(model => getModelCategory(model.modelName) === activeCategory)
    }

    // 按搜索关键词过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(model => 
        model.modelName.toLowerCase().includes(query) ||
        model.configName.toLowerCase().includes(query)
      )
    }

    return filtered
  }

  // 获取分类统计
  const getCategoryStats = () => {
    const stats = {
      all: availableModels.length,
      gpt: 0,
      claude: 0,
      gemini: 0,
      deepseek: 0,
      grok: 0,
      chinese: 0,
      other: 0
    }

    availableModels.forEach(model => {
      const category = getModelCategory(model.modelName)
      stats[category as keyof typeof stats]++
    })

    return stats
  }



  // 通过主进程获取可用模型列表
  const loadAvailableModels = async () => {
    setLoading(true)
    try {
      const modelOptions: ModelOption[] = []
      const defaultConfig = new ModelConfigEntity(DEFAULT_CONFIG)
      
      // 通过主进程调用 /models 接口
      if (window.electronAPI?.ai?.getAvailableModels) {
        const models = await window.electronAPI.ai.getAvailableModels({
          baseURL: DEFAULT_CONFIG.baseURL,
          apiKey: DEFAULT_CONFIG.apiKey
        })
        
        if (models && Array.isArray(models)) {
          models.forEach((modelName: string) => {
            const actualProvider = getModelProvider(modelName)
            const configForModel = new ModelConfigEntity({
              ...DEFAULT_CONFIG,
              provider: actualProvider,
              model: modelName
            })
            
            modelOptions.push({
              id: `${DEFAULT_CONFIG.id}-${modelName}`,
              configId: DEFAULT_CONFIG.id,
              configName: DEFAULT_CONFIG.name,
              provider: actualProvider,
              modelName: modelName,
              status: 'success',
              config: configForModel
            })
          })
        }
      }
      
      // 如果没有获取到模型，使用默认模型列表
      if (modelOptions.length === 0) {
        DEFAULT_CONFIG.enabledModels.forEach(modelName => {
          const actualProvider = getModelProvider(modelName)
          const configForModel = new ModelConfigEntity({
            ...DEFAULT_CONFIG,
            provider: actualProvider,
            model: modelName
          })
          
          modelOptions.push({
            id: `${DEFAULT_CONFIG.id}-${modelName}`,
            configId: DEFAULT_CONFIG.id,
            configName: DEFAULT_CONFIG.name,
            provider: actualProvider,
            modelName: modelName,
            status: 'success',
            config: configForModel
          })
        })
      }

      setAvailableModels(modelOptions)
    } catch (error) {
      console.error('Load models error:', error)
      // 出错时提供默认模型
      const defaultConfig = new ModelConfigEntity(DEFAULT_CONFIG)
      const fallbackOptions: ModelOption[] = []
      
      DEFAULT_CONFIG.enabledModels.forEach(modelName => {
        const actualProvider = getModelProvider(modelName)
        const configForModel = new ModelConfigEntity({
          ...DEFAULT_CONFIG,
          provider: actualProvider,
          model: modelName
        })
        
        fallbackOptions.push({
          id: `${DEFAULT_CONFIG.id}-${modelName}`,
          configId: DEFAULT_CONFIG.id,
          configName: DEFAULT_CONFIG.name,
          provider: actualProvider,
          modelName: modelName,
          status: 'success',
          config: configForModel
        })
      })
      
      setAvailableModels(fallbackOptions)
    } finally {
      setLoading(false)
    }
  }

  // 处理模型选择
  const handleSelectModel = (modelOption: ModelOption) => {
    onSelectModel(modelOption.id, modelOption.config, modelOption.modelName)
    onClose()
    message.success(`已切换到 ${modelOption.configName} - ${modelOption.modelName}`)
  }

  useEffect(() => {
    if (visible) {
      loadAvailableModels()
      setSearchQuery('')
      setActiveCategory('all')
    }
  }, [visible])

  const categoryStats = getCategoryStats()
  const filteredModels = getFilteredModels()

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <RobotOutlined style={{ color: '#1890ff', fontSize: '18px' }} />
          <span style={{ fontSize: '16px', fontWeight: 600 }}>选择AI模型</span>
          <Tag color="blue" style={{ fontSize: '12px', fontWeight: 500 }}>
            {availableModels.length} 个模型
          </Tag>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
      style={{ top: 20 }}
    >
      <div style={{ marginBottom: 20 }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: 16,
          padding: '0 4px'
        }}>
          <div>
            <Text style={{ fontSize: '14px', color: '#666' }}>
              选择一个AI模型来开始对话
            </Text>
          </div>
          <Input
            placeholder="搜索模型..."
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ 
              width: 260,
              borderRadius: '6px'
            }}
            allowClear
          />
        </div>
        
        <Tabs
          activeKey={activeCategory}
          onChange={setActiveCategory}
          type="card"
          size="small"
          style={{ marginBottom: 0 }}
          items={[
            {
              key: 'all',
              label: (
                <Space size={4}>
                  <span>全部</span>
                  <Badge count={categoryStats.all} showZero style={{ backgroundColor: '#52c41a' }} />
                </Space>
              )
            },
            {
              key: 'gpt',
              label: (
                <Space size={4}>
                  <span>GPT</span>
                  <Badge count={categoryStats.gpt} showZero style={{ backgroundColor: '#1890ff' }} />
                </Space>
              )
            },
            {
              key: 'claude',
              label: (
                <Space size={4}>
                  <span>Claude</span>
                  <Badge count={categoryStats.claude} showZero style={{ backgroundColor: '#ff6b35' }} />
                </Space>
              )
            },
            {
              key: 'gemini',
              label: (
                <Space size={4}>
                  <span>Gemini</span>
                  <Badge count={categoryStats.gemini} showZero style={{ backgroundColor: '#4285f4' }} />
                </Space>
              )
            },
            {
              key: 'deepseek',
              label: (
                <Space size={4}>
                  <span>DeepSeek</span>
                  <Badge count={categoryStats.deepseek} showZero style={{ backgroundColor: '#722ed1' }} />
                </Space>
              )
            },
            {
              key: 'grok',
              label: (
                <Space size={4}>
                  <span>Grok</span>
                  <Badge count={categoryStats.grok} showZero style={{ backgroundColor: '#1d4ed8' }} />
                </Space>
              )
            },
            {
              key: 'chinese',
              label: (
                <Space size={4}>
                  <span>国产</span>
                  <Badge count={categoryStats.chinese} showZero style={{ backgroundColor: '#f5222d' }} />
                </Space>
              )
            },
            {
              key: 'other',
              label: (
                <Space size={4}>
                  <span>其他</span>
                  <Badge count={categoryStats.other} showZero style={{ backgroundColor: '#8c8c8c' }} />
                </Space>
              )
            }
          ]}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Text type="secondary">正在加载模型列表...</Text>
        </div>
      ) : availableModels.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="没有可用的模型"
          style={{ margin: '40px 0' }}
        >
          <Button
            type="primary"
            onClick={() => {
              onClose()
              onGoToModelManagement?.()
            }}
          >
            去配置模型
          </Button>
        </Empty>
      ) : filteredModels.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={searchQuery ? `没有找到包含 "${searchQuery}" 的模型` : "该分类下暂无模型"}
          style={{ margin: '40px 0' }}
        />
      ) : (
        <div style={{ 
          maxHeight: '420px', 
          overflowY: 'auto',
          paddingRight: '4px'
        }}>
          <List
            dataSource={filteredModels}
            split={false}
            renderItem={(modelOption) => {
            const providerInfo = getProviderInfo(modelOption.provider)
            const isSelected = selectedModelId === modelOption.id

            return (
              <List.Item
                style={{
                  padding: '14px 16px',
                  border: isSelected ? '2px solid #1890ff' : '1px solid #e8e8e8',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  backgroundColor: isSelected ? '#f6ffed' : '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? '0 2px 8px rgba(24, 144, 255, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}
                onClick={() => handleSelectModel(modelOption)}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = '#fafafa'
                    e.currentTarget.style.borderColor = '#d9d9d9'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.15)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = '#fff'
                    e.currentTarget.style.borderColor = '#e8e8e8'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)'
                  }
                }}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar
                      size={44}
                      style={{
                        backgroundColor: providerInfo.bgColor,
                        color: providerInfo.color,
                        border: `2px solid ${providerInfo.color}30`,
                        fontSize: '18px'
                      }}
                      icon={providerInfo.icon}
                    />
                  }
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          fontSize: '15px', 
                          fontWeight: 600,
                          color: '#262626',
                          marginBottom: '2px'
                        }}>
                          {modelOption.modelName}
                        </div>
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#8c8c8c',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <span style={{
                            display: 'inline-block',
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: providerInfo.color
                          }} />
                          {providerInfo.name}
                        </div>
                      </div>
                      {isSelected && (
                        <CheckOutlined style={{ 
                          color: '#52c41a', 
                          fontSize: '18px',
                          marginTop: '2px'
                        }} />
                      )}
                    </div>
                  }
                  description={null}
                />
              </List.Item>
            )
          }}
          />
        </div>
      )}
    </Modal>
  )
}

export default ModelSelectionModal
