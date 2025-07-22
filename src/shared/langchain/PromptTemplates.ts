import { ChatPromptTemplate } from "@langchain/core/prompts";

/**
 * 内置提示词模板库
 * 为ProjectS提供常用的提示词模板
 */
export const BUILT_IN_TEMPLATES = {
  // 基础对话模板
  basic: ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful AI assistant."],
    ["human", "{input}"]
  ]),

  // 翻译模板
  translator: ChatPromptTemplate.fromMessages([
    ["system", "You are a professional translator. Translate the following text from {source_language} to {target_language}. Maintain the original meaning and tone."],
    ["human", "{text}"]
  ]),

  // 代码解释模板
  codeExplainer: ChatPromptTemplate.fromMessages([
    ["system", "You are a senior software engineer. Explain the following code clearly and concisely. Include what it does, how it works, and any important details."],
    ["human", "```{language}\n{code}\n```"]
  ]),

  // 代码生成模板
  codeGenerator: ChatPromptTemplate.fromMessages([
    ["system", "You are an expert programmer. Generate clean, efficient, and well-commented code based on the requirements. Use {language} programming language."],
    ["human", "Requirements: {requirements}"]
  ]),

  // 总结模板
  summarizer: ChatPromptTemplate.fromMessages([
    ["system", "You are an expert at summarizing content. Provide a concise and comprehensive summary of the following text. Highlight the key points and main ideas."],
    ["human", "{text}"]
  ]),

  // 问答模板
  qa: ChatPromptTemplate.fromMessages([
    ["system", "You are a knowledgeable assistant. Answer the following question accurately and comprehensively. If you're not sure about something, say so."],
    ["human", "Question: {question}\n\nContext (if provided): {context}"]
  ]),

  // 创意写作模板
  creativeWriter: ChatPromptTemplate.fromMessages([
    ["system", "You are a creative writer. Write engaging and original content based on the given prompt. Be creative, descriptive, and maintain good narrative flow."],
    ["human", "Writing prompt: {prompt}\n\nStyle: {style}\nLength: {length}"]
  ]),

  // 邮件写作模板
  emailWriter: ChatPromptTemplate.fromMessages([
    ["system", "You are a professional email writer. Compose a well-structured, polite, and effective email based on the given requirements."],
    ["human", "Email type: {type}\nRecipient: {recipient}\nPurpose: {purpose}\nKey points: {key_points}\nTone: {tone}"]
  ]),

  // 数据分析模板
  dataAnalyst: ChatPromptTemplate.fromMessages([
    ["system", "You are a data analyst. Analyze the provided data and provide insights, trends, and recommendations. Be specific and data-driven in your analysis."],
    ["human", "Data: {data}\n\nAnalysis focus: {focus}\nQuestions to answer: {questions}"]
  ]),

  // 学习助手模板
  tutor: ChatPromptTemplate.fromMessages([
    ["system", "You are a patient and knowledgeable tutor. Explain the concept clearly, provide examples, and help the student understand step by step."],
    ["human", "Subject: {subject}\nTopic: {topic}\nStudent level: {level}\nSpecific question: {question}"]
  ]),

  // PromptX角色模板
  promptxRole: ChatPromptTemplate.fromMessages([
    ["system", "You are {role_name}. {role_description}\n\nYour capabilities:\n{capabilities}\n\nYour working principles:\n{principles}\n\nPlease respond in character and use your specialized knowledge to help the user."],
    ["human", "{user_input}"]
  ]),

  // 技术文档模板
  techWriter: ChatPromptTemplate.fromMessages([
    ["system", "You are a technical writer. Create clear, comprehensive, and well-structured technical documentation. Use appropriate formatting and include examples where helpful."],
    ["human", "Documentation type: {doc_type}\nTopic: {topic}\nAudience: {audience}\nKey information: {information}"]
  ]),

  // 调试助手模板
  debugger: ChatPromptTemplate.fromMessages([
    ["system", "You are a debugging expert. Analyze the provided code and error information to identify the issue and suggest solutions. Be systematic and thorough."],
    ["human", "Programming language: {language}\nCode: {code}\nError message: {error}\nExpected behavior: {expected}"]
  ]),

  // 产品经理模板
  productManager: ChatPromptTemplate.fromMessages([
    ["system", "You are an experienced product manager. Analyze requirements, suggest features, and provide strategic insights for product development."],
    ["human", "Product context: {context}\nUser needs: {needs}\nBusiness goals: {goals}\nConstraints: {constraints}\nQuestion: {question}"]
  ])
};

/**
 * 少样本学习模板示例
 * 注意：FewShotChatMessagePromptTemplate.fromExamples 在新版本LangChain中可能已更改
 * 暂时注释掉，使用基础的ChatPromptTemplate
 */
export const FEW_SHOT_TEMPLATES = {
  // 情感分析模板
  sentimentAnalysis: ChatPromptTemplate.fromMessages([
    ["system", "You are a sentiment analysis expert. Analyze the sentiment and respond with 'Positive', 'Negative', or 'Neutral'."],
    ["human", "{input}"]
  ]),

  // 代码注释生成模板
  codeCommenting: ChatPromptTemplate.fromMessages([
    ["system", "You are a code documentation expert. Add helpful comments to the given code."],
    ["human", "Add comments to this code: {input}"]
  ])
};

/**
 * 获取模板的辅助函数
 */
export class TemplateManager {
  /**
   * 获取内置模板
   */
  static getTemplate(name: keyof typeof BUILT_IN_TEMPLATES): ChatPromptTemplate {
    const template = BUILT_IN_TEMPLATES[name];
    if (!template) {
      throw new Error(`Template '${name}' not found`);
    }
    return template;
  }

  /**
   * 获取少样本模板
   */
  static getFewShotTemplate(name: keyof typeof FEW_SHOT_TEMPLATES): ChatPromptTemplate {
    const template = FEW_SHOT_TEMPLATES[name];
    if (!template) {
      throw new Error(`Few-shot template '${name}' not found`);
    }
    return template;
  }

  /**
   * 列出所有可用的模板
   */
  static listTemplates(): string[] {
    return Object.keys(BUILT_IN_TEMPLATES);
  }

  /**
   * 列出所有可用的少样本模板
   */
  static listFewShotTemplates(): string[] {
    return Object.keys(FEW_SHOT_TEMPLATES);
  }

  /**
   * 创建自定义模板
   */
  static createCustomTemplate(
    systemPrompt: string,
    humanPrompt: string
  ): ChatPromptTemplate {
    return ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      ["human", humanPrompt]
    ]);
  }
}
