const Database = require('./database-sqlite.js');

async function checkApiKeys() {
    try {
        const db = new Database();
        
        console.log('=== API密钥调试 ===');
        
        // 获取所有店铺
        const shops = await db.getAllShops();
        console.log('总店铺数量:', shops.length);
        
        // 查找特定API密钥
        const targetApiKey = 'sk_z0d8f18ny6jss7jo7c5i5vy0oiw1kgds';
        console.log('\n查找目标API密钥:', targetApiKey);
        
        const matchedShop = shops.find(shop => shop.api_key === targetApiKey);
        
        if (matchedShop) {
            console.log('✅ 找到匹配的店铺:');
            console.log('店铺ID:', matchedShop.id);
            console.log('店铺名称:', matchedShop.name);
            console.log('域名:', matchedShop.domain);
            console.log('API密钥:', matchedShop.api_key);
            console.log('状态:', matchedShop.approvalStatus);
        } else {
            console.log('❌ 未找到匹配的API密钥');
            console.log('\n现有API密钥列表:');
            shops.forEach((shop, index) => {
                console.log(`${index + 1}. 店铺: ${shop.name}`);
                console.log(`   域名: ${shop.domain}`);
                console.log(`   API密钥: ${shop.api_key || '未生成'}`);
                console.log(`   状态: ${shop.approvalStatus}`);
                console.log('');
            });
        }
        
        // 查找域名匹配的店铺
        console.log('\n=== 按域名查找 ===');
        const targetDomain = 'bbs16.929991.xyz';
        console.log('目标域名:', targetDomain);
        
        const domainMatchedShops = shops.filter(shop => 
            shop.domain === targetDomain || 
            shop.domain.includes('bbs') ||
            shop.name.includes('bbs')
        );
        
        console.log('域名匹配的店铺:');
        domainMatchedShops.forEach(shop => {
            console.log(`- ${shop.name} (${shop.domain}) - API: ${shop.api_key || '未生成'}`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('调试失败:', error);
        process.exit(1);
    }
}

checkApiKeys();
