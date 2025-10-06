/**
 * StateCoordinator - 状态协调器
 * 管理多个Manager之间的状态同步和协调
 * 
 * 功能：
 * - 统一状态管理
 * - 跨Manager数据同步
 * - 状态变更通知
 * - 缓存协调
 * - 状态恢复
 */
(function() {
    'use strict';

    class StateCoordinator {
        constructor(options = {}) {
            this.name = 'StateCoordinator';
            
            // 初始化统一日志器
            this.logger = window.Loggers?.StateCoordinator || {
                debug: (...args) => console.log('[StateCoordinator]', ...args),
                info: (...args) => console.info('[StateCoordinator]', ...args),
                warn: (...args) => console.warn('[StateCoordinator]', ...args),
                error: (...args) => console.error('[StateCoordinator]', ...args)
            };
            
            this.options = {
                debug: false,
                autoSync: true,
                syncInterval: 30000, // 30秒自动同步
                ...options
            };

            // 注册的管理器
            this.managers = new Map();
            
            // 全局状态
            this.globalState = {
                currentShopId: null,
                currentConversationId: null,
                currentUser: null,
                unreadCounts: new Map(),
                lastUpdate: null,
                syncInProgress: false
            };

            // 状态监听器
            this.stateListeners = new Map();
            
            // 同步定时器
            this.syncTimer = null;

            // 事件总线
            this.eventBus = options.eventBus || window.MessageEventBus || null;

            this.log('info', '状态协调器初始化完成');
            this.bindGlobalEvents();
        }

        /**
         * 统一日志记录 (使用UnifiedLogger)
         */
        log(level, message, data = null) {
            if (this.logger && this.logger[level]) {
                this.logger[level](message, data);
            } else {
                // 回退实现
                if (!this.options.debug && level === 'debug') return;
                
                const timestamp = new Date().toLocaleTimeString();
                const prefix = `[${this.name}]`;
                const method = console[level] || console.log;
                method(`${prefix} ${timestamp}`, message, data);
            }
        }

        /**
         * 注册管理器 (使用ManagerFactory统一管理)
         */
        registerManager(name, manager) {
            if (!manager || typeof manager !== 'object') {
                this.log('error', '无效的管理器:', name);
                return false;
            }

            // 使用ManagerFactory统一管理，避免重复
            if (window.ManagerFactory) {
                this.managers.set(name, manager);
                this.log('info', '管理器已注册到状态协调器:', name);
            } else {
                // 回退到本地管理
                this.managers.set(name, manager);
                this.log('info', '管理器已注册 (本地模式):', name);
            }

            // 绑定管理器事件
            this.bindManagerEvents(name, manager);

            return true;
        }

        /**
         * 注销管理器
         */
        unregisterManager(name) {
            if (this.managers.has(name)) {
                this.managers.delete(name);
                this.stateListeners.delete(name);
                this.log('info', '管理器已注销:', name);
                return true;
            }
            return false;
        }

        /**
         * 绑定管理器事件
         */
        bindManagerEvents(name, manager) {
            // 监听店铺相关事件
            if (name === 'shops') {
                manager.on?.('shop:selected', (data) => {
                    this.updateGlobalState('currentShopId', data.shop.id);
                    this.notifyShopChange(data.shop);
                });

                manager.on?.('shops:loaded', (data) => {
                    this.syncShopsData(data.shops);
                });
            }

            // 监听对话相关事件
            if (name === 'conversations') {
                manager.on?.('conversation:selected', (data) => {
                    this.updateGlobalState('currentConversationId', data.conversation.id);
                    this.notifyConversationChange(data.conversation);
                });

                manager.on?.('conversations:loaded', (data) => {
                    this.syncConversationsData(data.conversations);
                });

                manager.on?.('conversation:updated', (data) => {
                    this.syncConversationUpdate(data.conversation);
                });
            }

            // 监听消息相关事件
            if (name === 'messages') {
                manager.on?.('message:sent', (data) => {
                    this.syncMessageSent(data.message);
                });

                manager.on?.('message:added', (data) => {
                    this.syncNewMessage(data.message);
                });
            }
        }

        /**
         * 绑定全局事件
         */
        bindGlobalEvents() {
            // 监听用户状态变化
            if (typeof window !== 'undefined') {
                window.addEventListener('user:login', (event) => {
                    this.updateGlobalState('currentUser', event.detail);
                    this.resetState();
                });

                window.addEventListener('user:logout', () => {
                    this.resetState();
                });

                // 监听页面可见性变化
                document.addEventListener('visibilitychange', () => {
                    if (!document.hidden && this.options.autoSync) {
                        this.syncAll();
                    }
                });
            }
        }

        /**
         * 更新全局状态
         */
        updateGlobalState(key, value) {
            const oldValue = this.globalState[key];
            this.globalState[key] = value;
            this.globalState.lastUpdate = Date.now();

            this.log('debug', `全局状态更新: ${key}`, { oldValue, newValue: value });

            // 通知状态变更
            this.notifyStateChange(key, value, oldValue);
        }

        /**
         * 获取全局状态
         */
        getGlobalState(key = null) {
            if (key) {
                return this.globalState[key];
            }
            return { ...this.globalState };
        }

        /**
         * 通知状态变更
         */
        notifyStateChange(key, newValue, oldValue) {
            const listeners = this.stateListeners.get(key) || [];
            listeners.forEach(listener => {
                try {
                    listener(newValue, oldValue);
                } catch (error) {
                    this.log('error', '状态监听器执行失败:', error.message);
                }
            });

            // 触发全局事件
            if (this.eventBus) {
                this.eventBus.emit(`state:${key}:changed`, {
                    key,
                    newValue,
                    oldValue,
                    timestamp: Date.now()
                });
            }
        }

        /**
         * 添加状态监听器
         */
        addStateListener(key, listener) {
            if (!this.stateListeners.has(key)) {
                this.stateListeners.set(key, []);
            }
            this.stateListeners.get(key).push(listener);
        }

        /**
         * 移除状态监听器
         */
        removeStateListener(key, listener) {
            const listeners = this.stateListeners.get(key);
            if (listeners) {
                const index = listeners.indexOf(listener);
                if (index > -1) {
                    listeners.splice(index, 1);
                }
            }
        }

        /**
         * 通知店铺变更
         */
        notifyShopChange(shop) {
            this.log('debug', '店铺切换通知:', shop.id);

            // 通知对话管理器加载新店铺的对话
            const conversationsManager = this.managers.get('conversations');
            if (conversationsManager && conversationsManager.loadConversations) {
                conversationsManager.loadConversations(shop.id);
            }

            // 清除当前对话选择
            this.updateGlobalState('currentConversationId', null);
        }

        /**
         * 通知对话变更
         */
        notifyConversationChange(conversation) {
            this.log('debug', '对话切换通知:', conversation.id);

            // 通知消息管理器加载对话消息
            const messagesManager = this.managers.get('messages');
            if (messagesManager && messagesManager.loadMessages) {
                messagesManager.loadMessages(conversation.id);
            }

            // 标记对话为已读
            const conversationsManager = this.managers.get('conversations');
            if (conversationsManager && conversationsManager.markAsRead) {
                conversationsManager.markAsRead(conversation.id);
            }
        }

        /**
         * 同步店铺数据
         */
        syncShopsData(shops) {
            this.log('debug', '同步店铺数据:', shops.length);
            // 可以在这里添加店铺数据的额外处理逻辑
        }

        /**
         * 同步对话数据
         */
        syncConversationsData(conversations) {
            this.log('debug', '同步对话数据:', conversations.length);
            
            // 更新未读计数
            const totalUnread = conversations.reduce((total, conv) => 
                total + (conv.unread_count || 0), 0);
            
            this.updateUnreadCount('total', totalUnread);
        }

        /**
         * 同步对话更新
         */
        syncConversationUpdate(conversation) {
            this.log('debug', '同步对话更新:', conversation.id);
            
            // 更新未读计数
            this.updateUnreadCount(conversation.id, conversation.unread_count || 0);
        }

        /**
         * 同步消息发送
         */
        syncMessageSent(message) {
            this.log('debug', '同步消息发送:', message.id);

            // 更新对话的最后消息
            const conversationsManager = this.managers.get('conversations');
            if (conversationsManager && conversationsManager.updateLastMessage) {
                conversationsManager.updateLastMessage(message.conversation_id, message);
            }
        }

        /**
         * 同步新消息
         */
        syncNewMessage(message) {
            this.log('debug', '同步新消息:', message.id);

            // 如果是其他对话的消息，更新未读计数
            if (message.conversation_id !== this.globalState.currentConversationId) {
                const conversationsManager = this.managers.get('conversations');
                if (conversationsManager) {
                    const conversation = conversationsManager.getConversation(message.conversation_id);
                    if (conversation) {
                        const newUnreadCount = (conversation.unread_count || 0) + 1;
                        conversationsManager.updateConversation(message.conversation_id, {
                            unread_count: newUnreadCount
                        });
                    }
                }
            }
        }

        /**
         * 更新未读计数
         */
        updateUnreadCount(key, count) {
            this.globalState.unreadCounts.set(key, count);
            
            // 触发未读计数更新事件
            if (this.eventBus) {
                this.eventBus.emit('unread:updated', {
                    key,
                    count,
                    total: this.getTotalUnreadCount()
                });
            }
        }

        /**
         * 获取总未读数
         */
        getTotalUnreadCount() {
            let total = 0;
            this.globalState.unreadCounts.forEach(count => {
                total += count;
            });
            return total;
        }

        /**
         * 同步所有数据
         */
        async syncAll() {
            if (this.globalState.syncInProgress) {
                this.log('debug', '同步正在进行中，跳过');
                return;
            }

            this.globalState.syncInProgress = true;
            this.log('info', '开始全量同步');

            try {
                // 同步店铺数据
                const shopsManager = this.managers.get('shops');
                if (shopsManager && shopsManager.loadShops) {
                    await shopsManager.loadShops();
                }

                // 同步当前店铺的对话
                if (this.globalState.currentShopId) {
                    const conversationsManager = this.managers.get('conversations');
                    if (conversationsManager && conversationsManager.loadConversations) {
                        await conversationsManager.loadConversations(this.globalState.currentShopId);
                    }
                }

                this.log('info', '全量同步完成');
            } catch (error) {
                this.log('error', '全量同步失败:', error.message);
            } finally {
                this.globalState.syncInProgress = false;
            }
        }

        /**
         * 重置状态
         */
        resetState() {
            this.globalState = {
                currentShopId: null,
                currentConversationId: null,
                currentUser: null,
                unreadCounts: new Map(),
                lastUpdate: null,
                syncInProgress: false
            };

            this.log('info', '状态已重置');
        }

        /**
         * 开始自动同步
         */
        startAutoSync() {
            if (!this.options.autoSync) return;

            this.stopAutoSync(); // 清除可能存在的定时器

            this.syncTimer = setInterval(() => {
                this.syncAll();
            }, this.options.syncInterval);

            this.log('info', '自动同步已启动');
        }

        /**
         * 停止自动同步
         */
        stopAutoSync() {
            if (this.syncTimer) {
                clearInterval(this.syncTimer);
                this.syncTimer = null;
                this.log('info', '自动同步已停止');
            }
        }

        /**
         * 获取状态统计
         */
        getStats() {
            return {
                managersCount: this.managers.size,
                listenersCount: Array.from(this.stateListeners.values())
                    .reduce((total, listeners) => total + listeners.length, 0),
                totalUnreadCount: this.getTotalUnreadCount(),
                lastUpdate: this.globalState.lastUpdate,
                syncInProgress: this.globalState.syncInProgress,
                autoSyncEnabled: !!this.syncTimer
            };
        }

        /**
         * 销毁协调器
         */
        destroy() {
            this.stopAutoSync();
            this.managers.clear();
            this.stateListeners.clear();
            this.resetState();
            this.log('info', '状态协调器已销毁');
        }
    }

    // 创建全局实例
    window.StateCoordinator = StateCoordinator;
    window.stateCoordinator = new StateCoordinator({
        debug: false,
        autoSync: true
    });

// 状态协调器注册
if (typeof window.ModuleLoader?.registerModule === 'function') {
    window.ModuleLoader.registerModule('state-coordinator', 'core', '状态协调器已加载 (统一状态管理)');
} else {
    console.log('✅ 状态协调器已加载 (统一状态管理)');
}

})();