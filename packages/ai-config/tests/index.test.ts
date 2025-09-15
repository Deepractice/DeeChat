import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { 
  AIConfigManager, 
  initializeAIConfig, 
  getAIConfigManager, 
  closeAIConfig,
  createConfig,
  getConfigById,
  getConfigByName,
  getDefaultConfig,
  getAllConfigs,
  setPreference,
  getPreference
} from '../src';

describe('AIConfigManager - 简化版测试', () => {
  let manager: AIConfigManager;
  let testDbPath: string;

  beforeEach(async () => {
    // 使用临时数据库
    testDbPath = join(tmpdir(), `test-ai-config-${Date.now()}.db`);
    manager = new AIConfigManager({ database_path: testDbPath });
    await manager.initialize();
  });

  afterEach(() => {
    if (manager) {
      manager.close();
    }
    // 清理测试数据库
    if (existsSync(testDbPath)) {
      try {
        unlinkSync(testDbPath);
      } catch (err) {
        // 忽略清理错误
      }
    }
  });

  describe('初始化', () => {
    test('应该成功初始化', () => {
      expect(manager.isInitialized()).toBe(true);
      expect(manager.healthCheck().status).toBe('healthy');
    });

    test('应该有正确的管理器实例', () => {
      expect(manager.configs).toBeDefined();
      expect(manager.preferences).toBeDefined();
    });
  });

  describe('AI配置管理', () => {
    test('应该能创建和获取配置', async () => {
      const configInput = {
        name: 'test-openai-config',
        api_key: 'sk-test123',
        base_url: 'https://api.openai.com/v1',
        is_default: false,
        is_active: true
      };

      const created = await manager.configs.create(configInput);
      expect(created.name).toBe(configInput.name);
      expect(created.api_key).toBe(configInput.api_key);
      expect(created.base_url).toBe(configInput.base_url);
      expect(created.is_default).toBe(false);
      expect(created.is_active).toBe(true);
      expect(created.id).toBeDefined();

      const retrieved = manager.configs.findByName('test-openai-config');
      expect(retrieved).toEqual(created);
    });

    test('应该能设置默认配置', async () => {
      // 创建两个配置
      await manager.configs.create({
        name: 'config-1',
        api_key: 'sk-test1',
        base_url: 'https://api.openai.com/v1',
        is_default: false
      });

      const config2 = await manager.configs.create({
        name: 'config-2',
        api_key: 'sk-test2',
        base_url: 'https://api.openai.com/v1',
        is_default: true  // 设为默认
      });

      expect(config2.is_default).toBe(true);

      const defaultConfig = manager.configs.findDefault();
      expect(defaultConfig).toBeTruthy();
      expect(defaultConfig?.name).toBe('config-2');

      // 确保只有一个默认配置
      const allConfigs = manager.configs.findAll({ is_default: true });
      expect(allConfigs).toHaveLength(1);
    });

    test('应该能更新配置', async () => {
      const created = await manager.configs.create({
        name: 'update-test',
        api_key: 'sk-old',
        base_url: 'https://api.old.com/v1'
      });

      const updated = await manager.configs.update(created.id, {
        api_key: 'sk-new',
        base_url: 'https://api.new.com/v1'
      });

      expect(updated.api_key).toBe('sk-new');
      expect(updated.base_url).toBe('https://api.new.com/v1');
      expect(updated.name).toBe('update-test'); // 名称未变
    });

    test('应该能删除配置', async () => {
      const created = await manager.configs.create({
        name: 'delete-test',
        api_key: 'sk-delete',
        base_url: 'https://api.test.com/v1'
      });

      await manager.configs.delete(created.id);

      const retrieved = manager.configs.findById(created.id);
      expect(retrieved).toBeNull();
    });

    test('应该能复制配置', async () => {
      const original = await manager.configs.create({
        name: 'original',
        api_key: 'sk-original',
        base_url: 'https://api.original.com/v1',
        is_default: true
      });

      const duplicated = await manager.configs.duplicate(original.id, 'duplicated');
      
      expect(duplicated.name).toBe('duplicated');
      expect(duplicated.api_key).toBe('sk-original');
      expect(duplicated.base_url).toBe('https://api.original.com/v1');
      expect(duplicated.is_default).toBe(false); // 复制的不能是默认
      expect(duplicated.id).not.toBe(original.id);
    });

    test('应该防止重复的配置名称', async () => {
      await manager.configs.create({
        name: 'unique-name',
        api_key: 'sk-test',
        base_url: 'https://api.test.com/v1'
      });

      await expect(manager.configs.create({
        name: 'unique-name', // 重复名称
        api_key: 'sk-test2',
        base_url: 'https://api.test2.com/v1'
      })).rejects.toThrow();
    });
  });

  describe('偏好管理', () => {
    test('应该能设置和获取偏好', async () => {
      await manager.preferences.set({
        key: 'test_setting',
        value: { enabled: true, count: 42 },
        category: 'test',
        description: 'A test setting'
      });

      const value = manager.preferences.get('test_setting');
      expect(value).toEqual({ enabled: true, count: 42 });

      const preference = manager.preferences.getPreference('test_setting');
      expect(preference).toBeTruthy();
      expect(preference?.key).toBe('test_setting');
      expect(preference?.category).toBe('test');
      expect(preference?.description).toBe('A test setting');
    });

    test('应该能获取带默认值的偏好', () => {
      const withDefault = manager.preferences.getWithDefault('non_existent', 'default_value');
      expect(withDefault).toBe('default_value');

      const nullValue = manager.preferences.get('non_existent');
      expect(nullValue).toBeNull();
    });

    test('应该能按分类管理偏好', async () => {
      await manager.preferences.set({
        key: 'ui_theme',
        value: 'dark',
        category: 'ui'
      });

      await manager.preferences.set({
        key: 'ai_temperature',
        value: 0.8,
        category: 'ai'
      });

      const uiPrefs = manager.preferences.getByCategory('ui');
      expect(uiPrefs).toHaveLength(1);
      expect(uiPrefs[0].key).toBe('ui_theme');

      const categories = manager.preferences.getCategories();
      expect(categories).toContain('ui');
      expect(categories).toContain('ai');
    });

    test('应该能批量设置偏好', async () => {
      const batchData = {
        'setting1': 'value1',
        'setting2': 42,
        'setting3': { nested: true }
      };

      const results = await manager.preferences.setBatch(batchData, 'batch_test');
      expect(results).toHaveLength(3);

      const batchPrefs = manager.preferences.getByCategory('batch_test');
      expect(batchPrefs).toHaveLength(3);
    });

    test('应该能搜索偏好', async () => {
      await manager.preferences.set({
        key: 'search_test_1',
        value: 'value1',
        description: 'This is a search test'
      });

      await manager.preferences.set({
        key: 'another_key',
        value: 'value2',
        description: 'This contains search term'
      });

      const searchResults = manager.preferences.search('search');
      expect(searchResults.length).toBeGreaterThan(0);
      
      const keys = searchResults.map(p => p.key);
      expect(keys).toContain('search_test_1');
    });

    test('应该能导出和导入偏好', async () => {
      await manager.preferences.set({
        key: 'export_test',
        value: 'export_value',
        category: 'export_category'
      });

      const exported = manager.preferences.export('export_category');
      expect(exported).toHaveProperty('export_test', 'export_value');

      // 清空分类
      await manager.preferences.clearCategory('export_category');
      expect(manager.preferences.getByCategory('export_category')).toHaveLength(0);

      // 重新导入
      const imported = await manager.preferences.import(exported, 'export_category');
      expect(imported).toBe(1);

      const reimported = manager.preferences.getByCategory('export_category');
      expect(reimported).toHaveLength(1);
      expect(reimported[0].key).toBe('export_test');
    });
  });

  describe('统计信息', () => {
    test('应该提供准确的统计信息', async () => {
      // 创建测试数据
      await manager.configs.create({
        name: 'stats-config',
        api_key: 'sk-stats',
        base_url: 'https://api.stats.com/v1',
        is_active: true
      });

      await manager.preferences.set({
        key: 'stats_pref',
        value: 'stats_value'
      });

      const stats = await manager.getStats();
      expect(stats.total_configs).toBeGreaterThan(0);
      expect(stats.active_configs).toBeGreaterThan(0);
      expect(stats.total_preferences).toBeGreaterThan(0);
    });

    test('应该提供偏好统计信息', async () => {
      await manager.preferences.set({
        key: 'ui_pref',
        value: 'ui_value',
        category: 'ui'
      });

      await manager.preferences.set({
        key: 'ai_pref',
        value: 'ai_value',
        category: 'ai'
      });

      const prefStats = manager.preferences.getStats();
      expect(prefStats.total).toBeGreaterThanOrEqual(2);
      expect(prefStats.ui).toBeGreaterThanOrEqual(1);
      expect(prefStats.ai).toBeGreaterThanOrEqual(1);
    });
  });

  describe('数据库健康检查', () => {
    test('应该通过健康检查', () => {
      const health = manager.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.details.connected).toBe(true);
      expect(health.details.test_query).toBe(true);
    });
  });
});

