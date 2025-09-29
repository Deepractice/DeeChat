# macOS MCP 工具文档

## 概述

macOS MCP (Model Context Protocol) 工具集是专为macOS系统设计的AI助手自动化解决方案。通过原生无障碍API、AppleScript和系统集成，提供了全面的macOS桌面控制能力。

## 工具生态概览

macOS MCP生态包含多个专业化的服务器，每个都针对特定的自动化需求：

| 工具名称 | 开发者 | 主要功能 | 特色 |
|---------|--------|----------|------|
| macOS UI Automation | mb-dev | UI元素交互 | 像Playwright但针对原生macOS应用 |
| macOS Automator | steipete | AppleScript/JXA执行 | 丰富的脚本知识库 |
| macOS Screenshot | kazuph | 截图和OCR | 支持多语言OCR识别 |
| Automation MCP | ashwwwin | 完整桌面控制 | 鼠标键盘全面控制 |
| Remote macOS Control | baryhuang | 远程控制 | 跨网络macOS控制 |

## 核心工具详解

### 1. macOS UI Automation MCP (mb-dev)

#### 项目信息
- **项目地址**: https://playbooks.com/mcp/mb-dev-macos-ui-automation
- **特色**: "像Playwright，但针对原生macOS应用"
- **技术**: 原生无障碍API集成

#### 核心功能
- **UI元素识别**: 自动识别和交互macOS应用中的UI元素
- **自然语言控制**: 通过自然语言命令导航应用界面
- **跨应用支持**: 支持所有符合无障碍标准的macOS应用
- **截图分析**: 自动截图并分析界面状态

#### 配置示例
```json
{
  "mcpServers": {
    "macos_ui_automation": {
      "command": "npx",
      "args": ["-y", "@mb-dev/macos-ui-automation-mcp"]
    }
  }
}
```

### 2. macOS Automator MCP (steipete)

#### 项目信息
- **项目地址**: https://github.com/steipete/macos-automator-mcp
- **开源协议**: MIT License
- **专长**: AppleScript和JavaScript for Automation (JXA)

#### 核心功能

##### 脚本执行能力
- **AppleScript执行**: 运行传统的AppleScript自动化脚本
- **JXA支持**: 执行JavaScript for Automation脚本
- **内联脚本**: 支持直接在命令中编写脚本
- **脚本文件**: 支持外部脚本文件执行
- **参数传递**: 支持向脚本传递参数

##### 预定义脚本库
- **系统控制**: 音量、亮度、电源管理
- **应用操作**: Finder、Safari、Mail等常用应用控制
- **文件管理**: 文件复制、移动、删除操作
- **网络操作**: 网络设置、连接管理

#### 配置示例
```json
{
  "mcpServers": {
    "macos_automator": {
      "command": "npx",
      "args": ["-y", "@steipete/macos-automator-mcp@latest"]
    }
  }
}
```

### 3. macOS Screenshot MCP (kazuph)

#### 项目信息
- **项目地址**: https://github.com/kazuph/mcp-screenshot
- **特色**: 专业的截图和OCR服务
- **多语言支持**: 特别优化了日语和英语识别

#### 核心功能

##### 截图能力
- **全屏截图**: 捕获整个桌面
- **区域截图**: 左半屏、右半屏自定义区域
- **窗口截图**: 特定应用窗口截图
- **定时截图**: 支持延时截图

##### OCR识别
- **多语言OCR**: 支持日语、英语等多种语言
- **高精度识别**: 使用先进的OCR引擎
- **多格式输出**: JSON、Markdown、垂直、水平等格式
- **文本提取**: 从图像中提取结构化文本

#### 配置示例
```json
{
  "mcpServers": {
    "macos_screenshot": {
      "command": "npx",
      "args": ["-y", "@kazuph/mcp-screenshot"],
      "env": {
        "OCR_API_URL": "http://localhost:8000"
      }
    }
  }
}
```

### 4. Automation MCP (ashwwwin)

#### 项目信息
- **项目地址**: https://github.com/ashwwwin/automation-mcp
- **特色**: 完整的桌面自动化解决方案

#### 核心功能

##### 鼠标控制 🖱️
- **精确点击**: 支持像素级精确点击
- **拖拽操作**: 支持复杂的拖拽操作
- **滚动控制**: 垂直、水平滚动控制
- **鼠标移动**: 平滑的鼠标移动轨迹

##### 键盘控制 ⌨️
- **文本输入**: 模拟真实的键盘输入
- **快捷键**: 支持所有系统快捷键
- **组合键**: 复杂的组合键操作
- **特殊键**: Fn、Command、Option等特殊键

##### 高级功能
- **窗口管理**: 窗口切换、大小调整、位置移动
- **应用控制**: 启动、关闭、前台显示应用
- **系统集成**: 与系统通知、菜单栏集成

### 5. Remote macOS Control MCP (baryhuang)

#### 项目信息
- **项目地址**: https://github.com/baryhuang/mcp-remote-macos-use
- **特色**: 首个开源远程macOS控制MCP服务器
- **优势**: 无需额外API密钥，完全使用Claude Pro计划

#### 核心功能
- **远程连接**: 通过网络连接远程macOS设备
- **屏幕共享**: 获取远程桌面截图
- **远程控制**: 完整的远程桌面操作能力
- **安全连接**: 基于macOS内置屏幕共享功能

## 系统权限配置

### 无障碍权限 (Accessibility)
```bash
# 系统设置路径
系统设置 > 隐私与安全性 > 辅助功能

# 需要添加的应用
- Terminal (如果通过终端运行)
- Claude Desktop
- 自定义MCP客户端应用
```

