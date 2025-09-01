/**
 * 端口层统一导出
 * 六边形架构的核心 - 定义应用与外界的交互契约
 */

// 入站端口 (Primary Ports) - 应用的API
export * from './inbound/handlers'

// 出站端口 (Secondary Ports) - 应用对外部的依赖
export * from './outbound/services'