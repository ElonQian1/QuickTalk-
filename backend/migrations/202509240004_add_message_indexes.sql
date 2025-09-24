-- 添加消息查询性能相关索引
-- 按会话时间排序获取消息列表
CREATE INDEX IF NOT EXISTS idx_messages_conversation_timestamp ON messages(conversation_id, timestamp DESC);
-- 软删除过滤优化：会话+deleted_at 组合（NULL 优化需 SQLite 3.39+ 支持 partial index，可退化为普通）
CREATE INDEX IF NOT EXISTS idx_messages_conversation_deleted ON messages(conversation_id, deleted_at);
