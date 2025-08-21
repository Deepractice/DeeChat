import { join } from 'path'
import { homedir, platform } from 'os'

/**
 * 获取跨平台的PromptX工作目录
 * - macOS: /Users/username/.promptx
 * - Linux: /home/username/.promptx  
 * - Windows: C:\Users\username\.promptx
 * 
 * 支持环境变量覆盖：
 * - PROMPTX_HOME: 自定义PromptX根目录
 * - PROMPTX_WORK_DIR: 直接指定工作目录
 */
function getPromptXWorkDir(): string {
  const currentPlatform = platform()
  
  // 1. 优先使用环境变量 PROMPTX_WORK_DIR
  if (process.env.PROMPTX_WORK_DIR) {
    console.log(`🌐 [PromptX跨平台] 使用环境变量 PROMPTX_WORK_DIR: ${process.env.PROMPTX_WORK_DIR}`)
    return process.env.PROMPTX_WORK_DIR
  }
  
  // 2. 使用自定义 PROMPTX_HOME + .promptx
  if (process.env.PROMPTX_HOME) {
    const customDir = join(process.env.PROMPTX_HOME, '.promptx')
    console.log(`🌐 [PromptX跨平台] 使用环境变量 PROMPTX_HOME: ${customDir}`)
    return customDir
  }
  
  // 3. 默认使用系统用户目录
  const homeDir = homedir()
  const promptxDir = join(homeDir, '.promptx')
  
  // 调试信息：显示不同平台的路径
  console.log(`🌐 [PromptX跨平台] 当前平台: ${currentPlatform}`)
  console.log(`🏠 [PromptX跨平台] 用户目录: ${homeDir}`)
  console.log(`📁 [PromptX跨平台] PromptX目录: ${promptxDir}`)
  
  // 平台特定处理（如果需要）
  switch (currentPlatform) {
    case 'win32':
      console.log(`🪟 [PromptX跨平台] Windows路径处理: 使用反斜杠分隔符`)
      break
    case 'darwin':
      console.log(`🍎 [PromptX跨平台] macOS路径处理: 使用正斜杠分隔符`)
      break
    case 'linux':
      console.log(`🐧 [PromptX跨平台] Linux路径处理: 使用正斜杠分隔符`)
      break
  }
  
  return promptxDir
}

/**
 * PromptX根目录配置
 * 跨平台兼容：自动适配不同操作系统的用户目录
 * 这是PromptX固定的根目录，存储全局资源：记忆、角色、工具等
 * 注意：这个目录由PromptX内部管理，我们不应该覆盖
 */
export const PROMPTX_HOME_DIR = getPromptXWorkDir()

/**
 * PromptX用户资源目录（全局）
 */
export const PROMPTX_USER_RESOURCE_DIR = join(PROMPTX_HOME_DIR, 'resource')

/**
 * PromptX认知记忆目录（全局）
 */
export const PROMPTX_COGNITION_DIR = join(PROMPTX_HOME_DIR, 'cognition')

/**
 * PromptX项目配置目录（全局）
 */
export const PROMPTX_PROJECT_DIR = join(PROMPTX_HOME_DIR, 'project')

/**
 * PromptX工具箱目录（全局）
 */
export const PROMPTX_TOOLBOX_DIR = join(PROMPTX_HOME_DIR, 'toolbox')

/**
 * PromptX工作区目录（全局）
 */
export const PROMPTX_WORKSPACE_DIR = join(PROMPTX_HOME_DIR, 'workspace')

/**
 * PromptX日志目录（全局）
 */
export const PROMPTX_LOGS_DIR = join(PROMPTX_HOME_DIR, 'logs')

/**
 * 平台信息
 */
export const PLATFORM_INFO = {
  platform: platform(),
  isWindows: platform() === 'win32',
  isMacOS: platform() === 'darwin',
  isLinux: platform() === 'linux',
  homeDir: homedir()
} as const

/**
 * DeeChat项目工作目录
 * 这是传递给PromptX init命令的workingDirectory参数
 */
export const DEECHAT_PROJECT_DIR = process.env.NODE_ENV === 'development' 
  ? process.cwd() // 开发环境：当前工作目录
  : join(PLATFORM_INFO.homeDir, 'DeeChat') // 生产环境：用户目录下的DeeChat文件夹