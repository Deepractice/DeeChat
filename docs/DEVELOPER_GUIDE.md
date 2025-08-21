# 🛠️ DeeChat 开发者指南

## 🏗️ 开发环境搭建

### 前置要求
- **Node.js**: 18.0+ (推荐使用LTS版本)
- **npm**: 9.0+ (随Node.js安装)
- **Git**: 用于版本控制
- **Python**: 3.8+ (MCP工具开发需要)

### 快速开始
```bash
# 1. 克隆仓库
git clone https://github.com/deepractice/deechat.git
cd deechat

# 2. 安装依赖
npm install

# 3. 启动开发环境
npm run dev
```

### 开发命令
```bash
# 开发模式 (Vite + Electron 热重载)
npm run dev

# 仅前端开发 (浏览器)
npm run dev:vite

# 仅Electron开发  
npm run dev:electron

# 类型检查
npm run type-check

# 代码格式化
npm run lint:fix

# 运行测试
npm run test

# 完整构建
npm run build
```

## 📁 项目结构

```
DeeChat/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts            # 主进程入口
│   │   ├── ipc/                # IPC 通信处理
│   │   │   ├── langchainHandlers.ts   # LangChain IPC
│   │   │   └── mcpHandlers.ts         # MCP IPC
│   │   ├── services/           # 核心服务
│   │   │   ├── llm/           # LLM 服务
│   │   │   ├── mcp/           # MCP 服务
│   │   │   ├── promptx/       # PromptX 服务
│   │   │   └── core/          # 核心服务
│   │   └── repositories/       # 数据访问层
│   ├── renderer/               # 渲染进程 (React 应用)
│   │   ├── src/
│   │   │   ├── components/    # React 组件
│   │   │   ├── pages/         # 页面组件
│   │   │   ├── hooks/         # 自定义 Hooks
│   │   │   ├── store/         # Redux 状态管理
│   │   │   └── services/      # 前端服务
│   │   └── mockElectronAPI.ts # 开发环境 Mock
│   ├── preload/               # 预加载脚本
│   │   └── index.ts          # API 暴露
│   └── shared/                # 共享代码
│       ├── entities/          # 数据实体
│       ├── interfaces/        # TypeScript 接口
│       ├── services/          # 共享服务
│       ├── types/             # 类型定义
│       └── langchain/         # LangChain 集成
├── resources/                 # 资源文件
│   └── promptx/              # PromptX 框架
├── docs/                     # 项目文档
├── tests/                    # 测试文件
└── scripts/                  # 构建脚本
```

## 🔧 核心架构

### 1. 统一流式消息架构

**设计理念**: 所有AI交互统一使用单一的`streamMessage`方法

```typescript
// src/main/services/llm/LLMService.ts
class LLMService {
  // 🔥 唯一的消息接口
  async streamMessage(
    request: LLMRequest,
    configId?: string,
    onChunk?: (chunk: string) => void
  ): Promise<string>

  // ❌ 已删除的冗余方法
  // sendMessage()
  // sendMessageWithMCPTools()
}
```

**IPC 通信**:
```typescript
// src/preload/index.ts
const electronAPI = {
  ai: {
    // 统一的流式消息API
    streamMessage: (request: any) => ipcRenderer.invoke('ai:streamMessage', request),
    
    // 流式事件监听
    onStreamChunk: (callback) => {
      ipcRenderer.on('ai:streamChunk', (_event, data) => callback(data))
    }
  }
}
```

**前端使用**:
```typescript
// src/renderer/src/hooks/useUnifiedMessage.ts
export const useUnifiedMessage = () => {
  const sendMessage = async (message: string) => {
    const response = await window.electronAPI.ai.streamMessage({
      message,
      sessionId: currentSession.id,
      activeRole: selectedRole
    })
    return response
  }
  
  return { sendMessage, isLoading }
}
```

### 2. PromptX 角色系统

**核心组件**:
```typescript
// src/main/services/promptx/PromptXLocalService.ts
export class PromptXLocalService {
  // 执行PromptX命令
  async execute(command: string, args?: any[]): Promise<any>
  
  // 激活专业角色
  async activateRole(roleId: string): Promise<string>
  
  // 检索专业记忆
  async recall(roleId: string, query?: string): Promise<any>
}
```

**角色激活流程**:
```typescript
// src/shared/langchain/layers/RoleStatusMonitorLayer.ts
export class RoleStatusMonitorLayer {
  private async activateRoleIfNeeded(
    sessionId: string,
    roleId: string,
    chatHistory: any[]
  ): Promise<string> {
    // 1. 检查角色是否已激活
    const isActivated = this.checkRoleActivation(sessionId, roleId, chatHistory)
    
    if (!isActivated) {
      // 2. 调用PromptX服务激活角色
      const result = await this.promptXService.execute('action', [roleId])
      return result.content
    }
    
    return ''
  }
}
```

