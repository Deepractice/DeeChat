/**
 * ModelFilter - 模型筛选组件
 *
 * 职责:
 * 1. 渲染筛选标签
 * 2. 渲染搜索框
 * 3. 处理筛选和搜索事件
 */

import React from 'react'
import { Input, Tag } from 'antd'

const { Search } = Input

interface ModelFilterProps {
  totalCount: number
  activeFilter: string
  searchText: string
  onFilterChange: (filter: string) => void
  onSearchChange: (text: string) => void
}

const ModelFilter: React.FC<ModelFilterProps> = ({
  totalCount,
  activeFilter,
  searchText,
  onFilterChange,
  onSearchChange
}) => {
  const filters = [
    { key: 'all', label: `全部 (${totalCount})`, emoji: '' },
    { key: 'recommended', label: '推荐', emoji: '🚀' },
    { key: 'chat', label: '对话', emoji: '💬' },
    { key: 'coding', label: '编程', emoji: '💻' },
    { key: 'reasoning', label: '推理', emoji: '🧠' },
    { key: 'vision', label: '视觉', emoji: '👁️' }
  ]

  return (
    <div
      style={{
        padding: '16px 24px',
        background: '#f9fafb',
        borderBottom: '1px solid #e5e7eb'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}
      >
        {/* 筛选标签 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', flex: 1 }}>
          {filters.map((filter) => (
            <Tag.CheckableTag
              key={filter.key}
              checked={activeFilter === filter.key}
              onChange={() => onFilterChange(filter.key)}
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
            onChange={(e) => onSearchChange(e.target.value)}
            style={{ width: 200 }}
            size="small"
          />
        </div>
      </div>
    </div>
  )
}

export default ModelFilter