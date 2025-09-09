const fetch = require('node-fetch');

class TestScenario {
    constructor() {
        this.baseURL = 'http://localhost:3030';
        this.adminSession = null;
        this.shopOwnerSession = null;
    }

    // 管理员登录
    async adminLogin() {
        console.log('🔐 管理员登录...');
        const response = await fetch(`${this.baseURL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin123' })
        });
        
        const data = await response.json();
        if (data.success) {
            this.adminSession = data.sessionId;
            console.log('✅ 管理员登录成功');
            return true;
        }
        console.log('❌ 管理员登录失败:', data.error);
        return false;
    }

    // 店主登录
    async shopOwnerLogin() {
        console.log('🔐 店主登录...');
        const response = await fetch(`${this.baseURL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'shop_owner', password: 'shop123' })
        });
        
        const data = await response.json();
        if (data.success) {
            this.shopOwnerSession = data.sessionId;
            console.log('✅ 店主登录成功');
            console.log('🏪 登录时获取的店铺数据:', JSON.stringify(data.shops?.[0], null, 2));
            return true;
        }
        console.log('❌ 店主登录失败:', data.error);
        return false;
    }

    // 获取待审核店铺
    async getPendingShops() {
        console.log('📋 获取待审核店铺...');
        const response = await fetch(`${this.baseURL}/api/admin/pending-shops`, {
            headers: { 'X-Session-Id': this.adminSession }
        });
        
        const data = await response.json();
        if (data.success) {
            console.log(`📊 待审核店铺数量: ${data.shops.length}`);
            return data.shops;
        }
        console.log('❌ 获取待审核店铺失败:', data.error);
        return [];
    }

    // 审核通过店铺
    async approveShop(shopId) {
        console.log('✅ 审核通过店铺:', shopId);
        const response = await fetch(`${this.baseURL}/api/admin/review-shop/${shopId}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'X-Session-Id': this.adminSession 
            },
            body: JSON.stringify({ 
                approved: true, 
                note: '测试审核通过' 
            })
        });
        
        const data = await response.json();
        if (data.success) {
            console.log('✅ 店铺审核通过成功');
            return true;
        }
        console.log('❌ 店铺审核失败:', data.error);
        return false;
    }

    // 获取店主的店铺列表
    async getShopOwnerShops() {
        console.log('🏪 获取店主店铺列表...');
        const response = await fetch(`${this.baseURL}/api/auth/me`, {
            headers: { 'X-Session-Id': this.shopOwnerSession }
        });
        
        const data = await response.json();
        if (data.success) {
            console.log(`📊 店铺总数: ${data.shops.length}`);
            if (data.shops.length > 0) {
                const shop = data.shops[0];
                console.log('📝 第一个店铺详细信息:');
                console.log('  - ID:', shop.id);
                console.log('  - 名称:', shop.name);
                console.log('  - userRole:', shop.userRole, '(类型:', typeof shop.userRole, ')');
                console.log('  - approvalStatus:', shop.approvalStatus, '(类型:', typeof shop.approvalStatus, ')');
                console.log('  - 权限:', shop.permissions);
                
                // 检查是否有问题
                if (shop.userRole === undefined) {
                    console.log('🚨 发现问题: userRole 为 undefined!');
                }
                if (shop.approvalStatus === undefined) {
                    console.log('🚨 发现问题: approvalStatus 为 undefined!');
                }
            }
            return data.shops;
        }
        console.log('❌ 获取店铺列表失败:', data.error);
        return [];
    }

    // 执行完整测试流程
    async runFullTest() {
        console.log('\n🧪 开始完整测试流程...\n');
        
        // 1. 管理员登录
        if (!await this.adminLogin()) return;
        
        // 2. 获取待审核店铺
        const pendingShops = await this.getPendingShops();
        if (pendingShops.length === 0) {
            console.log('⚠️ 没有待审核的店铺');
            return;
        }
        
        // 3. 审核通过第一个店铺
        const shopToApprove = pendingShops[0];
        console.log('📋 选择审核店铺:', shopToApprove.name);
        if (!await this.approveShop(shopToApprove.id)) return;
        
        // 4. 店主登录
        if (!await this.shopOwnerLogin()) return;
        
        // 5. 获取店主店铺列表
        await this.getShopOwnerShops();
        
        console.log('\n✅ 测试流程完成');
    }
}

// 运行测试
const test = new TestScenario();
test.runFullTest().catch(console.error);
