-- 默认订阅套餐与支付配置 seed
INSERT OR IGNORE INTO subscription_plans (id,name,type,price,duration,max_customers,max_agents,features) VALUES
 ('plan_basic','基础版','basic',99.00,12,100,2,'{"features":["基础客服功能","最多2个客服","最多100个客户","基础数据统计"]}'),
 ('plan_standard','标准版','standard',299.00,12,500,10,'{"features":["完整客服功能","最多10个客服","最多500个客户","高级数据分析","员工管理","API接口"]}'),
 ('plan_premium','高级版','premium',599.00,12,NULL,NULL,'{"features":["全部功能","无限客服","无限客户","高级数据分析","员工管理","API接口","自定义品牌","优先技术支持"]}');

INSERT OR IGNORE INTO payment_configs (id,payment_method,app_id,merchant_id,private_key,public_key,app_secret,notify_url,return_url,is_sandbox,is_active)
VALUES
 ('config_alipay','alipay','sandbox_app_id','sandbox_merchant_id','sandbox_private_key','sandbox_public_key',NULL,'/api/payments/notify/alipay','/api/payments/return/alipay',1,1),
 ('config_wechat','wechat','sandbox_app_id','sandbox_mch_id','sandbox_key','',NULL,'/api/payments/notify/wechat','/api/payments/return/wechat',1,1);
