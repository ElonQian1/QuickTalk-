/**
 * 统一消息适配器
 * 这是一个过渡期的适配器，内部使用 MessageRepository 但保持与原 MessageAdapter 相同的接口
 * 目的：确保平滑迁移，零风险升级到 MessageRepository
 * 
 * @author QuickTalk Team
 * @version 1.0.0 - 迁移过渡版本
 */

const MessageRepository = require('./message-repository');

class UnifiedMessageAdapter {
    constructor(database) {
        console.log('🔄 初始化统一消息适配器 (使用 MessageRepository)');
        
        // 使用 MessageRepository 作为底层实现
        this.messageRepo = new MessageRepository(database);
        this.db = database;
        
        // 标记这是过渡版本
        this.isTransitionVersion = true;
    }

    /**
     * 添加消息 - 兼容 MessageAdapter 接口
     * 内部使用 MessageRepository.addMessage
     */
    async addMessage(data) {
        try {
            console.log('🔄 [统一适配器] addMessage 调用 -> MessageRepository.addMessage');
            
            // 将 MessageAdapter 的数据格式转换为 MessageRepository 格式
            const {
                conversationId,
                senderType,
                senderId,
                content,
                messageType = 'text',
                fileId = null
            } = data;

            // 转换数据格式
            const repositoryData = {
                conversationId,
                senderType,
                senderId,
                senderName: data.senderName || `${senderType}_${senderId}`,
                message: content,
                messageType,
                attachments: fileId ? [{ fileId }] : [],
                metadata: {
                    originalSource: 'MessageAdapter',
                    migrationVersion: '1.0'
                }
            };

            const result = await this.messageRepo.addMessage(repositoryData);
            
            // 返回与 MessageAdapter 相同格式的结果
            return result.lastID || result.id || this.generateId();

        } catch (error) {
            console.error('❌ [统一适配器] addMessage 失败:', error);
            throw error;
        }
    }

    /**
     * 获取对话消息 - 兼容 MessageAdapter 接口
     * 内部使用 MessageRepository.getMessages
     */
    async getConversationMessages(conversationId, options = {}) {
        try {
            console.log('🔄 [统一适配器] getConversationMessages 调用 -> MessageRepository.getMessages');
            
            const result = await this.messageRepo.getMessages(conversationId, options);
            
            // 确保返回格式与 MessageAdapter 兼容
            return {
                messages: result.messages || result,
                total: result.total || (result.messages ? result.messages.length : result.length),
                hasMore: result.hasMore || false
            };

        } catch (error) {
            console.error('❌ [统一适配器] getConversationMessages 失败:', error);
            throw error;
        }
    }

    /**
     * 确保对话存在 - 兼容 MessageAdapter 接口
     * 内部使用 MessageRepository.createOrGetConversation
     */
    async ensureConversationExists(shopId, userId, lastMessage) {
        try {
            console.log('🔄 [统一适配器] ensureConversationExists 调用 -> MessageRepository.createOrGetConversation');
            
            const userData = {
                name: `用户_${userId}`,
                lastMessage: lastMessage
            };
            
            return await this.messageRepo.createOrGetConversation(shopId, userId, userData);

        } catch (error) {
            console.error('❌ [统一适配器] ensureConversationExists 失败:', error);
            // 不抛出错误，避免影响消息保存（与原 MessageAdapter 行为一致）
        }
    }

    /**
     * 生成ID - 兼容 MessageAdapter 接口
     */
    generateId() {
        return this.messageRepo.generateId();
    }

    /**
     * 获取底层 MessageRepository 实例（用于高级功能）
     */
    getRepository() {
        return this.messageRepo;
    }

    /**
     * 检查是否为过渡版本
     */
    isTransition() {
        return this.isTransitionVersion;
    }
}

module.exports = UnifiedMessageAdapter;