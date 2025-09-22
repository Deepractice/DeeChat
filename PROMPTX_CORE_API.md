# PromptX Core API 完整调用文档

## 📋 概述

**@promptx/core** 是一个基于 DPML（Domain Prompt Markup Language）的 AI prompt 框架核心库，提供认知系统、资源管理、工具扩展等功能。本文档详细介绍所有可用的 API 调用方式。

## 🚀 快速开始

### 安装
```bash
npm install @promptx/core
```

### 基础导入
```javascript
const {
  cognition,
  resource,
  toolx,
  pouch,
  utils
} = require('@promptx/core')
```

---

## 🧠 认知系统 (Cognition) API

### 核心类

#### CognitionSystem - 认知系统主控制器
```javascript
const { CognitionSystem } = require('@promptx/core/cognition')

// 创建认知系统实例
const cogSystem = new CognitionSystem()

// 初始化认知系统
await cogSystem.initialize()

// 保存记忆
await cogSystem.remember(role, engrams)

// 检索记忆
const mind = await cogSystem.recall(role, query)

// 启动角色认知
const primeResult = await cogSystem.prime(role)

// 清理资源
await cogSystem.cleanup()
```

#### Network - 认知网络容器
```javascript
const { Network } = require('@promptx/core/cognition')

// 创建认知网络
const network = new Network()

// 添加节点
const cue = network.addCue('concept', { data: 'value' })

// 获取节点
const retrievedCue = network.getCue('concept')

// 获取所有节点
const allCues = network.getAllCues()

// 保存网络
await network.save()

// 加载网络
await network.load()
```

#### Mind - 认知子图
```javascript
const { Mind } = require('@promptx/core/cognition')

// 创建认知子图
const mind = new Mind(network, startCue)

// 激活思维
mind.activate(query, weightStrategy)

// 获取激活的节点
const activatedCues = mind.getActivatedCues()

// 获取连接
const connections = mind.getConnections()
```

### 记忆操作类

#### Remember - 记忆写入
```javascript
const { Remember } = require('@promptx/core/cognition')

// 创建记忆写入器
const remember = new Remember(network, weightStrategy)

// 保存单个记忆
await remember.save(roleId, engram)

// 批量保存记忆
await remember.saveBatch(roleId, engrams)

// 记忆格式
const engram = {
  content: '要记忆的内容',
  schema: '概念1\n  概念2\n  概念3',
  strength: 0.8,
  type: 'ATOMIC' // ATOMIC|LINK|PATTERN
}
```

#### Recall - 记忆检索
```javascript
const { Recall } = require('@promptx/core/cognition')

// 创建记忆检索器
const recall = new Recall(network, activationStrategy)

// 检索记忆
const mind = await recall.search(roleId, query)

// 获取相关记忆
const relevantMemories = recall.getRelevantMemories(mind)
```

#### Prime - 认知启动
```javascript
const { Prime } = require('@promptx/core/cognition')

// 创建认知启动器
const prime = new Prime(network)

// 自动启动
const mind = await prime.auto(roleId)

// 从指定概念启动
const mind = await prime.fromConcept(roleId, concept)

// 多中心启动
const mind = await prime.multiCenter(roleId, concepts)
```

### 策略模式

#### 权重策略
```javascript
const {
  SimpleWeightStrategy,
  TimeBasedWeightStrategy,
  TemperatureWeightStrategy
} = require('@promptx/core/cognition')

// 简单权重策略
const simpleStrategy = new SimpleWeightStrategy()

// 时间衰减权重策略
const timeStrategy = new TimeBasedWeightStrategy({
  decayFactor: 0.1,
  timeWindow: 86400000 // 24小时
})

// 温度权重策略
const tempStrategy = new TemperatureWeightStrategy({
  temperature: 0.7
})
```

#### 激活策略
```javascript
const {
  HippocampalActivationStrategy
} = require('@promptx/core/cognition')

// 海马体激活策略
const hippocampalStrategy = new HippocampalActivationStrategy({
  threshold: 0.5,
  maxActivation: 100
})
```

---

## 📁 资源管理 (Resource) API

### 核心管理器

