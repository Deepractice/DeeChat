-- 对话存储数据库Schema
-- 用于管理对话会话和消息记录

-- 1. 对话会话表 - 存储对话会话信息
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,                 -- 会话ID
    title TEXT NOT NULL,                 -- 会话标题
    ai_config_name TEXT NOT NULL,        -- 使用的AI配置名称
    created_at TEXT NOT NULL,            -- 创建时间
    updated_at TEXT NOT NULL,            -- 更新时间
    message_count INTEGER DEFAULT 0      -- 消息数量
);

-- 2. 消息表 - 存储对话消息
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,                 -- 消息ID
    session_id TEXT NOT NULL,            -- 所属会话ID
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')), -- 消息角色
    content TEXT NOT NULL,               -- 消息内容
    timestamp TEXT NOT NULL,             -- 消息时间戳
    token_usage TEXT,                    -- Token使用情况(JSON格式)
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_ai_config ON sessions(ai_config_name);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_session_timestamp ON messages(session_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);