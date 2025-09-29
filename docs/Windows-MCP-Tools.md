# Windows MCP 工具文档

## 概述

Windows MCP (Model Context Protocol) 是一个用于在Windows环境下实现AI助手与系统交互的开源工具集。它提供了完整的Windows桌面自动化能力，支持与任何LLM集成。

## 项目信息

- **项目地址**: https://github.com/CursorTouch/Windows-MCP
- **开源协议**: MIT License
- **支持系统**: Windows 7-11
- **开发语言**: Python 3.13+
- **响应延迟**: 0.7-2.5秒

## 核心特性

### 1. 无需计算机视觉
- 直接与Windows UI元素交互
- 不依赖传统的计算机视觉技术
- 不需要特殊的微调模型

### 2. 轻量级架构
- 最小依赖设计
- 开源MIT协议
- 易于集成和扩展

### 3. 广泛的LLM兼容性
- 支持任何大语言模型
- 已在Claude Desktop中作为桌面扩展展示

## 工具列表

### UI交互工具

#### Click-Tool
- **功能**: 点击屏幕指定坐标
- **用途**: 模拟鼠标点击操作
- **参数**: x, y坐标

#### Type-Tool
- **功能**: 在UI元素上输入文本
- **用途**: 模拟键盘文本输入
- **参数**: 目标元素, 输入文本

#### Drag-Tool
- **功能**: 在两点间执行拖拽操作
- **用途**: 文件拖拽、窗口移动等
- **参数**: 起始坐标, 结束坐标

#### Move-Tool
- **功能**: 移动鼠标指针
- **用途**: 模拟鼠标移动
- **参数**: 目标坐标

#### Scroll-Tool
- **功能**: 垂直或水平滚动
- **用途**: 页面滚动、列表滚动等
- **参数**: 滚动方向, 滚动量

### 系统控制工具

#### Launch-Tool
- **功能**: 从开始菜单启动应用程序
- **用途**: 程序启动和管理
- **参数**: 应用程序名称或路径

#### Resize-Tool
- **功能**: 调整窗口大小和位置
- **用途**: 窗口管理
- **参数**: 窗口句柄, 新的大小和位置

#### Shell-Tool
- **功能**: 执行PowerShell命令
- **用途**: 系统级操作和脚本执行
- **参数**: PowerShell命令字符串

#### Shortcut-Tool
- **功能**: 执行键盘快捷键
- **用途**: 快速操作和系统命令
- **参数**: 快捷键组合

#### Key-Tool
- **功能**: 按下单个按键
- **用途**: 单键操作
- **参数**: 按键代码

#### Wait-Tool
- **功能**: 暂停执行指定时间
- **用途**: 等待操作完成
- **参数**: 等待时间（毫秒）

### 信息获取工具

#### State-Tool
- **功能**: 获取系统状态和UI快照
- **用途**: 屏幕截图、系统信息收集
- **输出**:
  - 语言设置
  - 浏览器状态
  - 活动应用程序
  - 交互式元素信息
  - 桌面截图

#### Scrape-Tool
- **功能**: 提取网页信息
- **用途**: 网页内容分析
- **参数**: 目标URL或页面元素

#### Clipboard-Tool
- **功能**: 剪贴板操作
- **用途**: 复制粘贴功能
- **操作**: 复制、粘贴、获取剪贴板内容

## 技术实现

### 架构设计
```
AI Agent
    ↓
MCP Protocol
    ↓
Windows MCP Server
    ↓
Windows UI Automation API
    ↓
Windows System
```

### 核心依赖
- Python 3.13+
- Windows UI Automation
- PowerShell
- 系统剪贴板API

### 性能指标
- **响应时间**: 0.7-2.5秒（取决于系统负载）
- **支持并发**: 单线程操作
- **内存占用**: 轻量级设计

## 使用限制

### 不支持的功能
1. **文本段落选择**: 无法选择特定的文本段落部分
2. **IDE编程**: 不适合复杂的IDE编程操作
3. **游戏交互**: 无法用于视频游戏交互

### 安全考虑
- 需要适当的系统权限
- 建议在沙盒环境中测试
- 遵循最小权限原则

## 集成示例

### MCP配置
```json
{
  "mcpServers": {
    "windows-automation": {
      "command": "python",
      "args": ["-m", "windows_mcp.server"],
      "env": {
        "WINDOWS_MCP_LOG_LEVEL": "INFO"
      }
    }
  }
}
```

### 使用示例
```typescript
// 获取屏幕状态
const screenState = await mcpClient.callTool('state-tool', {});

// 启动应用程序
await mcpClient.callTool('launch-tool', {
  app: 'notepad.exe'
});

// 点击坐标
await mcpClient.callTool('click-tool', {
  x: 100,
  y: 200
});

// 输入文本
await mcpClient.callTool('type-tool', {
  text: 'Hello World'
});
```

## 适用场景

### 企业办公自动化
- 文档处理自动化
- 表格数据录入
- 邮件管理
- 报告生成

### 测试自动化
- UI测试
- 回归测试
- 用户流程验证

### 个人效率提升
- 重复任务自动化
- 文件管理
- 系统维护

## 发展路线

### 当前版本特性
- 基础UI交互
- 系统级操作
- 屏幕状态获取

### 未来计划
- 增强OCR能力
- 支持更多应用程序
- 性能优化
- 安全性增强

## 相关资源

- [官方文档](https://github.com/CursorTouch/Windows-MCP/blob/main/README.md)
- [MCP协议规范](https://modelcontextprotocol.be/)
- [Windows UI Automation文档](https://docs.microsoft.com/en-us/windows/win32/winauto/)
- [Claude Desktop集成指南](https://docs.claude.com/)

---

*文档版本: 1.0*
*最后更新: 2024-12-28*
*维护团队: DeeChat 技术团队*