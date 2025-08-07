# FileOperationsMCPServer 配置指南

## 访问级别配置

FileOperationsMCPServer现在支持多种访问级别，从安全的沙箱模式到系统级访问。

⭐ **新特性**：智能跨平台路径验证，无需写死系统路径，自动适应Windows、macOS、Linux！

## 配置选项

### 1. 沙箱模式（默认，推荐）

```typescript
// 默认配置：只能访问用户数据目录
const server = new FileOperationsMCPServer();
// 或者明确指定
const server = new FileOperationsMCPServer({
  sandboxMode: true  // 默认值
});
```

**允许访问的目录：**
- `~/.deechat/`
- `~/.deechat/workspace/`  
- `~/.deechat/attachments/`
- `~/Documents/DeeChat/`

### 2. 自定义沙箱路径

```typescript
const server = new FileOperationsMCPServer({
  sandboxMode: true,
  allowedPaths: [
    '/Users/username/Projects',
    '/Users/username/Documents',
    '/tmp'
  ]
});
```

### 3. 系统级访问（需要明确授权）

```typescript
const server = new FileOperationsMCPServer({
  sandboxMode: false,          // 禁用沙箱
  allowSystemAccess: true      // 必须明确授权
});
```

**⚠️ 安全警告：** 系统级访问允许读取整个文件系统，包括敏感文件。

## 环境变量配置

### 在DeeChat中使用环境变量

```bash
# 禁用沙箱模式（允许系统级访问）
export FILE_OPS_SANDBOX=false
export FILE_OPS_SYSTEM_ACCESS=true

# 启动DeeChat
npm run dev
```

### 或者在启动命令中设置

```bash
FILE_OPS_SANDBOX=false FILE_OPS_SYSTEM_ACCESS=true npm run dev
```

## 实际使用示例

### 示例1：只读取用户文档（安全）

```typescript
// 默认沙箱模式
const server = new FileOperationsMCPServer();
await server.start();

// ✅ 允许：读取用户目录下的文件
await server.callTool('read_file', {
  path: '/Users/username/.deechat/config.json'
});

// ❌ 拒绝：尝试读取系统文件
await server.callTool('read_file', {
  path: '/etc/passwd'  // 错误：路径访问被拒绝
});
```

### 示例2：访问整个系统（需要授权）

```typescript
// 系统级访问
const server = new FileOperationsMCPServer({
  sandboxMode: false,
  allowSystemAccess: true
});
await server.start();

// ✅ 允许：读取系统文件
await server.callTool('read_file', {
  path: '/etc/hosts'  // 成功访问
});

// ✅ 允许：访问任意目录
await server.callTool('list_directory', {
  path: '/usr/local/bin'  // 成功访问
});
```

### 示例3：自定义允许路径

```typescript
// 自定义项目目录访问
const server = new FileOperationsMCPServer({
  sandboxMode: true,
  allowedPaths: [
    '/Users/username/Projects',
    '/Users/username/Downloads'
  ]
});
await server.start();

// ✅ 允许：访问项目目录
await server.callTool('read_file', {
  path: '/Users/username/Projects/my-app/package.json'
});

// ❌ 拒绝：访问其他目录
await server.callTool('read_file', {
  path: '/Users/username/Desktop/secret.txt'  // 错误：路径访问被拒绝
});
```

## 日志输出示例

### 沙箱模式启用

```
[FileOperations MCP] 🚀 标准MCP文件操作服务器初始化完成
[FileOperations MCP] 🔒 沙箱模式已启用
[FileOperations MCP] 🔒 安全路径: ["/Users/username/.deechat", ...]
```

### 系统级访问启用

```
[FileOperations MCP] ⚠️ 沙箱模式已禁用 - 允许系统级访问
[FileOperations MCP] ⚠️ 安全风险：可访问整个文件系统
[FileOperations MCP] 🚀 标准MCP文件操作服务器初始化完成
[Simple MCP] ⚠️ 文件操作服务器：沙箱模式已禁用
```

## 安全建议

### 🟢 推荐配置（生产环境）

