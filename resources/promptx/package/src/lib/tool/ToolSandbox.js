const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const vm = require('vm');
const SandboxIsolationManager = require('./SandboxIsolationManager');
const SandboxErrorManager = require('./SandboxErrorManager');

/**
 * ToolSandbox - 工具沙箱环境管理器
 * 
 * 基于现有协议系统的工具执行环境，支持：
 * - @tool:// 协议定位工具
 * - @user://.promptx/toolbox 沙箱隔离
 * - 自动依赖管理
 * - 可复用的执行环境
 */
class ToolSandbox {
  constructor(toolReference, options = {}) {
    this.toolReference = toolReference;  // @tool://url-validator
    this.resourceManager = null;         // ResourceManager实例
    this.toolId = null;                  // 工具ID，如 url-validator
    this.toolContent = null;             // 工具文件内容
    this.toolInstance = null;            // 工具实例
    this.dependencies = [];              // 依赖列表
    this.sandboxPath = null;             // 沙箱目录路径
    this.sandboxContext = null;          // VM沙箱上下文
    this.isolationManager = null;        // 沙箱隔离管理器
    this.errorManager = new SandboxErrorManager(); // 智能错误管理器
    
    // 状态标志
    this.isAnalyzed = false;
    this.isPrepared = false;
    
    // 配置选项
    this.options = {
      timeout: 30000,
      enableDependencyInstall: true,
      rebuild: false,  // 强制重建沙箱（用于处理异常情况）
      ...options
    };
  }

  /**
   * 设置ResourceManager实例
   * @param {ResourceManager} resourceManager 
   */
  setResourceManager(resourceManager) {
    this.resourceManager = resourceManager;
  }

  /**
   * 清理沙箱状态和缓存
   * @param {boolean} deleteDirectory - 是否删除沙箱目录
   */
  async clearSandbox(deleteDirectory = false) {
    console.log(`[ToolSandbox] 清理沙箱状态${deleteDirectory ? '并删除目录' : ''}`);
    
    // 清空所有缓存和状态
    this.isAnalyzed = false;
    this.isPrepared = false;
    this.toolContent = null;
    this.toolInstance = null;
    this.dependencies = [];
    this.sandboxContext = null;
    
    // 如果需要，删除沙箱目录
    if (deleteDirectory && this.sandboxPath && await this.sandboxExists()) {
      try {
        const { rmdir } = require('fs').promises;
        await rmdir(this.sandboxPath, { recursive: true });
        console.log(`[ToolSandbox] 已删除沙箱目录 ${this.sandboxPath}`);
      } catch (error) {
        console.log(`[ToolSandbox] 删除沙箱目录时出错（可忽略）: ${error.message}`);
      }
    }
  }

  /**
   * 分析工具：加载工具内容，提取元信息和依赖
   * @returns {Promise<Object>} 分析结果
   */
  async analyze() {
    if (this.isAnalyzed && !this.options.rebuild) {
      console.log(`[ToolSandbox] 使用缓存的分析结果，依赖: ${JSON.stringify(this.dependencies)}`);
      return this.getAnalysisResult();
    }

    if (!this.resourceManager) {
      throw new Error('ResourceManager not set. Call setResourceManager() first.');
    }

    try {
      // 1. 解析工具引用，提取工具ID
      this.toolId = this.extractToolId(this.toolReference);
      
      // 2. 通过协议系统加载工具（forceReinstall时强制重新加载）
      const loadOptions = this.options.forceReinstall ? { noCache: true } : {};
      console.log(`[ToolSandbox] 加载工具 ${this.toolReference}，选项:`, loadOptions);
      
      const toolResult = await this.resourceManager.loadResource(this.toolReference, loadOptions);
      if (!toolResult.success) {
        // 调试：尝试不同的查找方式
        console.log(`🔍 调试：尝试查找工具 ${this.toolReference}`);
        const directLookup = this.resourceManager.registryData.findResourceById(`tool:${this.toolId}`, 'tool');
        console.log(`   - 直接查找 tool:${this.toolId}: ${directLookup ? '找到' : '未找到'}`);
        
        throw new Error(`Failed to load tool: ${toolResult.error.message}`);
      }
      
      this.toolContent = toolResult.content;
      
      // 调试：检查加载的工具内容
      console.log(`[ToolSandbox] 加载的工具内容前200字符:`, this.toolContent.substring(0, 200));
      
      // 3. 设置沙箱路径（工具专用沙箱）
      this.sandboxPath = await this.resolveSandboxPath();
      
      // 4. 在基础沙箱中分析工具
      await this.analyzeToolInSandbox();
      
      this.isAnalyzed = true;
      return this.getAnalysisResult();
      
    } catch (error) {
      throw new Error(`Tool analysis failed: ${error.message}`);
    }
  }