#### ResourceManager - 资源管理器
```javascript
const {
  ResourceManager,
  getGlobalResourceManager
} = require('@promptx/core/resource')

// 方式1：创建新实例
const resourceManager = new ResourceManager({
  baseDir: '/path/to/resources',
  enableCache: true
})

// 方式2：使用全局单例（推荐）
const resourceManager = getGlobalResourceManager()

// 初始化
await resourceManager.initializeWithNewArchitecture()

// 加载资源
const resource = await resourceManager.loadResource('@role://luban')

// 解析资源引用
const parsed = resourceManager.parseResourceReference('@tool://my-tool')

// 注册资源协议
resourceManager.registerProtocol('custom', CustomProtocolHandler)

// 列出所有资源
const allResources = await resourceManager.listResources()
```

#### 协议解析器
```javascript
const {
  ResourceProtocolParser
} = require('@promptx/core/resource')

// 创建解析器
const parser = new ResourceProtocolParser()

// 解析资源引用
const parsed = parser.parse('@role://luban?version=1.0&context=dev')

// 解析结果结构
console.log(parsed)
// {
//   protocol: 'role',
//   resource: 'luban',
//   query: { version: '1.0', context: 'dev' },
//   fragment: null
// }
```

### 便捷方法

```javascript
const { parse, validate, createManager } = require('@promptx/core/resource')

// 快速解析
const parsed = parse('@tool://my-tool')

// 快速验证
const isValid = validate('@role://invalid-ref')

// 创建管理器实例
const manager = createManager({ enableCache: false })
```

### 资源类型定义

```javascript
const {
  LoadingSemantics,
  ParsedReference,
  QueryParams,
  ResourceContent,
  LazyResource,
  ResourceResult
} = require('@promptx/core/resource')

// 使用类型定义进行类型检查和验证
```

---

## 🔧 工具扩展 (ToolX) API

### 核心框架

#### ToolSandbox - 工具沙箱
```javascript
const { ToolSandbox } = require('@promptx/core/toolx')

// 创建工具沙箱
const sandbox = await ToolSandbox.create('@tool://my-tool')

// 设置资源管理器
sandbox.setResourceManager(resourceManager)

// 三阶段执行
await sandbox.analyze()        // 分析工具
await sandbox.prepareDependencies()  // 准备依赖
const result = await sandbox.execute(parameters)  // 执行工具

// 清理资源
await sandbox.cleanup()
```

#### 便捷执行方法
```javascript
const {
  executeTool,
  getGlobalToolSandbox,
  initialize,
  getStats
} = require('@promptx/core/toolx')

// 直接执行工具
const result = await executeTool(
  '@tool://my-tool',
  { param: 'value' },
  resourceManager
)

// 获取工具沙箱实例
const sandbox = await getGlobalToolSandbox('@tool://my-tool')

// 初始化工具框架
const initResult = initialize({
  enableLogging: true,
  cacheDir: '/tmp/toolx-cache'
})

// 获取框架统计信息
const stats = getStats()
```

### 工具管理组件

#### ToolValidator - 工具验证器
```javascript
const { ToolValidator } = require('@promptx/core/toolx')

const validator = new ToolValidator()

// 验证工具定义
const isValid = await validator.validateTool(toolDefinition)

// 验证工具参数
const paramsValid = validator.validateParameters(parameters, schema)
```

#### PackageInstaller - 包安装器
```javascript
const { PackageInstaller } = require('@promptx/core/toolx')

const installer = new PackageInstaller()

// 安装依赖
await installer.install(['lodash', 'axios'])

// 使用pnpm安装
await installer.installWithPnpm(['react', 'vue'])

// 检查依赖是否已安装
const installed = await installer.isInstalled('lodash')
```

### 工具接口规范

```javascript
const {
  TOOL_INTERFACE,
  TOOL_ERROR_CODES,
  TOOL_RESULT_FORMAT,
  EXAMPLE_TOOL
} = require('@promptx/core/toolx')

// 查看工具接口规范
console.log(TOOL_INTERFACE)

// 查看错误代码定义
console.log(TOOL_ERROR_CODES)

// 查看结果格式规范
console.log(TOOL_RESULT_FORMAT)

// 查看示例工具
console.log(EXAMPLE_TOOL)
```

---

## 🎯 Pouch CLI 框架 API

### CLI 执行接口

