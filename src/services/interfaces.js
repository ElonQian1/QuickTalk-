/**
 * 服务接口契约定义
 * 为所有服务定义标准接口，提高代码的可测试性和可维护性
 * 支持依赖注入和模拟测试
 */

/**
 * 基础服务接口
 * 所有服务都应实现的基本方法
 */
class BaseServiceInterface {
    /**
     * 服务健康检查
     * @returns {Promise<Object>} 健康状态
     */
    async healthCheck() {
        throw new Error('healthCheck method must be implemented');
    }

    /**
     * 服务初始化
     * @param {Object} config - 配置参数
     * @returns {Promise<void>}
     */
    async initialize(config = {}) {
        throw new Error('initialize method must be implemented');
    }

    /**
     * 服务关闭
     * @returns {Promise<void>}
     */
    async shutdown() {
        throw new Error('shutdown method must be implemented');
    }
}

/**
 * 消息服务接口
 * 定义消息相关的业务逻辑方法
 */
class IMessageService extends BaseServiceInterface {
    /**
     * 发送消息
     * @param {Object} messageData - 消息数据
     * @param {string} messageData.conversationId - 对话ID
     * @param {string} messageData.senderId - 发送者ID
     * @param {string} messageData.senderType - 发送者类型
     * @param {string} messageData.content - 消息内容
     * @param {string} messageData.messageType - 消息类型
     * @param {Object} messageData.metadata - 元数据
     * @returns {Promise<Object>} 发送结果
     */
    async sendMessage(messageData) {
        throw new Error('sendMessage method must be implemented');
    }

    /**
     * 获取对话消息
     * @param {Object} params - 查询参数
     * @param {string} params.conversationId - 对话ID
     * @param {number} params.page - 页码
     * @param {number} params.limit - 每页数量
     * @param {Date} params.beforeTimestamp - 时间戳之前
     * @param {Date} params.afterTimestamp - 时间戳之后
     * @returns {Promise<Object>} 消息列表
     */
    async getConversationMessages(params) {
        throw new Error('getConversationMessages method must be implemented');
    }

    /**
     * 标记消息为已读
     * @param {Object} params - 参数
     * @param {string} params.conversationId - 对话ID
     * @param {string} params.userId - 用户ID
     * @param {Array<string>} params.messageIds - 消息ID列表
     * @returns {Promise<Object>} 标记结果
     */
    async markMessagesAsRead(params) {
        throw new Error('markMessagesAsRead method must be implemented');
    }

    /**
     * 搜索消息
     * @param {Object} params - 搜索参数
     * @param {string} params.query - 搜索关键词
     * @param {string} params.shopId - 店铺ID
     * @param {string} params.conversationId - 对话ID
     * @returns {Promise<Object>} 搜索结果
     */
    async searchMessages(params) {
        throw new Error('searchMessages method must be implemented');
    }

    /**
     * 获取未读消息数量
     * @param {Object} params - 参数
     * @param {string} params.userId - 用户ID
     * @param {string} params.conversationId - 对话ID
     * @returns {Promise<Object>} 未读数量
     */
    async getUnreadMessageCount(params) {
        throw new Error('getUnreadMessageCount method must be implemented');
    }
}

/**
 * 对话服务接口
 * 定义对话管理的业务逻辑方法
 */
class IConversationService extends BaseServiceInterface {
    /**
     * 创建或获取对话
     * @param {Object} params - 参数
     * @param {string} params.shopId - 店铺ID
     * @param {string} params.userId - 用户ID
     * @param {Object} params.metadata - 元数据
     * @returns {Promise<Object>} 对话对象
     */
    async createOrGetConversation(params) {
        throw new Error('createOrGetConversation method must be implemented');
    }

    /**
     * 获取对话
     * @param {string} conversationId - 对话ID
     * @returns {Promise<Object>} 对话对象
     */
    async getConversation(conversationId) {
        throw new Error('getConversation method must be implemented');
    }

