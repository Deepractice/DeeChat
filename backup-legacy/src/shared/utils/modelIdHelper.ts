/**
 * 模型 ID 辅助函数
 * 统一处理模型 ID 的解析和生成
 */

export interface ModelSelection {
  configId: string
  modelName: string
}

/**
 * 解析模型 ID
 * 支持多种格式：
 * - UUID-modelName
 * - default-config-modelName
 * - 纯配置ID
 */
export function parseModelId(modelId: string): ModelSelection {
  if (!modelId) {
    throw new Error('Model ID is required')
  }

  // UUID 格式：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx-modelName
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  const uuidMatch = modelId.match(uuidPattern)

  if (uuidMatch) {
    const uuid = uuidMatch[0]
    const remaining = modelId.substring(uuid.length)
    
    if (remaining.startsWith('-')) {
      return {
        configId: uuid,
        modelName: remaining.substring(1)
      }
    } else {
      // 纯 UUID，没有模型名称
      return {
        configId: uuid,
        modelName: ''
      }
    }
  }

  // default-config 格式
  if (modelId.startsWith('default-config')) {
    if (modelId === 'default-config') {
      return {
        configId: 'default-config',
        modelName: ''
      }
    }
    
    // 对于 default-config-xxx 格式，xxx 是模型名称
    const prefix = 'default-config-'
    if (modelId.startsWith(prefix)) {
      return {
        configId: 'default-config',
        modelName: modelId.substring(prefix.length)
      }
    }
  }

  // 其他格式，尝试找到最后一个合理的分隔点
  const lastDashIndex = modelId.lastIndexOf('-')
  if (lastDashIndex > 0) {
    const possibleConfigId = modelId.substring(0, lastDashIndex)
    const possibleModelName = modelId.substring(lastDashIndex + 1)
    
    // 检查是否看起来像模型名称（包含字母或数字）
    if (/[a-zA-Z0-9]/.test(possibleModelName)) {
      return {
        configId: possibleConfigId,
        modelName: possibleModelName
      }
    }
  }

  // 无法解析，当作纯配置 ID
  return {
    configId: modelId,
    modelName: ''
  }
}

/**
 * 生成模型 ID
 */
export function generateModelId(configId: string, modelName: string): string {
  if (!modelName) {
    return configId
  }
  return `${configId}-${modelName}`
}

/**
 * 验证模型 ID 格式
 */
export function isValidModelId(modelId: string): boolean {
  try {
    parseModelId(modelId)
    return true
  } catch {
    return false
  }
}