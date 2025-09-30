/**
 * ModelSelectorModal - 模型选择器对话框（重构版）
 *
 * 职责:
 * 1. 提供模型选择对话框UI容器
 * 2. 组合子组件（ModelFilter, ModelGrid）
 * 3. 使用 useModelSelector Hook
 *
 * 架构改进:
 * - 业务逻辑迁移到 useModelSelector Hook
 * - UI 拆分为可复用的子组件
 * - 代码量从 457行 减少到 ~120行
 */

import React from 'react'
import { Modal, Button } from 'antd'
import { RobotOutlined, CloseOutlined } from '@ant-design/icons'
import { useModelSelector, type EnhancedModelInfo } from '../../hooks/useModelSelector'
import ModelFilter from './ModelFilter'
import ModelGrid from './ModelGrid'

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
  // ==================== 使用业务逻辑Hook ====================
  const {
    searchText,
    activeFilter,
    filteredModels,
    getModelTags,
    getModelIcon,
    getSpeedLabel,
    setSearchText,
    setActiveFilter
  } = useModelSelector({ models })

  // ==================== 事件处理 ====================
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
        <div
          style={{
            background: '#3b82f6',
            color: 'white',
            padding: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
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
        <ModelFilter
          totalCount={models?.length || 0}
          activeFilter={activeFilter}
          searchText={searchText}
          onFilterChange={setActiveFilter}
          onSearchChange={setSearchText}
        />

        {/* 模型列表区域 */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '20px' }}>
          <ModelGrid
            models={filteredModels}
            selectedModel={selectedModel}
            loading={loading}
            searchText={searchText}
            onModelSelect={handleModelSelect}
            getModelIcon={getModelIcon}
            getModelTags={getModelTags}
            getSpeedLabel={getSpeedLabel}
          />
        </div>

        {/* 底部操作区域 */}
        <div
          style={{
            padding: '16px 24px',
            background: '#f9fafb',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ fontSize: '14px', color: '#6b7280' }}>
            {selectedModel && (
              <span>
                已选择:{' '}
                <strong style={{ color: '#111827' }}>
                  {models?.find((m) => m.id === selectedModel)?.name || selectedModel}
                </strong>
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button onClick={onCancel}>取消</Button>
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