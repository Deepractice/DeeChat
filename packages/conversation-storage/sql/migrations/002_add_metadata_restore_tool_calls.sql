-- Migration: Restore tool_calls and tool_call_id fields
-- Version: 3
-- Date: 2025-10-01
-- Description: Restore tool_calls and tool_call_id fields for proper tool calling support

-- 创建新表(包含tool_calls和tool_call_id)
CREATE TABLE IF NOT EXISTS messages_new (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT,
    timestamp TEXT NOT NULL,
    token_usage TEXT,
    tool_calls TEXT,
    tool_call_id TEXT,
    metadata TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- 迁移现有数据
INSERT INTO messages_new (id, session_id, role, content, timestamp, token_usage, tool_calls, tool_call_id, metadata)
SELECT id, session_id, role, content, timestamp, token_usage, NULL, NULL, metadata
FROM messages;

-- 删除旧表
DROP TABLE messages;

-- 重命名新表
ALTER TABLE messages_new RENAME TO messages;

-- 重建索引
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
