/**
 * Configuration specific types
 */

export interface ConfigManagerOptions {
  /** 配置文件路径 */
  configFile?: string;
  /** 是否自动保存更改 */
  autoSave?: boolean;
}

export interface ServerFilters {
  /** 过滤启用状态 */
  enabled?: boolean;
  /** 过滤标签 */
  tags?: string[];
}

export interface ConfigDefaults {
  /** 默认超时时间 */
  timeout?: number;
  /** 默认自动重连 */
  autoReconnect?: boolean;
  /** 默认最大重连次数 */
  maxReconnectAttempts?: number;
  /** 默认重连延迟 */
  reconnectDelay?: number;
}