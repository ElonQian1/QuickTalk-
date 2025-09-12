/**
 * 消息数据库适配器
 * 将新的MessageDatabase接口适配到现有的SQLite表结构
 */

class MessageAdapter {
    constructor(database) {
        this.db = database;
    }

    /**
     * 添加消息 - 适配现有messages表结构
     */
    async addMessage(data) {
        try {
            const messageId = this.generateId();
            const {
                conversationId,
                senderType,
                senderId,
                content
            } = data;

            // 从conversationId中提取shop_id (格式: shop_xxx_yyy_userId)
            const shopId = conversationId.split('_')[0] + '_' + conversationId.split('_')[1] + '_' + conversationId.split('_')[2];
            const userId = senderId;
            const sender = senderType === 'customer' ? 'user' : senderType;

            console.log(`🔍 调试信息: conversationId=${conversationId}, shopId=${shopId}, userId=${userId}, content=${content}`);

            // 插入到现有messages表
            const sql = `
                INSERT INTO messages (
                    id, shop_id, user_id, message, sender, is_read
                ) VALUES (?, ?, ?, ?, ?, ?)
            `;

            console.log(`🔍 执行SQL: ${sql}`);
            console.log(`🔍 参数: [${messageId}, ${shopId}, ${userId}, ${content}, ${sender}, false]`);

            await this.db.runAsync(sql, [
                messageId,
                shopId,
                userId,
                content,
                sender,
                false // is_read
            ]);

            console.log(`✅ 消息已保存: ${messageId}`);
            return messageId;

        } catch (error) {
            console.error('❌ 添加消息失败:', error);
            throw error;
        }
    }

    /**
     * 获取对话消息 - 适配现有messages表结构
     */
    async getConversationMessages(conversationId, options = {}) {
        try {
            const {
                limit = 50,
                offset = 0,
                orderBy = 'created_at',
                orderDirection = 'ASC'
            } = options;

            // 从conversationId中提取shop_id和user_id
            const shopId = conversationId.split('_')[0] + '_' + conversationId.split('_')[1] + '_' + conversationId.split('_')[2];
            const userId = conversationId.split('_').slice(3).join('_');

            const sql = `
                SELECT 
                    id,
                    shop_id,
                    user_id,
                    message as content,
                    sender as sender_type,
                    is_read,
                    created_at
                FROM messages
                WHERE shop_id = ? AND user_id = ?
                ORDER BY ${orderBy} ${orderDirection}
                LIMIT ? OFFSET ?
            `;

            const messages = await this.db.getAllAsync(sql, [shopId, userId, limit, offset]);
            
            console.log(`✅ 获取到 ${messages ? messages.length : 0} 条消息`);
            return messages || [];

        } catch (error) {
            console.error('❌ 获取对话消息失败:', error);
            return [];
        }
    }

    /**
     * 生成唯一ID
     */
    generateId() {
        return Math.random().toString(36).substr(2, 15) + Date.now().toString(36);
    }
}

module.exports = MessageAdapter;
