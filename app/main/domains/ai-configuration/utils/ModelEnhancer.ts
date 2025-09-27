/**
 * 模型增强工具函数
 *
 * 职责：
 * - 模型分类和能力推断
 * - 原始API数据增强和标准化
 * - 定价信息处理
 * - 模型数据格式检测
 */

import {
  ModelCategory,
  RawModelData,
  EnhancedModelInfo,
  CategorizedModels
} from '../types/AIConfigTypes.js'

/**
 * 根据模型名称判断分类
 */
export function categorizeModel(modelId: string): ModelCategory {
  const modelLower = modelId.toLowerCase()

  // GPT系列
  if (modelLower.includes('gpt') || modelLower.includes('chatgpt') || modelLower.includes('o1')) {
    return ModelCategory.GPT_SERIES
  }

  // Claude系列
  if (modelLower.includes('claude')) {
    return ModelCategory.CLAUDE_SERIES
  }

  // 视觉模型
  if (modelLower.includes('vision') ||
      modelLower.includes('gpt-4v') ||
      modelLower.includes('claude-3') ||
      modelLower.includes('gemini-pro-vision') ||
      modelLower.includes('llava')) {
    return ModelCategory.VISION_MODELS
  }

  // 开源模型
  if (modelLower.includes('qwen') ||
      modelLower.includes('llama') ||
      modelLower.includes('mixtral') ||
      modelLower.includes('gemma') ||
      modelLower.includes('deepseek') ||
      modelLower.includes('yi') ||
      modelLower.includes('baichuan') ||
      modelLower.includes('chatglm') ||
      modelLower.includes('internlm') ||
      modelLower.includes('vicuna') ||
      modelLower.includes('alpaca')) {
    return ModelCategory.OPEN_SOURCE
  }

  return ModelCategory.OTHER
}

/**
 * 智能检测API数据格式类型
 */
export function detectApiFormat(rawModel: RawModelData): 'rich' | 'simple' | 'unknown' {
  if (rawModel.pricing && rawModel.architecture && rawModel.context_length) {
    return 'rich'  // OpenRouter类型：丰富的元数据
  }
  if (rawModel.object === 'model' && rawModel.created && !rawModel.pricing) {
    return 'simple'  // Sophnet类型：极简数据
  }
  return 'unknown'
}

/**
 * 检查模型是否支持视觉功能
 */
export function checkVisionCapability(modelId: string): boolean {
  const visionKeywords = ['vision', 'gpt-4v', 'claude-3', 'gemini-pro-vision', 'llava']
  return visionKeywords.some(keyword => modelId.toLowerCase().includes(keyword))
}

/**
 * 增强模型信息 - 统一处理各种格式的原始数据
 */
export function enhanceModelInfo(rawModel: RawModelData, provider: string): EnhancedModelInfo {
  const apiFormat = detectApiFormat(rawModel)
  const modelId = rawModel.id || 'unknown'
  const modelName = rawModel.name || modelId

  // 智能推断能力
  const visionCapability = checkVisionCapability(modelId) ||
    rawModel.architecture?.input_modalities?.includes('image') || false
  const audioCapability = rawModel.architecture?.input_modalities?.includes('audio') || false
  const functionCalling = rawModel.supported_parameters?.includes('tools') ||
    rawModel.supported_parameters?.includes('function_call') || false

  // 智能处理定价信息
  const pricing = {
    input: 0,
    output: 0,
    image: undefined as number | undefined
  }

  if (rawModel.pricing) {
    pricing.input = parseFloat(rawModel.pricing.prompt || '0') * 1000  // 转换为每1K tokens
    pricing.output = parseFloat(rawModel.pricing.completion || '0') * 1000
    if (rawModel.pricing.image && visionCapability) {
      pricing.image = parseFloat(rawModel.pricing.image) * 1000
    }
  }

  // 上下文长度推断
  const contextLength = rawModel.context_length ||
    rawModel.top_provider?.context_length ||
    4096  // 默认值

  // 生成默认描述
  const defaultDescription = rawModel.description ||
    `${modelName} - AI模型，支持文本处理${visionCapability ? '和图像理解' : ''}${audioCapability ? '和音频处理' : ''}`

  return {
    id: modelId,
    name: modelName,
    category: categorizeModel(modelId),
    description: defaultDescription,
    context_length: contextLength,
    capabilities: {
      vision: visionCapability,
      function_calling: functionCalling,
      audio: audioCapability,
      max_tokens: contextLength
    },
    pricing,
    provider,
    created: rawModel.created || Date.now(),
    metadata: {
      source: provider,
      api_format: apiFormat,
      original_data: rawModel
    }
  }
}

/**
 * 将模型列表按分类组织
 */
export function categorizeModels(models: EnhancedModelInfo[]): CategorizedModels {
  const categorized: CategorizedModels = {}

  // 初始化所有分类
  Object.values(ModelCategory).forEach(category => {
    categorized[category] = []
  })

  // 分类模型
  models.forEach(model => {
    categorized[model.category].push(model)
  })

  // 按名称排序每个分类中的模型
  Object.keys(categorized).forEach(category => {
    categorized[category].sort((a, b) => a.name.localeCompare(b.name))
  })

  return categorized
}