#### PouchCLI - 主CLI类
```javascript
const { PouchCLI, cli } = require('@promptx/core/pouch')

// 方式1：使用全局CLI实例（推荐）
await cli.execute('action', ['luban'])
await cli.execute('remember', [memoryData])
await cli.execute('recall', ['java-developer', 'Spring Boot'])

// 方式2：创建新CLI实例
const myCli = new PouchCLI()
await myCli.initialize()
await myCli.execute('discover', [])

// 获取帮助信息
const help = cli.getHelp()

// 获取状态信息
const status = cli.getStatus()

// 运行交互式CLI
await cli.runInteractive()
```

#### 便捷方法
```javascript
const { execute, help, status } = require('@promptx/core/pouch')

// 直接执行命令
await execute('action', ['luban'])

// 获取帮助
const helpText = help()

// 获取状态
const statusInfo = status()
```

### 所有可用命令

#### 1. action - 角色激活
```javascript
// 激活系统内置角色
await cli.execute('action', ['assistant'])   // AI助手
await cli.execute('action', ['luban'])       // 鲁班-工具开发大师
await cli.execute('action', ['noface'])      // 无面-万能学习助手
await cli.execute('action', ['nuwa'])        // 女娲-角色创造专家
await cli.execute('action', ['sean'])        // Sean-决策专家

// 激活用户自定义角色
await cli.execute('action', ['java-developer'])
await cli.execute('action', ['product-manager'])
```

#### 2. remember - 记忆保存
```javascript
const memoryData = {
  role: 'java-developer',
  engrams: [
    {
      content: 'Spring Boot 自动配置原理',
      schema: 'Spring Boot\n  自动配置\n  条件注解\n  starter依赖',
      strength: 0.9
    },
    {
      content: '使用@Conditional系列注解实现条件装配',
      schema: '@Conditional\n  条件装配\n  自动配置\n  Spring Boot',
      strength: 0.8
    }
  ]
}

await cli.execute('remember', [memoryData])
```

#### 3. recall - 记忆检索
```javascript
// 关键词检索
const searchResult = await cli.execute('recall', ['java-developer', 'Spring Boot'])

// 全量检索（获取认知地图）
const mindMap = await cli.execute('recall', ['java-developer'])

// 使用对象参数
const recallResult = await cli.execute('recall', [{
  role: 'java-developer',
  query: 'microservices'
}])
```

#### 4. discover - 资源发现
```javascript
// 发现所有资源
const allResources = await cli.execute('discover', [])

// 只发现角色
const roles = await cli.execute('discover', ['roles'])

// 只发现工具
const tools = await cli.execute('discover', ['tools'])

// 使用对象参数
const focused = await cli.execute('discover', [{ focus: 'roles' }])
```

#### 5. toolx - 工具执行
```javascript
// 查看工具手册（首次使用必须）
const manual = await cli.execute('toolx', [
  '@tool://my-tool',
  'manual'
])

// 配置环境变量
await cli.execute('toolx', [
  '@tool://api-tool',
  'configure',
  { API_KEY: 'your-api-key', BASE_URL: 'https://api.example.com' }
])

// 执行工具
const result = await cli.execute('toolx', [
  '@tool://data-processor',
  'execute',
  {
    input: 'data.csv',
    output: 'processed.json',
    format: 'json'
  }
])

// 重建沙箱后执行（解决依赖问题）
const rebuildResult = await cli.execute('toolx', [
  '@tool://my-tool',
  'rebuild',
  { param: 'value' }
])

// 查询执行日志
const logs = await cli.execute('toolx', [
  '@tool://my-tool',
  'log',
  { action: 'tail', lines: 50 }
])
```

#### 6. init - 项目初始化
```javascript
// 基础初始化
await cli.execute('init', [])

// 指定工作目录和IDE类型
await cli.execute('init', [{
  workingDirectory: '/path/to/project',
  ideType: 'vscode'
}])
```

### 命令注册和扩展

#### 注册自定义命令
```javascript
const { PouchRegistry, BasePouchCommand } = require('@promptx/core/pouch')

// 创建自定义命令
class MyCustomCommand extends BasePouchCommand {
  getPurpose() {
    return '我的自定义命令'
  }

  async getContent(args) {
    return `执行自定义逻辑: ${JSON.stringify(args)}`
  }
}

// 注册命令
const registry = new PouchRegistry()
registry.register('my-command', MyCustomCommand)

// 在CLI中使用
await cli.execute('my-command', ['param1', 'param2'])
```

