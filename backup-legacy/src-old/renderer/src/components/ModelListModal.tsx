import React, { useState, useEffect } from 'react'
import { Modal, List, Button, Switch, message, Space, Typography, Tag, Input, Divider, Spin, Skeleton, Tooltip } from 'antd'
import { PlusOutlined, DeleteOutlined, RobotOutlined, LoadingOutlined, ReloadOutlined, InfoCircleOutlined } from '@ant-design/icons'

const { Text, Title } = Typography
const { Search } = Input

interface ModelItem {
  name: string
  enabled: boolean
  isDefault?: boolean
}

interface ModelListModalProps {
  visible: boolean
  onClose: () => void
  providerName: string
  providerType: string
  availableModels: string[]
  enabledModels: string[]
  loading?: boolean
  onSaveModels: (models: ModelItem[]) => void
  onRefreshModels?: () => void  // 新增刷新回调
}

const ModelListModal: React.FC<ModelListModalProps> = ({
  visible,
  onClose,
  providerName,
  providerType,
  availableModels,
  enabledModels,
  loading = false,
  onSaveModels,
  onRefreshModels
}) => {
  const [models, setModels] = useState<ModelItem[]>([])
  const [searchText, setSearchText] = useState('')
  const [customModel, setCustomModel] = useState('')
  const [showAddCustomModal, setShowAddCustomModal] = useState(false)

  // 初始化模型列表
  useEffect(() => {
    if (visible && availableModels.length > 0) {
      const modelItems: ModelItem[] = availableModels.map((modelName, index) => ({
        name: modelName,
        enabled: enabledModels.includes(modelName) || (enabledModels.length === 0 && index === 0), // 使用已启用列表或默认启用第一个
        isDefault: index === 0
      }))

      // 添加已启用但不在可用列表中的模型（自定义模型）
      enabledModels.forEach(enabledModel => {
        if (!availableModels.includes(enabledModel)) {
          modelItems.push({
            name: enabledModel,
            enabled: true,
            isDefault: false
          })
        }
      })

      setModels(modelItems)
    }
  }, [visible, availableModels, enabledModels])

  // 过滤模型列表
  const filteredModels = models.filter(model =>
    model.name.toLowerCase().includes(searchText.toLowerCase())
  )

  // 切换模型启用状态
  const toggleModelEnabled = (modelName: string) => {
    setModels(prev => prev.map(model =>
      model.name === modelName
        ? { ...model, enabled: !model.enabled }
        : model
    ))
  }

  // 添加自定义模型
  const addCustomModel = () => {
    if (!customModel.trim()) {
      message.warning('请输入模型名称')
      return
    }

    if (models.some(m => m.name === customModel.trim())) {
      message.warning('模型已存在')
      return
    }

    const newModel: ModelItem = {
      name: customModel.trim(),
      enabled: true,
      isDefault: false
    }

    setModels(prev => [...prev, newModel])
    setCustomModel('')
    message.success('自定义模型添加成功')
  }

  // 删除模型
  const removeModel = (modelName: string) => {
    const model = models.find(m => m.name === modelName)
    if (model?.isDefault) {
      message.warning('不能删除默认模型')
      return
    }

    setModels(prev => prev.filter(m => m.name !== modelName))
    message.success('模型删除成功')
  }

  // 保存模型配置
  const handleSave = () => {
    const enabledModels = models.filter(m => m.enabled)
    if (enabledModels.length === 0) {
      message.warning('至少需要启用一个模型')
      return
    }

    onSaveModels(models)
    message.success(`已保存 ${enabledModels.length} 个启用的模型`)
    onClose()
  }

  // 获取提供商图标
  const getProviderIcon = (provider: string) => {
    const iconMap = {
      openai: { icon: <RobotOutlined />, color: '#10a37f' },
      claude: { icon: <RobotOutlined />, color: '#ff6b35' },
      gemini: { icon: <RobotOutlined />, color: '#4285f4' },
      grok: { icon: <RobotOutlined />, color: '#1d4ed8' },
      custom: { icon: <RobotOutlined />, color: '#6b7280' }
    }
    return iconMap[provider as keyof typeof iconMap] || iconMap.custom
  }

  const providerInfo = getProviderIcon(providerType)
  const enabledCount = models.filter(m => m.enabled).length

  return (
    <Modal
      title={
        <Space>
          <span style={{ color: providerInfo.color }}>{providerInfo.icon}</span>
          <span>管理模型 - {providerName}</span>
          <Tag color={providerInfo.color}>{providerType}</Tag>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      closable={true}
      width={800}
      style={{ top: 50 }}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="save" type="primary" onClick={handleSave}>
          保存配置 ({enabledCount} 个启用)
        </Button>
      ]}
    >
      {/* 工具栏 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 0',
        borderBottom: '1px solid #f0f0f0',
        marginBottom: '16px'
      }}>
        {onRefreshModels && (
          <Tooltip title="刷新模型列表">
            <Button
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={onRefreshModels}
              size="small"
            >
              刷新模型列表
            </Button>
          </Tooltip>
        )}

        <Button
          icon={<PlusOutlined />}
          onClick={() => setShowAddCustomModal(true)}
          size="small"
        >
          添加自定义模型
        </Button>

        {!loading && (
          <Text type="warning" style={{ fontSize: '12px', marginLeft: 'auto' }}>
            ⚠️ 标记为"付费模型"的需要付费API配额，免费配额无法使用
          </Text>
        )}
      </div>

      {/* 模型列表 */}
      <div style={{
        border: '1px solid #f0f0f0',
        borderRadius: '8px',
        backgroundColor: '#fafafa'
      }}>
        {/* 列表内搜索框 */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
          <Search
            placeholder="搜索模型..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            size="small"
          />
        </div>

        {/* 模型列表内容 */}
        <div style={{ maxHeight: 350, overflowY: 'auto' }}>
          {loading ? (
            // 加载状态显示骨架屏
            <div>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
                  <Skeleton.Input active size="small" style={{ width: 200, marginBottom: 8 }} />
                  <Skeleton.Input active size="small" style={{ width: 150 }} />
                </div>
              ))}
            </div>
          ) : (
            <List
              dataSource={filteredModels}
              renderItem={(model) => (
              <List.Item
                actions={[
                  <Switch
                    key="switch"
                    checked={model.enabled}
                    onChange={() => toggleModelEnabled(model.name)}
                    size="small"
                  />,
                  !model.isDefault && (
                    <div key="delete-wrapper" style={{ marginLeft: 16 }}>
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => removeModel(model.name)}
                        title="删除模型"
                      />
                    </div>
                  )
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  avatar={
                    <span style={{ color: model.enabled ? providerInfo.color : '#d9d9d9' }}>
                      {providerInfo.icon}
                    </span>
                  }
                  title={
                    <Space>
                      <span style={{
                        color: model.enabled ? '#000' : '#999',
                        fontWeight: model.isDefault ? 'bold' : 'normal'
                      }}>
                        {model.name}
                      </span>
                      {model.isDefault && <Tag size="small" color="blue">默认</Tag>}
                      {model.enabled && <Tag size="small" color="green">启用</Tag>}
                    </Space>
                  }
                  description={
                    <div>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {model.isDefault ? '提供商默认模型' : '可选模型'}
                        {(model.name.includes('2.5-pro') && (model.name.includes('preview') || model.name.includes('exp'))) && (
                          <span style={{ color: '#ff4d4f', marginLeft: '8px' }}>
                            • 需要付费配额
                          </span>
                        )}
                      </Text>
                      {/* 显示模型特性标签 */}
                      <div style={{ marginTop: '4px' }}>
                        {model.name.includes('2.5') && (
                          <Tag size="small" color="purple">2.5版本</Tag>
                        )}
                        {model.name.includes('2.0') && (
                          <Tag size="small" color="blue">2.0版本</Tag>
                        )}
                        {model.name.includes('pro') && (
                          <Tag size="small" color="gold">Pro</Tag>
                        )}
                        {model.name.includes('flash') && (
                          <Tag size="small" color="green">Flash</Tag>
                        )}
                        {model.name.includes('thinking') && (
                          <Tag size="small" color="cyan">思维链</Tag>
                        )}
                        {model.name.includes('exp') && (
                          <Tag size="small" color="orange">实验版</Tag>
                        )}
                        {model.name.includes('preview') && (
                          <Tag size="small" color="magenta">预览版</Tag>
                        )}
                        {(model.name.includes('2.5-pro') && (model.name.includes('preview') || model.name.includes('exp'))) && (
                          <Tooltip title="此模型需要付费API配额，免费配额无法使用">
                            <Tag size="small" color="red">付费模型</Tag>
                          </Tooltip>
                        )}
                        {model.name.includes('2.5-pro') && model.name.includes('preview') && (
                          <Tag size="small" color="red">付费</Tag>
                        )}
                      </div>
                    </div>
                  }
                />
              </List.Item>
            )}
            locale={{ emptyText: '没有找到匹配的模型' }}
          />
          )}
        </div>
      </div>

      {filteredModels.length === 0 && searchText && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
          <Text type="secondary">没有找到包含 "{searchText}" 的模型</Text>
        </div>
      )}

      {/* 添加自定义模型弹窗 */}
      <Modal
        title="添加自定义模型"
        open={showAddCustomModal}
        onCancel={() => {
          setShowAddCustomModal(false)
          setCustomModel('')
        }}
        onOk={() => {
          addCustomModel()
          setShowAddCustomModal(false)
        }}
        okText="添加"
        cancelText="取消"
        width={400}
      >
        <div style={{ padding: '20px 0' }}>
          <Input
            placeholder="请输入自定义模型名称..."
            value={customModel}
            onChange={(e) => setCustomModel(e.target.value)}
            onPressEnter={() => {
              addCustomModel()
              setShowAddCustomModal(false)
            }}
            autoFocus
          />
          <Text type="secondary" style={{ fontSize: '12px', marginTop: '8px', display: 'block' }}>
            例如：gpt-4-turbo、claude-3-opus 等
          </Text>
        </div>
      </Modal>
    </Modal>
  )
}

export default ModelListModal
