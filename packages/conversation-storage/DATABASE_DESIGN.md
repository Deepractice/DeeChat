# conversation-storage 数据库设计

## 数据库选择
- **SQLite** - 轻量级、无服务器、文件型数据库
- **原因**：与ai-config保持一致，适合桌面应用，无需额外配置

## 表结构设计

### 1. sessions 表（会话）
```sql
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,                    -- 会话ID (session_timestamp_random)
  title TEXT NOT NULL,                    -- 会话标题
  ai_config_name TEXT NOT NULL,          -- 关联的AI配置名称
  created_at TEXT NOT NULL,              -- 创建时间 (ISO格式)
  updated_at TEXT NOT NULL,              -- 更新时间 (ISO格式)
  message_count INTEGER DEFAULT 0        -- 消息数量
);
```

### 2. messages 表（消息）
```sql
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,                    -- 消息ID (msg_timestamp_random)
  session_id TEXT NOT NULL,              -- 所属会话ID
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),  -- 消息角色
  content TEXT NOT NULL,                 -- 消息内容
  timestamp TEXT NOT NULL,               -- 消息时间戳 (ISO格式)
  token_usage TEXT,                      -- Token使用情况 (JSON格式，可选)
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
```

## 索引设计

### 查询优化索引
```sql
-- 消息按会话ID查询（最常用）
CREATE INDEX IF NOT EXISTS idx_messages_session_id 
ON messages(session_id);

-- 消息按时间排序
CREATE INDEX IF NOT EXISTS idx_messages_timestamp 
ON messages(timestamp);

-- 会话按更新时间排序（会话列表显示）
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at 
ON sessions(updated_at DESC);

-- 消息复合索引（会话+时间，优化历史查询）
CREATE INDEX IF NOT EXISTS idx_messages_session_timestamp 
ON messages(session_id, timestamp);
```

## 数据类型说明

### 时间戳格式
- **格式**：ISO 8601 字符串 (YYYY-MM-DDTHH:mm:ss.sssZ)
- **示例**：'2025-01-15T10:30:45.123Z'
- **优势**：人可读、支持时区、SQLite原生支持比较

### ID生成规则
```typescript
// 会话ID：session_timestamp_random
// 示例：session_1705315845123_a1b2c3
const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`

// 消息ID：msg_timestamp_random  
// 示例：msg_1705315845456_x9y8z7
const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2)}`
```

### token_usage JSON 结构
```json
{
  "prompt_tokens": 150,
  "completion_tokens": 89,
  "total_tokens": 239
}
```

## 数据库初始化

### 创建数据库脚本
```sql
-- 启用外键约束
PRAGMA foreign_keys = ON;

-- 启用WAL模式（提高并发性能）
PRAGMA journal_mode = WAL;

-- 设置同步模式
PRAGMA synchronous = NORMAL;

-- 创建表
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  ai_config_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  message_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  token_usage TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_session_timestamp ON messages(session_id, timestamp);
```

## 常用查询

### 会话相关查询
```sql
-- 获取所有会话（按更新时间倒序）
SELECT * FROM sessions ORDER BY updated_at DESC;

-- 获取单个会话
SELECT * FROM sessions WHERE id = ?;

-- 更新会话消息数量
UPDATE sessions 
SET message_count = (
  SELECT COUNT(*) FROM messages WHERE session_id = ?
), updated_at = ?
WHERE id = ?;

-- 删除会话（自动级联删除消息）
DELETE FROM sessions WHERE id = ?;
```

### 消息相关查询
```sql
-- 获取会话的消息历史（按时间正序）
SELECT * FROM messages 
WHERE session_id = ? 
ORDER BY timestamp ASC;

-- 保存消息
INSERT INTO messages (id, session_id, role, content, timestamp, token_usage)
VALUES (?, ?, ?, ?, ?, ?);

-- 删除会话的所有消息
DELETE FROM messages WHERE session_id = ?;

-- 获取最新的N条消息
SELECT * FROM messages 
WHERE session_id = ? 
ORDER BY timestamp DESC 
LIMIT ?;
```

## 性能考虑

### 预估数据量
- **会话**：用户可能创建数百个会话
- **消息**：每个会话可能包含数千条消息
- **总量**：数万到数十万条消息记录

### 优化策略
1. **索引优化**：为常用查询路径创建复合索引
2. **WAL模式**：提高并发读写性能
3. **批量操作**：消息批量插入时使用事务
4. **定期维护**：可选的消息清理和数据库压缩

### 扩展性预留
- **分页查询**：支持消息历史分页加载
- **搜索功能**：预留全文搜索扩展能力
- **归档机制**：长期可考虑旧会话归档

## 数据库位置

### 默认路径规划
```
用户数据目录/
├── ai-config.db        (AI配置数据库)
└── conversations.db    (会话数据库)
```

### 路径解析
- **Windows**: `%APPDATA%/DeeChat/conversations.db`
- **macOS**: `~/Library/Application Support/DeeChat/conversations.db`  
- **Linux**: `~/.config/DeeChat/conversations.db`

这个数据库设计合理吗？是否还需要调整？