  /**
   * 准备依赖：安装依赖，准备执行环境
   * @returns {Promise<Object>} 准备结果
   */
  async prepareDependencies() {
    // 处理rebuild选项
    if (this.options.rebuild) {
      console.log(`[ToolSandbox] 手动触发重建沙箱`);
      await this.clearSandbox(true);
    }
    
    // 分析工具（如果需要）
    if (!this.isAnalyzed) {
      await this.analyze();
    }
    
    // 自动检测依赖是否需要更新
    if (!this.options.rebuild && await this.checkDependenciesNeedUpdate()) {
      console.log(`[ToolSandbox] 检测到依赖变化，自动重建沙箱`);
      await this.clearSandbox(true);
      // 重新分析以获取最新依赖
      await this.analyze();
    }
    
    if (this.isPrepared) {
      return { success: true, message: 'Dependencies already prepared' };
    }

    try {
      // 1. 确保沙箱目录存在
      await this.ensureSandboxDirectory();
      
      // 2. 如果有依赖，安装它们
      if (this.dependencies.length > 0) {
        await this.installDependencies();
      }
      
      // 3. 创建执行沙箱环境
      await this.createExecutionSandbox();
      
      this.isPrepared = true;
      return { 
        success: true, 
        sandboxPath: this.sandboxPath,
        dependencies: this.dependencies 
      };
      
    } catch (error) {
      throw new Error(`Dependency preparation failed: ${error.message}`);
    }
  }

  /**
   * 执行工具
   * @param {Object} parameters - 工具参数
   * @returns {Promise<Object>} 执行结果
   */
  async execute(parameters = {}) {
    if (!this.isPrepared) {
      await this.prepareDependencies();
    }

    try {
      // 1. 参数验证
      await this.validateParameters(parameters);
      
      // 2. 在沙箱中执行工具
      const result = await this.executeInSandbox(parameters);
      
      return {
        success: true,
        data: result,
        metadata: {
          toolId: this.toolId,
          sandboxPath: this.sandboxPath,
          executionTime: Date.now()
        }
      };
      
    } catch (error) {
      // 使用智能错误管理器分析错误
      const intelligentError = this.errorManager.analyzeError(error, {
        toolId: this.toolId,
        dependencies: this.dependencies,
        sandboxPath: this.sandboxPath,
        phase: 'execute'
      });
      
      // 抛出增强的错误对象，供上层处理自动重试
      const enhancedError = new Error(intelligentError.formattedMessage);
      enhancedError.intelligentError = intelligentError;
      enhancedError.originalError = error;
      throw enhancedError;
    }
  }

  /**
   * 提取工具ID
   * @param {string} toolReference - @tool://url-validator
   * @returns {string} 工具ID
   */
  extractToolId(toolReference) {
    const match = toolReference.match(/^@tool:\/\/(.+)$/);
    if (!match) {
      throw new Error(`Invalid tool reference format: ${toolReference}`);
    }
    return match[1];
  }

  /**
   * 解析沙箱路径
   * @returns {Promise<string>} 沙箱绝对路径
   */
  async resolveSandboxPath() {
    // 使用 @user://.promptx/toolbox/{toolId} 作为沙箱路径  
    const userDataReference = `@user://.promptx/toolbox/${this.toolId}`;
    const result = await this.resourceManager.resolveProtocolReference(userDataReference);
    
    if (!result.success) {
      throw new Error(`Failed to resolve sandbox path: ${result.error}`);
    }
    
    // 通过UserProtocol解析实际路径
    const userProtocol = this.resourceManager.protocols.get('user');
    const sandboxPath = await userProtocol.resolvePath(
      `.promptx/toolbox/${this.toolId}`, 
      new Map()
    );
    
    return sandboxPath;
  }

  /**
   * 在基础沙箱中分析工具
   */
  async analyzeToolInSandbox() {
    // 创建分析阶段的隔离管理器
    this.isolationManager = new SandboxIsolationManager(this.sandboxPath, {
      enableDependencyLoading: false,
      analysisMode: true
    });
    
    const sandbox = this.isolationManager.createIsolatedContext();
    
    // 调试：检查即将执行的代码
    console.log(`[ToolSandbox] 即将执行的工具代码中的getDependencies部分:`, 
      this.toolContent.match(/getDependencies[\s\S]*?return[\s\S]*?\]/)?.[0] || '未找到getDependencies');
    