---

## 🛠️ 工具类 (Utils) API

### 项目管理

#### ProjectManager - 项目管理器
```javascript
const { ProjectManager, getGlobalProjectManager } = require('@promptx/core/utils')

// 使用全局实例
const pm = getGlobalProjectManager()

// 初始化项目
await pm.initializeProject('/path/to/project')

// 获取项目信息
const projectInfo = pm.getProjectInfo()

// 检查项目状态
const isValid = pm.isValidProject()

// 获取项目配置
const config = pm.getProjectConfig()
```

#### DirectoryService - 目录服务
```javascript
const { DirectoryService } = require('@promptx/core/utils')

const dirService = new DirectoryService()

// 确保目录存在
await dirService.ensureDir('/path/to/directory')

// 获取用户目录
const userDir = dirService.getUserDirectory()

// 获取缓存目录
const cacheDir = dirService.getCacheDirectory()

// 清理临时文件
await dirService.cleanupTemp()
```

#### ServerEnvironment - 服务器环境
```javascript
const { ServerEnvironment, getGlobalServerEnvironment } = require('@promptx/core/utils')

const env = getGlobalServerEnvironment()

// 检测运行环境
const isElectron = env.isElectron()
const isNode = env.isNode()
const isBrowser = env.isBrowser()

// 获取环境信息
const envInfo = env.getEnvironmentInfo()

// 设置环境变量
env.setEnvironment('development')
```

### 版本和配置

#### 版本信息
```javascript
const { version } = require('@promptx/core/utils')

// 获取版本信息
const versionInfo = version.getVersion()
const buildInfo = version.getBuildInfo()
```

#### 项目配置
```javascript
const { ProjectConfig } = require('@promptx/core/utils')

const config = new ProjectConfig('/path/to/project')

// 加载配置
await config.load()

// 获取配置值
const value = config.get('key', 'defaultValue')

// 设置配置值
config.set('key', 'value')

// 保存配置
await config.save()
```

---

## 🎨 完整使用示例

### 示例1：完整的角色激活和记忆管理流程
```javascript
const { pouch } = require('@promptx/core')

async function completeWorkflow() {
  try {
    // 1. 发现可用角色
    const discovery = await pouch.execute('discover', ['roles'])
    console.log('可用角色:', discovery)

    // 2. 激活Java开发者角色
    const activation = await pouch.execute('action', ['java-developer'])
    console.log('角色激活结果:', activation)

    // 3. 保存新的学习记忆
    const memoryData = {
      role: 'java-developer',
      engrams: [{
        content: '学习了Spring Security JWT认证实现',
        schema: 'Spring Security\n  JWT\n  认证\n  Token\n  过滤器',
        strength: 0.9
      }]
    }

    await pouch.execute('remember', [memoryData])
    console.log('记忆保存完成')

    // 4. 检索相关记忆
    const memories = await pouch.execute('recall', ['java-developer', 'Spring'])
    console.log('检索到的记忆:', memories)

    // 5. 执行代码生成工具
    const codeResult = await pouch.execute('toolx', [
      '@tool://code-generator',
      'execute',
      {
        template: 'spring-boot-jwt',
        output: './src/main/java/auth/',
        package: 'com.example.auth'
      }
    ])
    console.log('代码生成结果:', codeResult)

  } catch (error) {
    console.error('执行失败:', error.message)
  }
}

// 运行完整流程
completeWorkflow()
```

### 示例2：认知系统底层API直接调用
```javascript
const { cognition, resource } = require('@promptx/core')

async function directCognitionAPI() {
  // 1. 初始化资源管理器
  const resourceManager = resource.getGlobalResourceManager()
  await resourceManager.initializeWithNewArchitecture()

  // 2. 创建认知系统
  const cogSystem = new cognition.CognitionSystem()
  await cogSystem.initialize()

  // 3. 直接保存记忆
  const engrams = [{
    content: '微服务架构设计原则',
    schema: '微服务\n  架构设计\n  服务拆分\n  数据一致性',
    strength: 0.8,
    type: 'PATTERN'
  }]

  await cogSystem.remember('architect', engrams)

  // 4. 直接检索记忆
  const mind = await cogSystem.recall('architect', '架构设计')

  // 5. 分析认知网络
  console.log('激活的节点数:', mind.activatedCues.size)
  console.log('连接数:', mind.connections.length)

  // 6. 启动认知
  const primeResult = await cogSystem.prime('architect')
  console.log('认知启动结果:', primeResult)

  // 7. 清理资源
  await cogSystem.cleanup()
}

// 运行底层API调用
directCognitionAPI()
```

