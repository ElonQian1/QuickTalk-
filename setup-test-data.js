/**
 * 独立的数据库初始化脚本
 * 直接操作内存数据库，创建完整测试数据
 */

const crypto = require('crypto');

// 创建内存数据库
const users = new Map();
const shops = new Map();
const userShops = new Map();
const sessions = new Map();

// 密码哈希函数 - 与 database.js 保持一致
function hashPassword(password) {
    return Buffer.from(password).toString('base64');
}

async function initCompleteTestData() {
    console.log('🔄 正在初始化完整测试数据...');
    
    // 创建超级管理员
    const adminId = 'admin_' + Date.now() + '_001';
    const adminUser = {
        id: adminId,
        username: 'admin',
        password: hashPassword('admin123'),
        email: 'admin@quicktalk.com',
        role: 'super_admin',
        status: 'active',
        createdAt: new Date(),
        lastLoginAt: null,
        permissions: ['all']
    };
    
    users.set(adminId, adminUser);
    console.log('✅ 创建超级管理员账号: admin / admin123');
    
    // 创建审核员账号
    const reviewerId = 'reviewer_' + Date.now() + '_001';
    const reviewerUser = {
        id: reviewerId,
        username: 'reviewer',
        password: hashPassword('reviewer123'),
        email: 'reviewer@quicktalk.com',
        role: 'reviewer',
        status: 'active',
        createdAt: new Date(),
        lastLoginAt: null,
        permissions: ['review_shops', 'approve_shops', 'reject_shops']
    };
    
    users.set(reviewerId, reviewerUser);
    console.log('✅ 创建审核员账号: reviewer / reviewer123');
    
    // 创建店主账号
    const shopOwnerId = 'owner_' + Date.now() + '_001';
    const shopOwnerUser = {
        id: shopOwnerId,
        username: 'shop_owner',
        password: hashPassword('123456'),
        email: 'owner@example.com',
        role: 'shop_owner',
        status: 'active',
        createdAt: new Date(),
        lastLoginAt: null,
        permissions: ['manage_own_shops', 'create_shops']
    };
    
    users.set(shopOwnerId, shopOwnerUser);
    console.log('✅ 创建店主账号: shop_owner / 123456');
    
    // 创建第二个店主账号
    const shopOwner2Id = 'owner_' + Date.now() + '_002';
    const shopOwner2User = {
        id: shopOwner2Id,
        username: 'shop_owner2',
        password: hashPassword('123456'),
        email: 'owner2@example.com',
        role: 'shop_owner',
        status: 'active',
        createdAt: new Date(),
        lastLoginAt: null,
        permissions: ['manage_own_shops', 'create_shops']
    };
    
    users.set(shopOwner2Id, shopOwner2User);
    console.log('✅ 创建第二个店主账号: shop_owner2 / 123456');
    
    // 创建店铺数据
    const shopDataList = [
        {
            name: '科技数码专营店',
            domain: 'tech.quicktalk.com',
            description: '专业的科技数码产品销售店铺，提供优质的客服服务',
            status: 'approved',
            ownerId: shopOwnerId,
            category: '数码科技'
        },
        {
            name: '时尚服饰旗舰店',
            domain: 'fashion.quicktalk.com',
            description: '时尚潮流服饰，引领穿搭风尚',
            status: 'approved',
            ownerId: shopOwnerId,
            category: '服装服饰'
        },
        {
            name: '美食生活馆',
            domain: 'food.quicktalk.com',
            description: '精选美食，品质生活',
            status: 'pending',
            ownerId: shopOwnerId,
            category: '食品饮料'
        },
        {
            name: '家居装饰店',
            domain: 'home.quicktalk.com',
            description: '温馨家居，装点生活',
            status: 'rejected',
            ownerId: shopOwnerId,
            category: '家居生活',
            rejectionReason: '店铺信息不完整，请补充营业执照等相关资质文件'
        },
        {
            name: '运动健身专区',
            domain: 'sports.quicktalk.com',
            description: '运动装备，健康生活',
            status: 'suspended',
            ownerId: shopOwnerId,
            category: '运动户外',
            suspensionReason: '用户投诉较多，暂时停用待整改'
        },
        {
            name: '书籍文具店',
            domain: 'books.quicktalk.com',
            description: '知识的海洋，学习的伙伴',
            status: 'approved',
            ownerId: shopOwner2Id,
            category: '图书文具'
        },
        {
            name: '母婴用品店',
            domain: 'baby.quicktalk.com',
            description: '专业母婴用品，呵护成长每一天',
            status: 'pending',
            ownerId: shopOwner2Id,
            category: '母婴用品'
        }
    ];
    
    const createdShops = [];
    shopDataList.forEach((shopData, index) => {
        const shopId = 'shop_' + Date.now() + '_' + String(index + 1).padStart(3, '0');
        const shop = {
            id: shopId,
            name: shopData.name,
            domain: shopData.domain,
            description: shopData.description,
            ownerId: shopData.ownerId,
            status: shopData.status,
            approvalStatus: shopData.status,
            category: shopData.category,
            createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // 随机过去30天内的时间
            updatedAt: new Date(),
            api_key: shopData.status === 'approved' ? `sk_${shopId}_${Math.random().toString(36).substr(2, 16)}` : null,
            apiKeyCreatedAt: shopData.status === 'approved' ? new Date() : null,
            expiresAt: shopData.status === 'approved' ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null, // 1年后过期
            members: [],
            settings: {
                autoReply: true,
                businessHours: {
                    enabled: true,
                    start: '09:00',
                    end: '18:00',
                    timezone: 'Asia/Shanghai'
                },
                notifications: {
                    email: true,
                    sms: false,
                    webhook: false
                }
            }
        };
        
        if (shopData.rejectionReason) {
            shop.rejectionReason = shopData.rejectionReason;
            shop.reviewedAt = new Date();
            shop.reviewedBy = reviewerId;
        }
        
        if (shopData.suspensionReason) {
            shop.suspensionReason = shopData.suspensionReason;
            shop.suspendedAt = new Date();
            shop.suspendedBy = adminId;
        }
        
        shops.set(shopId, shop);
        createdShops.push(shop);
        console.log(`✅ 创建店铺: ${shop.name} (${shop.status})`);
    });
    
    // 建立用户-店铺关系
    const owner1Shops = createdShops.filter(shop => shop.ownerId === shopOwnerId);
    const owner2Shops = createdShops.filter(shop => shop.ownerId === shopOwner2Id);
    
    userShops.set(shopOwnerId, owner1Shops.map(shop => ({
        shopId: shop.id,
        role: 'owner',
        userRole: 'owner',
        permissions: ['manage_staff', 'view_chats', 'handle_chats', 'manage_shop', 'view_analytics'],
        joinedAt: shop.createdAt
    })));
    
    userShops.set(shopOwner2Id, owner2Shops.map(shop => ({
        shopId: shop.id,
        role: 'owner',
        userRole: 'owner',
        permissions: ['manage_staff', 'view_chats', 'handle_chats', 'manage_shop', 'view_analytics'],
        joinedAt: shop.createdAt
    })));
    
    console.log(`✅ 为店主1关联 ${owner1Shops.length} 个店铺`);
    console.log(`✅ 为店主2关联 ${owner2Shops.length} 个店铺`);
    
    // 创建一些客服员工账号
    const employees = [
        { username: 'service001', name: '客服小张', shopOwner: shopOwnerId },
        { username: 'service002', name: '客服小李', shopOwner: shopOwnerId },
        { username: 'service003', name: '客服小王', shopOwner: shopOwner2Id }
    ];
    
    employees.forEach((emp, index) => {
        const empId = 'emp_' + Date.now() + '_' + String(index + 1).padStart(3, '0');
        const employee = {
            id: empId,
            username: emp.username,
            password: hashPassword('123456'),
            email: `${emp.username}@quicktalk.com`,
            name: emp.name,
            role: 'agent',
            status: 'active',
            createdAt: new Date(),
            lastLoginAt: null,
            permissions: ['view_chats', 'handle_chats']
        };
        
        users.set(empId, employee);
        console.log(`✅ 创建客服账号: ${emp.username} / 123456 (${emp.name})`);
    });
    
    console.log('\n🎉 测试数据初始化完成！');
    console.log('\n📝 账号信息汇总:');
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│ 管理员账号                                              │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│ 超级管理员: admin / admin123                           │');
    console.log('│ 审核员: reviewer / reviewer123                         │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│ 店主账号                                                │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│ 店主1: shop_owner / 123456                             │');
    console.log('│ 店主2: shop_owner2 / 123456                            │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│ 客服账号                                                │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│ 客服1: service001 / 123456 (客服小张)                  │');
    console.log('│ 客服2: service002 / 123456 (客服小李)                  │');
    console.log('│ 客服3: service003 / 123456 (客服小王)                  │');
    console.log('└─────────────────────────────────────────────────────────┘');
    console.log('\n🏪 店铺状态统计:');
    console.log(`已通过审核: ${createdShops.filter(s => s.status === 'approved').length} 个`);
    console.log(`待审核: ${createdShops.filter(s => s.status === 'pending').length} 个`);
    console.log(`已拒绝: ${createdShops.filter(s => s.status === 'rejected').length} 个`);
    console.log(`已暂停: ${createdShops.filter(s => s.status === 'suspended').length} 个`);
    console.log(`总计: ${createdShops.length} 个店铺`);
    console.log('\n🌐 访问地址:');
    console.log('桌面版管理后台: http://localhost:3030/admin');
    console.log('移动端管理后台: http://localhost:3030/mobile-admin');
    
    // 将数据写入到文件以便 database.js 加载
    const dataToSave = {
        users: Array.from(users.entries()),
        shops: Array.from(shops.entries()),
        userShops: Array.from(userShops.entries()),
        sessions: Array.from(sessions.entries()),
        timestamp: new Date().toISOString()
    };
    
    const fs = require('fs');
    fs.writeFileSync('./data/test-data.json', JSON.stringify(dataToSave, null, 2));
    console.log('\n💾 测试数据已保存到 data/test-data.json');
    
    return {
        users: users.size,
        shops: shops.size,
        userShops: userShops.size,
        createdShops: createdShops
    };
}

// 如果直接运行此文件，执行初始化
if (require.main === module) {
    initCompleteTestData().catch(console.error);
}

module.exports = { initCompleteTestData };
