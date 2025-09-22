/**
 * PromptX 角色相关类型定义
 */

// 角色信息接口
export interface Role {
  id: string                    // 角色唯一标识符
  name: string                  // 角色显示名称
  description: string           // 角色描述
  avatar?: string               // 角色头像URL（可选）
  system_prompt?: string        // 角色的系统提示词
  category?: string             // 角色分类
  tags?: string[]               // 角色标签
  created_at?: string           // 创建时间
  updated_at?: string           // 更新时间
}

// PromptX Discover API 响应接口
export interface DiscoverResponse {
  success: boolean
  roles?: Role[]                // 可用角色列表
  tools?: any[]                 // 可用工具列表
  system_info?: {               // 系统信息
    version: string
    roles_count: number
    tools_count: number
  }
}

// 角色激活响应接口
export interface RoleActivationResponse {
  success: boolean
  role?: {
    id: string
    name: string
    description: string
  }
  activation_id?: string        // 激活会话ID
  context_summary?: string      // 上下文摘要
  available_capabilities?: string[]  // 可用能力列表
  mindmap?: any                 // 认知地图
  system_prompt?: string        // 角色系统提示词
}

// 角色选择器组件的 Props
export interface RoleSelectorProps {
  onRoleSelect: (role: Role, activationResult: RoleActivationResponse) => void
  onBack: () => void
  loading?: boolean
}

// 角色卡片组件的 Props
export interface RoleCardProps {
  role: Role
  onSelect: (role: Role) => void
  selected?: boolean
  loading?: boolean
}