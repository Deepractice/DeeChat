/**
 * PromptX 核心库
 *
 * 提供AI prompt框架的核心功能，包括：
 * - 四大核心命令实现
 * - 资源管理和路径解析
 * - 格式化输出和用户交互
 * - 配置管理和错误处理
 */

// 核心命令模块
const commands = {
  hello: require('./commands/hello'),
  learn: require('./commands/learn'),
  recall: require('./commands/recall'),
  remember: require('./commands/remember')
}

// 核心功能模块
const core = {
  ResourceManager: require('./core/resource-manager'),
  PathResolver: require('./core/path-resolver'),
  OutputFormatter: require('./core/output-formatter')
}

// 工具模块
const utils = {
  logger: require('./utils/logger'),
  validator: require('./utils/validator'),
  config: require('./utils/config')
}

module.exports = {
  commands,
  core,
  utils,

  // 便捷导出
  ...commands,
  ...core,
  ...utils
}
