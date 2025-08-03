# PromptX本地调用服务完整指南

## 概述

PromptX本地调用服务是DeeChat中用于直接调用PromptX命令的核心服务。通过直接加载内置的PromptX模块，避免了MCP协议的网络开销，特别适合高频操作如角色管理、记忆存取等。

## 服务架构

```
渲染进程 → IPC → 主进程 → PromptXLocalService → PromptX模块（内置）
   ↓                                                        ↓
UI组件 ←─────────────── 响应结果 ←───────────────── PromptX CLI
```

## 核心特性

- ✅ **高性能** - 直接函数调用，无进程创建开销
- ✅ **完整功能** - 支持所有PromptX命令
- ✅ **类型安全** - 完整的TypeScript类型定义
- ✅ **错误处理** - 统一的错误处理和结果格式
- ✅ **单例模式** - 确保服务实例唯一性

## 快速开始

### 1. 初始化PromptX环境（必须）

```typescript
// 在应用启动时初始化
import { promptXService } from '@/services/PromptXService';

async function initializePromptX() {
  try {
    // 初始化当前项目的PromptX工作区
    const result = await promptXService.initWorkspace(
      process.cwd(),  // 工作目录
      'cursor'        // IDE类型（可选）
    );
    
    if (result.success) {
      console.log('PromptX工作区初始化成功');
    } else {
      console.error('初始化失败:', result.error);
    }
  } catch (error) {
    console.error('PromptX初始化异常:', error);
  }
}
```

### 2. 角色管理

```typescript
// 获取所有可用角色
async function loadRoles() {
  const result = await promptXService.getAvailableRoles();
  if (result.success) {
    // result.data 包含角色列表文本
    const roles = parseRoleList(result.data);
    return roles;
  }
}

// 激活特定角色
async function activateRole(roleId: string) {
  const result = await promptXService.activateRole(roleId);
  if (result.success) {
    console.log(`角色 ${roleId} 激活成功`);
    // 更新系统提示词...
  }
}
```

### 3. 记忆管理

```typescript
// 保存记忆
async function saveMemory(role: string, content: string) {
  const result = await promptXService.remember(role, content);
  if (result.success) {
    console.log('记忆保存成功');
  }
}

// 检索记忆
async function searchMemory(role: string, query?: string) {
  const result = await promptXService.recall(role, query);
  if (result.success) {
    // result.data 包含相关记忆
    return result.data;
  }
}
```

## API参考

### 命令参数对照表

| 命令 | 方法 | 参数 | 说明 |
|------|------|------|------|
| `init` | `initWorkspace(path?, ide?)` | `workingDirectory: string`<br/>`ideType?: string` | 初始化工作区 |
| `welcome` | `getAvailableRoles()` | 无 | 获取可用角色列表 |
| `action` | `activateRole(roleId)` | `roleId: string` | 激活指定角色 |
| `learn` | `learn(resourceUrl)` | `resourceUrl: string` | 学习资源（如 `@manual://tool-name`） |
| `remember` | `remember(role, content)` | `role: string`<br/>`content: string` | 保存记忆 |
| `recall` | `recall(role, query?)` | `role: string`<br/>`query?: string` | 检索记忆 |
| `tool` | `executeTool(resource, params)` | `toolResource: string`<br/>`parameters: object` | 执行工具 |
| `think` | `think(role, thought)` | `role: string`<br/>`thought: object` | 执行思考 |

### 返回值格式

所有方法返回统一的 `PromptXResult` 格式：

```typescript
interface PromptXResult<T = any> {
  success: boolean;  // 是否成功
  data?: T;         // 成功时的返回数据
  error?: string;   // 失败时的错误信息
}
```

### 完整API示例