    /**
     * 更新对话状态
     * @param {Object} params - 参数
     * @param {string} params.conversationId - 对话ID
     * @param {string} params.status - 新状态
     * @param {Object} params.metadata - 元数据
     * @returns {Promise<Object>} 更新结果
     */
    async updateConversationStatus(params) {
        throw new Error('updateConversationStatus method must be implemented');
    }

    /**
     * 获取店铺的对话列表
     * @param {Object} params - 参数
     * @param {string} params.shopId - 店铺ID
     * @param {number} params.page - 页码
     * @param {number} params.limit - 每页数量
     * @returns {Promise<Object>} 对话列表
     */
    async getShopConversations(params) {
        throw new Error('getShopConversations method must be implemented');
    }

    /**
     * 获取对话统计信息
     * @param {string} conversationId - 对话ID
     * @returns {Promise<Object>} 统计信息
     */
    async getConversationStats(conversationId) {
        throw new Error('getConversationStats method must be implemented');
    }
}

/**
 * 店铺服务接口
 * 定义店铺管理的业务逻辑方法
 */
class IShopService extends BaseServiceInterface {
    /**
     * 创建店铺
     * @param {Object} shopData - 店铺数据
     * @param {string} shopData.name - 店铺名称
     * @param {string} shopData.domain - 店铺域名
     * @param {Object} shopData.config - 店铺配置
     * @returns {Promise<Object>} 创建结果
     */
    async createShop(shopData) {
        throw new Error('createShop method must be implemented');
    }

    /**
     * 更新店铺
     * @param {string} shopId - 店铺ID
     * @param {Object} updates - 更新数据
     * @returns {Promise<Object>} 更新结果
     */
    async updateShop(shopId, updates) {
        throw new Error('updateShop method must be implemented');
    }

    /**
     * 获取店铺
     * @param {string} shopId - 店铺ID
     * @returns {Promise<Object>} 店铺对象
     */
    async getShop(shopId) {
        throw new Error('getShop method must be implemented');
    }

    /**
     * 验证API密钥
     * @param {string} apiKey - API密钥
     * @returns {Promise<Object>} 验证结果
     */
    async validateApiKey(apiKey) {
        throw new Error('validateApiKey method must be implemented');
    }

    /**
     * 重新生成API密钥
     * @param {string} shopId - 店铺ID
     * @returns {Promise<Object>} 新API密钥
     */
    async regenerateApiKey(shopId) {
        throw new Error('regenerateApiKey method must be implemented');
    }

    /**
     * 记录使用统计
     * @param {string} shopId - 店铺ID
     * @param {Object} stats - 统计数据
     * @returns {Promise<void>}
     */
    async recordUsageStats(shopId, stats) {
        throw new Error('recordUsageStats method must be implemented');
    }

    /**
     * 获取店铺统计
     * @param {string} shopId - 店铺ID
     * @param {Object} params - 参数
     * @returns {Promise<Object>} 统计数据
     */
    async getShopStats(shopId, params = {}) {
        throw new Error('getShopStats method must be implemented');
    }
}

/**
 * 通知服务接口
 * 定义通知处理的业务逻辑方法
 */
class INotificationService extends BaseServiceInterface {
    /**
     * 发送新消息通知
     * @param {Object} data - 通知数据
     * @param {string} data.shopId - 店铺ID
     * @param {string} data.conversationId - 对话ID
     * @param {Object} data.message - 消息对象
     * @returns {Promise<void>}
     */
    async notifyNewMessage(data) {
        throw new Error('notifyNewMessage method must be implemented');
    }

    /**
     * 发送新连接通知
     * @param {Object} data - 通知数据
     * @param {string} data.shopId - 店铺ID
     * @param {string} data.userId - 用户ID
     * @param {string} data.conversationId - 对话ID
     * @returns {Promise<void>}
     */
    async notifyNewConnection(data) {
        throw new Error('notifyNewConnection method must be implemented');
    }

    /**
     * 发送连接关闭通知
     * @param {Object} data - 通知数据
     * @param {string} data.shopId - 店铺ID
     * @param {string} data.userId - 用户ID
     * @param {string} data.reason - 关闭原因
     * @returns {Promise<void>}
     */
    async notifyConnectionClosed(data) {
        throw new Error('notifyConnectionClosed method must be implemented');
    }

