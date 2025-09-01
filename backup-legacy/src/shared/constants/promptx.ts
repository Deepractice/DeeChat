import { join } from 'path'
import { homedir, platform } from 'os'
import * as crypto from 'crypto'

/**
 * PromptX标准目录结构（遵循PromptX内部约定）
 * - 全局PromptX目录: ~/.promptx
 * - 项目目录结构: ~/.promptx/project/{projectHash}/.promptx/
 * - 项目记忆目录: ~/.promptx/project/{projectHash}/.promptx/memory/
 * - 项目资源目录: ~/.promptx/project/{projectHash}/.promptx/resource/
 * 
 * 环境变量支持：
 * - PROMPTX_HOME: 自定义PromptX根目录（默认~/.promptx）
 */

/**
 * 生成项目路径的Hash值（与PromptX ProjectManager一致）
 */
function generateProjectHash(projectPath: string): string {
  return crypto.createHash('md5').update(projectPath).digest('hex').substr(0, 8)
}

/**
 * 获取PromptX全局根目录（固定使用~/.promptx，遵循PromptX约定）
 */
function getPromptXHomeDir(): string {
  // 支持环境变量覆盖，但默认使用~/.promptx
  if (process.env.PROMPTX_HOME) {
    console.log(`🏠 [PromptX目录] 使用自定义PROMPTX_HOME: ${process.env.PROMPTX_HOME}`)
    return process.env.PROMPTX_HOME
  }
  
  const homeDir = homedir()
  const promptxDir = join(homeDir, '.promptx')
  
  console.log(`🏠 [PromptX目录] 使用标准目录: ${promptxDir}`)
  return promptxDir
}

/**
 * PromptX全局根目录（遵循PromptX标准）
 */
export const PROMPTX_HOME_DIR = getPromptXHomeDir()

/**
 * DeeChat项目工作目录
 * 这是PromptX init命令的workingDirectory参数，也是DeeChat的实际项目路径
 */
export const DEECHAT_PROJECT_DIR = process.env.NODE_ENV === 'development' 
  ? process.cwd() // 开发环境：当前工作目录
  : join(homedir(), 'DeeChat') // 生产环境：用户目录下的DeeChat文件夹

/**
 * DeeChat项目的Hash值（用于PromptX项目识别）
 */
export const DEECHAT_PROJECT_HASH = generateProjectHash(DEECHAT_PROJECT_DIR)

/**
 * DeeChat在PromptX中的项目目录结构
 * 遵循PromptX ProjectManager的Hash目录约定：
 * ~/.promptx/project/{projectHash}/.promptx/
 */
export const DEECHAT_PROMPTX_PROJECT_DIR = join(PROMPTX_HOME_DIR, 'project', DEECHAT_PROJECT_HASH)
export const DEECHAT_PROMPTX_MEMORY_DIR = join(DEECHAT_PROMPTX_PROJECT_DIR, '.promptx', 'memory')
export const DEECHAT_PROMPTX_RESOURCE_DIR = join(DEECHAT_PROMPTX_PROJECT_DIR, '.promptx', 'resource')

/**
 * PromptX全局系统目录（系统级角色、工具等）
 */
export const PROMPTX_SYSTEM_RESOURCE_DIR = join(PROMPTX_HOME_DIR, 'resource')
export const PROMPTX_SYSTEM_COGNITION_DIR = join(PROMPTX_HOME_DIR, 'cognition')
export const PROMPTX_SYSTEM_TOOLBOX_DIR = join(PROMPTX_HOME_DIR, 'toolbox')
export const PROMPTX_SYSTEM_WORKSPACE_DIR = join(PROMPTX_HOME_DIR, 'workspace')
export const PROMPTX_SYSTEM_LOGS_DIR = join(PROMPTX_HOME_DIR, 'logs')

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
 * 统一的PromptX环境变量设置函数
 * 确保DeeChat和PromptX使用相同的目录配置
 */
export function setPromptXEnvironmentVariables(): void {
  // 设置PromptX标准环境变量
  process.env.PROMPTX_HOME = PROMPTX_HOME_DIR
  process.env.PROMPTX_WORKSPACE = DEECHAT_PROJECT_DIR
  process.env.PROMPTX_PROJECT_PATH = DEECHAT_PROJECT_DIR
  
  // 兼容性环境变量
  process.env.PROJECT_ROOT = DEECHAT_PROJECT_DIR
  process.env.WORKSPACE_ROOT = DEECHAT_PROJECT_DIR
  
  console.log(`🔧 [PromptX环境] PROMPTX_HOME: ${PROMPTX_HOME_DIR}`)
  console.log(`🔧 [PromptX环境] PROMPTX_WORKSPACE: ${DEECHAT_PROJECT_DIR}`)
  console.log(`🔧 [PromptX环境] DeeChat项目Hash: ${DEECHAT_PROJECT_HASH}`)
}

/**
 * 导出项目Hash生成函数供其他模块使用
 */
export { generateProjectHash }