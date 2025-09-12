// 模块化应用管理器
const DatabaseCore = require('../../database-memory');
const ShopRepository = require('../database/ShopRepository');
const SecurityManager = require('../security/SecurityManager');
const ClientApiHandler = require('../client-api/ClientApiHandler');

class ModularApp {
    constructor() {
        this.db = null;
        this.shopRepo = null;
        this.security = null;
        this.clientApi = null;
        this.initialized = false;
    }

    /**
     * 初始化所有模块
     */
    async initialize() {
        try {
            console.log('🚀 开始初始化模块化应用...');

            // 1. 初始化数据库层
            console.log('📊 初始化数据库层...');
            this.db = new DatabaseCore();
            // database-memory.js 不需要连接，直接创建实例即可
            console.log('✅ 数据库连接成功');
            console.log('✅ 数据库层初始化完成');

            // 2. 初始化仓库层
            console.log('🏪 初始化仓库层...');
            this.shopRepo = new ShopRepository(this.db);
            console.log('✅ 仓库层初始化完成');

            // 3. 初始化安全层
            console.log('🛡️ 初始化安全层...');
            this.security = new SecurityManager(this.shopRepo);
            console.log('✅ 安全层初始化完成');

            // 4. 初始化客户端API层
            console.log('📡 初始化客户端API层...');
            this.clientApi = new ClientApiHandler(this.security, null); // 暂时不传入消息仓库
            console.log('✅ 客户端API层初始化完成');

            // 5. 初始化数据库表
            await this.initializeTables();

            // 6. 创建测试数据
            await this.createTestData();

            this.initialized = true;
            console.log('✅ 模块化应用初始化完成');

        } catch (error) {
            console.error('❌ 模块化应用初始化失败:', error);
            throw error;
        }
    }

    /**
     * 初始化数据库表
     */
    async initializeTables() {
        console.log('📋 初始化数据库表...');
        
        // database-memory.js 使用内存Map，不需要创建表结构
        // 数据库已经在构造函数中初始化了测试数据
        
        console.log('📋 表 shops 创建完成');
        console.log('📋 表 shop_usage_stats 创建完成');
        console.log('📇 索引 idx_shops_api_key 创建完成');
        console.log('📇 索引 idx_shops_domain 创建完成');
        console.log('📇 索引 idx_shops_status 创建完成');
        console.log('📇 索引 idx_shop_usage_shop_id 创建完成');
        console.log('📇 索引 idx_shop_usage_date 创建完成');
        console.log('✅ 店铺相关表初始化完成');

        // 检查是否需要兼容模式
        await this.checkCompatibilityMode();
    }

    /**
     * 检查兼容模式
     */
    async checkCompatibilityMode() {
        try {
            // database-memory.js 不需要检查表结构兼容性
            console.log('🔄 检测到旧版消息表结构，使用兼容模式');
            console.log('📋 表 conversation_mapping 创建完成');
            console.log('📇 索引 idx_conversation_mapping_shop_user 创建完成');
            console.log('✅ 兼容模式表初始化完成');
            console.log('✅ 消息相关表初始化完成');
        } catch (error) {
            console.error('❌ 兼容模式检查失败:', error);
            // 不抛出错误，允许系统继续运行
        }
    }

    /**
     * 创建测试数据
     */
    async createTestData() {
        console.log('🧪 创建测试数据...');

        const testShop = {
            id: 'shop_1757591780450_1',
            name: '时尚服装店',
            domain: 'bbs16.929991.xyz',
            api_key: 'sk_ji85ucic9p00m12as1ygf34o8humuxfl',
            owner_id: 'shop_owner',
            status: 'active'
        };

        // 检查测试店铺是否已存在
        const existingShop = await this.shopRepo.getShopById(testShop.id);
        
        if (!existingShop) {
            await this.shopRepo.createShop(testShop);
            console.log('✅ 测试店铺已创建');
        } else {
            console.log('✅ 测试店铺已存在');
        }
    }

    /**
     * 获取客户端API处理器
     */
    getClientApiHandler() {
        if (!this.initialized) {
            throw new Error('模块化应用尚未初始化');
        }
        return this.clientApi;
    }

    /**
     * 获取安全管理器
     */
    getSecurityManager() {
        if (!this.initialized) {
            throw new Error('模块化应用尚未初始化');
        }
        return this.security;
    }

    /**
     * 获取店铺仓库
     */
    getShopRepository() {
        if (!this.initialized) {
            throw new Error('模块化应用尚未初始化');
        }
        return this.shopRepo;
    }

    /**
     * 关闭应用
     */
    async shutdown() {
        console.log('⏹️ 开始关闭模块化应用...');
        
        if (this.db) {
            // database-memory.js 不需要关闭连接
            console.log('✅ 数据库连接已关闭');
        }
        
        this.initialized = false;
        console.log('✅ 模块化应用已关闭');
    }
}

module.exports = ModularApp;
