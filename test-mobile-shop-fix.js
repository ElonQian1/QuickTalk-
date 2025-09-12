const Database = require('./database-sqlite');

/**
 * 测试移动端店铺管理修复
 */
async function testMobileShopFix() {
    console.log('🔧 测试移动端店铺管理修复');
    console.log('=' .repeat(50));
    
    const db = new Database();
    
    try {
        // 1. 测试用户会话
        console.log('\n1. 🔍 测试用户会话');
        const userId = 'user_1757668176155_6ofzzuiao';
        const user = await new Promise((resolve, reject) => {
            db.db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (user) {
            console.log('✅ 用户存在:', {
                id: user.id,
                username: user.username,
                role: user.role
            });
        } else {
            console.log('❌ 用户不存在');
            return;
        }
        
        // 2. 测试用户店铺关系
        console.log('\n2. 🏪 测试用户店铺');
        const userShops = await db.getUserShops(userId);
        console.log('📊 用户店铺数量:', userShops.length);
        
        userShops.forEach((shop, index) => {
            console.log(`📝 店铺 ${index + 1}:`, {
                id: shop.id,
                name: shop.name,
                domain: shop.domain,
                status: shop.status,
                approval_status: shop.approval_status,
                approvalStatus: shop.approvalStatus,
                service_status: shop.service_status
            });
        });
        
        // 3. 测试 /api/admin/stats 端点模拟
        console.log('\n3. 📊 测试统计信息模拟');
        const totalShops = userShops.length;
        const unreadMessages = 0;
        
        console.log('✅ 统计信息:', {
            totalShops,
            unreadMessages,
            userRole: user.role
        });
        
        // 4. 测试会话ID管理
        console.log('\n4. 🔑 测试会话ID管理');
        const testSessionId = 'sess_1757671316591_g9wvz23lv';
        const sessionUser = await db.validateSession(testSessionId);
        
        if (sessionUser) {
            console.log('✅ 会话验证成功:', {
                id: sessionUser.id,
                username: sessionUser.username,
                role: sessionUser.role
            });
        } else {
            console.log('❌ 会话验证失败');
        }
        
        // 5. 店铺状态分析
        console.log('\n5. 📋 店铺状态分析');
        const pendingShops = userShops.filter(shop => 
            shop.approval_status === 'pending' || shop.approvalStatus === 'pending'
        );
        const approvedShops = userShops.filter(shop => 
            shop.approval_status === 'approved' || shop.approvalStatus === 'approved'
        );
        
        console.log(`⏳ 待审核店铺: ${pendingShops.length}`);
        console.log(`✅ 已审核店铺: ${approvedShops.length}`);
        
        pendingShops.forEach(shop => {
            console.log(`  ⏳ ${shop.name} (${shop.id})`);
        });
        
        approvedShops.forEach(shop => {
            console.log(`  ✅ ${shop.name} (${shop.id})`);
        });
        
        console.log('\n🎉 测试完成！');
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
    } finally {
        process.exit(0);
    }
}

testMobileShopFix();
