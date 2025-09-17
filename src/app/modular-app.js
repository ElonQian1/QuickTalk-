/**
 * 模块化应用管理器
 * 负责初始化和管理所有模块
 */
const DatabaseCore = require('../database/database-core');
const ShopRepository = require('../database/shop-repository');
const MessageRepository = require('../database/message-repository');

const AuthValidator = require('../security/auth-validator');
const DomainValidator = require('../security/domain-validator');
const SecurityLogger = require('../security/security-logger');

const ConnectionHandler = require('../client-api/connection-handler');
const MessageHandler = require('../client-api/message-handler');
const ClientApiRouter = require('../client-api/client-api-router');

class ModularApp {
    constructor(options = {}) {
        this.options = {
            dbPath: './data/customer_service.db',
            logDir: './logs',
            port: 3030,
            ...options
        };
        
        this.modules = {};
        this.initialized = false;
    }

    /**
     * 初始化所有模块
     */
    async initialize() {
        console.log('🚀 开始初始化模块化应用...');
        
        try {
            // 1. 初始化数据库层
            await this.initializeDatabaseLayer();
            
            // 2. 初始化安全层
            await this.initializeSecurityLayer();
            
            // 3. 初始化客户端API层
            await this.initializeClientApiLayer();
            
            // 4. 初始化数据库表
            await this.initializeDatabaseTables();
            
            this.initialized = true;
            console.log('✅ 模块化应用初始化完成');
            
            return this;
            
        } catch (error) {
            console.error('❌ 模块化应用初始化失败:', error);
            throw error;
        }
    }

    /**
     * 初始化数据库层
     */
    async initializeDatabaseLayer() {
        console.log('📊 初始化数据库层...');
        
        // 核心数据库连接
        this.modules.databaseCore = new DatabaseCore(this.options.dbPath);
        await this.modules.databaseCore.initialize();
        
        // 数据访问层
        this.modules.shopRepository = new ShopRepository(this.modules.databaseCore);
        this.modules.messageRepository = new MessageRepository(this.modules.databaseCore);
        
        console.log('✅ 数据库层初始化完成');
    }

    /**
     * 初始化安全层
     */
    async initializeSecurityLayer() {
        console.log('🛡️ 初始化安全层...');
        
        // 安全验证模块
        this.modules.authValidator = new AuthValidator(this.modules.shopRepository);
        this.modules.domainValidator = new DomainValidator();
        this.modules.securityLogger = new SecurityLogger({
            logDir: this.options.logDir
        });
        
        console.log('✅ 安全层初始化完成');
    }

    /**
     * 初始化客户端API层
     */
    async initializeClientApiLayer() {
        console.log('📡 初始化客户端API层...');
        
        // 连接和消息处理器
        this.modules.connectionHandler = new ConnectionHandler(
            this.modules.shopRepository,
            this.modules.messageRepository,
            this.modules.authValidator,
            this.modules.domainValidator,
            this.modules.securityLogger
        );
        
        this.modules.messageHandler = new MessageHandler(
            this.modules.messageRepository,
            this.modules.connectionHandler,
            this.modules.securityLogger
        );
        
        // 客户端API路由
        this.modules.clientApiRouter = new ClientApiRouter(
            this.modules.connectionHandler,
            this.modules.messageHandler,
            this.modules.authValidator,
            this.modules.domainValidator,
            this.modules.securityLogger
        );
        
        console.log('✅ 客户端API层初始化完成');
    }

    /**
     * 初始化数据库表
     */
    async initializeDatabaseTables() {
        console.log('📋 初始化数据库表...');
        
        await this.modules.shopRepository.initializeTables();
        await this.modules.messageRepository.initializeTables();
        
        console.log('✅ 数据库表初始化完成');
    }

    /**
     * 获取模块
     */
    getModule(name) {
        if (!this.initialized) {
            throw new Error('应用尚未初始化');
        }
        
        if (!this.modules[name]) {
            throw new Error(`模块 ${name} 不存在`);
        }
        
        return this.modules[name];
    }

    /**
     * 获取所有模块
     */
    getAllModules() {
        return { ...this.modules };
    }

    /**
     * 获取客户端API路由器
     */
    getClientApiRouter() {
        return this.getModule('clientApiRouter').getRouter();
    }

