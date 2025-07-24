const chalk = require('chalk')

/**
 * 日志工具
 * 提供彩色和格式化的日志输出
 */
class Logger {
  constructor (options = {}) {
    this.silent = options.silent || false
    this.prefix = options.prefix || 'PromptX'
  }

  /**
   * 信息日志
   */
  info (message, ...args) {
    if (this.silent) return
    console.error(chalk.blue('ℹ'), message, ...args)
  }

  /**
   * 成功日志
   */
  success (message, ...args) {
    if (this.silent) return
    console.error(chalk.green('✅'), message, ...args)
  }

  /**
   * 警告日志
   */
  warn (message, ...args) {
    if (this.silent) return
    console.error(chalk.yellow('⚠️'), chalk.yellow(message), ...args)
  }

  /**
   * 错误日志
   */
  error (message, ...args) {
    if (this.silent) return
    console.error(chalk.red('❌'), chalk.red(message), ...args)
  }

  /**
   * 调试日志
   */
  debug (message, ...args) {
    if (this.silent || !process.env.DEBUG) return
    console.error(chalk.gray('🐛'), chalk.gray(message), ...args)
  }

  /**
   * 步骤日志（用于显示进度）
   */
  step (message, ...args) {
    if (this.silent) return
    console.error(chalk.cyan('▶️'), message, ...args)
  }

  /**
   * 直接输出（不带前缀）
   */
  log (message, ...args) {
    if (this.silent) return
    console.error(message, ...args)
  }

  /**
   * 空行
   */
  newLine () {
    if (this.silent) return
    console.error('')
  }

  /**
   * 分隔线
   */
  separator (char = '=', length = 80) {
    if (this.silent) return
    console.error(chalk.gray(char.repeat(length)))
  }
}

// 导出默认实例
const logger = new Logger()

module.exports = logger
module.exports.Logger = Logger
