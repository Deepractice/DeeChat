/**
 * MCP输出适配器
 * 负责将PromptX CLI的富文本输出转换为MCP标准JSON格式
 * 
 * 设计原则：
 * - 保留所有emoji、markdown、中文字符
 * - 转换为MCP标准的content数组格式
 * - 提供统一的错误处理机制
 */
class MCPOutputAdapter {
  constructor() {
    this.version = '1.0.0';
  }
  
  /**
   * 将CLI输出转换为MCP标准格式
   * @param {any} input - CLI输出（可能是字符串、对象、PouchOutput等）
   * @returns {object} MCP标准格式的响应
   */
  convertToMCPFormat(input) {
    try {
      const text = this.normalizeInput(input);
      const sanitizedText = this.sanitizeText(text);
      
      return {
        content: [
          {
            type: 'text',
            text: sanitizedText
          }
        ]
      };
    } catch (error) {
      return this.handleError(error);
    }
  }
  
  /**
   * 标准化输入，将各种类型转换为字符串
   * @param {any} input - 输入数据
   * @returns {string} 标准化后的字符串
   */
  normalizeInput(input) {
    // 处理null和undefined
    if (input === null) return 'null';
    if (input === undefined) return 'undefined';
    
    // 处理字符串
    if (typeof input === 'string') {
      return input;
    }
    
    // 处理有toString方法的对象（如PouchOutput）
    if (input && typeof input.toString === 'function' && input.toString !== Object.prototype.toString) {
      return input.toString();
    }
    
    // 处理数组和普通对象
    if (typeof input === 'object') {
      return JSON.stringify(input, null, 2);
    }
    
    // 其他类型直接转换
    return String(input);
  }
  
  /**
   * 清理文本，确保JSON兼容性但保留所有格式
   * @param {string} text - 输入文本
   * @returns {string} 清理后的文本
   */
  sanitizeText(text) {
    // 对于MCP协议，我们实际上不需要做任何转义
    // emoji、中文字符、markdown都应该保留
    // MCP的content格式本身就支持UTF-8字符
    return text;
  }
  
  /**
   * 统一的错误处理
   * @param {Error|string} error - 错误对象或错误信息
   * @returns {object} MCP格式的错误响应
   */
  handleError(error) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : String(error);
    
    return {
      content: [
        {
          type: 'text',
          text: `❌ 执行失败: ${errorMessage}`
        }
      ],
      isError: true
    };
  }
  
  /**
   * 验证输出格式是否符合MCP标准
   * @param {object} output - 要验证的输出
   * @returns {boolean} 是否符合标准
   */
  validateMCPFormat(output) {
    if (!output || typeof output !== 'object') {
      return false;
    }
    
    if (!Array.isArray(output.content)) {
      return false;
    }
    
    return output.content.every(item => 
      item && 
      typeof item === 'object' && 
      item.type === 'text' && 
      typeof item.text === 'string'
    );
  }
  
  /**
   * 创建成功响应的快捷方法
   * @param {string} text - 响应文本
   * @returns {object} MCP格式响应
   */
  createSuccessResponse(text) {
    return this.convertToMCPFormat(text);
  }
  
  /**
   * 创建错误响应的快捷方法
   * @param {string} message - 错误消息
   * @returns {object} MCP格式错误响应
   */
  createErrorResponse(message) {
    return this.handleError(message);
  }
}

module.exports = { MCPOutputAdapter }; 