    /**
     * 广播到店铺
     * @param {string} shopId - 店铺ID
     * @param {Object} message - 消息内容
     * @returns {Promise<void>}
     */
    async broadcastToShop(shopId, message) {
        throw new Error('broadcastToShop method must be implemented');
    }

    /**
     * 发送批量通知
     * @param {Array<Object>} notifications - 通知列表
     * @returns {Promise<Object>} 发送结果
     */
    async sendBatchNotifications(notifications) {
        throw new Error('sendBatchNotifications method must be implemented');
    }
}

/**
 * 知识库服务接口
 * 定义知识库管理的业务逻辑方法
 */
class IKnowledgeBaseService extends BaseServiceInterface {
    /**
     * 搜索知识库
     * @param {Object} params - 搜索参数
     * @param {string} params.query - 搜索关键词
     * @param {number} params.limit - 结果数量限制
     * @returns {Promise<Object>} 搜索结果
     */
    async searchKnowledge(params) {
        throw new Error('searchKnowledge method must be implemented');
    }

    /**
     * 添加知识条目
     * @param {Object} knowledge - 知识数据
     * @param {string} knowledge.question - 问题
     * @param {string} knowledge.answer - 答案
     * @param {Array<string>} knowledge.tags - 标签
     * @returns {Promise<Object>} 添加结果
     */
    async addKnowledge(knowledge) {
        throw new Error('addKnowledge method must be implemented');
    }

    /**
     * 更新知识条目
     * @param {string} knowledgeId - 知识ID
     * @param {Object} updates - 更新数据
     * @returns {Promise<Object>} 更新结果
     */
    async updateKnowledge(knowledgeId, updates) {
        throw new Error('updateKnowledge method must be implemented');
    }
}

/**
 * 意图分类服务接口
 * 定义意图识别的业务逻辑方法
 */
class IIntentClassificationService extends BaseServiceInterface {
    /**
     * 分类用户意图
     * @param {Object} params - 参数
     * @param {string} params.text - 用户输入文本
     * @param {Object} params.context - 上下文信息
     * @returns {Promise<Object>} 分类结果
     */
    async classifyIntent(params) {
        throw new Error('classifyIntent method must be implemented');
    }

    /**
     * 训练意图模型
     * @param {Array<Object>} trainingData - 训练数据
     * @returns {Promise<Object>} 训练结果
     */
    async trainModel(trainingData) {
        throw new Error('trainModel method must be implemented');
    }

    /**
     * 获取支持的意图列表
     * @returns {Promise<Array<string>>} 意图列表
     */
    async getSupportedIntents() {
        throw new Error('getSupportedIntents method must be implemented');
    }
}

/**
 * 自动回复服务接口
 * 定义自动回复的业务逻辑方法
 */
class IAutoReplyService extends BaseServiceInterface {
    /**
     * 处理消息并生成回复
     * @param {Object} params - 参数
     * @param {string} params.messageId - 消息ID
     * @param {string} params.conversationId - 对话ID
     * @param {string} params.content - 消息内容
     * @param {Object} params.metadata - 元数据
     * @returns {Promise<Object>} 处理结果
     */
    async processMessage(params) {
        throw new Error('processMessage method must be implemented');
    }

    /**
     * 配置自动回复规则
     * @param {string} shopId - 店铺ID
     * @param {Object} rules - 回复规则
     * @returns {Promise<Object>} 配置结果
     */
    async configureAutoReply(shopId, rules) {
        throw new Error('configureAutoReply method must be implemented');
    }

    /**
     * 获取自动回复统计
     * @param {string} shopId - 店铺ID
     * @param {Object} params - 参数
     * @returns {Promise<Object>} 统计数据
     */
    async getAutoReplyStats(shopId, params = {}) {
        throw new Error('getAutoReplyStats method must be implemented');
    }
}

/**
 * 服务管理器接口
 * 定义服务管理的方法
 */
