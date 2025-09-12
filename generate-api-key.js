const Database = require('./database-sqlite.js');

async function generateApiKeyForShop() {
    try {
        const db = new Database();
        
        console.log('=== 为店铺生成API密钥 ===');
        
        // 查找目标店铺
        const shops = await db.getAllShops();
        const targetShop = shops.find(shop => shop.domain === 'bbs16.929991.xyz');
        
        if (!targetShop) {
            console.log('❌ 未找到目标店铺');
            process.exit(1);
        }
        
        console.log('找到目标店铺:');
        console.log('ID:', targetShop.id);
        console.log('名称:', targetShop.name);
        console.log('域名:', targetShop.domain);
        console.log('当前API密钥:', targetShop.api_key || '未生成');
        
        // 生成新的API密钥
        function generateApiKey() {
            const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
            let result = 'sk_';
            for (let i = 0; i < 32; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        }
        
        const newApiKey = generateApiKey();
        console.log('生成新的API密钥:', newApiKey);
        
        // 更新数据库
        const updateResult = await db.updateShop(targetShop.id, {
            api_key: newApiKey
        });
        
        console.log('✅ API密钥更新完成');
        console.log('');
        console.log('=== 新的集成信息 ===');
        console.log('店铺ID:', targetShop.id);
        console.log('店铺名称:', targetShop.name);
        console.log('域名:', targetShop.domain);
        console.log('新API密钥:', newApiKey);
        console.log('');
        console.log('请使用以下配置更新客户端代码:');
        console.log(`shopKey: '${newApiKey}',`);
        console.log(`shopId: '${targetShop.id}',`);
        console.log(`authorizedDomain: '${targetShop.domain}',`);
        
        process.exit(0);
    } catch (error) {
        console.error('生成API密钥失败:', error);
        process.exit(1);
    }
}

generateApiKeyForShop();
