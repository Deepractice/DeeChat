import { app, BrowserWindow } from 'electron'
import { ApplicationBootstrapper } from './infrastructure/application-bootstrapper.js'
import { IPCRegistry } from './ipc/ipc-registry.js'
import { WindowManager } from './infrastructure/window-manager.js'

// 导入Domain类以触发@Service装饰器注册
import './domains/AIConfigurationDomain.js'
import './domains/ConversationDomain.js'

let mainWindow: BrowserWindow | null = null

async function bootstrap() {
  console.log('🏗️ DeeChat后端服务启动...')
  
  // 1. 启动应用并初始化所有服务
  const bootstrapper = new ApplicationBootstrapper()
  await bootstrapper.initialize()
  
  // 2. 注册所有Domain的IPC处理器
  const ipcRegistry = new IPCRegistry(bootstrapper)
  await ipcRegistry.registerAllDomains()
  
  // 3. 获取窗口管理器
  const windowManager = bootstrapper.resolve<WindowManager>('WindowManager')
  mainWindow = await windowManager.createMainWindow()
  
  console.log('✅ DeeChat 后端服务启动完成')
}

// 应用就绪事件
app.whenReady().then(bootstrap)

// 关闭所有窗口时退出应用
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && mainWindow === null) {
    bootstrap()
  }
})