### 示例3：工具开发和执行
```javascript
const { toolx, resource } = require('@promptx/core')

async function toolDevelopmentWorkflow() {
  // 1. 初始化工具框架
  const initResult = toolx.initialize({
    enableLogging: true,
    maxConcurrency: 3
  })
  console.log('工具框架初始化:', initResult)

  // 2. 获取资源管理器
  const resourceManager = resource.getGlobalResourceManager()

  // 3. 执行工具 - 查看手册
  const manual = await toolx.executeTool(
    '@tool://api-client',
    { mode: 'manual' },
    resourceManager
  )
  console.log('工具手册:', manual)

  // 4. 配置工具环境
  await toolx.executeTool(
    '@tool://api-client',
    {
      mode: 'configure',
      API_KEY: process.env.API_KEY,
      BASE_URL: 'https://api.example.com'
    },
    resourceManager
  )

  // 5. 执行工具业务逻辑
  const result = await toolx.executeTool(
    '@tool://api-client',
    {
      mode: 'execute',
      endpoint: '/users',
      method: 'GET',
      params: { page: 1, limit: 10 }
    },
    resourceManager
  )
  console.log('API调用结果:', result)

  // 6. 查看执行统计
  const stats = toolx.getStats()
  console.log('工具框架统计:', stats)
}

// 运行工具开发流程
toolDevelopmentWorkflow()
```

---

## 🚨 错误处理

### 常见错误类型
```javascript
try {
  await pouch.execute('action', ['non-existent-role'])
} catch (error) {
  if (error.message.includes('角色不存在')) {
    // 处理角色不存在错误
    console.log('请先使用 discover 查看可用角色')
  }
}

try {
  await toolx.executeTool('@tool://invalid-tool', {}, resourceManager)
} catch (error) {
  if (error.code === 'TOOL_NOT_FOUND') {
    // 处理工具不存在错误
    console.log('工具不存在，请检查工具名称')
  } else if (error.code === 'DEPENDENCY_ERROR') {
    // 处理依赖错误，尝试重建
    await toolx.executeTool('@tool://invalid-tool', { mode: 'rebuild' }, resourceManager)
  }
}
```

### 日志和调试
```javascript
const logger = require('@promptx/logger')

// 设置日志级别
logger.setLevel('debug')

// 启用详细日志
process.env.PROMPTX_DEBUG = 'true'

// 自定义日志处理
logger.on('error', (error) => {
  console.error('PromptX错误:', error)
})
```

---

## 📚 最佳实践

### 1. 资源管理
- 始终使用全局单例实例 `getGlobalResourceManager()`
- 在应用启动时初始化资源管理器
- 使用完毕后调用 `cleanup()` 清理资源

### 2. 认知系统
- 角色激活前先检查角色是否存在
- 记忆保存时合理设置 strength 值
- 定期清理过期或无用的记忆

### 3. 工具执行
- 首次使用工具必须先查看 manual
- 合理设置超时时间避免长时间阻塞
- 使用 log 模式调试工具执行问题

### 4. 错误处理
- 始终使用 try-catch 包装 API 调用
- 根据错误类型选择合适的恢复策略
- 启用日志便于问题排查

### 5. 性能优化
- 使用缓存减少重复资源加载
- 合理使用并发控制避免资源竞争
- 定期清理临时文件和缓存

---

## 🔗 相关链接

- [PromptX 官方仓库](https://github.com/Deepractice/PromptX)
- [DPML 协议规范](https://docs.promptx.org/dpml)
- [工具开发指南](https://docs.promptx.org/tools)
- [认知系统原理](https://docs.promptx.org/cognition)

---

## 📝 更新日志

- **v1.18.0**: 添加 ToolX 2.0 框架，支持多模式执行
- **v1.17.0**: 重构认知系统，优化记忆管理
- **v1.16.0**: 增强资源管理器，支持新架构
- **v1.15.0**: 添加 Pouch CLI 框架，统一命令接口

---

*本文档基于 @promptx/core v1.18.0 编写，如有更新请参考最新版本文档。*