```typescript
// 生产环境：严格沙箱模式
const server = new FileOperationsMCPServer({
  sandboxMode: true,  // 启用沙箱
  allowedPaths: [     // 最小权限原则
    path.join(os.homedir(), '.deechat'),
    path.join(os.homedir(), 'Documents', 'DeeChat')
  ]
});
```

### 🟡 谨慎使用（开发环境）

```typescript
// 开发环境：扩展项目目录访问
const server = new FileOperationsMCPServer({
  sandboxMode: true,
  allowedPaths: [
    '/Users/dev/Projects',      // 项目目录
    '/tmp',                     // 临时文件
    '/Users/dev/.deechat'       // 用户数据
  ]
});
```

### 🔴 高风险（仅特殊需求）

```typescript
// 特殊需求：系统级访问（如系统管理工具）
const server = new FileOperationsMCPServer({
  sandboxMode: false,
  allowSystemAccess: true  // 需要用户明确确认风险
});
```

## 错误处理

### 权限不足错误

```javascript
try {
  await server.callTool('read_file', { path: '/etc/passwd' });
} catch (error) {
  if (error.message.includes('路径访问被拒绝')) {
    console.log('需要更高的访问权限或修改沙箱配置');
  }
}
```

### 系统访问未授权错误

```javascript
try {
  const server = new FileOperationsMCPServer({
    sandboxMode: false,
    allowSystemAccess: false  // 未授权
  });
} catch (error) {
  console.log('系统级访问需要设置 allowSystemAccess: true');
}
```

## 迁移指南

### 从严格模式迁移到灵活模式

```typescript
// 之前：只能访问用户目录
const server = new FileOperationsMCPServer();

// 现在：可以添加更多允许路径
const server = new FileOperationsMCPServer({
  sandboxMode: true,
  allowedPaths: [
    ...CrossPlatformPathUtils.getUserDataPaths(),  // 保持原有路径
    '/Users/username/Projects',                     // 添加项目目录
    '/tmp'                                         // 添加临时目录
  ]
});
```

### 从沙箱模式迁移到系统模式

```typescript
// 步骤1：确认安全风险
const confirmSystemAccess = confirm('允许访问整个文件系统存在安全风险，是否继续？');

if (confirmSystemAccess) {
  // 步骤2：创建系统级访问实例
  const server = new FileOperationsMCPServer({
    sandboxMode: false,
    allowSystemAccess: true
  });
}
```

## 测试验证

### ✅ 测试结果（macOS Darwin x64）

```
🧪 系统级访问测试结果:

📦 沙箱模式
✅ 正确阻止系统文件访问 (/etc/hosts)
✅ 允许访问用户数据目录

🌐 系统级访问模式  
✅ 成功读取系统文件: /etc/hosts (254 B)
✅ 成功列举系统目录: /usr/bin (915个项目)
✅ 成功访问临时目录: /tmp (17个项目)

🛡️  跨平台路径验证
✅ 正确拒绝包含危险字符的路径
✅ 正确拒绝超长路径 (Unix: >4096字符)
✅ 正确拒绝超长文件名 (>255字符)

🌍 跨平台兼容性
✅ macOS应用程序目录访问正常
✅ 路径规范化工作正常
✅ 权限验证功能正常
```

### 🔧 智能路径验证特性

新的路径验证系统会自动：

1. **跨平台字符检查**
   - Windows: 拒绝 `<>:"|?*` 等危险字符
   - Unix: 只拒绝空字符 `\x00`

2. **文件系统限制验证**
   - Windows: 路径长度 ≤ 260字符
   - Unix: 路径长度 ≤ 4096字符，文件名 ≤ 255字符

3. **保留名称检测**
   - Windows: 自动检测 `CON`, `PRN`, `AUX`, `NUL` 等保留名称

4. **动态平台适应**
   - 无需预定义系统路径
   - 自动适应当前运行平台
   - 智能权限验证

---

**注意：** 
- 系统级访问应该仅在确实需要的情况下使用
- 推荐在生产环境中使用沙箱模式
- 新的路径验证系统提供更好的跨平台兼容性
- 定期审查和更新访问权限配置
- 监控文件操作日志以发现异常访问