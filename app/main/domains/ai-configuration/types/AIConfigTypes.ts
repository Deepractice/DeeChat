/**
 * AI配置领域类型定义
 *
 * 包含：
 * - 模型分类枚举
 * - 模型数据接口
 * - API响应接口
 */

// 模型分类枚举
export enum ModelCategory {
  GPT_SERIES = 'GPT系列',
  CLAUDE_SERIES = 'Claude系列',
  OPEN_SOURCE = '开源模型',
  VISION_MODELS = '视觉模型',
  OTHER = '其他模型'
}

// 原始API返回的模型数据（任意格式）
export interface RawModelData {
  [key: string]: any
}

// 统一的模型信息接口（前端使用）
export interface EnhancedModelInfo {
  id: string                    // 模型ID
  name: string                  // 显示名称（如果没有name则使用id）
  category: ModelCategory       // 自动分类
  description: string           // 描述（如果没有则生成默认描述）
  context_length: number        // 上下文长度（默认4096）
  capabilities: {
    vision: boolean            // 是否支持视觉（基于名称推断）
    function_calling: boolean  // 是否支持函数调用（基于元数据或名称推断）
    audio: boolean             // 是否支持音频（基于名称推断）
    max_tokens: number         // 最大token数（等于context_length）
  }
  pricing: {
    input: number              // 输入价格（默认0表示未知）
    output: number             // 输出价格（默认0表示未知）
    image?: number             // 图像价格（支持视觉时显示）
  }
  provider: string              // 提供商名称
  created: number               // 创建时间（使用实际值或当前时间）
  // 元数据用于调试和扩展
  metadata?: {
    source: string             // 供应商标识，来自配置名称
    api_format: 'rich' | 'simple' | 'unknown'  // 数据格式类型
    original_data: any         // 保留原始数据以供调试
  }
}

// 分类后的模型数据结构
export interface CategorizedModels {
  [key: string]: EnhancedModelInfo[]  // 以分类名为key
}

// API响应接口 (原始格式，用于类型引用)
export interface ModelListResponse {
  success: boolean
  data: {
    models: EnhancedModelInfo[]
    categorized: CategorizedModels
    total: number
    provider: string
  } | null
  error?: string
}

// 直接返回的数据接口 (IPC会自动包装)
export interface ModelListData {
  models: EnhancedModelInfo[]
  categorized: CategorizedModels
  total: number
  provider: string
}