    /**
     * 获取数据库核心
     */
    getDatabaseCore() {
        return this.getModule('databaseCore');
    }

    /**
     * 获取店铺仓库
     */
    getShopRepository() {
        return this.getModule('shopRepository');
    }

    /**
     * 获取消息仓库
     */
    getMessageRepository() {
        return this.getModule('messageRepository');
    }

    /**
     * 获取连接处理器
     */
    getConnectionHandler() {
        return this.getModule('connectionHandler');
    }

    /**
     * 获取安全日志器
     */
    getSecurityLogger() {
        return this.getModule('securityLogger');
    }

    /**
     * 获取安全管理器 - 兼容性方法
     */
    getSecurityManager() {
        return this.getModule('authValidator');
    }

    /**
     * 获取消息适配器 - 兼容性方法 
     */
    getMessageAdapter() {
        return this.getModule('messageRepository');
    }

    /**
     * 创建默认测试数据
     */
    async createTestData() {
        console.log('🧪 创建测试数据...');
        
        const shopRepo = this.getShopRepository();
        const authValidator = this.getModule('authValidator');
        
        // 检查是否已存在测试店铺
        const existingShop = await shopRepo.getShopById('shop_1757591780450_1');
        
        if (!existingShop) {
            // 创建测试店铺
            const testShopData = {
                id: 'shop_1757591780450_1',
                name: '时尚服装店',
                domain: 'bbs16.929991.xyz',
                api_key: 'sk_ji85ucic9p00m12as1ygf34o8humuxfl',
                owner_username: 'shop_owner',
                owner_password: '123456',
                owner_email: 'shop@example.com',
                settings: {
                    welcomeMessage: '欢迎访问时尚服装店！有什么可以帮您的吗？',
                    theme: 'default',
                    autoReply: true
                }
            };
            
            await shopRepo.createShop(testShopData);
            console.log('✅ 测试店铺创建完成');
        } else {
            console.log('✅ 测试店铺已存在');
        }
    }

    /**
     * 获取应用状态
     */
    getStatus() {
        return {
            initialized: this.initialized,
            modules: Object.keys(this.modules),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            connections: this.initialized ? this.getConnectionHandler().getConnectionStats() : null
        };
    }

    /**
     * 优雅关闭
     */
    async shutdown() {
        console.log('⏹️ 开始关闭模块化应用...');
        
        try {
            // 关闭连接处理器
            if (this.modules.connectionHandler && typeof this.modules.connectionHandler.destroy === 'function') {
                this.modules.connectionHandler.destroy();
            }
            
            // 关闭API路由器
            if (this.modules.clientApiRouter && typeof this.modules.clientApiRouter.destroy === 'function') {
                this.modules.clientApiRouter.destroy();
            }
            
            // 关闭数据库连接
            if (this.modules.databaseCore) {
                await this.modules.databaseCore.close();
            }
            
            console.log('✅ 模块化应用已关闭');
            
        } catch (error) {
            console.error('❌ 关闭应用时出错:', error);
        }
    }

    /**
     * 热重载模块
     */
    async reloadModule(moduleName) {
        console.log(`🔄 重载模块: ${moduleName}`);
        
        // 这里可以实现模块的热重载逻辑
        // 目前只是重新初始化指定模块
        
        switch (moduleName) {
            case 'clientApi':
                await this.initializeClientApiLayer();
                break;
            case 'security':
                await this.initializeSecurityLayer();
                break;
            default:
                throw new Error(`不支持重载模块: ${moduleName}`);
        }
        
        console.log(`✅ 模块 ${moduleName} 重载完成`);
    }

    /**
     * 获取模块配置
     */
    getModuleConfig(moduleName) {
        const configs = {
            database: {
                path: this.options.dbPath,
                type: 'sqlite3'
            },
            security: {
                logDir: this.options.logDir,
                apiKeyPrefix: 'sk_',
                sessionTimeout: 30 * 60 * 1000 // 30分钟
            },
            clientApi: {
                rateLimits: {
                    connection: { windowMs: 5 * 60 * 1000, maxRequests: 10 },
                    message: { windowMs: 1 * 60 * 1000, maxRequests: 30 },
                    general: { windowMs: 1 * 60 * 1000, maxRequests: 60 }
                }
            }
        };
        
        return configs[moduleName] || null;
    }
}

module.exports = ModularApp;
