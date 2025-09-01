# Services 服务层架构

ProjectS的服务层采用分层架构设计，按功能模块组织，提供清晰的职责分离和良好的可维护性。

## 📁 目录结构

```
src/main/services/
├── core/                   # 核心基础服务
│   ├── ConfigService.ts    # 应用配置管理
│   ├── ChatService.ts      # 聊天会话管理
│   ├── LocalStorageService.ts # 本地存储服务
│   └── index.ts           # 核心服务导出
├── llm/                    # 大语言模型服务
│   ├── LLMService.ts      # 统一LLM服务接口
│   └── index.ts           # LLM服务导出
├── mcp/                    # MCP协议服务
│   ├── MCPIntegrationService.ts # MCP核心集成
│   ├── MCPClientManager.ts # MCP客户端管理
│   ├── MCPConfigService.ts # MCP配置管理
│   ├── MCPCacheService.ts  # MCP缓存服务
│   ├── MCPToolService.ts   # MCP工具管理服务
│   └── index.ts           # MCP服务导出
├── model/                  # 模型管理服务
│   ├── ModelService.ts    # 模型配置管理服务
│   └── index.ts           # 模型服务导出
├── archive/                # 归档的旧版本服务
│   ├── LLMService.ts      # 已被LangChain替代
│   └── RealMCPClient.ts   # 已被SimpleMCPClient替代
├── index.ts               # 服务层统一导出
└── README.md              # 本文档
```

## 🏗️ 架构设计原则

### 1. **功能分组**
- **core**: 应用核心基础服务，不依赖外部API
- **llm**: 大语言模型相关服务，处理AI对话
- **mcp**: MCP协议相关服务，处理插件系统
- **model**: 模型配置管理服务，处理模型元数据

### 2. **依赖关系**
```
llm → mcp → model → core
```
- 上层服务可以依赖下层服务
- 同层服务之间可以相互依赖
- 下层服务不应依赖上层服务

### 3. **命名规范**
- 所有服务类以`Service`结尾
- 集成类以`IntegrationService`结尾
- 管理类以`Manager`结尾
- 缓存类以`CacheService`结尾

## 📋 服务说明

### Core Services (核心服务)

#### ConfigService
- **职责**: 应用配置的读取、写入和管理
- **特点**: 基础服务，被其他服务依赖
- **接口**: 提供配置的CRUD操作

#### ChatService
- **职责**: 聊天会话的创建、管理和持久化
- **特点**: 处理会话生命周期
- **接口**: 会话管理和消息存储

#### LocalStorageService
- **职责**: 本地数据存储的统一接口
- **特点**: 封装文件系统操作
- **接口**: 数据的读写和缓存

### LLM Services (大语言模型服务)

#### LLMService
- **职责**: 统一的LLM服务接口，基于LangChain框架
- **特点**: 替代了原有的UnifiedLLMService，提供简洁的服务接口
- **接口**: 统一的LLM调用接口，支持多提供商

### MCP Services (MCP协议服务)

#### MCPIntegrationService
- **职责**: MCP协议的核心集成服务
- **特点**: 提供MCP功能的统一入口
- **接口**: 服务器管理、工具发现、工具调用

#### MCPClientManager
- **职责**: MCP客户端的生命周期管理
- **特点**: 处理连接、断开、重连逻辑
- **接口**: 客户端创建和管理

#### MCPConfigService
- **职责**: MCP服务器配置的管理
- **特点**: 配置的验证、导入导出
- **接口**: 配置CRUD和批量操作

#### MCPCacheService
- **职责**: MCP相关数据的缓存管理
- **特点**: 三层缓存架构（工具、结果、状态）
- **接口**: 缓存的读写和失效

#### MCPToolService
- **职责**: MCP工具的管理和LangChain集成
- **特点**: 将MCP工具包装为LangChain工具，提供工具调用功能
- **接口**: 工具转换、调用和统计

### Model Services (模型管理服务)

#### ModelService
- **职责**: 模型配置的管理和验证
- **特点**: 支持多提供商模型配置，提供完整的模型管理功能
- **接口**: 模型配置CRUD和测试

## 🔧 使用方式

### 1. 统一导入
```typescript
import {
  ConfigService,
  LLMService,
  MCPIntegrationService
} from '../services/index.js';
```

### 2. 分组导入
```typescript
import { ConfigService } from '../services/core/index.js';
import { LLMService } from '../services/llm/index.js';
import { MCPIntegrationService } from '../services/mcp/index.js';
```

### 3. 直接导入
```typescript
import { ConfigService } from '../services/core/ConfigService.js';
```

## 📈 扩展指南

### 添加新服务
1. 确定服务所属的功能分组
2. 在对应目录下创建服务文件
3. 更新该目录的index.ts导出
4. 更新总index.ts的描述
5. 更新本README文档

### 服务重构
1. 保持接口兼容性
2. 更新相关的导入路径
3. 添加迁移说明
4. 将旧版本移至archive目录

## 🗂️ 归档说明

`archive/` 目录包含已废弃但保留的服务：
- **LLMService**: 已被LangChainIntegrationService替代
- **RealMCPClient**: 已被SimpleMCPClient替代

这些文件保留用于：
- 历史参考
- 回滚需要
- 迁移对比
