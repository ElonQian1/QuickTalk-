-- 禁用外键约束
PRAGMA foreign_keys = OFF;

-- 删除所有店铺
DELETE FROM shops;

-- 删除相关的激活订单
DELETE FROM activation_orders;

-- 重新启用外键约束
PRAGMA foreign_keys = ON;
