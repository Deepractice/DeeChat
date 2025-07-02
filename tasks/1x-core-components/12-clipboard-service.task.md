# 任务12: 剪贴板操作服务

**目标(O)**:
- **功能目标**:
  - 实现一键复制文本到系统剪贴板
  - 提供剪贴板操作的用户反馈
  - 支持跨平台的剪贴板访问

- **执行任务**:
  - 创建文件:
    - `renderer/services/clipboardService.js` - 剪贴板服务模块
  - 实现功能:
    - 封装Electron clipboard API
    - 实现文本复制和读取功能
    - 提供操作成功/失败的反馈机制
    - 处理剪贴板权限和兼容性问题

- **任务边界**:
  - 专注于剪贴板文本操作，不支持富文本或文件
  - 使用Electron原生API，不依赖第三方库
  - 不涉及UI交互，仅提供服务接口

**环境(E)**:
- **参考资源**:
  - ARCHITECTURE.md中的ClipboardService类设计
  - Electron官方clipboard API文档

- **上下文信息**:
  - 可与其他1x任务并行开发，使用标准接口
  - 运行环境：Electron渲染进程
  - 平台支持：Windows(主要)、macOS(次要)
  - 权限要求：需要剪贴板访问权限

- **注意事项**:
  - 某些安全策略可能阻止剪贴板访问
  - 需要处理大文本的复制性能问题
  - 剪贴板内容可能被其他应用覆盖
  - 提供明确的操作反馈给用户

**实现指导(I)**:
- **核心API设计**:
  ```javascript
  class ClipboardService {
    constructor() {
      this.isSupported = false;
      this.lastCopiedText = '';
    }
    
    // 核心方法
    copyText(text)               // 复制文本到剪贴板
    readText()                   // 读取剪贴板文本
    isClipboardSupported()       // 检查剪贴板支持
    showCopyFeedback()           // 显示复制成功反馈
  }
  ```

- **Electron API集成**:
  ```javascript
  const { clipboard } = require('electron');
  
  // 基础复制操作
  clipboard.writeText(text);
  
  // 基础读取操作  
  const text = clipboard.readText();
  ```

- **代码模板**:
  ```javascript
  // renderer/services/clipboardService.js
  const { clipboard } = require('electron');
  
  class ClipboardService {
    constructor() {
      this.isSupported = this.checkClipboardSupport();
      this.lastCopiedText = '';
      this.copyFeedbackTimeout = null;
    }
    
    checkClipboardSupport() {
      try {
        // 测试是否可以访问clipboard
        clipboard.readText();
        return true;
      } catch (error) {
        console.warn('剪贴板不可用:', error);
        return false;
      }
    }
    
    async copyText(text) {
      if (!text || typeof text !== 'string') {
        throw new Error('复制内容不能为空');
      }
      
      if (!this.isSupported) {
        throw new Error('当前环境不支持剪贴板操作');
      }
      
      try {
        clipboard.writeText(text);
        this.lastCopiedText = text;
        
        // 验证复制是否成功
        const verifyText = clipboard.readText();
        if (verifyText === text) {
          return {
            success: true,
            message: '复制成功',
            length: text.length
          };
        } else {
          throw new Error('复制验证失败');
        }
      } catch (error) {
        console.error('复制失败:', error);
        return {
          success: false,
          error: error.message,
          fallback: this.getFallbackCopyMethod(text)
        };
      }
    }
    
    async readText() {
      if (!this.isSupported) {
        throw new Error('当前环境不支持剪贴板操作');
      }
      
      try {
        const text = clipboard.readText();
        return {
          success: true,
          text: text,
          length: text.length
        };
      } catch (error) {
        console.error('读取剪贴板失败:', error);
        return {
          success: false,
          error: error.message
        };
      }
    }
    
    getFallbackCopyMethod(text) {
      // 降级方案：提供文本选择的方式
      return {
        method: 'manual',
        message: '请手动选择并复制以下文本',
        text: text
      };
    }
    
    showCopyFeedback(element, duration = 2000) {
      if (!element) return;
      
      const originalText = element.textContent;
      element.textContent = '✅ 已复制!';
      element.style.backgroundColor = '#28a745';
      element.style.color = 'white';
      
      // 清除之前的定时器
      if (this.copyFeedbackTimeout) {
        clearTimeout(this.copyFeedbackTimeout);
      }
      
      this.copyFeedbackTimeout = setTimeout(() => {
        element.textContent = originalText;
        element.style.backgroundColor = '';
        element.style.color = '';
      }, duration);
    }
    
    isClipboardSupported() {
      return this.isSupported;
    }
    
    getLastCopiedText() {
      return this.lastCopiedText;
    }
    
    clearHistory() {
      this.lastCopiedText = '';
    }
    
    // 工具方法：格式化大文本
    formatLargeText(text, maxLength = 1000) {
      if (text.length <= maxLength) {
        return text;
      }
      
      return {
        truncated: true,
        preview: text.substring(0, maxLength) + '...',
        fullText: text,
        originalLength: text.length
      };
    }
    
    // 工具方法：文本统计
    getTextStats(text) {
      return {
        length: text.length,
        lines: text.split('\n').length,
        words: text.split(/\s+/).filter(word => word.length > 0).length,
        characters: text.replace(/\s/g, '').length
      };
    }
  }
  
  // 导出服务实例
  window.clipboardService = new ClipboardService();
  ```

- **实现策略**:
  1. 实现基础的复制和读取功能
  2. 添加剪贴板支持检测机制
  3. 实现操作结果验证和反馈
  4. 添加错误处理和降级方案
  5. 提供用户友好的反馈机制

**成功标准(S)**:
- **基础达标**:
  - ClipboardService类成功实例化
  - copyText()能正常复制文本到剪贴板
  - 复制操作有明确的成功/失败反馈
  - 支持检测剪贴板是否可用

- **预期品质**:
  - 复制成功率≥95%(正常环境下)
  - 支持大文本复制(>10KB)
  - 复制操作有immediate用户反馈
  - 错误处理机制完善，有降级方案

- **卓越表现**:
  - 提供复制内容的统计信息
  - 支持复制历史记录
  - 实现智能的文本格式化 