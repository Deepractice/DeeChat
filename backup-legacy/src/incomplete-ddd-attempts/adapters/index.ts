/**
 * 适配器层统一导出
 * 提供所有适配器组件的统一访问入口
 */

// Primary Adapters (入站适配器)
export * from './primary/electron/ElectronMainAdapter'
export * from './primary/ipc/router/IPCRouter'
export * from './primary/ipc/handlers/ConversationIPCHandler'
export * from './primary/ipc/handlers/IntelligenceIPCHandler'
export * from './primary/ipc/handlers/ToolIPCHandler'
export * from './primary/ipc/base/BaseIPCHandler'

// Secondary Adapters (出站适配器) - 如果需要的话，将在这里添加