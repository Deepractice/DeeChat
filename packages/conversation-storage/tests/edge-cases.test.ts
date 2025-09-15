import { ConversationStorage } from '../src';
import { join } from 'path';
import { tmpdir } from 'os';
import { rmSync, existsSync } from 'fs';

describe('ConversationStorage - 边界情况和错误处理', () => {
  let storage: ConversationStorage;
  let testDbPath: string;

  beforeEach(() => {
    testDbPath = join(tmpdir(), `test-edge-${Date.now()}-${Math.random().toString(36)}.db`);
    storage = new ConversationStorage({ dbPath: testDbPath });
  });

  afterEach(() => {
    storage.close();
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }
  });

  describe('数据库连接错误', () => {
    test('应该处理无效的数据库路径', () => {
      expect(() => {
        new ConversationStorage({ dbPath: '/invalid/path/that/does/not/exist/test.db' });
      }).not.toThrow(); // 构造函数不应该抛出错误，错误应该在连接时抛出
    });

    test('应该处理重复初始化', async () => {
      await storage.initialize();
      
      // 重复初始化应该是安全的
      await storage.initialize();
      
      const health = storage.healthCheck();
      expect(health.status).toBe('healthy');
    });

    test('应该处理未初始化时的操作', () => {
      expect(() => {
        storage.getSession('test-id');
      }).toThrow('Conversation Storage not initialized');

      expect(() => {
        storage.getSessions();
      }).toThrow('Conversation Storage not initialized');
    });
  });

  describe('输入数据验证', () => {
    beforeEach(async () => {
      await storage.initialize();
    });

    test('应该处理极长的字符串', async () => {
      const longTitle = 'a'.repeat(10000);
      const longContent = 'b'.repeat(100000);

      const session = await storage.createSession({
        title: longTitle,
        ai_config_name: 'test-config'
      });

      expect(session.title).toBe(longTitle);

      const message = storage.saveMessage({
        session_id: session.id,
        role: 'user',
        content: longContent
      });

      expect(message.content).toBe(longContent);
    });

    test('应该处理特殊字符', async () => {
      const specialTitle = '测试🚀会话\n换行\t制表符"引号\'单引号\\反斜杠';
      const specialContent = 'JSON: {"key": "value"}\nSQL: SELECT * FROM table WHERE id = 1;';

      const session = await storage.createSession({
        title: specialTitle,
        ai_config_name: 'special-config'
      });

      expect(session.title).toBe(specialTitle);

      const message = storage.saveMessage({
        session_id: session.id,
        role: 'assistant',
        content: specialContent
      });

      expect(message.content).toBe(specialContent);
    });

    test('应该处理无效的Token使用数据', async () => {
      // 先创建一个有效会话
      const session = await storage.createSession({
        title: 'Token测试会话',
        ai_config_name: 'test-config'
      });

      // 负数token应该被schema验证阻止
      expect(() => {
        storage.saveMessage({
          session_id: session.id,
          role: 'assistant',
          content: 'test',
          token_usage: {
            prompt_tokens: -1,
            completion_tokens: 10,
            total_tokens: 9
          }
        });
      }).toThrow();

      // 不一致的total_tokens（虽然schema允许，但在实际使用中可能有问题）
      // 这里我们测试系统是否能处理这种数据
      expect(() => {
        storage.saveMessage({
          session_id: session.id,
          role: 'assistant',
          content: 'test',
          token_usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 20 // 不等于15，但schema允许
          }
        });
      }).not.toThrow(); // 我们不在schema层面验证这个逻辑一致性
    });
  });

  describe('并发操作', () => {
    beforeEach(async () => {
      await storage.initialize();
    });

    test('应该处理并发会话创建', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        storage.createSession({
          title: `并发会话${i}`,
          ai_config_name: `config${i}`
        })
      );

      const sessions = await Promise.all(promises);
      
      expect(sessions).toHaveLength(10);
      
      // 所有会话ID应该是唯一的
      const ids = sessions.map(s => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);
    });

    test('应该处理并发消息保存', async () => {
      const session = await storage.createSession({
        title: '并发测试会话',
        ai_config_name: 'test-config'
      });

      const messages = Array.from({ length: 20 }, (_, i) => ({
        session_id: session.id,
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `并发消息${i}`
      }));

      // 注意：saveMessage是同步的，但我们可以测试快速连续调用
      const savedMessages = messages.map(msg => storage.saveMessage(msg));
      
      expect(savedMessages).toHaveLength(20);
      
      // 检查会话的消息计数是否正确
      const updatedSession = storage.getSession(session.id);
      expect(updatedSession?.message_count).toBe(20);
    });
  });

  describe('数据完整性', () => {
    beforeEach(async () => {
      await storage.initialize();
    });

    test('应该处理不存在的会话ID的消息操作', () => {
      expect(() => {
        storage.saveMessage({
          session_id: 'non-existent-session',
          role: 'user',
          content: 'test message'
        });
      }).toThrow(); // 外键约束应该阻止这个操作
    });

    test('应该处理删除操作的级联效果', async () => {
      const session = await storage.createSession({
        title: '级联删除测试',
        ai_config_name: 'test-config'
      });

      // 添加消息
      storage.saveMessage({
        session_id: session.id,
        role: 'user',
        content: '测试消息1'
      });

      storage.saveMessage({
        session_id: session.id,
        role: 'assistant',
        content: '测试消息2'
      });

      // 删除会话应该级联删除所有消息
      await storage.deleteSession(session.id);

      // 验证会话不存在
      const deletedSession = storage.getSession(session.id);
      expect(deletedSession).toBeNull();

      // 验证消息也被删除了
      const messages = storage.getMessageHistory(session.id);
      expect(messages).toHaveLength(0);
    });

    test('应该处理大量数据操作', async () => {
      // 创建多个会话
      const sessions = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          storage.createSession({
            title: `大量数据测试会话${i}`,
            ai_config_name: `config${i}`
          })
        )
      );

      // 每个会话添加大量消息
      sessions.forEach(session => {
        for (let i = 0; i < 50; i++) {
          storage.saveMessage({
            session_id: session.id,
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `消息${i}: ${'内容'.repeat(100)}`
          });
        }
      });

      // 验证统计信息
      const stats = await storage.getStats();
      expect(stats.total_sessions).toBe(5);
      expect(stats.total_messages).toBe(250);
      expect(stats.messages_by_role.user).toBe(125);
      expect(stats.messages_by_role.assistant).toBe(125);

      // 测试分页查询
      const firstPage = storage.getMessageHistory(sessions[0].id, { limit: 10 });
      expect(firstPage).toHaveLength(10);

      const secondPage = storage.getMessageHistory(sessions[0].id, { 
        limit: 10, 
        offset: 10 
      });
      expect(secondPage).toHaveLength(10);
      
      // 确保分页数据不重复
      const firstPageIds = firstPage.map(m => m.id);
      const secondPageIds = secondPage.map(m => m.id);
      const overlap = firstPageIds.filter(id => secondPageIds.includes(id));
      expect(overlap).toHaveLength(0);
    });
  });

  describe('查询边界情况', () => {
    beforeEach(async () => {
      await storage.initialize();
    });

    test('应该处理空查询结果', () => {
      const emptySessions = storage.getSessions({ ai_config_name: 'non-existent-config' });
      expect(emptySessions).toHaveLength(0);

      const emptyMessages = storage.getMessageHistory('non-existent-session');
      expect(emptyMessages).toHaveLength(0);

      const emptyRecent = storage.getRecentMessages('non-existent-session', 10);
      expect(emptyRecent).toHaveLength(0);
    });

    test('应该处理极限查询参数', async () => {
      const session = await storage.createSession({
        title: '极限查询测试',
        ai_config_name: 'test-config'
      });

      // 添加一些消息
      for (let i = 0; i < 5; i++) {
        storage.saveMessage({
          session_id: session.id,
          role: 'user',
          content: `消息${i}`
        });
      }

      // 测试极大的limit
      const allMessages = storage.getMessageHistory(session.id, { limit: 1000000 });
      expect(allMessages).toHaveLength(5);

      // 测试limit为0
      const noMessages = storage.getMessageHistory(session.id, { limit: 0 });
      expect(noMessages).toHaveLength(0);

      // 测试offset超出范围
      const offsetMessages = storage.getMessageHistory(session.id, { 
        limit: 10, 
        offset: 1000 
      });
      expect(offsetMessages).toHaveLength(0);
    });
  });

  describe('资源管理', () => {
    test('应该正确关闭数据库连接', async () => {
      await storage.initialize();
      
      const healthBefore = storage.healthCheck();
      expect(healthBefore.status).toBe('healthy');

      storage.close();

      const healthAfter = storage.healthCheck();
      expect(healthAfter.status).toBe('unhealthy');
      expect(healthAfter.details.error).toContain('not initialized');
    });

    test('应该处理多次关闭', async () => {
      await storage.initialize();
      
      storage.close();
      storage.close(); // 多次关闭应该是安全的
      
      const health = storage.healthCheck();
      expect(health.status).toBe('unhealthy');
    });
  });
});