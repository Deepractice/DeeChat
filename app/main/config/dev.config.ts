/**
 * 🔧 开发环境统一配置
 * 一处修改，处处生效 - 避免端口配置不同步问题
 */

export const DEV_CONFIG = {
  // 🌐 前端服务配置
  VITE: {
    PORT: 5173,  // electron-vite 默认端口
    HOST: 'localhost',
    OPEN: false, // 是否自动打开浏览器
  },

  // 🖥️ Electron 窗口配置
  ELECTRON: {
    WINDOW: {
      WIDTH: 1200,
      HEIGHT: 800,
      MIN_WIDTH: 800,
      MIN_HEIGHT: 600,
    },
    DEV_TOOLS: true, // 开发环境自动打开 DevTools
    TITLE_BAR_STYLE: 'default' as const, // 显示标准标题栏，可拖动
  },

  // 🔌 网络和超时配置
  NETWORK: {
    CONNECTION_TIMEOUT: 5000, // 连接超时 5秒
    RETRY_ATTEMPTS: 3, // 重试次数
  },

  // 📝 日志配置
  LOGGING: {
    LEVEL: 'debug' as const,
    ENABLE_IPC_LOGS: true,
    ENABLE_DOMAIN_LOGS: true,
  }
} as const

// 🎯 类型导出，确保类型安全
export type DevConfig = typeof DEV_CONFIG

// 🔧 辅助函数：获取完整的 Vite URL
export const getViteDevUrl = (): string => {
  return `http://${DEV_CONFIG.VITE.HOST}:${DEV_CONFIG.VITE.PORT}`
}

// 🖼️ 辅助函数：获取窗口配置
export const getWindowConfig = () => {
  const { join } = require('path')
  return {
    title: 'DeeChat',
    width: DEV_CONFIG.ELECTRON.WINDOW.WIDTH,
    height: DEV_CONFIG.ELECTRON.WINDOW.HEIGHT,
    minWidth: DEV_CONFIG.ELECTRON.WINDOW.MIN_WIDTH,
    minHeight: DEV_CONFIG.ELECTRON.WINDOW.MIN_HEIGHT,
    titleBarStyle: DEV_CONFIG.ELECTRON.TITLE_BAR_STYLE,
    icon: join(__dirname, '../../assets/icon.png'),
  }
}

// 🐛 开发环境检查
export const isDevelopment = (): boolean => {
  return process.env.NODE_ENV === 'development'
}

// 📊 配置信息打印（用于调试）
export const printDevConfig = (): void => {
  if (isDevelopment()) {
    console.log('🔧 开发配置加载:', {
      viteUrl: getViteDevUrl(),
      windowSize: `${DEV_CONFIG.ELECTRON.WINDOW.WIDTH}x${DEV_CONFIG.ELECTRON.WINDOW.HEIGHT}`,
      devTools: DEV_CONFIG.ELECTRON.DEV_TOOLS,
      logLevel: DEV_CONFIG.LOGGING.LEVEL
    })
  }
}