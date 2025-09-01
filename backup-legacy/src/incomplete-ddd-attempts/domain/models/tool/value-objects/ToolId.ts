/**
 * 工具ID值对象
 */

import { Id } from '../../../shared/primitives/Id'

export class ToolId extends Id {
  private constructor(value: string) {
    super(value)
  }

  /**
   * 创建新的工具ID
   */
  static create(): ToolId {
    return new ToolId(this.generateUUID())
  }

  /**
   * 从字符串创建工具ID
   */
  static fromString(value: string): ToolId {
    this.validateId(value)
    return new ToolId(value)
  }

  /**
   * 从MCP工具名称创建ID（用于兼容性）
   */
  static fromToolName(toolName: string): ToolId {
    if (!toolName || typeof toolName !== 'string') {
      throw new Error('Tool name must be a non-empty string')
    }
    
    // 清理工具名称并创建确定性ID
    const cleanName = toolName
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')

    if (cleanName.length === 0) {
      throw new Error('Tool name produces empty ID after cleaning')
    }

    return new ToolId(`tool_${cleanName}`)
  }

  /**
   * 检查是否为系统工具ID
   */
  isSystemTool(): boolean {
    return this.value.startsWith('system_') || this.value.startsWith('mcp_')
  }

  /**
   * 检查是否为用户工具ID
   */
  isUserTool(): boolean {
    return this.value.startsWith('user_') || this.value.startsWith('custom_')
  }

  /**
   * 获取工具类型前缀
   */
  getTypePrefix(): string {
    const parts = this.value.split('_')
    return parts.length > 1 ? parts[0] : 'unknown'
  }
}