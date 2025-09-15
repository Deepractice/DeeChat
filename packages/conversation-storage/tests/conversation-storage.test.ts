import { ConversationStorage } from '../src';
import { join } from 'path';
import { tmpdir } from 'os';
import { rmSync, existsSync } from 'fs';

describe('ConversationStorage', () => {
  let storage: ConversationStorage;
  let testDbPath: string;

  beforeEach(() => {
    // 为每个测试创建唯一的数据库文件
    testDbPath = join(tmpdir(), `test-conv-${Date.now()}-${Math.random().toString(36)}.db`);
    storage = new ConversationStorage({ dbPath: testDbPath });
  });

  afterEach(() => {
    // 清理测试数据库文件
    storage.close();
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }
  });

  describe('初始化', () => {
    test('应该成功初始化', async () => {
      await storage.initialize();
      
      const health = storage.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.details.tables_managed).toContain('sessions');
      expect(health.details.tables_managed).toContain('messages');
    });

    test('应该拒绝空的数据库路径', () => {
      expect(() => {
        new ConversationStorage({ dbPath: '' });
      }).toThrow('Database path is required');
    });

    test('应该支持表前缀', async () => {
      const storageWithPrefix = new ConversationStorage({ 
        dbPath: testDbPath, 
        tablePrefix: 'test_' 
      });
      
      await storageWithPrefix.initialize();
      
      const health = storageWithPrefix.healthCheck();
      expect(health.details.table_prefix).toBe('test_');
      
      storageWithPrefix.close();
    });
  });

  describe('会话管理', () => {
    beforeEach(async () => {
      await storage.initialize();
    });

    test('应该创建会话', async () => {
      const session = await storage.createSession({
        title: '测试会话',
        ai_config_name: 'test-config'
      });

      expect(session.id).toBeTruthy();
      expect(session.title).toBe('测试会话');
      expect(session.ai_config_name).toBe('test-config');
      expect(session.message_count).toBe(0);
      expect(session.created_at).toBeTruthy();
      expect(session.updated_at).toBeTruthy();
    });

    test('应该获取会话', async () => {
      const created = await storage.createSession({
        title: '测试会话',
        ai_config_name: 'test-config'
      });

      const retrieved = storage.getSession(created.id);
      expect(retrieved).toEqual(created);
    });

    test('应该返回null对于不存在的会话', () => {
      const session = storage.getSession('non-existent-id');
      expect(session).toBeNull();
    });

    test('应该获取所有会话', async () => {
      const session1 = await storage.createSession({
        title: '会话1',
        ai_config_name: 'config1'
      });

      // 等待一毫秒确保时间戳不同
      await new Promise(resolve => setTimeout(resolve, 1));

      const session2 = await storage.createSession({
        title: '会话2',
        ai_config_name: 'config2'
      });

      const sessions = storage.getSessions();
      expect(sessions).toHaveLength(2);
      
      // 验证按更新时间倒序（最新的在前）
      const session2Time = new Date(sessions[0].updated_at).getTime();
      const session1Time = new Date(sessions[1].updated_at).getTime();
      expect(session2Time).toBeGreaterThan(session1Time);
    });

    test('应该按AI配置过滤会话', async () => {
      await storage.createSession({
        title: '会话1',
        ai_config_name: 'config1'
      });

      await storage.createSession({
        title: '会话2',
        ai_config_name: 'config2'
      });

      const filteredSessions = storage.getSessions({ ai_config_name: 'config1' });
      expect(filteredSessions).toHaveLength(1);
      expect(filteredSessions[0].title).toBe('会话1');
    });

    test('应该更新会话', async () => {
      const session = await storage.createSession({
        title: '原标题',
        ai_config_name: 'config1'
      });

      await storage.updateSession(session.id, {
        title: '新标题',
        ai_config_name: 'config2'
      });

      const updated = storage.getSession(session.id);
      expect(updated?.title).toBe('新标题');
      expect(updated?.ai_config_name).toBe('config2');
      expect(new Date(updated!.updated_at).getTime()).toBeGreaterThan(
        new Date(session.updated_at).getTime()
      );
    });

    test('应该删除会话', async () => {
      const session = await storage.createSession({
        title: '待删除会话',
        ai_config_name: 'config1'
      });

      await storage.deleteSession(session.id);

      const retrieved = storage.getSession(session.id);
      expect(retrieved).toBeNull();
    });

    test('删除不存在的会话应该抛出错误', async () => {
      await expect(storage.deleteSession('non-existent-id')).rejects.toThrow('Session not found');
    });
  });

  describe('消息管理', () => {
    let sessionId: string;

    beforeEach(async () => {
      await storage.initialize();
      const session = await storage.createSession({
        title: '测试会话',
        ai_config_name: 'test-config'
      });
      sessionId = session.id;
    });

    test('应该保存消息', () => {
      const message = storage.saveMessage({
        session_id: sessionId,
        role: 'user',
        content: '你好，世界！'
      });

      expect(message.id).toBeTruthy();
      expect(message.session_id).toBe(sessionId);
      expect(message.role).toBe('user');
      expect(message.content).toBe('你好，世界！');
      expect(message.timestamp).toBeTruthy();
    });

    test('应该保存带token使用信息的消息', () => {
      const message = storage.saveMessage({
        session_id: sessionId,
        role: 'assistant',
        content: '你好！我是AI助手。',
        token_usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30
        }
      });

      expect(message.token_usage).toEqual({
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30
      });
    });

    test('保存消息应该更新会话的消息计数', () => {
      storage.saveMessage({
        session_id: sessionId,
        role: 'user',
        content: '消息1'
      });

      storage.saveMessage({
        session_id: sessionId,
        role: 'assistant',
        content: '消息2'
      });

      const session = storage.getSession(sessionId);
      expect(session?.message_count).toBe(2);
    });

    test('应该获取消息历史', () => {
      storage.saveMessage({
        session_id: sessionId,
        role: 'user',
        content: '第一条消息'
      });

      storage.saveMessage({
        session_id: sessionId,
        role: 'assistant',
        content: '第二条消息'
      });

      const history = storage.getMessageHistory(sessionId);
      expect(history).toHaveLength(2);
      expect(history[0].content).toBe('第一条消息'); // 按时间正序
      expect(history[1].content).toBe('第二条消息');
    });

    test('应该按角色过滤消息', () => {
      storage.saveMessage({
        session_id: sessionId,
        role: 'user',
        content: '用户消息'
      });

      storage.saveMessage({
        session_id: sessionId,
        role: 'assistant',
        content: 'AI回复'
      });

      const userMessages = storage.getMessageHistory(sessionId, { role: 'user' });
      expect(userMessages).toHaveLength(1);
      expect(userMessages[0].content).toBe('用户消息');
    });

    test('应该获取最近的消息', () => {
      // 创建5条消息
      for (let i = 1; i <= 5; i++) {
        storage.saveMessage({
          session_id: sessionId,
          role: 'user',
          content: `消息${i}`
        });
      }

      const recentMessages = storage.getRecentMessages(sessionId, 3);
      expect(recentMessages).toHaveLength(3);
      expect(recentMessages[0].content).toBe('消息3'); // 最早的在前
      expect(recentMessages[1].content).toBe('消息4');
      expect(recentMessages[2].content).toBe('消息5');
    });

  });

  describe('统计信息', () => {
    beforeEach(async () => {
      await storage.initialize();
    });

    test('应该获取统计信息', async () => {
      // 创建测试数据
      const session1 = await storage.createSession({
        title: '会话1',
        ai_config_name: 'config1'
      });

      const session2 = await storage.createSession({
        title: '会话2',
        ai_config_name: 'config2'
      });

      storage.saveMessage({
        session_id: session1.id,
        role: 'user',
        content: '用户消息1'
      });

      storage.saveMessage({
        session_id: session1.id,
        role: 'assistant',
        content: 'AI回复1'
      });

      storage.saveMessage({
        session_id: session2.id,
        role: 'system',
        content: '系统消息'
      });

      const stats = await storage.getStats();
      
      expect(stats.total_sessions).toBe(2);
      expect(stats.total_messages).toBe(3);
      expect(stats.messages_by_role.user).toBe(1);
      expect(stats.messages_by_role.assistant).toBe(1);
      expect(stats.messages_by_role.system).toBe(1);
    });
  });

  describe('数据验证', () => {
    beforeEach(async () => {
      await storage.initialize();
    });

    test('创建会话时应该验证输入', async () => {
      await expect(storage.createSession({
        title: '',
        ai_config_name: 'config1'
      })).rejects.toThrow('会话标题不能为空');

      await expect(storage.createSession({
        title: '测试会话',
        ai_config_name: ''
      })).rejects.toThrow('AI配置名称不能为空');
    });

    test('保存消息时应该验证输入', async () => {
      const session = await storage.createSession({
        title: '测试会话',
        ai_config_name: 'config1'
      });

      expect(() => storage.saveMessage({
        session_id: '',
        role: 'user',
        content: '测试消息'
      })).toThrow('会话ID不能为空');

      expect(() => storage.saveMessage({
        session_id: session.id,
        role: 'invalid' as any,
        content: '测试消息'
      })).toThrow();

      expect(() => storage.saveMessage({
        session_id: session.id,
        role: 'user',
        content: ''
      })).toThrow('消息内容不能为空');
    });
  });
});