class IServiceManager {
    /**
     * 初始化服务管理器
     * @param {Object} config - 配置
     * @returns {Promise<Object>} 初始化结果
     */
    async initialize(config = {}) {
        throw new Error('initialize method must be implemented');
    }

    /**
     * 获取服务实例
     * @param {string} serviceName - 服务名称
     * @returns {Object} 服务实例
     */
    getService(serviceName) {
        throw new Error('getService method must be implemented');
    }

    /**
     * 获取所有服务
     * @returns {Object} 所有服务实例
     */
    getAllServices() {
        throw new Error('getAllServices method must be implemented');
    }

    /**
     * 检查服务健康状态
     * @returns {Promise<Object>} 健康状态
     */
    async checkHealth() {
        throw new Error('checkHealth method must be implemented');
    }

    /**
     * 重启服务
     * @param {string} serviceName - 服务名称
     * @returns {Promise<Object>} 重启结果
     */
    async restartService(serviceName) {
        throw new Error('restartService method must be implemented');
    }

    /**
     * 关闭服务管理器
     * @returns {Promise<void>}
     */
    async shutdown() {
        throw new Error('shutdown method must be implemented');
    }
}

/**
 * 服务工厂接口
 * 定义服务工厂的方法
 */
class IServiceFactory {
    /**
     * 初始化服务工厂
     * @param {Object} dependencies - 依赖项
     * @returns {Promise<Object>} 初始化结果
     */
    async initialize(dependencies = {}) {
        throw new Error('initialize method must be implemented');
    }

    /**
     * 获取服务管理器
     * @returns {IServiceManager} 服务管理器实例
     */
    getServiceManager() {
        throw new Error('getServiceManager method must be implemented');
    }

    /**
     * 创建控制器服务上下文
     * @returns {Object} 服务上下文
     */
    createControllerContext() {
        throw new Error('createControllerContext method must be implemented');
    }

    /**
     * 为特定控制器创建服务上下文
     * @param {string} controllerType - 控制器类型
     * @returns {Object} 服务上下文
     */
    createContextForController(controllerType) {
        throw new Error('createContextForController method must be implemented');
    }

    /**
     * 创建Express中间件
     * @returns {Function} Express中间件
     */
    createServiceMiddleware() {
        throw new Error('createServiceMiddleware method must be implemented');
    }

    /**
     * 获取健康状态
     * @returns {Promise<Object>} 健康状态
     */
    async getHealthStatus() {
        throw new Error('getHealthStatus method must be implemented');
    }

    /**
     * 关闭服务工厂
     * @returns {Promise<void>}
     */
    async shutdown() {
        throw new Error('shutdown method must be implemented');
    }
}

// 导出所有接口
module.exports = {
    // 基础接口
    BaseServiceInterface,
    
    // 业务服务接口
    IMessageService,
    IConversationService,
    IShopService,
    INotificationService,
    
    // AI服务接口
    IKnowledgeBaseService,
    IIntentClassificationService,
    IAutoReplyService,
    
    // 管理接口
    IServiceManager,
    IServiceFactory,
    
    // 接口验证工具
    validateServiceInterface: (service, interfaceClass) => {
        const interfacePrototype = interfaceClass.prototype;
        const serviceMethods = Object.getOwnPropertyNames(service.constructor.prototype);
        const interfaceMethods = Object.getOwnPropertyNames(interfacePrototype);
        
        const missingMethods = interfaceMethods.filter(method => {
            return method !== 'constructor' && !serviceMethods.includes(method);
        });
        
        if (missingMethods.length > 0) {
            throw new Error(`Service missing required methods: ${missingMethods.join(', ')}`);
        }
        
        return true;
    },
    
    // 模拟服务创建工具
    createMockService: (interfaceClass) => {
        const mockService = {};
        const interfacePrototype = interfaceClass.prototype;
        const methods = Object.getOwnPropertyNames(interfacePrototype);
        
        methods.forEach(method => {
            if (method !== 'constructor') {
                mockService[method] = jest ? jest.fn() : function() {
                    console.log(`Mock method called: ${method}`);
                    return Promise.resolve({});
                };
            }
        });
        
        return mockService;
    }
};