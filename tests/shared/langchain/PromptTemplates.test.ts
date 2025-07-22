import { BUILT_IN_TEMPLATES, FEW_SHOT_TEMPLATES, TemplateManager } from '../../../src/shared/langchain/PromptTemplates';
import { ChatPromptTemplate } from '@langchain/core/prompts';

describe('PromptTemplates', () => {
  describe('BUILT_IN_TEMPLATES', () => {
    it('should contain all expected templates', () => {
      const expectedTemplates = [
        'basic',
        'translator',
        'codeExplainer',
        'codeGenerator',
        'summarizer',
        'qa',
        'creativeWriter',
        'emailWriter',
        'dataAnalyst',
        'tutor',
        'promptxRole',
        'techWriter',
        'debugger',
        'productManager'
      ];

      expectedTemplates.forEach(templateName => {
        expect(BUILT_IN_TEMPLATES).toHaveProperty(templateName);
        expect(BUILT_IN_TEMPLATES[templateName]).toBeInstanceOf(ChatPromptTemplate);
      });
    });

    it('should format translator template correctly', async () => {
      const template = BUILT_IN_TEMPLATES.translator;
      const formatted = await template.formatMessages({
        source_language: '中文',
        target_language: 'English',
        text: '你好世界'
      });

      expect(formatted).toHaveLength(2);
      expect(formatted[0].content).toContain('中文');
      expect(formatted[0].content).toContain('English');
      expect(formatted[1].content).toBe('你好世界');
    });

    it('should format code explainer template correctly', async () => {
      const template = BUILT_IN_TEMPLATES.codeExplainer;
      const formatted = await template.formatMessages({
        language: 'javascript',
        code: 'console.log("Hello World");'
      });

      expect(formatted).toHaveLength(2);
      expect(formatted[1].content).toContain('```javascript');
      expect(formatted[1].content).toContain('console.log("Hello World");');
    });

    it('should format promptx role template correctly', async () => {
      const template = BUILT_IN_TEMPLATES.promptxRole;
      const formatted = await template.formatMessages({
        role_name: 'Senior Developer',
        role_description: 'An experienced software engineer',
        capabilities: 'Code review, architecture design',
        principles: 'Clean code, best practices',
        user_input: 'Help me with React hooks'
      });

      expect(formatted).toHaveLength(2);
      expect(formatted[0].content).toContain('Senior Developer');
      expect(formatted[0].content).toContain('experienced software engineer');
      expect(formatted[1].content).toBe('Help me with React hooks');
    });
  });

  describe('FEW_SHOT_TEMPLATES', () => {
    it('should contain expected few-shot templates', () => {
      expect(FEW_SHOT_TEMPLATES).toHaveProperty('sentimentAnalysis');
      expect(FEW_SHOT_TEMPLATES).toHaveProperty('codeCommenting');
    });
  });

  describe('TemplateManager', () => {
    describe('getTemplate', () => {
      it('should return the correct template', () => {
        const template = TemplateManager.getTemplate('translator');
        expect(template).toBe(BUILT_IN_TEMPLATES.translator);
      });

      it('should throw error for non-existent template', () => {
        expect(() => {
          TemplateManager.getTemplate('nonExistent' as any);
        }).toThrow("Template 'nonExistent' not found");
      });
    });

    describe('getFewShotTemplate', () => {
      it('should return the correct few-shot template', () => {
        const template = TemplateManager.getFewShotTemplate('sentimentAnalysis');
        expect(template).toBe(FEW_SHOT_TEMPLATES.sentimentAnalysis);
      });

      it('should throw error for non-existent few-shot template', () => {
        expect(() => {
          TemplateManager.getFewShotTemplate('nonExistent' as any);
        }).toThrow("Few-shot template 'nonExistent' not found");
      });
    });

    describe('listTemplates', () => {
      it('should return all template names', () => {
        const templates = TemplateManager.listTemplates();
        expect(templates).toContain('translator');
        expect(templates).toContain('codeExplainer');
        expect(templates).toContain('promptxRole');
        expect(templates.length).toBeGreaterThan(10);
      });
    });

    describe('listFewShotTemplates', () => {
      it('should return all few-shot template names', () => {
        const templates = TemplateManager.listFewShotTemplates();
        expect(templates).toContain('sentimentAnalysis');
        expect(templates).toContain('codeCommenting');
      });
    });

    describe('createCustomTemplate', () => {
      it('should create a custom template', async () => {
        const template = TemplateManager.createCustomTemplate(
          'You are a helpful assistant specialized in {domain}',
          'Please help me with: {request}'
        );

        const formatted = await template.formatMessages({
          domain: 'web development',
          request: 'creating a React component'
        });

        expect(formatted).toHaveLength(2);
        expect(formatted[0].content).toContain('web development');
        expect(formatted[1].content).toContain('creating a React component');
      });
    });
  });
});