### 3. MCP 协议集成

**服务器管理**:
```typescript
// src/main/services/mcp/client/SimpleMCPClientManager.ts
export class SimpleMCPClientManager {
  // 添加MCP服务器
  async addServer(config: MCPServerEntity): Promise<void>
  
  // 调用MCP工具
  async callTool(request: MCPToolCallRequest): Promise<any>
  
  // 获取所有可用工具
  async getAllTools(): Promise<MCPToolEntity[]>
}
```

**内置MCP服务器**:
```typescript
// src/main/services/mcp/servers/InProcessMCPServer.ts
export class InProcessMCPServer {
  // PromptX本地服务器
  async startPromptXServer(): Promise<void>
  
  // 文件操作服务器  
  async startFileOperationsServer(): Promise<void>
  
  // 工作区服务器
  async startWorkspaceServer(): Promise<void>
}
```

## 🎨 前端开发

### 组件开发规范

**函数组件模板**:
```typescript
// src/renderer/src/components/ExampleComponent.tsx
import React, { useState, useEffect } from 'react'
import { Button, Card } from 'antd'
import styled from 'styled-components'

interface ExampleComponentProps {
  title: string
  onAction?: (data: any) => void
}

const StyledCard = styled(Card)`
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`

export const ExampleComponent: React.FC<ExampleComponentProps> = ({
  title,
  onAction
}) => {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      // 业务逻辑
      onAction?.('data')
    } finally {
      setLoading(false)
    }
  }

  return (
    <StyledCard title={title}>
      <Button 
        type="primary" 
        loading={loading} 
        onClick={handleClick}
      >
        Action
      </Button>
    </StyledCard>
  )
}

export default ExampleComponent
```

### Redux 状态管理

**Slice 模板**:
```typescript
// src/renderer/src/store/slices/exampleSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'

interface ExampleState {
  data: any[]
  loading: boolean
  error: string | null
}

const initialState: ExampleState = {
  data: [],
  loading: false,
  error: null
}

// 异步操作
export const fetchData = createAsyncThunk(
  'example/fetchData',
  async (params: any) => {
    const response = await window.electronAPI.someMethod(params)
    return response
  }
)

const exampleSlice = createSlice({
  name: 'example',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchData.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchData.fulfilled, (state, action) => {
        state.loading = false
        state.data = action.payload
      })
      .addCase(fetchData.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Unknown error'
      })
  }
})

export const { clearError } = exampleSlice.actions
export default exampleSlice.reducer
```

### 自定义Hooks

**Hook开发模板**:
```typescript
// src/renderer/src/hooks/useExample.ts
import { useState, useEffect, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../store'

export const useExample = (initialValue?: any) => {
  const dispatch = useDispatch()
  const { data, loading, error } = useSelector((state: RootState) => state.example)
  
  const [localState, setLocalState] = useState(initialValue)

  const handleAction = useCallback(async (params: any) => {
    try {
      const result = await window.electronAPI.someMethod(params)
      setLocalState(result)
      return result
    } catch (error) {
      console.error('Action failed:', error)
      throw error
    }
  }, [])

  useEffect(() => {
    // 初始化逻辑
  }, [])

  return {
    data,
    loading,
    error,
    localState,
    handleAction
  }
}
```

## 🔌 后端开发

### 服务开发规范

**服务类模板**:
```typescript
// src/main/services/example/ExampleService.ts
import { injectable } from 'inversify'
import { IExampleService } from '../../interfaces/IExampleService'

@injectable()
export class ExampleService implements IExampleService {
  private initialized = false

  async initialize(): Promise<void> {
    if (this.initialized) return
    
    // 初始化逻辑
    this.initialized = true
  }

  async processData(data: any): Promise<any> {
    if (!this.initialized) {
      await this.initialize()
    }

    try {
      // 业务逻辑
      return result
    } catch (error) {
      console.error('ExampleService.processData failed:', error)
      throw error
    }
  }

  async cleanup(): Promise<void> {
    // 清理资源
    this.initialized = false
  }
}
```

### IPC 处理器

**IPC处理器模板**:
```typescript
// src/main/ipc/exampleHandlers.ts
import { ipcMain } from 'electron'
import { ExampleService } from '../services/example/ExampleService'

export function registerExampleHandlers(exampleService: ExampleService) {
  // 查询数据
  ipcMain.handle('example:getData', async (event, params) => {
    try {
      const result = await exampleService.getData(params)
      return { success: true, data: result }
    } catch (error) {
      console.error('IPC example:getData failed:', error)
      return { success: false, error: error.message }
    }
  })

  // 处理数据
  ipcMain.handle('example:processData', async (event, data) => {
    try {
      const result = await exampleService.processData(data)
      return { success: true, data: result }
    } catch (error) {
      console.error('IPC example:processData failed:', error)
      return { success: false, error: error.message }
    }
  })
}
```