    const script = new vm.Script(this.toolContent, { filename: `${this.toolId}.js` });
    const context = vm.createContext(sandbox);
    
    try {
      script.runInContext(context);
    } catch (error) {
      // 使用智能错误过滤处理require错误
      const filteredError = this._filterRequireError(error);
      if (filteredError) {
        throw filteredError;
      }
      // 如果是预期的require错误，继续执行
    }
    
    const exported = context.module.exports;
    
    if (!exported) {
      throw new Error(`Tool does not export anything: ${this.toolId}`);
    }
    
    // 创建工具实例
    let toolInstance;
    if (typeof exported === 'function') {
      toolInstance = new exported();
    } else if (typeof exported === 'object') {
      toolInstance = exported;
    } else {
      throw new Error(`Invalid tool export format: ${this.toolId}`);
    }
    
    // 提取依赖
    if (typeof toolInstance.getDependencies === 'function') {
      try {
        this.dependencies = toolInstance.getDependencies() || [];
        console.log(`[ToolSandbox] 提取到的依赖列表: ${JSON.stringify(this.dependencies)}`);
      } catch (error) {
        console.warn(`[ToolSandbox] Failed to get dependencies for ${this.toolId}: ${error.message}`);
        this.dependencies = [];
      }
    } else {
      console.log(`[ToolSandbox] 工具没有 getDependencies 方法`);
      this.dependencies = [];
    }
    
