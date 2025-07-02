# 任务11: AI文本优化服务

**目标(O)**:
- **功能目标**:
  - 实现AI文本优化的核心功能
  - 将口述文本转换为高质量提示词
  - 支持多种国产AI模型API调用

- **执行任务**:
  - 创建文件:
    - `renderer/services/aiService.js` - AI服务模块
  - 实现功能:
    - 封装AI API调用逻辑
    - 实现提示词优化算法
    - 提供多AI服务商切换能力
    - 处理API调用错误和降级

- **任务边界**:
  - 专注于文本优化功能，不涉及UI交互
  - 优先支持Moonshot API，预留其他厂商接口
  - 不包含复杂的文本预处理，专注核心优化

**环境(E)**:
- **参考资源**:
  - ARCHITECTURE.md中的AIService类设计
  - TECH_STACK.md中的AI API选择策略

- **上下文信息**:
  - 可与其他1x任务并行开发，使用标准接口
  - API提供商：优先Moonshot，备选阿里百炼、百度文心
  - 网络要求：需要稳定的外网连接
  - 响应时间：目标<5秒，超时<10秒

- **注意事项**:
  - API Key需要外部配置提供
  - 必须处理网络超时和API限额
  - 需要实现错误重试机制
  - API响应格式可能因厂商而异

**实现指导(I)**:
- **核心API设计**:
  ```javascript
  class AIService {
    constructor() {
      this.provider = 'moonshot';
      this.apiConfig = {};
      this.requestQueue = [];
    }
    
    // 核心方法
    optimizeText(text)           // 优化文本主方法
    setProvider(provider)        // 切换AI服务商
    setApiKey(apiKey)           // 设置API密钥
    validateConnection()         // 测试连接
  }
  ```

- **优化提示词模板**:
  ```javascript
  const OPTIMIZATION_PROMPT = `请将用户的口述需求转换为专业的AI提示词，要求：
1. 结构化表达，使用清晰的分段和编号
2. 补充必要的上下文和约束条件  
3. 提升语言的专业性和准确性
4. 保持用户原始意图不变

用户原始输入：
{{userInput}}

请输出优化后的提示词：`;
  ```

- **代码模板**:
  ```javascript
  // renderer/services/aiService.js
  const axios = require('axios');
  
  class AIService {
    constructor() {
      this.provider = 'moonshot';
      this.apiConfig = {
        moonshot: {
          url: 'https://api.moonshot.cn/v1/chat/completions',
          model: 'moonshot-v1-8k',
          headers: {}
        },
        bailian: {
          url: 'https://bailian.console.aliyun.com/api',
          model: 'qwen-plus',
          headers: {}
        }
      };
      this.timeout = 10000; // 10秒超时
    }
    
    setApiKey(apiKey, provider = this.provider) {
      if (this.apiConfig[provider]) {
        this.apiConfig[provider].headers['Authorization'] = `Bearer ${apiKey}`;
      }
    }
    
    setProvider(provider) {
      if (this.apiConfig[provider]) {
        this.provider = provider;
        return true;
      }
      return false;
    }
    
    async optimizeText(originalText) {
      if (!originalText || originalText.trim().length === 0) {
        throw new Error('输入文本不能为空');
      }
      
      const prompt = this.buildOptimizationPrompt(originalText);
      
      try {
        const response = await this.callAPI(prompt);
        return this.extractOptimizedText(response);
      } catch (error) {
        console.error('AI优化失败:', error);
        return this.getFallbackOptimization(originalText);
      }
    }
    
    buildOptimizationPrompt(userInput) {
      return `请将用户的口述需求转换为专业的AI提示词，要求：
1. 结构化表达，使用清晰的分段和编号
2. 补充必要的上下文和约束条件  
3. 提升语言的专业性和准确性
4. 保持用户原始意图不变

用户原始输入：
${userInput}

请输出优化后的提示词：`;
    }
    
    async callAPI(prompt) {
      const config = this.apiConfig[this.provider];
      
      const requestData = {
        model: config.model,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的提示词优化专家，擅长将自然语言转换为高质量的AI提示词。'
          },
          {
            role: 'user', 
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      };
      
      const response = await axios.post(config.url, requestData, {
        headers: {
          'Content-Type': 'application/json',
          ...config.headers
        },
        timeout: this.timeout
      });
      
      return response.data;
    }
    
    extractOptimizedText(response) {
      // Moonshot API响应格式
      if (response.choices && response.choices[0]) {
        return response.choices[0].message.content.trim();
      }
      
      throw new Error('API响应格式异常');
    }
    
    getFallbackOptimization(originalText) {
      // 降级方案：添加基础的结构化处理
      return `## 任务需求
${originalText}

## 实现要求
请根据上述需求提供详细的解决方案。

## 输出格式
请提供结构化的回答，包含具体的实现步骤。

---
*注：AI服务暂时不可用，以上为基础优化版本*`;
    }
    
    async validateConnection() {
      try {
        const testResponse = await this.optimizeText('测试连接');
        return { 
          success: true, 
          provider: this.provider,
          message: '连接正常'
        };
      } catch (error) {
        return { 
          success: false, 
          provider: this.provider,
          error: error.message 
        };
      }
    }
  }
  
  // 导出服务实例
  window.aiService = new AIService();
  ```

- **实现策略**:
  1. 先实现Moonshot API调用基础框架
  2. 设计提示词优化的prompt模板
  3. 实现错误处理和降级机制
  4. 添加API配置和切换功能
  5. 测试优化效果和响应速度

**成功标准(S)**:
- **基础达标**:
  - AIService类成功实例化
  - optimizeText()能正常调用API并返回结果
  - 错误处理机制工作正常，有降级方案
  - API连接测试功能正常

- **预期品质**:
  - AI优化效果明显，提示词质量提升>50%
  - API调用成功率≥90%
  - 响应时间<5秒(正常网络环境)
  - 支持API Key配置和服务商切换

- **卓越表现**:
  - 支持多家AI服务商无缝切换
  - 实现智能重试和负载均衡
  - 提供优化质量评估指标 