```typescript
import { promptXService } from '@/services/PromptXService';

// 1. 初始化工作区
const initResult = await promptXService.initWorkspace('/Users/user/project', 'cursor');

// 2. 获取可用命令
const commands = await promptXService.getAvailableCommands();
// 返回: ['init', 'welcome', 'action', 'learn', 'recall', 'remember', 'tool', 'think']

// 3. 检查命令是否可用
const isAvailable = await promptXService.isCommandAvailable('welcome');
// 返回: true

// 4. 获取角色列表
const rolesResult = await promptXService.getAvailableRoles();

// 5. 激活角色
const activateResult = await promptXService.activateRole('luban');

// 6. 学习资源
const learnResult = await promptXService.learn('@manual://mcp-server');

// 7. 保存记忆
const rememberResult = await promptXService.remember(
  'assistant', 
  '用户偏好使用TypeScript进行开发'
);

// 8. 检索记忆
const recallResult = await promptXService.recall('assistant', 'TypeScript');

// 9. 执行工具
const toolResult = await promptXService.executeTool('@tool://calculator', {
  operation: 'add',
  a: 10,
  b: 20
});

// 10. 思考过程
const thinkResult = await promptXService.think('assistant', {
  goal: '帮助用户解决React组件性能问题',
  context: '用户报告组件重渲染频繁',
  approach: 'analytical'
});

// 11. 通用命令执行
const customResult = await promptXService.execute('custom-command', ['arg1', 'arg2']);
```

## 实际使用场景

### 场景1：角色选择器组件

```typescript
import React, { useState, useEffect } from 'react';
import { promptXService } from '@/services/PromptXService';

interface Role {
  id: string;
  name: string;
  description: string;
  source: 'system' | 'project' | 'user';
}

export const RoleSelector: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [currentRole, setCurrentRole] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    setLoading(true);
    try {
      const result = await promptXService.getAvailableRoles();
      if (result.success) {
        // 解析角色列表
        const parsedRoles = parseRoleListFromText(result.data);
        setRoles(parsedRoles);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelect = async (roleId: string) => {
    setLoading(true);
    try {
      const result = await promptXService.activateRole(roleId);
      if (result.success) {
        setCurrentRole(roleId);
        // 通知系统提示词更新
        notifySystemPromptUpdate(roleId);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="role-selector">
      <h3>选择AI角色</h3>
      <div className="role-list">
        {roles.map(role => (
          <div 
            key={role.id}
            className={`role-item ${currentRole === role.id ? 'active' : ''}`}
            onClick={() => handleRoleSelect(role.id)}
          >
            <h4>{role.name}</h4>
            <p>{role.description}</p>
            <span className="source">{role.source}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### 场景2：与系统提示词集成

```typescript
import { PromptProvider, PromptSegment } from '@/interfaces/ISystemPromptProvider';
import { promptXService } from '@/services/PromptXService';

export class PromptXRoleProvider implements PromptProvider {
  private currentRole: string | null = null;
  private roleActivationTime: Date | null = null;

  async activateRole(roleId: string) {
    const result = await promptXService.activateRole(roleId);
    if (result.success) {
      this.currentRole = roleId;
      this.roleActivationTime = new Date();
      return true;
    }
    return false;
  }

  getSegments(): PromptSegment[] {
    if (!this.currentRole) return [];

    return [{
      id: 'promptx-current-role',
      content: `You are currently activated as PromptX role: ${this.currentRole}
Role activated at: ${this.roleActivationTime?.toISOString()}
Please embody the characteristics and expertise of this role.`,
      enabled: true,
      priority: 100
    }];
  }
}

// 注册到系统提示词提供器
const roleProvider = new PromptXRoleProvider();
systemPromptProvider.registerProvider(roleProvider);
```

### 场景3：智能记忆助手

```typescript
class MemoryAssistant {
  private currentRole: string;

  constructor(role: string) {
    this.currentRole = role;
  }

  // 自动保存重要信息
  async autoSaveImportantInfo(conversation: string) {
    // 分析对话内容，提取重要信息
    const importantInfo = this.extractImportantInfo(conversation);
    
    if (importantInfo.length > 0) {
      for (const info of importantInfo) {
        await promptXService.remember(this.currentRole, info);
      }
    }
  }

  // 基于上下文检索相关记忆
  async getRelevantMemories(context: string) {
    const keywords = this.extractKeywords(context);
    const memories = [];

    for (const keyword of keywords) {
      const result = await promptXService.recall(this.currentRole, keyword);
      if (result.success && result.data) {
        memories.push(result.data);
      }
    }

    return this.deduplicateMemories(memories);
  }

  private extractImportantInfo(text: string): string[] {
    // 实现信息提取逻辑
    return [];
  }

