-- 添加软删除字段
ALTER TABLE messages ADD COLUMN deleted_at DATETIME; 
CREATE INDEX IF NOT EXISTS idx_messages_deleted_at ON messages(deleted_at);
