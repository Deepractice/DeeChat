import React, { useEffect, useState } from 'react'
import { Button, Tag, message, Space, Typography, Avatar } from 'antd'
import { RobotOutlined, ApiOutlined, SettingOutlined, CheckCircleOutlined, ExclamationCircleOutlined, ThunderboltOutlined, DownOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import { ModelConfigEntity } from '../../../shared/entities/ModelConfigEntity'
import ModelSelectionModal from './ModelSelectionModal'

const { Text } = Typography

// 简化的模型选项（直接使用ModelConfigEntity）
interface ModelOption {
  id: string                    // 配置ID
  name: string                 // 配置名称
  provider: string             // 提供商类型
  model: string                // 模型名称
  status: string               // 状态
  isEnabled: boolean           // 是否启用
  enabledModels?: string[]     // 启用的模型列表
  config: ModelConfigEntity    // 完整配置
}

interface ModelSelectorProps {
  value?: string
  selectedConfig?: ModelConfigEntity  // 🔥 新增：直接接收完整配置
  onChange?: (modelId: string, config: ModelConfigEntity, modelName?: string) => void
  disabled?: boolean
  style?: React.CSSProperties
  onGoToModelManagement?: () => void  // 新增：跳转到模型管理的回调
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  value,
  selectedConfig,  // 🔥 新增：接收完整配置
  onChange,
  disabled = false,
  style,
  onGoToModelManagement
}) => {
  const [currentConfig, setCurrentConfig] = useState<ModelConfigEntity | null>(null)
  const [currentModelName, setCurrentModelName] = useState<string>('')  // 🔥 新增：当前模型名称
  const [modalVisible, setModalVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [configCheckInterval, setConfigCheckInterval] = useState<NodeJS.Timeout | null>(null)

  // 🔥 重构：简化配置加载逻辑，优先使用传入的selectedConfig
  const loadSelectedConfig = async () => {
    // console.log('🔍 [ModelSelector] loadSelectedConfig 被调用:', {
    //   value,
    //   传入的selectedConfig: selectedConfig?.id,
    //   当前currentConfig: currentConfig?.id
    // })

    if (!value) {
//       console.log('🚫 [ModelSelector] value为空，清空 currentConfig')
      setCurrentConfig(null)
      setCurrentModelName('')
      return
    }

    // 新方案：value 直接就是模型ID
    setCurrentModelName(value)

    // 🔥 优先使用传入的完整配置
    if (selectedConfig && value) {
//       console.log('✅ [ModelSelector] 使用传入的完整配置:', selectedConfig.id)
      setCurrentConfig(selectedConfig)
      return
    }

    // 🔥 降级：如果没有传入完整配置，则查找配置（保持向后兼容）
//     console.log('🔍 [ModelSelector] 降级查找配置:', value)
    setLoading(true)
    try {
      if (!window.electronAPI?.model?.getAll) {
//         console.log('⚠️ [ModelSelector] electronAPI 不可用')
        return
      }

      const response = await window.electronAPI.model.getAll()
      const configs = response?.data || []
//       console.log('🔍 [ModelSelector] 获取到配置列表:', configs.length, '个')

      // 新方案：直接使用默认配置，不需要查找
      // 因为 value 现在就是纯模型ID，比如 "gpt-4o-mini"
      const configData = null
//       console.log('🔍 [ModelSelector] 查找配置结果:', configData ? '找到' : '未找到', configId)

      if (configData) {
        const config = new ModelConfigEntity(configData)
//         console.log('✅ [ModelSelector] 设置 currentConfig:', config.id)
        setCurrentConfig(config)
      } else {
//         console.log('❌ [ModelSelector] 未找到配置，清空 currentConfig')
        setCurrentConfig(null)
      }
    } catch (error) {
      console.error('❌ [ModelSelector] Load selected config error:', error)
      setCurrentConfig(null)
    } finally {
      setLoading(false)
    }
  }

  // 获取提供商图标和颜色
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

  // 获取状态信息
  const getStatusInfo = (status: string) => {
    const statusMap = {
      available: {
        icon: <CheckCircleOutlined />,
        color: '#52c41a',
        text: '可用',
        tagColor: 'success'
      },
      error: {
        icon: <ExclamationCircleOutlined />,
        color: '#ff4d4f',
        text: '错误',
        tagColor: 'error'
      },
      testing: {
        icon: <ExclamationCircleOutlined />,
        color: '#faad14',
        text: '测试中',
        tagColor: 'processing'
      },
      untested: {
        icon: <CheckCircleOutlined />,
        color: '#52c41a',
        text: '就绪',
        tagColor: 'success'
      }
    }
    return statusMap[status as keyof typeof statusMap] || statusMap.untested
  }

  // 处理模型选择
  const handleModelSelect = (modelId: string, config: ModelConfigEntity, modelName: string) => {
    // console.log('🎯 [ModelSelector] handleModelSelect 被调用:', {
    //   modelId,
    //   configId: config.id,
    //   modelName,
    //   当前currentConfig: currentConfig?.id,
    //   当前value: value
    // })

//     console.log('🎯 [ModelSelector] 设置 currentConfig:', config.id)
    setCurrentConfig(config)

//     console.log('🎯 [ModelSelector] 关闭弹窗')
    setModalVisible(false)

    if (onChange) {
//       console.log('🎯 [ModelSelector] 调用 onChange 回调:', modelId)
      onChange(modelId, config, modelName)
    } else {
//       console.log('⚠️ [ModelSelector] onChange 回调不存在')
    }
  }

  // 打开模型选择弹窗
  const handleOpenModal = () => {
    if (!disabled) {
      setModalVisible(true)
    }
  }

  // 🔥 修复：更温和的配置状态检查，添加防抖和状态缓存
  const checkConfigAvailability = async () => {
    if (!value || !currentConfig) return

    try {
      const response = await window.electronAPI.model.getAll()
      const configs = response?.data || []
      const parts = value.split('-')
      const configId = parts.length >= 6 ? parts.slice(0, 5).join('-') : value

      const latestConfig = configs.find((c: any) => c.id === configId)

      // 🔥 只在开发模式下输出详细日志，减少生产环境的控制台噪音
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 [ModelSelector] 配置状态检查:', {
          configId,
          找到配置: !!latestConfig,
          配置启用状态: latestConfig?.isEnabled,
          配置名称: latestConfig?.name
        })
      }

      // 🔥 修复：更严格的检查条件，避免误判，并添加状态缓存
      if (!latestConfig) {
        console.warn('⚠️ [ModelSelector] 配置已被删除，自动清理选择:', currentConfig.name)
        setCurrentConfig(null)
        setCurrentModelName('')

        // 通知父组件清空选择
        if (onChange) {
          onChange('', currentConfig, '')
        }
      } else if (latestConfig.isEnabled === false) {
        // 只有明确设置为false时才清理，避免undefined导致的误判
        console.warn('⚠️ [ModelSelector] 配置已被禁用，自动清理选择:', currentConfig.name)
        setCurrentConfig(null)
        setCurrentModelName('')

        // 通知父组件清空选择
        if (onChange) {
          onChange('', currentConfig, '')
        }
      }
    } catch (error) {
      console.error('❌ [ModelSelector] 检查配置可用性失败:', error)
    }
  }

  // 🔥 启动配置状态监听 - 修复频繁触发问题
  useEffect(() => {
    // 清理之前的定时器
    if (configCheckInterval) {
      clearInterval(configCheckInterval)
      setConfigCheckInterval(null)
    }

    if (value && currentConfig) {
      // 🔥 修复：减少检查频率，每60秒检查一次配置状态，避免频繁触发
      const interval = setInterval(checkConfigAvailability, 60000)
      setConfigCheckInterval(interval)

      return () => {
        if (interval) {
          clearInterval(interval)
        }
      }
    }
  }, [value])  // 🔥 修复：只依赖value，避免currentConfig变化导致的循环触发

  useEffect(() => {
    // console.log('🎯 [ModelSelector] useEffect: props变化触发:', {
    //   新value: value,
    //   传入selectedConfig: selectedConfig?.id,
    //   即将调用: 'loadSelectedConfig'
    // })
    loadSelectedConfig()
  }, [value, selectedConfig])  // 🔥 添加selectedConfig依赖

  // 🔥 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (configCheckInterval) {
        clearInterval(configCheckInterval)
      }
    }
  }, [])

  // 🔥 新增：实时调试状态
  useEffect(() => {
    // console.log('🎯 [ModelSelector] 状态更新:', {
    //   value,
    //   hasCurrentConfig: !!currentConfig,
    //   currentConfigId: currentConfig?.id,
    //   currentConfigName: currentConfig?.name,
    //   传入selectedConfig: selectedConfig?.id,
    //   loading,
    //   渲染状态: currentConfig ? '显示配置' : '显示选择按钮'
    // })
  }, [value, currentConfig, selectedConfig, loading])



  // 简化渲染逻辑：如果没有选中模型，显示选择按钮
  if (!value || !currentModelName) {
    return (
      <>
        <Button
          onClick={handleOpenModal}
          disabled={disabled}
          size="small"
          style={{
            minWidth: 160,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            ...style
          }}
        >
          <Space>
            <RobotOutlined />
            <Text>选择AI模型</Text>
            <DownOutlined style={{ fontSize: '12px' }} />
          </Space>
        </Button>

        <ModelSelectionModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          selectedModelId={value}
          onSelectModel={handleModelSelect}
          onGoToModelManagement={onGoToModelManagement}
        />
      </>
    )
  }

  // 根据模型名称推断提供商
  const getProviderFromModelName = (modelName: string) => {
    const name = modelName.toLowerCase()
    if (name.includes('gpt') || name.includes('o1') || name.includes('o3')) return 'openai'
    if (name.includes('claude')) return 'claude'
    if (name.includes('gemini')) return 'gemini'
    if (name.includes('grok')) return 'grok'
    return 'custom'
  }
  
  const provider = getProviderFromModelName(currentModelName)
  const providerInfo = getProviderInfo(provider)

  return (
    <>
      <Button
        onClick={handleOpenModal}
        disabled={disabled}
        loading={loading}
        size="small"
        style={{
          minWidth: 180,
          maxWidth: 220,
          height: 32,
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 12,
          ...style
        }}
      >
        <Space size={6}>
          <Avatar
            size={20}
            style={{
              backgroundColor: providerInfo.bgColor,
              color: providerInfo.color,
              border: `1px solid ${providerInfo.color}20`
            }}
            icon={providerInfo.icon}
          />
          <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
            <div 
              style={{ 
                fontSize: '12px', 
                fontWeight: 500, 
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '140px'
              }}
              title={currentModelName}
            >
              {currentModelName}
            </div>
            <div style={{ fontSize: '10px', color: '#999', lineHeight: 1.2 }}>
              {providerInfo.name} · ChatAnywhere
            </div>
          </div>
        </Space>
        <Space size={4}>
          <DownOutlined style={{ fontSize: '12px', color: '#999' }} />
        </Space>
      </Button>

      <ModelSelectionModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        selectedModelId={value}
        onSelectModel={handleModelSelect}
        onGoToModelManagement={onGoToModelManagement}
      />
    </>
  )
}

export default ModelSelector
