import React, { useEffect, useState } from 'react'
import { Modal, List, Avatar, Typography, Tag, Space, Button, message, Divider, Empty } from 'antd'
import {
  RobotOutlined,
  ApiOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  CheckOutlined
} from '@ant-design/icons'
import { ModelConfigEntity } from '../../../shared/entities/ModelConfigEntity'

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



  // 加载可用的具体模型列表
  const loadAvailableModels = async () => {
    setLoading(true)
    try {
      if (!window.electronAPI?.langchain?.getAllConfigs) {
        message.error('模型配置API不可用')
        return
      }

      const configs = await window.electronAPI.langchain.getAllConfigs()
      const modelOptions: ModelOption[] = []

      // 为每个启用的配置获取其启用的模型列表
      for (const configData of configs.filter((c: any) => c.isEnabled)) {
        const config = new ModelConfigEntity(configData)

        // 如果配置有启用的模型列表，使用启用的模型
        if (config.enabledModels && config.enabledModels.length > 0) {
          config.enabledModels.forEach(modelName => {
            modelOptions.push({
              id: `${config.id}-${modelName}`,
              configId: config.id,
              configName: config.name,
              provider: config.provider,
              modelName: modelName,
              status: config.status,
              config: config
            })
          })
        } else {
          // 如果没有启用的模型列表，使用默认模型
          modelOptions.push({
            id: `${config.id}-${config.model}`,
            configId: config.id,
            configName: config.name,
            provider: config.provider,
            modelName: config.model,
            status: config.status,
            config: config
          })
        }
      }

      setAvailableModels(modelOptions)
    } catch (error) {
      message.error('加载模型列表失败')
      console.error('Load models error:', error)
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
    }
  }, [visible])

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RobotOutlined style={{ color: '#1890ff' }} />
          <span>选择AI模型</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
      style={{ top: 50 }}
    >
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">
          选择一个具体的AI模型来开始对话。模型按配置分组显示。
        </Text>
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
      ) : (
        <List
          dataSource={availableModels}
          renderItem={(modelOption) => {
            const providerInfo = getProviderInfo(modelOption.provider)
            const isSelected = selectedModelId === modelOption.id

            return (
              <List.Item
                style={{
                  padding: '16px',
                  border: isSelected ? '2px solid #1890ff' : '1px solid #f0f0f0',
                  borderRadius: '8px',
                  marginBottom: '12px',
                  backgroundColor: isSelected ? '#f6ffed' : '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onClick={() => handleSelectModel(modelOption)}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = '#fafafa'
                    e.currentTarget.style.borderColor = '#d9d9d9'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = '#fff'
                    e.currentTarget.style.borderColor = '#f0f0f0'
                  }
                }}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar
                      size={48}
                      style={{
                        backgroundColor: providerInfo.bgColor,
                        color: providerInfo.color,
                        border: `2px solid ${providerInfo.color}20`
                      }}
                      icon={providerInfo.icon}
                    />
                  }
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space direction="vertical" size={2} style={{ flex: 1 }}>
                        <Text style={{ fontSize: '16px', fontWeight: 600 }}>
                          {modelOption.modelName}
                        </Text>
                      </Space>
                      <Space>
                        {isSelected && (
                          <CheckOutlined style={{ color: '#52c41a', fontSize: '16px' }} />
                        )}
                      </Space>
                    </div>
                  }
                  description={
                    <div style={{ marginTop: '8px' }}>
                      <Text type="secondary" style={{ fontSize: '13px' }}>
                        <strong>提供商:</strong> {providerInfo.name}
                      </Text>
                    </div>
                  }
                />
              </List.Item>
            )
          }}
        />
      )}
    </Modal>
  )
}

export default ModelSelectionModal
