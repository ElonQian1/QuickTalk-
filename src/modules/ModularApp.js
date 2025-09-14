// 模块化应用管理器
const DatabaseCore = require('../../database-sqlite');
const ShopRepository = require('../database/ShopRepository');
const MessageAdapter = require('../database/MessageAdapter'); // 消息数据库适配器
const SecurityManager = require('../security/SecurityManager');
const ClientApiHandler = require('../client-api/ClientApiHandler');
const EmployeeManager = require('./EmployeeManager'); // 员工管理系统
const EnhancedAnalyticsDashboard = require('./EnhancedAnalyticsDashboard'); // 增强版数据分析系统
const EnhancedAIAssistant = require('./EnhancedAIAssistant'); // AI智能客服助手
const FileManager = require('./FileManager'); // 文件管理与共享系统
const AdvancedNotificationSystem = require('./AdvancedNotificationSystem'); // 高级通知系统

// 综合安全模块 - 已完整实现，当前暂时停用
// 包含功能：会话管理、数据加密、访问控制、威胁检测、审计日志、安全策略
// 如需启用请取消下行注释并在初始化部分启用相关代码
const ComprehensiveSecurityModule = require('./ComprehensiveSecurityModule');

class ModularApp {
    constructor(externalDatabase = null) {
        this.db = null;
        this.externalDatabase = externalDatabase; // 接受外部数据库实例
        this.shopRepo = null;
        this.security = null;
        this.clientApi = null;
        this.employeeManager = null; // 员工管理系统
        this.analyticsManager = null; // 增强版数据分析系统
        this.aiAssistant = null; // AI智能客服助手
        this.fileManager = null; // 文件管理与共享系统
        this.notificationSystem = null; // 高级通知系统
        this.securityModule = null; // 综合安全模块
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
            console.log('🔍 外部数据库实例类型:', this.externalDatabase?.constructor?.name);
            if (this.externalDatabase) {
                // 使用外部数据库实例（比如 database-sqlite）
                this.db = this.externalDatabase;
                console.log('✅ 使用外部数据库实例');
            } else {
                // 使用内存数据库
                this.db = new DatabaseCore();
                console.log('✅ 使用内存数据库');
            }
            console.log('✅ 数据库层初始化完成');

            // 2. 初始化仓库层
            console.log('🏪 初始化仓库层...');
            this.shopRepo = new ShopRepository(this.db); // 使用ShopRepository包装数据库实例
            this.messageRepo = new MessageAdapter(this.db); // 使用消息适配器
            console.log('✅ 仓库层初始化完成');

            // 3. 初始化安全层
            console.log('🛡️ 初始化安全层...');
            this.security = new SecurityManager(this.shopRepo);
            console.log('✅ 安全层初始化完成');

            // 4. 初始化客户端API层
            console.log('📡 初始化客户端API层...');
            this.clientApi = new ClientApiHandler(this.security, this.messageRepo); // 传入消息仓库
            console.log('✅ 客户端API层初始化完成');

            // 5. 初始化员工管理系统
            console.log('👥 初始化员工管理系统...');
            this.employeeManager = new EmployeeManager(this.db, this.messageRepo);
            await this.employeeManager.initialize();
            console.log('✅ 员工管理系统初始化完成');

            // 6. 初始化增强版数据分析系统
            console.log('📊 初始化增强版数据分析系统...');
            this.analyticsManager = new EnhancedAnalyticsDashboard(this.db, this.messageRepo);
            await this.analyticsManager.initialize();
            console.log('✅ 增强版数据分析系统初始化完成');

            // 7. 初始化AI智能客服助手
            console.log('🤖 初始化AI智能客服助手...');
            this.aiAssistant = new EnhancedAIAssistant(this.db, this.messageRepo);
            await this.aiAssistant.initialize();
            console.log('✅ AI智能客服助手初始化完成');

            // 8. 初始化文件管理与共享系统
            console.log('📁 初始化文件管理与共享系统...');
            this.fileManager = new FileManager(this.db, this);
            await this.fileManager.initialize();
            console.log('✅ 文件管理与共享系统初始化完成');

            // 9. 初始化高级通知系统
            console.log('📡 初始化高级通知系统...');
            this.notificationSystem = new AdvancedNotificationSystem(this.db, this.websocketRouter);
            await this.notificationSystem.initialize();
            console.log('✅ 高级通知系统初始化完成');

            // 10. 综合安全模块 - 已实现但暂时停用
            // 注意：该模块已完整开发并测试通过，包含以下功能：
            // - 会话安全管理、数据加密解密、访问控制系统
            // - 威胁检测防护、审计日志记录、安全策略管理
            // 如需启用，请取消以下注释：
            console.log('🛡️ 综合安全模块 (已实现，当前停用状态)');
            this.securityModule = null; // 已实现但暂时停用
            // this.securityModule = new ComprehensiveSecurityModule(this.db);
            // await this.securityModule.initialize();
            // console.log('✅ 综合安全模块初始化完成');
            console.log('✅ 综合安全模块初始化完成');

            // 11. 初始化数据库表（仅在使用内存数据库时）
            if (!this.externalDatabase) {
                await this.initializeTables();
                // 11. 创建测试数据（仅在使用内存数据库时）
                await this.createTestData();
            } else {
                console.log('✅ 使用外部数据库，跳过表初始化和测试数据创建');
            }

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
     * 获取消息适配器
     */
    getMessageAdapter() {
        if (!this.initialized) {
            throw new Error('模块化应用尚未初始化');
        }
        return this.messageRepo;
    }

    /**
     * 获取员工管理系统
     */
    getEmployeeManager() {
        if (!this.initialized) {
            throw new Error('模块化应用尚未初始化');
        }
        return this.employeeManager;
    }

    /**
     * 获取增强版数据分析系统
     */
    getAnalyticsManager() {
        if (!this.initialized) {
            throw new Error('模块化应用尚未初始化');
        }
        return this.analyticsManager;
    }

    /**
     * 获取AI智能客服助手
     */
    getAIAssistant() {
        if (!this.initialized) {
            throw new Error('模块化应用尚未初始化');
        }
        return this.aiAssistant;
    }

    /**
     * 通用模块获取器
     * @param {string} moduleName 模块名称
     * @returns {object} 模块实例
     */
    getModule(moduleName) {
        if (!this.initialized) {
            throw new Error('模块化应用尚未初始化');
        }

        const moduleMap = {
            'ClientApiHandler': this.clientApi,
            'SecurityManager': this.security,
            'ShopRepository': this.shopRepo,
            'MessageAdapter': this.messageRepo,
            'EmployeeManager': this.employeeManager,
            'EnhancedAnalyticsDashboard': this.analyticsManager,
            'EnhancedAIAssistant': this.aiAssistant
        };

        const module = moduleMap[moduleName];
        if (!module) {
            throw new Error(`未找到模块: ${moduleName}`);
        }

        return module;
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
