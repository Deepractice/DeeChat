-- AI配置数据库Schema (极简版)
-- 基于"如非必要，勿增实体"原则设计

-- 1. AI配置表 - 存储API连接信息
CREATE TABLE IF NOT EXISTS ai_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,              -- 用户自定义名称："我的ChatGPT"、"公司API"
    api_key TEXT NOT NULL,           -- API密钥
    base_url TEXT NOT NULL,          -- API服务地址
    is_default BOOLEAN DEFAULT 0,    -- 是否为默认配置
    is_active BOOLEAN DEFAULT 1,     -- 是否启用
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name)                     -- 配置名称唯一
);

-- 2. 用户偏好表 - 存储用户使用偏好
CREATE TABLE IF NOT EXISTS preferences (
    key TEXT PRIMARY KEY,            -- 偏好键：如"default_config_id"、"last_model_for_config_1"
    value TEXT NOT NULL,             -- 偏好值 (JSON格式)
    category TEXT,                   -- 分类：ui、ai、general等
    description TEXT,                -- 描述
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_ai_configs_active ON ai_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_configs_default ON ai_configs(is_default);
CREATE INDEX IF NOT EXISTS idx_preferences_category ON preferences(category);

-- 触发器：自动更新时间戳
CREATE TRIGGER IF NOT EXISTS update_ai_configs_timestamp 
    AFTER UPDATE ON ai_configs
BEGIN
    UPDATE ai_configs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_preferences_timestamp 
    AFTER UPDATE ON preferences
BEGIN
    UPDATE preferences SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
END;

-- 约束：确保只有一个默认配置
CREATE TRIGGER IF NOT EXISTS enforce_single_default_config
    BEFORE INSERT ON ai_configs
    WHEN NEW.is_default = 1
BEGIN
    UPDATE ai_configs SET is_default = 0;
END;

CREATE TRIGGER IF NOT EXISTS enforce_single_default_config_update
    BEFORE UPDATE ON ai_configs
    WHEN NEW.is_default = 1 AND OLD.is_default = 0
BEGIN
    UPDATE ai_configs SET is_default = 0 WHERE id != NEW.id;
END;