    this.toolInstance = toolInstance;
  }

  /**
   * 智能过滤require错误
   * @param {Error} error - 捕获的错误
   * @returns {Error|null} - 如果是真正的错误则返回Error对象，如果是预期的require错误则返回null
   * @private
   */
  _filterRequireError(error) {
    // 检查是否是MODULE_NOT_FOUND错误
    if (error.code === 'MODULE_NOT_FOUND') {
      const missingModule = this._extractMissingModuleName(error.message);
      
      if (missingModule) {
        // 获取已声明的依赖列表
        const declaredDependencies = this._extractDeclaredDependencies();
        
        // 检查缺失的模块是否在依赖声明中
        if (this._isDeclaredInDependencies(missingModule, declaredDependencies)) {
          console.log(`[ToolSandbox] 依赖 ${missingModule} 未安装，将在prepareDependencies阶段安装`);
          return null; // 预期的错误，忽略
        } else {
          return new Error(`未声明的依赖: ${missingModule}，请在getDependencies()中添加此依赖`);
        }
      }
    }
    
    // 其他错误直接返回
    return error;
  }

  /**
   * 从错误信息中提取缺失的模块名
   * @param {string} errorMessage - 错误信息
   * @returns {string|null} - 模块名或null
   * @private
   */
  _extractMissingModuleName(errorMessage) {
    // 匹配 "Cannot find module 'moduleName'" 或 "Cannot resolve module 'moduleName'"
    const match = errorMessage.match(/Cannot (?:find|resolve) module ['"]([^'"]+)['"]/);
    return match ? match[1] : null;
  }

  /**
   * 尝试从工具代码中提取已声明的依赖
   * @returns {string[]} - 依赖列表
   * @private
   */
  _extractDeclaredDependencies() {
    try {
      // 尝试通过正则表达式从代码中提取getDependencies的返回值
      const dependencyMatch = this.toolContent.match(/getDependencies\s*\(\s*\)\s*\{[\s\S]*?return\s*\[([\s\S]*?)\]/);
      
      if (dependencyMatch) {
        const dependencyString = dependencyMatch[1];
        // 提取字符串字面量
        const stringMatches = dependencyString.match(/['"]([^'"]+)['"]/g);
        if (stringMatches) {
          return stringMatches.map(str => str.slice(1, -1)); // 去掉引号
        }
      }
    } catch (error) {
      console.warn(`[ToolSandbox] 无法解析依赖声明: ${error.message}`);
    }
    
    return [];
  }

  /**
   * 检查模块是否在依赖声明中
   * @param {string} moduleName - 模块名
   * @param {string[]} declaredDependencies - 已声明的依赖列表
   * @returns {boolean} - 是否已声明
   * @private
   */
  _isDeclaredInDependencies(moduleName, declaredDependencies) {
    return declaredDependencies.some(dep => {
      // 支持 "axios@^1.6.0" 格式，提取模块名部分
      const depName = dep.split('@')[0];
      return depName === moduleName;
    });
  }

  /**
   * 检查沙箱目录是否存在
   * @returns {Promise<boolean>}
   */
  async sandboxExists() {
    try {
      await fs.access(this.sandboxPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 确保沙箱目录存在
   */
  async ensureSandboxDirectory() {
    try {
      await fs.access(this.sandboxPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(this.sandboxPath, { recursive: true });
      } else {
        throw error;
      }
    }
  }

  /**
   * 安装依赖
   */
  async installDependencies() {
    if (this.dependencies.length === 0) {
      return;
    }

    // 1. 创建package.json
    await this.createPackageJson();
    
    // 2. 使用内置pnpm安装依赖
    await this.runPnpmInstall();
  }

  /**
   * 检查依赖是否需要更新
   * @returns {Promise<boolean>} true表示需要更新
   */
  async checkDependenciesNeedUpdate() {
    const packageJsonPath = path.join(this.sandboxPath, 'package.json');
    
    try {
      // 读取现有的package.json
      const existingContent = await fs.readFile(packageJsonPath, 'utf-8');
      const existingPackageJson = JSON.parse(existingContent);
      const existingDeps = existingPackageJson.dependencies || {};
      
      // 构建新的依赖对象
      const newDeps = {};
      for (const dep of this.dependencies) {
        if (dep.includes('@')) {
          const [name, version] = dep.split('@');
          newDeps[name] = version;
        } else {
          newDeps[dep] = 'latest';
        }
      }
      
      // 比较依赖是否一致
      const existingKeys = Object.keys(existingDeps).sort();
      const newKeys = Object.keys(newDeps).sort();
      
      // 检查键是否相同
      if (existingKeys.length !== newKeys.length || 
          !existingKeys.every((key, index) => key === newKeys[index])) {
        console.log(`[ToolSandbox] 依赖列表变化 - 旧: ${existingKeys.join(', ')} | 新: ${newKeys.join(', ')}`);
        return true;
      }
      
      // 检查版本是否相同
      for (const key of existingKeys) {
        if (existingDeps[key] !== newDeps[key]) {
          console.log(`[ToolSandbox] 依赖版本变化 - ${key}: ${existingDeps[key]} -> ${newDeps[key]}`);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      // 文件不存在或解析失败，需要创建
      console.log(`[ToolSandbox] package.json不存在或无效，需要创建`);
      return true;
    }
  }

  /**
   * 创建package.json
   */
  async createPackageJson() {
    const packageJsonPath = path.join(this.sandboxPath, 'package.json');
    
    const packageJson = {
      name: `toolbox-${this.toolId}`,
      version: '1.0.0',
      description: `Sandbox for tool: ${this.toolId}`,
      private: true,
      dependencies: {}
    };
    
    // 解析依赖格式 ["validator@^13.11.0", "lodash"]
    console.log(`[ToolSandbox] 正在处理依赖列表: ${JSON.stringify(this.dependencies)}`);
    for (const dep of this.dependencies) {
      if (dep.includes('@')) {
        const [name, version] = dep.split('@');
        console.log(`[ToolSandbox] 解析依赖 "${dep}" => name="${name}", version="${version}"`);
        packageJson.dependencies[name] = version;
      } else {
        packageJson.dependencies[dep] = 'latest';
      }
    }
    
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
  }

  /**
   * 运行pnpm安装
   */
  async runPnpmInstall() {
    return new Promise((resolve, reject) => {
      // 获取内置pnpm路径 - 直接从node_modules获取
      const pnpmModulePath = require.resolve('pnpm');
      const pnpmBinPath = path.join(path.dirname(pnpmModulePath), 'bin', 'pnpm.cjs');
      
      const pnpm = spawn('node', [pnpmBinPath, 'install'], {
        cwd: this.sandboxPath,
        stdio: 'pipe'
      });
      
      let stdout = '';
      let stderr = '';
      
      pnpm.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      pnpm.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      pnpm.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`pnpm install failed with code ${code}: ${stderr}`));
        }
      });
      
      pnpm.on('error', (error) => {
        reject(new Error(`Failed to spawn pnpm: ${error.message}`));
      });
    });
  }

  /**
   * 创建执行沙箱环境
   */
  async createExecutionSandbox() {
    // 创建执行阶段的隔离管理器
    this.isolationManager = new SandboxIsolationManager(this.sandboxPath, {
      enableDependencyLoading: true,
      analysisMode: false
    });
    
    this.sandboxContext = this.isolationManager.createIsolatedContext();
    
    // 在完全隔离的沙箱中重新加载工具
    const script = new vm.Script(this.toolContent, { filename: `${this.toolId}.js` });
    const context = vm.createContext(this.sandboxContext);
    
    script.runInContext(context);
    const exported = context.module.exports;
    
    if (typeof exported === 'function') {
      this.toolInstance = new exported();
    } else if (typeof exported === 'object') {
      this.toolInstance = exported;
    }
  }


  /**
   * 解析协议路径（支持@project://等协议）
   * @param {string} protocolPath - 协议路径，如@project://.promptx/cwd
   * @returns {Promise<string>} 解析后的绝对路径
   */
  async resolveProtocolPath(protocolPath) {
    // 处理undefined或null的情况
    if (!protocolPath) {
      throw new Error('protocolPath is required but was undefined');
    }
    
    // 🚀 新架构：@project协议直接使用ProjectPathResolver
    if (protocolPath.startsWith('@project://')) {
      const { getGlobalProjectPathResolver } = require('../utils/ProjectPathResolver');
      const pathResolver = getGlobalProjectPathResolver();
      
      try {
        // 提取协议路径的相对部分
        const relativePath = protocolPath.replace(/^@project:\/\//, '');
        const resolvedPath = pathResolver.resolvePath(relativePath);
        
        // 确保目录存在
        const fs = require('fs').promises;
        try {
          await fs.access(resolvedPath);
        } catch (error) {
          if (error.code === 'ENOENT') {
            await fs.mkdir(resolvedPath, { recursive: true });
            console.log(`[ToolSandbox] 创建统一工作目录: ${resolvedPath}`);
          }
        }
        
        return resolvedPath;
      } catch (error) {
        throw new Error(`解析@project://路径失败: ${error.message}`);
      }
    }
    
    // 其他协议路径使用ResourceManager解析
    if (protocolPath.startsWith('@')) {
      if (!this.resourceManager) {
        throw new Error('ResourceManager not set. Cannot resolve protocol path.');
      }
      
      // 其他协议处理逻辑保持不变
      throw new Error(`暂不支持的协议路径: ${protocolPath}`);
    }
    
    // 普通路径直接返回
    return protocolPath;
  }




  /**
   * 参数验证
   */
  async validateParameters(parameters) {
    if (typeof this.toolInstance.validate === 'function') {
      const result = this.toolInstance.validate(parameters);
      
      if (typeof result === 'boolean' && !result) {
        throw new Error('Parameter validation failed');
      } else if (result && typeof result === 'object' && !result.valid) {
        throw new Error(`Parameter validation failed: ${result.errors?.join(', ')}`);
      }
    }
  }

  /**
   * 在沙箱中执行工具
   */
  async executeInSandbox(parameters) {
    if (!this.toolInstance || typeof this.toolInstance.execute !== 'function') {
      throw new Error(`Tool ${this.toolId} does not have execute method`);
    }
    
    return await this.toolInstance.execute(parameters);
  }

  /**
   * 获取分析结果
   */
  getAnalysisResult() {
    return {
      toolId: this.toolId,
      dependencies: this.dependencies,
      sandboxPath: this.sandboxPath,
      hasMetadata: typeof this.toolInstance?.getMetadata === 'function',
      hasSchema: typeof this.toolInstance?.getSchema === 'function'
    };
  }

  /**
   * 清理沙箱资源
   */
  async cleanup() {
    // 清理隔离管理器
    if (this.isolationManager) {
      this.isolationManager.cleanup();
      this.isolationManager = null;
    }
    
    // 清理其他资源
    this.sandboxContext = null;
    this.toolInstance = null;
  }

  /**
   * 获取工具元信息
   */
  getToolMetadata() {
    if (this.toolInstance && typeof this.toolInstance.getMetadata === 'function') {
      return this.toolInstance.getMetadata();
    }
    return null;
  }

  /**
   * 获取工具Schema
   */
  getToolSchema() {
    if (this.toolInstance && typeof this.toolInstance.getSchema === 'function') {
      return this.toolInstance.getSchema();
    }
    return null;
  }
}

module.exports = ToolSandbox;