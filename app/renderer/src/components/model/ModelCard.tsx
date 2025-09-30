/**
 * ModelCard - 模型卡片组件
 *
 * 职责:
 * 1. 渲染单个模型的卡片UI
 * 2. 显示模型信息、标签、性能指标
 * 3. 处理悬停和选中状态
 */

import React from 'react'
import { CheckOutlined } from '@ant-design/icons'
import type { EnhancedModelInfo } from '../../hooks/useModelSelector'

interface ModelCardProps {
  model: EnhancedModelInfo
  isSelected: boolean
  onSelect: (modelId: string) => void
  modelIcon: { icon: string; gradient: string }
  tags: string[]
  speedLabel: string
}

const ModelCard: React.FC<ModelCardProps> = ({
  model,
  isSelected,
  onSelect,
  modelIcon,
  tags,
  speedLabel
}) => {
  return (
    <div
      onClick={() => onSelect(model.id)}
      style={{
        background: isSelected ? '#e3f2fd' : '#ffffff',
        border: isSelected ? '2px solid #3b82f6' : '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '14px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: isSelected
          ? '0 4px 12px rgba(59, 130, 246, 0.15)'
          : '0 1px 3px rgba(0, 0, 0, 0.1)',
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px'
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            background: '#f5f5f5',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            border: '1px solid #e0e0e0'
          }}
        >
          {modelIcon.icon}
        </div>
        {isSelected && <CheckOutlined style={{ color: '#3b82f6', fontSize: '16px' }} />}
      </div>

      {/* 模型名称 */}
      <h3
        style={{
          margin: '0 0 8px 0',
          fontSize: '15px',
          fontWeight: 600,
          color: '#111827',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: '1.2'
        }}
      >
        {model.name}
      </h3>

      {/* 标签 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
        {/* 推荐标签 */}
        {model.id.includes('thinking') && (
          <span
            style={{
              padding: '2px 6px',
              background: '#dbeafe',
              color: '#1d4ed8',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 500
            }}
          >
            🚀 推荐
          </span>
        )}

        {/* 功能标签 */}
        {tags.includes('reasoning') && (
          <span
            style={{
              padding: '2px 6px',
              background: '#dcfce7',
              color: '#15803d',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 500
            }}
          >
            🧠 推理
          </span>
        )}

        {tags.includes('chat') && (
          <span
            style={{
              padding: '2px 6px',
              background: '#f3e8ff',
              color: '#7c2d12',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 500
            }}
          >
            💬 对话
          </span>
        )}

        {tags.includes('coding') && (
          <span
            style={{
              padding: '2px 6px',
              background: '#fed7aa',
              color: '#c2410c',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 500
            }}
          >
            💻 编程
          </span>
        )}
      </div>

      {/* 描述 */}
      <p
        style={{
          margin: '0 0 auto 0',
          fontSize: '12px',
          color: '#6b7280',
          lineHeight: '1.3',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}
      >
        {model.description}
      </p>

      {/* 底部信息 */}
      <div
        style={{
          marginTop: '8px',
          paddingTop: '6px',
          borderTop: '1px solid #f0f0f0'
        }}
      >
        {/* 提供商 */}
        <div style={{ marginBottom: '6px' }}>
          <span
            style={{
              padding: '2px 6px',
              background: '#f1f5f9',
              color: '#475569',
              borderRadius: '4px',
              fontSize: '10px'
            }}
          >
            {model.provider}
          </span>
        </div>

        {/* 性能指标 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: '#9ca3af'
          }}
        >
          <span>⚡ {(model.context_length / 1000).toFixed(0)}K</span>
          <span>🕐 {speedLabel}</span>
          {model.capabilities.vision && <span>👁️</span>}
          {model.capabilities.audio && <span>🔊</span>}
        </div>
      </div>
    </div>
  )
}

export default ModelCard