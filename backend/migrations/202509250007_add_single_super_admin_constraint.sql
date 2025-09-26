-- 约束：系统中始终最多只有一个超级管理员账号 (role='super_admin')
-- 利用 SQLite 部分唯一索引（partial unique index）实现物理层防护
-- 如果已有多个非法超级管理员，请先人工清理再执行此迁移，否则创建索引会失败。

CREATE UNIQUE INDEX IF NOT EXISTS ux_single_super_admin ON admins(role) WHERE role = 'super_admin';

-- 验证方式：
-- 1) 试图再插入第二个 super_admin 将报错：UNIQUE constraint failed: admins.role
-- 2) 正常注册普通账号不受影响。