### 数据库操作

**Repository模式**:
```typescript
// src/main/repositories/ExampleRepository.ts
import Database from 'better-sqlite3'
import { BaseRepository } from './BaseRepository'

export interface ExampleEntity {
  id: string
  name: string
  data: any
  createdAt: number
  updatedAt: number
}

export class ExampleRepository extends BaseRepository<ExampleEntity> {
  constructor(db: Database.Database) {
    super(db, 'examples')
  }

  protected getCreateTableSQL(): string {
    return `
      CREATE TABLE IF NOT EXISTS examples (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        data TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      )
    `
  }

  async findByName(name: string): Promise<ExampleEntity | null> {
    const stmt = this.db.prepare('SELECT * FROM examples WHERE name = ?')
    const row = stmt.get(name) as any
    return row ? this.deserialize(row) : null
  }

  protected serialize(entity: ExampleEntity): any {
    return {
      ...entity,
      data: JSON.stringify(entity.data)
    }
  }

  protected deserialize(row: any): ExampleEntity {
    return {
      ...row,
      data: JSON.parse(row.data)
    }
  }
}
```

## 🧪 测试开发

### 单元测试

**测试文件模板**:
```typescript
// tests/unit/ExampleService.test.ts
import { ExampleService } from '../../src/main/services/example/ExampleService'

describe('ExampleService', () => {
  let service: ExampleService

  beforeEach(() => {
    service = new ExampleService()
  })

  afterEach(async () => {
    await service.cleanup()
  })

  describe('processData', () => {
    it('should process data correctly', async () => {
      // Arrange
      const inputData = { test: 'value' }
      const expectedOutput = { processed: true }

      // Act
      const result = await service.processData(inputData)

      // Assert
      expect(result).toEqual(expectedOutput)
    })

    it('should handle errors gracefully', async () => {
      // Arrange
      const invalidData = null

      // Act & Assert
      await expect(service.processData(invalidData))
        .rejects.toThrow('Invalid data')
    })
  })
})
```

### 集成测试

**集成测试模板**:
```typescript
// tests/integration/MessageFlow.test.ts
import { Application } from 'spectron'
import path from 'path'

describe('Message Flow Integration', () => {
  let app: Application

  beforeAll(async () => {
    app = new Application({
      path: path.join(__dirname, '../../dist/main/index.js'),
      args: ['--test-mode']
    })
    await app.start()
  })

  afterAll(async () => {
    if (app && app.isRunning()) {
      await app.stop()
    }
  })

  it('should send and receive messages', async () => {
    // 测试完整的消息流程
    const client = app.client
    
    // 等待应用启动
    await client.waitUntilWindowLoaded()
    
    // 输入消息
    await client.setValue('#message-input', 'Hello, AI!')
    await client.click('#send-button')
    
    // 验证响应
    await client.waitForExist('#ai-response', 5000)
    const response = await client.getText('#ai-response')
    
    expect(response).toBeTruthy()
  })
})
```

## 🔧 MCP工具开发

### 创建MCP工具

**工具开发模板**:
```typescript
// resources/promptx/tools/example-tool.js
/**
 * @tool://example-calculator
 * @description 示例计算器工具
 */

class ExampleCalculator {
  /**
   * 执行数学计算
   * @param {Object} params - 计算参数
   * @param {string} params.operation - 运算类型 (add, subtract, multiply, divide)
   * @param {number} params.a - 第一个数字
   * @param {number} params.b - 第二个数字
   * @returns {Object} 计算结果
   */
  async execute(params) {
    const { operation, a, b } = params
    
    // 参数验证
    if (typeof a !== 'number' || typeof b !== 'number') {
      throw new Error('参数a和b必须是数字')
    }

    let result
    switch (operation) {
      case 'add':
        result = a + b
        break
      case 'subtract':
        result = a - b
        break
      case 'multiply':
        result = a * b
        break
      case 'divide':
        if (b === 0) throw new Error('除数不能为0')
        result = a / b
        break
      default:
        throw new Error(`不支持的运算类型: ${operation}`)
    }

    return {
      success: true,
      result,
      operation,
      operands: [a, b]
    }
  }
}

module.exports = ExampleCalculator
```

**工具文档**:
```markdown
# @manual://example-calculator

## 功能描述
示例计算器工具，支持基本的数学运算。

## 使用方法
```typescript
await promptx_tool({
  tool_resource: "@tool://example-calculator",
  parameters: {
    operation: "add",
    a: 25,
    b: 37
  }
})
```

## 参数说明
- `operation`: 运算类型
  - `add`: 加法
  - `subtract`: 减法  
  - `multiply`: 乘法
  - `divide`: 除法
- `a`: 第一个数字
- `b`: 第二个数字

## 返回值
```json
{
  "success": true,
  "result": 62,
  "operation": "add", 
  "operands": [25, 37]
}
```

## 错误处理
- 参数类型错误: 当a或b不是数字时
- 除零错误: 当除法运算中b为0时
- 不支持的运算: 当operation不在支持列表中时
```

