/**
 * ConversationsManager - 对话管理器
 * 继承自BaseManager，专门处理对话相关的业务逻辑
 * 
 * 优化内容：
 * - 移除重复的API调用代码
 * - 使用BaseManager提供的统一接口
 * - 统一错误处理和状态管理
 */
(function() {
    'use strict';

    // 本地文本助手：统一访问文案，兼容全局 getText 渐进迁移
    function T(key, fallback) {
        if (typeof window !== 'undefined' && typeof window.getText === 'function') {
            return window.getText(key, fallback || key);
        }
        return (window.StateTexts && window.StateTexts[key]) || fallback || key;
    }

    class ConversationsManager extends BaseManager {
        constructor(options = {}) {
            super('ConversationsManager', {
                debug: false,
                cacheTimeout: 180000, // 3分钟缓存
                ...options
            });

            // 对话数据状态
            this.conversations = [];
            this.currentConversationId = null;
            this.currentShopId = null;
            this.selectedConversation = null;

            // 回调函数
            this.callbacks = {
                onConversationSelected: options.onConversationSelected || (() => {}),
                onConversationsLoaded: options.onConversationsLoaded || (() => {}),
                onConversationUpdated: options.onConversationUpdated || (() => {})
            };

            this.log('info', '对话管理器初始化完成');

            // 注册到状态协调器
            this.registerToStateCoordinator();
        }

        /**
         * 注册到状态协调器
         */
        registerToStateCoordinator() {
            if (typeof window.stateCoordinator !== 'undefined') {
                window.stateCoordinator.registerManager('conversations', this);
                this.log('debug', '已注册到状态协调器');
            }
        }

        /**
         * 加载对话列表
         */
        async loadConversations(shopId = null) {
            const targetShopId = shopId || this.currentShopId;
            
            if (!targetShopId) {
                this.log('warn', '未指定店铺ID，无法加载对话');
                return [];
            }

            if (this.state.loading) {
                this.log('debug', '对话加载中，跳过重复请求');
                return this.conversations;
            }

            this.log('info', `开始加载店铺${targetShopId}的对话列表`);

            try {
                const data = await this.apiCall(`/api/conversations?shop_id=${targetShopId}`, {
                    method: 'GET'
                });

                if (data.success && Array.isArray(data.data)) {
                    this.conversations = data.data;
                    this.currentShopId = targetShopId;
                    
                    this.log('info', `对话加载成功，数量: ${this.conversations.length}`);
                    
                    // 触发回调
                    this.callbacks.onConversationsLoaded(this.conversations);
                    this.emit('conversations:loaded', { 
                        conversations: this.conversations, 
                        shopId: targetShopId 
                    });
                } else {
                    throw new Error(data.message || '对话数据格式错误');
                }

                return this.conversations;

            } catch (error) {
                this.log('error', '加载对话失败:', error.message);
                this.conversations = [];
                this.emit('conversations:error', { error: error.message, shopId: targetShopId });
                throw error;
            }
        }

        /**
         * 选择对话
         */
        selectConversation(conversationId) {
            const conversation = this.conversations.find(c => c.id === conversationId);
            if (!conversation) {
                this.log('warn', '对话不存在:', conversationId);
                return false;
            }

            const previousConversationId = this.currentConversationId;
            this.currentConversationId = conversationId;
            this.selectedConversation = conversation;

            this.log('info', '对话已选择:', conversationId);

            // 触发回调
            this.callbacks.onConversationSelected(conversation);
            this.emit('conversation:selected', { 
                conversation, 
                previousConversationId,
                currentConversationId: conversationId 
            });

            return true;
        }

        /**
         * 获取当前选中的对话
         */
        getCurrentConversation() {
            return this.selectedConversation;
        }

        /**
         * 获取对话信息
         */
        getConversation(conversationId) {
            return this.conversations.find(c => c.id === conversationId);
        }

        /**
         * 更新对话信息（如最后消息、未读数等）
         */
        updateConversation(conversationId, updateData) {
            const conversationIndex = this.conversations.findIndex(c => c.id === conversationId);
            
            if (conversationIndex === -1) {
                this.log('warn', '要更新的对话不存在:', conversationId);
                return false;
            }

            // 更新对话数据
            this.conversations[conversationIndex] = {
                ...this.conversations[conversationIndex],
                ...updateData,
                updated_at: new Date().toISOString()
            };

            // 如果是当前选中的对话，更新选中数据
            if (this.currentConversationId === conversationId) {
                this.selectedConversation = this.conversations[conversationIndex];
            }

            this.log('debug', '对话信息已更新:', conversationId, updateData);

            // 触发回调
            this.callbacks.onConversationUpdated(this.conversations[conversationIndex]);
            this.emit('conversation:updated', { 
                conversation: this.conversations[conversationIndex],
                updateData 
            });

            return true;
        }

        /**
         * 更新对话最后消息
         */
        updateLastMessage(conversationId, message) {
            return this.updateConversation(conversationId, {
                last_message: message.content,
                last_message_time: message.created_at,
                last_message_type: message.type,
                last_sender_type: message.sender_type
            });
        }

        /**
         * 标记对话为已读
         */
        async markAsRead(conversationId) {
            try {
                const data = await this.apiCall(`/api/conversations/${conversationId}/read`, {
                    method: 'POST'
                });

                if (data.success) {
                    // 更新本地未读状态
                    this.updateConversation(conversationId, {
                        unread_count: 0,
                        last_read_at: new Date().toISOString()
                    });

                    this.log('debug', '对话已标记为已读:', conversationId);
                    this.emit('conversation:read', { conversationId });
                    
                    return true;
                } else {
                    const failMsg = data.message || T('MARK_READ_FAIL', '标记已读失败');
                    throw new Error(failMsg);
                }

            } catch (error) {
                const txt = T('MARK_READ_FAIL', '标记已读失败');
                this.log('error', txt + ':', error.message);
                return false;
            }
        }

        /**
         * 获取对话未读数
         */
        getUnreadCount(conversationId = null) {
            if (conversationId) {
                const conversation = this.getConversation(conversationId);
                return conversation ? (conversation.unread_count || 0) : 0;
            }

            // 返回所有对话的总未读数
            return this.conversations.reduce((total, conv) => {
                return total + (conv.unread_count || 0);
            }, 0);
        }

        /**
         * 搜索对话
         */
        searchConversations(keyword) {
            if (!keyword) {
                return this.conversations;
            }

            const searchTerm = keyword.toLowerCase();
            return this.conversations.filter(conv => 
                conv.customer_name?.toLowerCase().includes(searchTerm) ||
                conv.last_message?.toLowerCase().includes(searchTerm) ||
                conv.customer_number?.includes(searchTerm)
            );
        }

        /**
         * 按状态过滤对话
         */
        filterByStatus(status) {
            if (!status || status === 'all') {
                return this.conversations;
            }

            return this.conversations.filter(conv => conv.status === status);
        }

        /**
         * 按未读状态过滤对话
         */
        filterUnread() {
            return this.conversations.filter(conv => (conv.unread_count || 0) > 0);
        }

        /**
         * 对话排序
         */
        sortConversations(sortBy = 'last_message_time', order = 'desc') {
            const sorted = [...this.conversations].sort((a, b) => {
                let aValue = a[sortBy];
                let bValue = b[sortBy];

                // 处理时间字段
                if (sortBy.includes('time') || sortBy.includes('at')) {
                    aValue = new Date(aValue || 0).getTime();
                    bValue = new Date(bValue || 0).getTime();
                }

                if (order === 'desc') {
                    return bValue - aValue;
                } else {
                    return aValue - bValue;
                }
            });

            return sorted;
        }

        /**
         * 获取对话统计
         */
        getConversationsStats() {
            const stats = {
                total: this.conversations.length,
                unread: this.conversations.filter(c => (c.unread_count || 0) > 0).length,
                active: this.conversations.filter(c => c.status === 'active').length,
                closed: this.conversations.filter(c => c.status === 'closed').length,
                totalUnreadCount: this.getUnreadCount()
            };

            return stats;
        }

        /**
         * 刷新对话列表
         */
        async refreshConversations() {
            this.clearCache(); // 清除缓存
            return this.loadConversations(this.currentShopId);
        }

        /**
         * 切换店铺
         */
        async switchShop(shopId) {
            if (shopId === this.currentShopId) {
                this.log('debug', '店铺未发生变化:', shopId);
                return this.conversations;
            }

            this.log('info', '切换店铺:', shopId);
            
            // 重置当前对话选择
            this.currentConversationId = null;
            this.selectedConversation = null;
            
            // 加载新店铺的对话
            return this.loadConversations(shopId);
        }

        /**
         * 重置状态
         */
        reset() {
            this.conversations = [];
            this.currentConversationId = null;
            this.currentShopId = null;
            this.selectedConversation = null;
            this.clearCache();
            this.log('info', '对话管理器状态已重置');
        }

        /**
         * 获取管理器状态
         */
        getStatus() {
            return {
                ...super.getStatus(),
                conversationsCount: this.conversations.length,
                currentConversationId: this.currentConversationId,
                currentShopId: this.currentShopId,
                unreadCount: this.getUnreadCount()
            };
        }

        /**
         * 销毁管理器
         */
        destroy() {
            this.reset();
            super.destroy();
            this.log('info', '对话管理器已销毁');
        }
    }

    // 暴露到全局
    window.ConversationsManager = ConversationsManager;

    console.log('✅ 优化的对话管理器已加载 (继承BaseManager)');

})();