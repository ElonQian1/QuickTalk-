-- 为 admins.username 显式创建唯一索引（虽然表定义已 UNIQUE，单独索引便于后续分析与并发插入一致性保障）
-- 若初始建表时已存在 UNIQUE 约束，此处 IF NOT EXISTS 不会报错。
CREATE UNIQUE INDEX IF NOT EXISTS ux_admins_username ON admins(username);
