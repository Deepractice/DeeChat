/**
 * ModelGrid - 模型网格容器组件
 *
 * 职责:
 * 1. 渲染模型卡片网格布局
 * 2. 处理加载和空状态
 */

import React from 'react'
import { Empty } from 'antd'
import ModelCard from './ModelCard'
import type { EnhancedModelInfo } from '../../hooks/useModelSelector'

interface ModelGridProps {
  models: EnhancedModelInfo[]
  selectedModel: string
  loading: boolean
  searchText: string
  onModelSelect: (modelId: string) => void
  getModelIcon: (model: EnhancedModelInfo) => { icon: string; gradient: string }
  getModelTags: (model: EnhancedModelInfo) => string[]
  getSpeedLabel: (model: EnhancedModelInfo) => string
}

const ModelGrid: React.FC<ModelGridProps> = ({
  models,
  selectedModel,
  loading,
  searchText,
  onModelSelect,
  getModelIcon,
  getModelTags,
  getSpeedLabel
}) => {
  // 加载状态
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
        <div style={{ fontSize: '16px', marginBottom: '8px' }}>⏳</div>
        <div>加载模型列表中...</div>
      </div>
    )
  }

  // 空状态
  if (models.length === 0) {
    return (
      <Empty
        description={searchText ? `没有找到包含 "${searchText}" 的模型` : '暂无可用模型'}
        style={{ padding: '60px 0' }}
      />
    )
  }

  // 模型网格
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px',
        width: '100%'
      }}
    >
      {models.map((model) => {
        const modelIcon = getModelIcon(model)
        const tags = getModelTags(model)
        const speedLabel = getSpeedLabel(model)
        const isSelected = model.id === selectedModel

        return (
          <ModelCard
            key={model.id}
            model={model}
            isSelected={isSelected}
            onSelect={onModelSelect}
            modelIcon={modelIcon}
            tags={tags}
            speedLabel={speedLabel}
          />
        )
      })}
    </div>
  )
}

export default ModelGrid