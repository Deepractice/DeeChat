/**
 * 唯一ID生成器 - 解决React key冲突问题
 * 使用时间戳+计数器+随机数确保绝对唯一性
 */

let counter = 0
let lastTimestamp = 0

/**
 * 生成唯一ID，确保即使在同一毫秒内多次调用也不会重复
 * @param prefix 可选前缀
 * @returns 唯一ID字符串
 */
export function generateUniqueId(prefix?: string): string {
  const timestamp = Date.now()
  
  // 如果时间戳相同，递增计数器
  if (timestamp === lastTimestamp) {
    counter++
  } else {
    counter = 0
    lastTimestamp = timestamp
  }
  
  // 添加随机数确保更高的唯一性
  const random = Math.floor(Math.random() * 1000)
  
  const id = `${timestamp}_${counter}_${random}`
  
  return prefix ? `${prefix}_${id}` : id
}

/**
 * 生成消息ID的专用函数
 */
export function generateMessageId(): string {
  return generateUniqueId('msg')
}

/**
 * 生成会话ID的专用函数
 */
export function generateSessionId(): string {
  return generateUniqueId('session')
}

/**
 * 生成工具执行ID的专用函数
 */
export function generateToolExecutionId(): string {
  return generateUniqueId('tool')
}