### 注册MCP工具

**在PromptX中注册**:
```typescript
// src/main/services/promptx/PromptXLocalService.ts
export class PromptXLocalService {
  private async registerCustomTools() {
    // 扫描工具目录
    const toolsDir = path.join(this.resourcesPath, 'tools')
    const toolFiles = await fs.readdir(toolsDir)
    
    for (const file of toolFiles) {
      if (file.endsWith('.js')) {
        const toolPath = path.join(toolsDir, file)
        const ToolClass = require(toolPath)
        
        // 注册工具
        this.toolRegistry.register(file.replace('.js', ''), ToolClass)
      }
    }
  }
}
```

## 📦 构建和发布

### 构建配置

**Electron Builder配置**:
```json
// package.json - build section
{
  "build": {
    "appId": "com.deepractice.deechat",
    "productName": "DeeChat",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "node_modules/**/*"
    ],
    "extraResources": [
      {
        "from": "resources",
        "to": "resources"
      },
      {
        "from": ".promptx", 
        "to": ".promptx"
      }
    ]
  }
}
```

### 构建脚本

**完整构建流程**:
```bash
# 1. 预构建PromptX资源
npm run prebuild:promptx

# 2. 构建渲染进程
npm run build:renderer

# 3. 构建主进程  
npm run build:main

# 4. 后构建资源处理
npm run postbuild:resources

# 5. 打包应用
electron-builder
```

### 发布流程

**GitHub Actions CI/CD**:
```yaml
# .github/workflows/build.yml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build application
        run: npm run build
        
      - name: Package application
        run: npm run dist
        
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: ${{ matrix.os }}-build
          path: release/
```

## 🐛 调试技巧

### 主进程调试

**使用VSCode调试配置**:
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Main Process",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/dist/main/index.js",
      "console": "integratedTerminal",
      "sourceMaps": true,
      "outFiles": ["${workspaceFolder}/dist/main/**/*.js"]
    }
  ]
}
```

**日志调试**:
```typescript
// 使用electron-log进行日志记录
import log from 'electron-log'

// 设置日志级别
log.transports.console.level = 'debug'
log.transports.file.level = 'info'

// 记录日志
log.info('Service initialized')
log.debug('Debug info:', data)
log.error('Error occurred:', error)
```

### 渲染进程调试

**浏览器开发者工具**:
```typescript
// 在开发模式下打开DevTools
if (process.env.NODE_ENV === 'development') {
  win.webContents.openDevTools()
}
```

**React DevTools**:
```bash
# 安装React DevTools扩展
npm install --save-dev @electron/remote
```

### IPC通信调试

**IPC事件监听**:
```typescript
// 主进程监听所有IPC事件
ipcMain.on('*', (event, ...args) => {
  console.log('IPC Event:', event.channel, args)
})

// 渲染进程调试
window.electronAPI.debug = {
  logIPC: true,
  // 添加调试方法
}
```

## 📚 学习资源

### 官方文档
- [Electron文档](https://www.electronjs.org/docs)
- [React文档](https://react.dev/)
- [TypeScript文档](https://www.typescriptlang.org/docs/)
- [Ant Design文档](https://ant.design/docs/react/introduce)

### 项目相关
- [LangChain文档](https://js.langchain.com/docs/)
- [PromptX框架](https://github.com/deepractice/promptx)
- [MCP协议](https://modelcontextprotocol.io/)

### 最佳实践
- [Electron Security](https://www.electronjs.org/docs/tutorial/security)
- [React Performance](https://react.dev/reference/react/memo)
- [TypeScript Best Practices](https://typescript-eslint.io/rules/)

---

## 🎯 下一步

现在您已经掌握了DeeChat的开发基础！

**建议的学习路径**:
1. 熟悉项目结构和核心架构
2. 运行项目并调试一个简单功能
3. 创建一个自定义React组件
4. 开发一个简单的MCP工具
5. 参与开源贡献

**参与开发**:
- 查看[GitHub Issues](https://github.com/deepractice/deechat/issues)寻找贡献机会
- 阅读[贡献指南](CONTRIBUTING.md)了解开发流程
- 加入[开发者讨论](https://github.com/deepractice/deechat/discussions)

欢迎加入DeeChat开发者社区！🚀

---

**文档版本**: v1.0.0  
**最后更新**: 2025-08-21  
**适用版本**: DeeChat 1.0.0+