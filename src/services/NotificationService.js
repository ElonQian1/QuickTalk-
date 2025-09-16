/**
 * NotificationService - 通知服务
 * 负责各种事件的通知处理
 */

class NotificationService {
    constructor(webSocketManager, emailService, pushService) {
        this.webSocketManager = webSocketManager;
        this.emailService = emailService;
        this.pushService = pushService;
        
        // 通知配置
        this.notificationConfig = {
            retryAttempts: 3,
            retryDelay: 1000,
            batchSize: 50
        };
    }

    /**
     * 通知新消息
     * @param {Object} messageData - 消息数据
     */
    async notifyNewMessage(messageData) {
        try {
            const notification = {
                type: 'new_message',
                data: messageData,
                timestamp: new Date()
            };

            // 1. WebSocket实时通知
            if (this.webSocketManager) {
                await this.sendWebSocketNotification(notification, {
                    shopId: messageData.shopId,
                    userId: messageData.userId
                });
            }

            // 2. 如果是用户发送的消息，通知管理员
            if (messageData.sender === 'user') {
                await this.notifyAdminNewMessage(messageData);
            }

            // 3. 如果是管理员回复，通知用户
            if (messageData.sender === 'admin') {
                await this.notifyUserNewReply(messageData);
            }

            return { success: true };

        } catch (error) {
            console.error('发送新消息通知失败:', error);
            throw new Error(`发送新消息通知失败: ${error.message}`);
        }
    }

    /**
     * 通知消息已读
     * @param {Object} readData - 已读数据
     */
    async notifyMessageRead(readData) {
        try {
            const notification = {
                type: 'message_read',
                data: readData,
                timestamp: new Date()
            };

            // WebSocket实时通知
            if (this.webSocketManager) {
                await this.sendWebSocketNotification(notification, {
                    conversationId: readData.conversationId
                });
            }

            return { success: true };

        } catch (error) {
            console.error('发送消息已读通知失败:', error);
            throw new Error(`发送消息已读通知失败: ${error.message}`);
        }
    }

    /**
     * 通知新对话
     * @param {Object} conversationData - 对话数据
     */
    async notifyNewConversation(conversationData) {
        try {
            const notification = {
                type: 'new_conversation',
                data: conversationData,
                timestamp: new Date()
            };

            // 1. WebSocket通知管理员
            if (this.webSocketManager) {
                await this.sendWebSocketNotification(notification, {
                    shopId: conversationData.shopId,
                    target: 'admin'
                });
            }

            // 2. 邮件通知（如果配置了）
            if (this.emailService) {
                await this.sendNewConversationEmail(conversationData);
            }

            return { success: true };

        } catch (error) {
            console.error('发送新对话通知失败:', error);
            throw new Error(`发送新对话通知失败: ${error.message}`);
        }
    }

    /**
     * 通知对话状态更新
     * @param {Object} statusData - 状态数据
     */
    async notifyConversationStatusUpdate(statusData) {
        try {
            const notification = {
                type: 'conversation_status_update',
                data: statusData,
                timestamp: new Date()
            };

            // WebSocket通知
            if (this.webSocketManager) {
                await this.sendWebSocketNotification(notification, {
                    conversationId: statusData.conversationId
                });
            }

            return { success: true };

        } catch (error) {
            console.error('发送对话状态更新通知失败:', error);
            throw new Error(`发送对话状态更新通知失败: ${error.message}`);
        }
    }

    /**
     * 通知对话分配
     * @param {Object} assignmentData - 分配数据
     */
    async notifyConversationAssigned(assignmentData) {
        try {
            const notification = {
                type: 'conversation_assigned',
                data: assignmentData,
                timestamp: new Date()
            };

            // 通知被分配的客服
            if (this.webSocketManager) {
                await this.sendWebSocketNotification(notification, {
                    userId: assignmentData.assigneeId,
                    target: 'admin'
                });
            }

            return { success: true };

        } catch (error) {
            console.error('发送对话分配通知失败:', error);
            throw new Error(`发送对话分配通知失败: ${error.message}`);
        }
    }