describe('全局管理器函数', () => {
  let testDbPath: string;

  beforeEach(() => {
    testDbPath = join(tmpdir(), `test-global-${Date.now()}.db`);
  });

  afterEach(() => {
    closeAIConfig();
    if (existsSync(testDbPath)) {
      try {
        unlinkSync(testDbPath);
      } catch (err) {
        // 忽略清理错误
      }
    }
  });

  test('应该能初始化和使用全局管理器', async () => {
    const manager = await initializeAIConfig({ database_path: testDbPath });
    expect(manager.isInitialized()).toBe(true);

    const globalManager = getAIConfigManager();
    expect(globalManager).toBe(manager);

    // 测试便利函数
    await setPreference('global_test_key', 'global_test_value');
    const value = getPreference('global_test_key');
    expect(value).toBe('global_test_value');
  });

  test('应该能使用全局配置函数', async () => {
    await initializeAIConfig({ database_path: testDbPath });

    // 创建配置
    const created = await createConfig({
      name: 'global-config',
      api_key: 'sk-global',
      base_url: 'https://api.global.com/v1',
      is_default: true
    });

    expect(created.name).toBe('global-config');

    // 获取配置
    const byId = getConfigById(created.id);
    expect(byId).toEqual(created);

    const byName = getConfigByName('global-config');
    expect(byName).toEqual(created);

    const defaultConfig = getDefaultConfig();
    expect(defaultConfig).toEqual(created);

    const allConfigs = getAllConfigs();
    expect(allConfigs).toContainEqual(created);
  });

  test('应该在未初始化时抛出错误', () => {
    expect(() => getAIConfigManager()).toThrow();
  });
});