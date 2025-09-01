# Legacy Code Archive

## 📋 迁移记录

**迁移时间**: 2025-08-30
**迁移策略**: 渐进式DDD架构重构

## 🗂️ 已迁移的旧代码

### 1. **共享类型和实体** (`src/shared/`)
- 旧的类型定义
- 传统实体模型
- 工具函数和常量

### 2. **旧DDD尝试** (`src/domains/`)  
- 早期的DDD架构尝试
- 不完整的领域模型
- 已被新的 `src/domain/` 替代

### 3. **前端服务层** (`src/renderer/src/services/`)
- `PromptXService.ts`
- `RoleContentService.ts` 
- `SessionService.ts`
- `WorkspaceFileManager.ts`

### 4. **前端类型定义** (`src/renderer/src/types/`)
- `file.ts`
- `global.d.ts`
- `window.d.ts`

### 5. **旧仓储层** (`src/main/repositories/`)
- SQLite仓储实现
- 传统数据访问层

## 🎯 新DDD架构 (保留在 `src/`)

### 领域层 (`src/domain/`)
- 纯净的领域实体和值对象
- 领域服务和规则
- 不依赖外部技术

### 应用层 (`src/application/`)
- 应用服务和用例
- DTO和请求/响应模型
- 依赖接口定义

### 基础设施层 (`src/infrastructure/`)  
- 数据库适配器
- 外部服务客户端
- 技术实现细节

### 适配器层 (`src/adapters/`)
- 控制器和API适配器
- 事件处理器
- 外部系统集成

## 📚 使用指南

这些旧代码**仅供参考和学习**，用于：
- 理解原有业务逻辑
- 查找遗漏的功能点
- 对比新旧架构设计

**⚠️ 不要直接使用这些代码**，所有功能都应在新DDD架构中重新实现。

## 🚀 迁移原则

1. **功能对等**: 新架构要实现所有原有功能
2. **架构升级**: 使用DDD模式重新设计
3. **测试验证**: 确保功能正确性
4. **渐进发布**: 逐步替换旧功能

---

*迁移完成后，此文件夹的代码将不再维护和更新。*