### 自动化权限 (Automation)
```bash
# 系统设置路径
系统设置 > 隐私与安全性 > 自动化

# 权限配置
Terminal 需要控制:
  ✓ Finder
  ✓ Safari
  ✓ Mail
  ✓ 其他目标应用
```

### 屏幕录制权限 (Screen Recording)
```bash
# 系统设置路径
系统设置 > 隐私与安全性 > 屏幕录制

# 截图功能必需权限
- 允许应用录制屏幕内容
- 用于截图和UI分析
```

## 技术架构

### 整体架构
```
AI Agent (Claude)
    ↓
MCP Protocol
    ↓
macOS MCP Servers
    ↓
┌─────────────┬─────────────┬─────────────┐
│ Accessibility │ AppleScript │ Screen API  │
│     API       │     Engine  │   & OCR     │
└─────────────┴─────────────┴─────────────┘
    ↓                ↓              ↓
macOS System    macOS Apps    Screen Content
```

### 核心技术栈
- **Node.js**: 18.0.0+ (推荐)
- **AppleScript引擎**: macOS原生支持
- **无障碍API**: macOS Accessibility框架
- **OCR引擎**: 第三方OCR服务集成
- **屏幕API**: Core Graphics框架

## 应用场景

### 企业办公自动化
```javascript
// 自动处理邮件
await mcpClient.callTool('applescript', {
  script: `
    tell application "Mail"
      set newMessage to make new outgoing message
      set content of newMessage to "自动生成的报告"
      send newMessage
    end tell
  `
});

// 批量文件处理
await mcpClient.callTool('ui_automation', {
  action: 'batch_process_files',
  folder: '/Users/username/Documents'
});
```

### 设计工作流
```javascript
// Photoshop自动化
await mcpClient.callTool('applescript', {
  script: `
    tell application "Adobe Photoshop 2024"
      open file "template.psd"
      -- 执行设计操作
      save current document
    end tell
  `
});
```

### 系统管理
```javascript
// 系统监控
const systemState = await mcpClient.callTool('screenshot_ocr', {
  region: 'system_monitor',
  ocr: true
});

// 网络诊断
await mcpClient.callTool('applescript', {
  script: 'do shell script "ping -c 4 google.com"'
});
```

## 性能与限制

### 性能指标
- **响应时间**: 0.5-3.0秒（取决于操作复杂度）
- **OCR处理**: 1-5秒（取决于图像复杂度）
- **AppleScript执行**: 0.1-1.0秒
- **远程控制延迟**: 网络延迟 + 1-2秒

### 使用限制
1. **权限依赖**: 必须正确配置系统权限
2. **应用兼容性**: 部分应用可能不完全支持无障碍API
3. **版本兼容**: 需要macOS 10.14+
4. **网络要求**: 远程控制需要稳定网络连接

## 安全考虑

### 权限管理
- 遵循最小权限原则
- 定期审查权限配置
- 监控自动化操作日志

### 数据安全
- 本地处理优先
- 敏感信息加密传输
- 操作审计日志记录

### 系统稳定性
- 操作前状态检查
- 错误恢复机制
- 资源使用限制

## 集成示例

### DeeChat集成配置
```json
{
  "mcpServers": {
    "macos_ui_automation": {
      "command": "npx",
      "args": ["-y", "@mb-dev/macos-ui-automation-mcp"],
      "timeout": 30000
    },
    "macos_automator": {
      "command": "npx",
      "args": ["-y", "@steipete/macos-automator-mcp@latest"],
      "timeout": 15000
    },
    "macos_screenshot": {
      "command": "npx",
      "args": ["-y", "@kazuph/mcp-screenshot"],
      "env": {
        "OCR_API_URL": "http://localhost:8000",
        "OCR_LANGUAGES": "ja,en"
      }
    }
  }
}
```

### TypeScript使用示例
```typescript
// 截图并分析
const screenshot = await mcpClient.callTool('take_screenshot', {
  region: 'full_screen',
  ocr: true,
  language: 'en'
});

// UI自动化
await mcpClient.callTool('click_element', {
  app: 'Safari',
  element: 'address_bar'
});

await mcpClient.callTool('type_text', {
  text: 'https://example.com'
});

// AppleScript执行
await mcpClient.callTool('run_applescript', {
  script: `
    tell application "System Events"
      keystroke return
    end tell
  `
});
```

## 故障排除

### 常见问题
1. **权限被拒绝**: 检查系统权限设置
2. **脚本执行失败**: 验证AppleScript语法
3. **OCR识别错误**: 检查OCR服务状态
4. **连接超时**: 调整网络和超时设置

### 调试工具
- **Console.app**: 查看系统日志
- **Accessibility Inspector**: 调试UI元素
- **Script Editor**: 测试AppleScript
- **网络诊断**: 检查远程连接

## 发展趋势

### 2024年发展
- MCP协议标准化
- Claude Computer Use集成
- 更多第三方工具支持
- 增强的安全特性

### 未来规划
- AI视觉分析集成
- 更智能的UI理解
- 跨平台兼容性
- 企业级安全增强

## 相关资源

- [MCP官方规范](https://modelcontextprotocol.be/)
- [macOS无障碍编程指南](https://developer.apple.com/accessibility/)
- [AppleScript语言指南](https://developer.apple.com/library/archive/documentation/AppleScript/)
- [Claude Desktop文档](https://docs.claude.com/)
- [macOS自动化最佳实践](https://developer.apple.com/automation/)

---

*文档版本: 1.0*
*最后更新: 2024-12-28*
*维护团队: DeeChat 技术团队*