/**
 * ConversationsManager - 对话管理器 (深度优化版)
 * 继承自BaseManager，专门处理对话相关的业务逻辑
 * 
 * 优化内容 (2025-10-06):
 * - ✅ 移除重复的API调用代码
 * - ✅ 使用BaseManager提供的统一接口
 * - ✅ 统一错误处理和状态管理
 * - 🔧 第一轮：合并过滤方法，提供统一filterConversations接口
 * - 🔧 第一轮：简化排序逻辑，减少冗余代码
 * - 🔧 第一轮：优化统计计算，单次遍历获取所有数据
 * - 🔧 第一轮：保留向后兼容性，旧方法委托给新统一接口
 * - 🚀 第二轮：消除状态同步冗余，使用getter/setter自动管理selectedConversation
 * - 🚀 第二轮：简化状态重置逻辑，减少手动状态同步代码
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
            this._currentConversationId = null; // 私有属性，通过getter/setter管理
            this.currentShopId = null;

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
         * 🔧 优化：通过getter自动计算selectedConversation，消除状态同步冗余
         */
        get currentConversationId() {
            return this._currentConversationId;
        }

        set currentConversationId(id) {
            this._currentConversationId = id;
        }

        get selectedConversation() {
            if (!this._currentConversationId) return null;
            return this.conversations.find(c => c.id === this._currentConversationId) || null;
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
         * 🔧 优化：选择对话，自动状态同步
         */
        selectConversation(conversationId) {
            const conversation = this.conversations.find(c => c.id === conversationId);
            if (!conversation) {
                this.log('warn', '对话不存在:', conversationId);
                return false;
            }

            const previousConversationId = this.currentConversationId;
            this.currentConversationId = conversationId; // selectedConversation 自动通过getter更新

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
         * 🔧 优化：获取当前选中的对话，直接使用getter
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
         * 🔧 优化：更新对话信息，自动状态同步
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

            // selectedConversation 自动通过getter同步，无需手动更新

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
         * 🔧 优化：统一的过滤接口，替代原来的多个过滤方法
         * @param {Object} filters - 过滤条件
         * @param {string} filters.keyword - 搜索关键词
         * @param {string} filters.status - 状态过滤 ('active', 'closed', 'all')
         * @param {boolean} filters.unreadOnly - 仅显示未读对话
         * @returns {Array} 过滤后的对话列表
         */
        filterConversations(filters = {}) {
            let filtered = [...this.conversations];

            // 关键词搜索
            if (filters.keyword) {
                const searchTerm = filters.keyword.toLowerCase();
                filtered = filtered.filter(conv => 
                    conv.customer_name?.toLowerCase().includes(searchTerm) ||
                    conv.last_message?.toLowerCase().includes(searchTerm) ||
                    conv.customer_number?.includes(searchTerm)
                );
            }

            // 状态过滤
            if (filters.status && filters.status !== 'all') {
                filtered = filtered.filter(conv => conv.status === filters.status);
            }

            // 未读过滤
            if (filters.unreadOnly) {
                filtered = filtered.filter(conv => (conv.unread_count || 0) > 0);
            }

            return filtered;
        }

        /**
         * 🔧 优化：简化的排序方法
         * @param {string} sortBy - 排序字段
         * @param {string} order - 排序方向 ('asc' | 'desc')
         * @returns {Array} 排序后的对话列表
         */
        sortConversations(sortBy = 'last_message_time', order = 'desc') {
            const isTimeField = sortBy.includes('time') || sortBy.includes('at');
            const multiplier = order === 'desc' ? -1 : 1;

            return [...this.conversations].sort((a, b) => {
                let aValue = a[sortBy];
                let bValue = b[sortBy];

                // 时间字段转换为时间戳比较
                if (isTimeField) {
                    aValue = new Date(aValue || 0).getTime();
                    bValue = new Date(bValue || 0).getTime();
                }

                return (aValue > bValue ? 1 : aValue < bValue ? -1 : 0) * multiplier;
            });
        }

        /**
         * 🔧 优化：单次遍历获取所有统计数据
         * @returns {Object} 对话统计信息
         */
        getConversationsStats() {
            const stats = {
                total: this.conversations.length,
                unread: 0,
                active: 0,
                closed: 0,
                totalUnreadCount: 0
            };

            // 单次遍历获取所有统计
            this.conversations.forEach(conv => {
                const unreadCount = conv.unread_count || 0;
                
                if (unreadCount > 0) {
                    stats.unread++;
                    stats.totalUnreadCount += unreadCount;
                }

                if (conv.status === 'active') {
                    stats.active++;
                } else if (conv.status === 'closed') {
                    stats.closed++;
                }
            });

            return stats;
        }

        /**
         * 🔧 保留兼容性：传统搜索方法 (委托给统一过滤接口)
         */
        searchConversations(keyword) {
            return this.filterConversations({ keyword });
        }

        /**
         * 🔧 保留兼容性：按状态过滤 (委托给统一过滤接口)
         */
        filterByStatus(status) {
            return this.filterConversations({ status });
        }

        /**
         * 🔧 保留兼容性：未读过滤 (委托给统一过滤接口)
         */
        filterUnread() {
            return this.filterConversations({ unreadOnly: true });
        }

        /**
         * 刷新对话列表
         */
        async refreshConversations() {
            this.clearCache(); // 清除缓存
            return this.loadConversations(this.currentShopId);
        }

        /**
         * 🔧 优化：切换店铺，简化状态重置
         */
        async switchShop(shopId) {
            if (shopId === this.currentShopId) {
                this.log('debug', '店铺未发生变化:', shopId);
                return this.conversations;
            }

            this.log('info', '切换店铺:', shopId);
            
            // 重置当前对话选择
            this.currentConversationId = null; // selectedConversation 自动同步
            
            // 加载新店铺的对话
            return this.loadConversations(shopId);
        }

        /**
         * 🔧 优化：重置状态，简化属性重置
         */
        reset() {
            this.conversations = [];
            this.currentConversationId = null; // selectedConversation 自动同步
            this.currentShopId = null;
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

    console.log('✅ 优化的对话管理器已加载 (深度优化：消除状态同步冗余)');

})();