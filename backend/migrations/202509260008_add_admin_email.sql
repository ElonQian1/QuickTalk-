-- 为 admins 表添加邮箱字段（可为空，后续注册时写入）
ALTER TABLE admins ADD COLUMN email TEXT;

-- 可选索引：若未来需要唯一邮箱，可改为 UNIQUE 索引；当前不强制唯一以兼容历史数据
-- CREATE UNIQUE INDEX IF NOT EXISTS ux_admins_email ON admins(email) WHERE email IS NOT NULL AND email != '';
