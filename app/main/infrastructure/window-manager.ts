import { BrowserWindow } from 'electron'
import { join } from 'path'
import { getViteDevUrl, getWindowConfig, isDevelopment, printDevConfig } from '../config/dev.config.js'

// electron-vite 自动提供 __filename 和 __dirname

export class WindowManager {
  private mainWindow: BrowserWindow | null = null

  async createMainWindow(): Promise<BrowserWindow> {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.focus()
      return this.mainWindow
    }

    console.log('🪟 创建主窗口...')
    
    // 🔧 打印开发配置信息
    printDevConfig()

    // 🎛️ 使用统一配置创建窗口
    const windowConfig = getWindowConfig()
    this.mainWindow = new BrowserWindow({
      ...windowConfig,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, '../preload/preload.js')
      },
      show: false // 先隐藏，加载完成后显示
    })

    // 设置窗口事件
    this.setupWindowEvents()

    // 加载页面
    await this.loadContent()

    // 显示窗口
    this.mainWindow.show()

    console.log('✅ 主窗口创建完成')
    return this.mainWindow
  }

  private setupWindowEvents(): void {
    if (!this.mainWindow) return

    // 窗口关闭事件
    this.mainWindow.on('closed', () => {
      this.mainWindow = null
    })

    // 窗口准备显示事件
    this.mainWindow.once('ready-to-show', () => {
      console.log('🎨 窗口准备就绪')
    })

    // 🔧 开发环境下自动打开开发者工具（基于配置）
    if (isDevelopment()) {
      this.mainWindow.webContents.openDevTools()
    }
  }

  private async loadContent(): Promise<void> {
    if (!this.mainWindow) return

    try {
      if (isDevelopment()) {
        // 🌐 开发环境：使用统一配置连接Vite开发服务器
        const viteUrl = getViteDevUrl()
        await this.mainWindow.loadURL(viteUrl)
        console.log(`🔗 已连接到Vite开发服务器: ${viteUrl}`)
      } else {
        // 📦 生产环境：加载打包后的文件
        await this.mainWindow.loadFile(join(__dirname, '../renderer/dist/index.html'))
        console.log('📦 已加载生产构建文件')
      }
    } catch (error) {
      console.error('❌ 加载页面失败:', error)
      throw error
    }
  }

  // 获取主窗口实例
  getMainWindow(): BrowserWindow | null {
    return this.mainWindow
  }

  // 重新加载页面
  reload(): void {
    if (this.mainWindow) {
      this.mainWindow.reload()
    }
  }

  // 切换开发者工具
  toggleDevTools(): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.toggleDevTools()
    }
  }

  // 最小化窗口
  minimize(): void {
    if (this.mainWindow) {
      this.mainWindow.minimize()
    }
  }

  // 最大化窗口
  maximize(): void {
    if (this.mainWindow) {
      if (this.mainWindow.isMaximized()) {
        this.mainWindow.unmaximize()
      } else {
        this.mainWindow.maximize()
      }
    }
  }

  // 关闭窗口
  close(): void {
    if (this.mainWindow) {
      this.mainWindow.close()
    }
  }
}