    /**
     * 通知店铺创建
     * @param {Object} shopData - 店铺数据
     */
    async notifyShopCreated(shopData) {
        try {
            const notification = {
                type: 'shop_created',
                data: shopData,
                timestamp: new Date()
            };

            // 1. 通知超级管理员
            if (this.webSocketManager) {
                await this.sendWebSocketNotification(notification, {
                    target: 'super_admin'
                });
            }

            // 2. 发送欢迎邮件给店主
            if (this.emailService) {
                await this.sendShopCreatedEmail(shopData);
            }

            return { success: true };

        } catch (error) {
            console.error('发送店铺创建通知失败:', error);
            throw new Error(`发送店铺创建通知失败: ${error.message}`);
        }
    }

    /**
     * 通知店铺更新
     * @param {Object} updateData - 更新数据
     */
    async notifyShopUpdated(updateData) {
        try {
            const notification = {
                type: 'shop_updated',
                data: updateData,
                timestamp: new Date()
            };

            // WebSocket通知
            if (this.webSocketManager) {
                await this.sendWebSocketNotification(notification, {
                    shopId: updateData.shopId
                });
            }

            return { success: true };

        } catch (error) {
            console.error('发送店铺更新通知失败:', error);
            throw new Error(`发送店铺更新通知失败: ${error.message}`);
        }
    }

    /**
     * 通知店铺状态变更
     * @param {Object} statusData - 状态数据
     */
    async notifyShopStatusChanged(statusData) {
        try {
            const notification = {
                type: 'shop_status_changed',
                data: statusData,
                timestamp: new Date()
            };

            // 1. WebSocket通知
            if (this.webSocketManager) {
                await this.sendWebSocketNotification(notification, {
                    shopId: statusData.shopId
                });
            }

            // 2. 邮件通知重要状态变更
            if (this.emailService && this.isImportantStatusChange(statusData)) {
                await this.sendShopStatusChangeEmail(statusData);
            }

            return { success: true };

        } catch (error) {
            console.error('发送店铺状态变更通知失败:', error);
            throw new Error(`发送店铺状态变更通知失败: ${error.message}`);
        }
    }

    /**
     * 通知店铺删除
     * @param {Object} deleteData - 删除数据
     */
    async notifyShopDeleted(deleteData) {
        try {
            const notification = {
                type: 'shop_deleted',
                data: deleteData,
                timestamp: new Date()
            };

            // WebSocket通知
            if (this.webSocketManager) {
                await this.sendWebSocketNotification(notification, {
                    shopId: deleteData.shopId,
                    target: 'super_admin'
                });
            }

            return { success: true };

        } catch (error) {
            console.error('发送店铺删除通知失败:', error);
            throw new Error(`发送店铺删除通知失败: ${error.message}`);
        }
    }

    /**
     * 通知API密钥变更
     * @param {Object} keyData - 密钥数据
     */
    async notifyApiKeyChanged(keyData) {
        try {
            const notification = {
                type: 'api_key_changed',
                data: keyData,
                timestamp: new Date()
            };

            // 1. WebSocket通知
            if (this.webSocketManager) {
                await this.sendWebSocketNotification(notification, {
                    shopId: keyData.shopId
                });
            }

            // 2. 邮件通知（安全相关）
            if (this.emailService) {
                await this.sendApiKeyChangeEmail(keyData);
            }

            return { success: true };

        } catch (error) {
            console.error('发送API密钥变更通知失败:', error);
            throw new Error(`发送API密钥变更通知失败: ${error.message}`);
        }
    }

    /**
     * 批量发送通知
     * @param {Array} notifications - 通知列表
     */
    async sendBatchNotifications(notifications) {
        try {
            const batches = this.createBatches(notifications, this.notificationConfig.batchSize);
            const results = [];

            for (const batch of batches) {
                const batchResults = await Promise.allSettled(
                    batch.map(notification => this.sendSingleNotification(notification))
                );
                results.push(...batchResults);
            }

            return {
                success: true,
                total: notifications.length,
                successful: results.filter(r => r.status === 'fulfilled').length,
                failed: results.filter(r => r.status === 'rejected').length
            };

        } catch (error) {
            console.error('批量发送通知失败:', error);
            throw new Error(`批量发送通知失败: ${error.message}`);
        }
    }