  private extractKeywords(text: string): string[] {
    // 实现关键词提取逻辑
    return [];
  }

  private deduplicateMemories(memories: any[]): any[] {
    // 实现去重逻辑
    return memories;
  }
}
```

## 错误处理最佳实践

```typescript
// 使用try-catch处理异常
async function safeExecute() {
  try {
    const result = await promptXService.activateRole('unknown-role');
    if (!result.success) {
      // 处理业务错误
      console.error('激活失败:', result.error);
      showUserError(result.error);
    }
  } catch (error) {
    // 处理系统异常
    console.error('系统异常:', error);
    showSystemError('服务暂时不可用');
  }
}

// 使用装饰器模式统一处理
function withErrorHandling(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function(...args: any[]) {
    try {
      const result = await originalMethod.apply(this, args);
      if (!result.success) {
        console.error(`${propertyName} failed:`, result.error);
        // 统一错误处理
      }
      return result;
    } catch (error) {
      console.error(`${propertyName} exception:`, error);
      return { success: false, error: error.message };
    }
  };
}
```

## 性能优化建议

1. **缓存角色列表**
   ```typescript
   class RoleCache {
     private cache: Map<string, any> = new Map();
     private cacheTime: number = 5 * 60 * 1000; // 5分钟

     async getAvailableRoles() {
       const cached = this.cache.get('roles');
       if (cached && Date.now() - cached.time < this.cacheTime) {
         return cached.data;
       }

       const result = await promptXService.getAvailableRoles();
       if (result.success) {
         this.cache.set('roles', {
           data: result,
           time: Date.now()
         });
       }
       return result;
     }
   }
   ```

2. **批量操作优化**
   ```typescript
   // 避免多次调用，使用execute批量执行
   const commands = [
     { cmd: 'remember', args: ['assistant', 'info1'] },
     { cmd: 'remember', args: ['assistant', 'info2'] },
     { cmd: 'remember', args: ['assistant', 'info3'] }
   ];

   for (const { cmd, args } of commands) {
     await promptXService.execute(cmd, args);
   }
   ```

3. **防抖和节流**
   ```typescript
   import { debounce } from 'lodash';

   const debouncedSaveMemory = debounce(
     async (role: string, content: string) => {
       await promptXService.remember(role, content);
     },
     1000 // 1秒防抖
   );
   ```

## 故障排除

### 常见问题

1. **"PromptX模块加载失败"**
   - 确认 resources/promptx/package 目录存在
   - 检查路径配置是否正确
   - 验证PromptX模块完整性

2. **"项目未初始化"**
   - 必须先调用 `initWorkspace()`
   - 检查工作目录路径是否正确
   - 确保有足够的文件系统权限

3. **"命令执行失败"**
   - 检查命令参数格式
   - 确认角色ID是否存在
   - 查看具体错误信息

### 调试技巧

```typescript
// 开启详细日志
process.env.PROMPTX_DEBUG = 'true';

// 监听所有PromptX调用
const originalExecute = promptXService.execute;
promptXService.execute = async (command, args) => {
  console.log(`[PromptX] Executing: ${command}`, args);
  const result = await originalExecute.call(promptXService, command, args);
  console.log(`[PromptX] Result:`, result);
  return result;
};
```

## 与MCP服务的区别

| 特性 | PromptX本地服务 | MCP服务 |
|------|----------------|----------|
| 调用方式 | 直接函数调用 | MCP协议 |
| 性能 | 高（无网络开销） | 中等 |
| 适用场景 | 高频操作（角色、记忆） | 标准工具调用 |
| 错误处理 | 同步异常 | 协议错误 |
| 扩展性 | 仅限PromptX命令 | 支持所有MCP工具 |

## 后续扩展

1. **WebSocket实时通信** - 支持角色状态实时同步
2. **批量命令执行** - 优化多命令执行性能
3. **命令队列** - 避免并发问题
4. **结果缓存** - 减少重复调用
5. **插件系统** - 支持自定义命令扩展

## 相关文档

- [系统提示词提供器框架](./system-prompt-provider-guide.md)
- [PromptX MCP工具完整指南](./promptx-mcp-tools-complete-guide.md)
- [MCP集成指南](./mcp-integration-guide.md)