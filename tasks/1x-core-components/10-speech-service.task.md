# 任务10: WebSpeech语音识别服务

**目标(O)**:
- **功能目标**:
  - 实现基于WebSpeech API的语音识别功能
  - 提供语音转文字的核心能力
  - 支持中文语音识别和实时反馈

- **执行任务**:
  - 创建文件:
    - `renderer/services/speechService.js` - 语音识别服务模块
  - 实现功能:
    - 封装webkitSpeechRecognition API
    - 实现开始/停止录音控制
    - 提供语音识别结果回调
    - 处理语音识别错误和异常

- **任务边界**:
  - 仅负责语音识别功能，不涉及UI交互
  - 使用浏览器原生API，不依赖第三方库
  - 专注于核心转录功能，不包含高级音频处理

**环境(E)**:
- **参考资源**:
  - ARCHITECTURE.md中的SpeechService类设计
  - SYSTEM_ARCHITECTURE.md中的语音识别技术细节

- **上下文信息**:
  - 可与其他1x任务并行开发，使用标准接口
  - 目标环境：支持WebSpeech的现代浏览器
  - 语言设置：优先中文识别，支持中英混合
  - 性能要求：实时响应，延迟<500ms

- **注意事项**:
  - 需要处理浏览器兼容性问题
  - 必须实现错误处理和降级方案
  - 语音权限需要用户授权
  - 网络状态可能影响识别质量

**实现指导(I)**:
- **核心API封装**:
  ```javascript
  class SpeechService {
    constructor() {
      this.recognition = null;
      this.isRecording = false;
      this.callbacks = {};
    }
    
    // 核心方法
    startRecording()    // 开始语音识别
    stopRecording()     // 停止语音识别  
    onResult(callback)  // 设置结果回调
    onError(callback)   // 设置错误回调
  }
  ```

- **配置参数**:
  ```javascript
  const config = {
    continuous: true,           // 连续识别
    lang: 'zh-CN',             // 中文识别
    interimResults: true,      // 实时结果
    maxAlternatives: 1         // 最佳匹配
  };
  ```

- **代码模板**:
  ```javascript
  // renderer/services/speechService.js
  class SpeechService {
    constructor() {
      this.recognition = null;
      this.isRecording = false;
      this.callbacks = {
        onResult: null,
        onError: null,
        onEnd: null
      };
      this.initializeRecognition();
    }
    
    initializeRecognition() {
      if (!('webkitSpeechRecognition' in window)) {
        throw new Error('当前浏览器不支持语音识别');
      }
      
      this.recognition = new webkitSpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.lang = 'zh-CN';
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      
      this.setupEventHandlers();
    }
    
    setupEventHandlers() {
      this.recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }
        
        if (this.callbacks.onResult) {
          this.callbacks.onResult({
            final: finalTranscript,
            interim: interimTranscript,
            isFinal: finalTranscript.length > 0
          });
        }
      };
      
      this.recognition.onerror = (event) => {
        if (this.callbacks.onError) {
          this.callbacks.onError(event.error);
        }
      };
      
      this.recognition.onend = () => {
        this.isRecording = false;
        if (this.callbacks.onEnd) {
          this.callbacks.onEnd();
        }
      };
    }
    
    startRecording() {
      if (this.isRecording) return false;
      
      try {
        this.recognition.start();
        this.isRecording = true;
        return true;
      } catch (error) {
        if (this.callbacks.onError) {
          this.callbacks.onError(error.message);
        }
        return false;
      }
    }
    
    stopRecording() {
      if (!this.isRecording) return false;
      
      this.recognition.stop();
      this.isRecording = false;
      return true;
    }
    
    onResult(callback) {
      this.callbacks.onResult = callback;
    }
    
    onError(callback) {
      this.callbacks.onError = callback;
    }
    
    onEnd(callback) {
      this.callbacks.onEnd = callback;
    }
    
    isSupported() {
      return 'webkitSpeechRecognition' in window;
    }
  }
  
  // 导出服务实例
  window.speechService = new SpeechService();
  ```

- **实现策略**:
  1. 先实现基础的语音识别封装
  2. 添加事件回调机制
  3. 实现错误处理和状态管理
  4. 测试中文识别效果
  5. 优化识别准确度和响应速度

**成功标准(S)**:
- **基础达标**:
  - SpeechService类成功实例化
  - startRecording()能正常启动语音识别
  - 语音输入能转换为文字并通过回调返回
  - stopRecording()能正常停止识别

- **预期品质**:
  - 中文语音识别准确率≥85%
  - 实时转录延迟<500ms
  - 错误处理机制完善，有明确的错误提示
  - 支持连续语音识别，不需要重复启动

- **卓越表现**:
  - 支持中英文混合识别
  - 提供识别置信度信息
  - 实现智能断句和标点符号 