/**
 * ModelSelector 业务逻辑 Hook
 *
 * 职责:
 * 1. 管理搜索和过滤状态
 * 2. 处理模型过滤逻辑
 * 3. 提供模型元数据工具函数
 */

import { useState, useMemo } from 'react'

// 增强的模型信息接口
export interface EnhancedModelInfo {
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

interface UseModelSelectorOptions {
  models: EnhancedModelInfo[]
}

export const useModelSelector = ({ models }: UseModelSelectorOptions) => {
  // ==================== 状态管理 ====================
  const [searchText, setSearchText] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')

  // ==================== 工具函数 ====================

  /**
   * 获取模型标签
   */
  const getModelTags = (model: EnhancedModelInfo): string[] => {
    const tags: string[] = []
    if (model.capabilities.vision) tags.push('vision')
    if (model.capabilities.function_calling) tags.push('coding')
    if (model.capabilities.audio) tags.push('audio')
    if (model.id.includes('thinking') || model.description.includes('reasoning')) tags.push('reasoning')
    if (model.description.includes('chat') || model.description.includes('conversation')) tags.push('chat')
    return tags
  }

  /**
   * 获取模型图标
   */
  const getModelIcon = (model: EnhancedModelInfo) => {
    const name = model.name.toLowerCase()
    if (name.includes('qwen')) return { icon: '🧠', gradient: 'from-blue-500 to-purple-600' }
    if (name.includes('claude')) return { icon: '📚', gradient: 'from-indigo-500 to-blue-600' }
    if (name.includes('gpt')) return { icon: '🤖', gradient: 'from-green-500 to-teal-600' }
    return { icon: '⚡', gradient: 'from-gray-500 to-gray-600' }
  }

  /**
   * 获取速度标签
   */
  const getSpeedLabel = (model: EnhancedModelInfo) => {
    if (model.context_length > 1000000) return '较慢'
    if (model.context_length > 100000) return '中等'
    return '快速'
  }

  // ==================== 模型过滤 ====================

  /**
   * 过滤后的模型列表
   */
  const filteredModels = useMemo(() => {
    let modelList = Array.isArray(models) ? models : []

    // 搜索过滤
    if (searchText) {
      modelList = modelList.filter(
        (model) =>
          model.id.toLowerCase().includes(searchText.toLowerCase()) ||
          model.name.toLowerCase().includes(searchText.toLowerCase()) ||
          model.description.toLowerCase().includes(searchText.toLowerCase())
      )
    }

    // 标签过滤
    if (activeFilter !== 'all') {
      modelList = modelList.filter((model) => {
        const tags = getModelTags(model)
        return tags.includes(activeFilter)
      })
    }

    return modelList
  }, [models, searchText, activeFilter])

  // ==================== 返回接口 ====================
  return {
    // 状态
    searchText,
    activeFilter,
    filteredModels,

    // 工具函数
    getModelTags,
    getModelIcon,
    getSpeedLabel,

    // 状态更新
    setSearchText,
    setActiveFilter
  }
}