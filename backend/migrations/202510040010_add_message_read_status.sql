-- 添加消息已读字段以支持未读计数
-- 已读状态：read_at 为 NULL 表示未读，有值表示已读时间

ALTER TABLE messages ADD COLUMN read_at DATETIME DEFAULT NULL;

-- 为已读状态添加索引，用于快速查询未读消息
CREATE INDEX IF NOT EXISTS idx_messages_read_at ON messages(read_at);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(conversation_id, sender_type, read_at);

-- 可选：将现有的 agent 消息标记为已读，客户消息保持未读
-- UPDATE messages SET read_at = timestamp WHERE sender_type = 'agent';