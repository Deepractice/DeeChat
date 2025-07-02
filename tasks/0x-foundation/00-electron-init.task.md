# 任务00: Electron项目初始化

**目标(O)**:
- **功能目标**:
  - 创建可运行的Electron应用基础框架
  - 建立项目的基本文件结构
  - 确保`npm start`能够成功启动窗口

- **执行任务**:
  - 创建文件:
    - `package.json` - 项目配置和依赖定义
    - `main.js` - Electron主进程入口文件
  - 实现功能:
    - 配置Electron应用基本信息
    - 实现窗口创建和生命周期管理
    - 设置开发环境配置

- **任务边界**:
  - 仅负责Electron框架搭建，不涉及具体UI内容
  - 不包含复杂的窗口配置，使用基础设置
  - 暂不考虑打包和分发配置

**环境(E)**:
- **参考资源**:
  - [Electron官方文档](https://www.electronjs.org/docs/latest/)
  - ProjectS架构文档中的技术栈说明

- **上下文信息**:
  - 项目目标：60分钟MVP开发
  - 技术约束：Windows 10+ 环境优先
  - 窗口要求：800x600基础尺寸，支持开发工具

- **注意事项**:
  - 必须启用nodeIntegration以支持后续功能
  - 禁用contextIsolation以简化开发
  - 开发模式下自动打开DevTools

**实现指导(I)**:
- **项目结构**:
  ```
  ProjectS/
  ├── package.json
  ├── main.js
  └── renderer/ (后续任务创建)
  ```

- **技术选型**:
  - Electron版本：^28.0.0 (稳定版本)
  - 启动脚本：使用npm scripts管理

- **代码模板**:
  ```javascript
  // main.js 核心结构
  const { app, BrowserWindow } = require('electron');
  
  const createWindow = () => {
    const win = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
    
    win.loadFile('renderer/index.html');
    
    if (process.env.NODE_ENV === 'development') {
      win.webContents.openDevTools();
    }
  };
  ```

- **实现策略**:
  1. 先创建package.json基础配置
  2. 实现main.js最小可用版本
  3. 验证启动流程
  4. 添加开发环境优化

**成功标准(S)**:
- **基础达标**:
  - `npm install`安装依赖成功
  - `npm start`能启动Electron应用
  - 窗口正常显示（虽然内容为空或404）
  - 开发环境下DevTools自动打开

- **预期品质**:
  - 窗口尺寸和位置合理
  - 应用图标和标题正确显示
  - 窗口关闭时应用正确退出

- **卓越表现**:
  - 支持热重载开发模式
  - 包含基础的错误处理
  - 启动速度优化 