    /**
     * 发送WebSocket通知
     * @private
     */
    async sendWebSocketNotification(notification, target) {
        if (!this.webSocketManager) {
            console.warn('WebSocket管理器未配置，跳过WebSocket通知');
            return;
        }

        try {
            await this.webSocketManager.sendNotification(notification, target);
        } catch (error) {
            console.error('发送WebSocket通知失败:', error);
            // WebSocket发送失败不应该影响主流程
        }
    }

    /**
     * 通知管理员新消息
     * @private
     */
    async notifyAdminNewMessage(messageData) {
        const notification = {
            type: 'admin_new_message',
            data: {
                messageId: messageData.id,
                shopId: messageData.shopId,
                userId: messageData.userId,
                content: messageData.content.substring(0, 100), // 只显示前100个字符
                timestamp: messageData.timestamp
            },
            timestamp: new Date()
        };

        if (this.webSocketManager) {
            await this.sendWebSocketNotification(notification, {
                shopId: messageData.shopId,
                target: 'admin'
            });
        }
    }

    /**
     * 通知用户新回复
     * @private
     */
    async notifyUserNewReply(messageData) {
        const notification = {
            type: 'user_new_reply',
            data: {
                messageId: messageData.id,
                content: messageData.content,
                timestamp: messageData.timestamp
            },
            timestamp: new Date()
        };

        if (this.webSocketManager) {
            await this.sendWebSocketNotification(notification, {
                shopId: messageData.shopId,
                userId: messageData.userId,
                target: 'user'
            });
        }
    }

    /**
     * 发送新对话邮件通知
     * @private
     */
    async sendNewConversationEmail(conversationData) {
        if (!this.emailService) return;

        try {
            await this.emailService.sendEmail({
                to: 'admin@example.com', // 这里应该从店铺配置中获取
                subject: '新的客服对话',
                template: 'new_conversation',
                data: conversationData
            });
        } catch (error) {
            console.error('发送新对话邮件失败:', error);
        }
    }

    /**
     * 发送店铺创建邮件
     * @private
     */
    async sendShopCreatedEmail(shopData) {
        if (!this.emailService) return;

        try {
            await this.emailService.sendEmail({
                to: 'owner@example.com', // 这里应该从用户数据中获取
                subject: '店铺创建成功',
                template: 'shop_created',
                data: shopData
            });
        } catch (error) {
            console.error('发送店铺创建邮件失败:', error);
        }
    }

    /**
     * 发送店铺状态变更邮件
     * @private
     */
    async sendShopStatusChangeEmail(statusData) {
        if (!this.emailService) return;

        try {
            await this.emailService.sendEmail({
                to: 'owner@example.com', // 这里应该从店铺数据中获取
                subject: '店铺状态变更通知',
                template: 'shop_status_change',
                data: statusData
            });
        } catch (error) {
            console.error('发送店铺状态变更邮件失败:', error);
        }
    }

    /**
     * 发送API密钥变更邮件
     * @private
     */
    async sendApiKeyChangeEmail(keyData) {
        if (!this.emailService) return;

        try {
            await this.emailService.sendEmail({
                to: 'owner@example.com', // 这里应该从店铺数据中获取
                subject: 'API密钥变更通知',
                template: 'api_key_change',
                data: keyData
            });
        } catch (error) {
            console.error('发送API密钥变更邮件失败:', error);
        }
    }

    /**
     * 判断是否为重要状态变更
     * @private
     */
    isImportantStatusChange(statusData) {
        const importantChanges = [
            'approved', 'rejected', 'suspended', 'expired'
        ];
        return importantChanges.includes(statusData.toStatus);
    }

    /**
     * 发送单个通知
     * @private
     */
    async sendSingleNotification(notification) {
        switch (notification.type) {
            case 'new_message':
                return this.notifyNewMessage(notification.data);
            case 'message_read':
                return this.notifyMessageRead(notification.data);
            case 'new_conversation':
                return this.notifyNewConversation(notification.data);
            default:
                throw new Error(`未知通知类型: ${notification.type}`);
        }
    }

    /**
     * 创建批次
     * @private
     */
    createBatches(items, batchSize) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }
}

module.exports = NotificationService;