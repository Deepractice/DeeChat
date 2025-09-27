import React, { useState, useMemo } from 'react'
import { 
  Modal, 
  Input,
  Button, 
  Tag, 
  Empty
} from 'antd'
import { 
  RobotOutlined, 
  CheckOutlined,
  CloseOutlined
} from '@ant-design/icons'

const { Search } = Input

// 增强的模型信息接口
interface EnhancedModelInfo {
  id: string
  name: string
  category: string
  description: string
  context_length: number
  capabilities: {
    vision: boolean
    function_calling: boolean
    audio: boolean
    max_tokens: number
  }
  pricing: {
    input: number
    output: number
    image?: number
  }
  provider: string
  created: number
  metadata?: {
    source: string
    api_format: string
    original_data: any
  }
}

interface ModelSelectorModalProps {
  visible: boolean
  onCancel: () => void
  onSelect: (model: string) => void
  models: EnhancedModelInfo[]
  selectedModel: string
  loading?: boolean
}


const ModelSelectorModal: React.FC<ModelSelectorModalProps> = ({
  visible,
  onCancel,
  onSelect,
  models,
  selectedModel,
  loading = false
}) => {
  const [searchText, setSearchText] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  
  // 过滤和排序逻辑
  const getModelTags = (model: EnhancedModelInfo): string[] => {
    const tags: string[] = []
    if (model.capabilities.vision) tags.push('vision')
    if (model.capabilities.function_calling) tags.push('coding')
    if (model.capabilities.audio) tags.push('audio')
    if (model.id.includes('thinking') || model.description.includes('reasoning')) tags.push('reasoning')
    if (model.description.includes('chat') || model.description.includes('conversation')) tags.push('chat')
    return tags
  }

  const getModelIcon = (model: EnhancedModelInfo) => {
    const name = model.name.toLowerCase()
    if (name.includes('qwen')) return { icon: '🧠', gradient: 'from-blue-500 to-purple-600' }
    if (name.includes('claude')) return { icon: '📚', gradient: 'from-indigo-500 to-blue-600' }
    if (name.includes('gpt')) return { icon: '🤖', gradient: 'from-green-500 to-teal-600' }
    return { icon: '⚡', gradient: 'from-gray-500 to-gray-600' }
  }

  const getSpeedLabel = (model: EnhancedModelInfo) => {
    if (model.context_length > 1000000) return '较慢'
    if (model.context_length > 100000) return '中等'
    return '快速'
  }

  // 模型过滤逻辑
  const filteredModels = useMemo(() => {
    let modelList = Array.isArray(models) ? models : []
    
    // 搜索过滤
    if (searchText) {
      modelList = modelList.filter(model => 
        model.id.toLowerCase().includes(searchText.toLowerCase()) ||
        model.name.toLowerCase().includes(searchText.toLowerCase()) ||
        model.description.toLowerCase().includes(searchText.toLowerCase())
      )
    }
    
    // 标签过滤
    if (activeFilter !== 'all') {
      modelList = modelList.filter(model => {
        const tags = getModelTags(model)
        return tags.includes(activeFilter)
      })
    }
    
    return modelList
  }, [models, searchText, activeFilter, getModelTags])

  const handleModelSelect = (modelId: string) => {
    onSelect(modelId)
    onCancel()
  }


  return (
    <Modal
      title={null}
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={1000}
      closable={false}
      styles={{
        body: { padding: 0, maxHeight: '80vh', overflowY: 'hidden', overflowX: 'hidden' }
      }}
      className="model-selector-modal"
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '80vh' }}>
        {/* 头部 */}
        <div style={{
          background: '#3b82f6',
          color: 'white',
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <RobotOutlined style={{ fontSize: '24px' }} />
            <span style={{ fontSize: '20px', fontWeight: 600 }}>选择AI模型</span>
          </div>
          <Button 
            type="text" 
            icon={<CloseOutlined />} 
            onClick={onCancel}
            style={{ 
              color: 'white', 
              border: 'none',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '8px'
            }}
          />
        </div>
        {/* 筛选区域 */}
        <div style={{ 
          padding: '16px 24px', 
          background: '#f9fafb', 
          borderBottom: '1px solid #e5e7eb'
        }}>          
          {/* 快速筛选标签和排序 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            {/* 筛选标签 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', flex: 1 }}>
              {[
                { key: 'all', label: `全部 (${models?.length || 0})`, emoji: '' },
                { key: 'recommended', label: '推荐', emoji: '🚀' },
                { key: 'chat', label: '对话', emoji: '💬' },
                { key: 'coding', label: '编程', emoji: '💻' },
                { key: 'reasoning', label: '推理', emoji: '🧠' },
                { key: 'vision', label: '视觉', emoji: '👁️' },
              ].map(filter => (
                <Tag.CheckableTag
                  key={filter.key}
                  checked={activeFilter === filter.key}
                  onChange={() => setActiveFilter(filter.key)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: 500,
                    border: '1px solid #d1d5db',
                    background: activeFilter === filter.key ? '#3b82f6' : '#ffffff',
                    color: activeFilter === filter.key ? '#ffffff' : '#374151',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {filter.emoji && <span style={{ marginRight: '4px' }}>{filter.emoji}</span>}
                  {filter.label}
                </Tag.CheckableTag>
              ))}
            </div>
            
            {/* 搜索框 */}
            <div style={{ flexShrink: 0 }}>
              <Search
                placeholder="搜索模型..."
                allowClear
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 200 }}
                size="small"
              />
            </div>
          </div>
        </div>

        {/* 模型列表区域 */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
              <div style={{ fontSize: '16px', marginBottom: '8px' }}>⏳</div>
              <div>加载模型列表中...</div>
            </div>
          ) : filteredModels.length === 0 ? (
            <Empty
              description={searchText ? `没有找到包含 "${searchText}" 的模型` : "暂无可用模型"}
              style={{ padding: '60px 0' }}
            />
          ) : (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
              gap: '16px',
              width: '100%'
            }}>
              {filteredModels.map(model => {
                const modelIcon = getModelIcon(model)
                const tags = getModelTags(model)
                const speedLabel = getSpeedLabel(model)
                const isSelected = model.id === selectedModel
                
                return (
                  <div
                    key={model.id}
                    onClick={() => handleModelSelect(model.id)}
                    style={{
                      background: isSelected ? '#e3f2fd' : '#ffffff',
                      border: isSelected ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? '0 4px 12px rgba(59, 130, 246, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
                      display: 'flex',
                      flexDirection: 'column',
                      minHeight: '160px'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.transform = 'translateY(-2px)'
                        e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.1)'
                        e.currentTarget.style.borderColor = '#3b82f6'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.transform = 'translateY(0px)'
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)'
                        e.currentTarget.style.borderColor = '#e5e7eb'
                      }
                    }}
                  >
                    {/* 头部：图标和选中状态 */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        background: '#f5f5f5',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        border: '1px solid #e0e0e0'
                      }}>
                        {modelIcon.icon}
                      </div>
                      {isSelected && (
                        <CheckOutlined style={{ color: '#3b82f6', fontSize: '16px' }} />
                      )}
                    </div>
                    
                    {/* 模型名称 */}
                    <h3 style={{ 
                      margin: '0 0 8px 0', 
                      fontSize: '15px', 
                      fontWeight: 600, 
                      color: '#111827',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      lineHeight: '1.2'
                    }}>
                      {model.name}
                    </h3>
                    
                    {/* 标签 */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                      {/* 推荐标签 */}
                      {model.id.includes('thinking') && (
                        <span style={{
                          padding: '2px 6px',
                          background: '#dbeafe',
                          color: '#1d4ed8',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 500
                        }}>
                          🚀 推荐
                        </span>
                      )}
                      
                      {/* 功能标签 */}
                      {tags.includes('reasoning') && (
                        <span style={{
                          padding: '2px 6px',
                          background: '#dcfce7',
                          color: '#15803d',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 500
                        }}>
                          🧠 推理
                        </span>
                      )}
                      
                      {tags.includes('chat') && (
                        <span style={{
                          padding: '2px 6px',
                          background: '#f3e8ff',
                          color: '#7c2d12',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 500
                        }}>
                          💬 对话
                        </span>
                      )}
                      
                      {tags.includes('coding') && (
                        <span style={{
                          padding: '2px 6px',
                          background: '#fed7aa',
                          color: '#c2410c',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 500
                        }}>
                          💻 编程
                        </span>
                      )}
                    </div>
                    
                    {/* 描述 */}
                    <p style={{
                      margin: '0 0 auto 0',
                      fontSize: '12px',
                      color: '#6b7280',
                      lineHeight: '1.3',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {model.description}
                    </p>
                    
                    {/* 底部信息 */}
                    <div style={{ 
                      marginTop: '8px',
                      paddingTop: '6px',
                      borderTop: '1px solid #f0f0f0'
                    }}>
                      {/* 提供商 */}
                      <div style={{ marginBottom: '6px' }}>
                        <span style={{
                          padding: '2px 6px',
                          background: '#f1f5f9',
                          color: '#475569',
                          borderRadius: '4px',
                          fontSize: '10px'
                        }}>
                          {model.provider}
                        </span>
                      </div>
                      
                      {/* 性能指标 */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af' }}>
                        <span>⚡ {(model.context_length / 1000).toFixed(0)}K</span>
                        <span>🕐 {speedLabel}</span>
                        {model.capabilities.vision && <span>👁️</span>}
                        {model.capabilities.audio && <span>🔊</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        
        {/* 底部操作区域 */}
        <div style={{
          padding: '16px 24px',
          background: '#f9fafb',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>
            {selectedModel && (
              <span>
                已选择: <strong style={{ color: '#111827' }}>
                  {models?.find(m => m.id === selectedModel)?.name || selectedModel}
                </strong>
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button onClick={onCancel}>
              取消
            </Button>
            <Button 
              type="primary" 
              disabled={!selectedModel}
              onClick={() => selectedModel && handleModelSelect(selectedModel)}
            >
              确认选择
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// 添加样式
const style = document.createElement('style')
style.textContent = `
  .model-selector-modal .ant-modal-content {
    border-radius: 16px !important;
    overflow: hidden !important;
  }
  
  .model-selector-modal .ant-modal-header {
    display: none !important;
  }
`
document.head.appendChild(style)

export default ModelSelectorModal