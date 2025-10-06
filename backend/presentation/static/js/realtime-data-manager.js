/**
 * 实时数据管理器
 * 统一管理实时数据更新、WebSocket消息处理、状态同步
 */
(function() {
    'use strict';

    class RealtimeDataManager {
        constructor() {
            this.data = new Map(); // 存储实时数据
            this.subscribers = new Map(); // 数据变化订阅者
            this.wsConnected = false;
            this.reconnectAttempts = 0;
            this.maxReconnectAttempts = 5;
            this.logger = window.Logger?.createModuleLogger?.('RealtimeDataManager') || console;
            
            this.init();
        }

        init() {
            // 监听全局WebSocket事件
            if (window.addEventListener) {
                window.addEventListener('websocket-connected', () => {
                    this.wsConnected = true;
                    this.reconnectAttempts = 0;
                    this.logger.info('WebSocket连接建立');
                });

                window.addEventListener('websocket-disconnected', () => {
                    this.wsConnected = false;
                    this.logger.warn('WebSocket连接断开');
                });

                window.addEventListener('websocket-message', (event) => {
                    this.handleWebSocketMessage(event.detail);
                });
            }

            // 定期检查连接状态
            setInterval(() => this.checkConnectionHealth(), 30000);
        }

        /**
         * 设置数据
         */
        setData(key, value, notify = true) {
            const oldValue = this.data.get(key);
            this.data.set(key, value);
            
            if (notify && oldValue !== value) {
                this.notifySubscribers(key, value, oldValue);
            }
        }

        /**
         * 获取数据
         */
        getData(key, defaultValue = null) {
            return this.data.get(key) || defaultValue;
        }

        /**
         * 订阅数据变化
         */
        subscribe(key, callback) {
            if (!this.subscribers.has(key)) {
                this.subscribers.set(key, new Set());
            }
            this.subscribers.get(key).add(callback);

            // 返回取消订阅函数
            return () => {
                const keySubscribers = this.subscribers.get(key);
                if (keySubscribers) {
                    keySubscribers.delete(callback);
                    if (keySubscribers.size === 0) {
                        this.subscribers.delete(key);
                    }
                }
            };
        }

        /**
         * 通知订阅者
         */
        notifySubscribers(key, newValue, oldValue) {
            const keySubscribers = this.subscribers.get(key);
            if (keySubscribers) {
                for (const callback of keySubscribers) {
                    try {
                        callback(newValue, oldValue, key);
                    } catch (error) {
                        this.logger.error('订阅者回调错误:', error);
                    }
                }
            }
        }

        /**
         * 处理WebSocket消息
         */
        handleWebSocketMessage(message) {
            try {
                const data = typeof message === 'string' ? JSON.parse(message) : message;
                
                switch (data.type) {
                    case 'new_message':
                        this.handleNewMessage(data);
                        break;
                    case 'conversation_update':
                        this.handleConversationUpdate(data);
                        break;
                    case 'shop_update':
                        this.handleShopUpdate(data);
                        break;
                    case 'unread_count':
                        this.handleUnreadCountUpdate(data);
                        break;
                    default:
                        this.logger.debug('未处理的WebSocket消息类型:', data.type);
                }
            } catch (error) {
                this.logger.error('WebSocket消息处理错误:', error);
            }
        }

        /**
         * 处理新消息
         */
        handleNewMessage(data) {
            const { message, conversation_id } = data;
            
            // 更新消息列表
            const messages = this.getData(`messages_${conversation_id}`, []);
            messages.push(message);
            this.setData(`messages_${conversation_id}`, messages);
            
            // 更新未读计数
            if (window.ReadStateManager && message.sender_type === 'customer') {
                const currentCount = window.ReadStateManager.getUnreadCount(conversation_id);
                window.ReadStateManager.setUnreadCount(conversation_id, currentCount + 1);
            }
            
            // 触发全局事件
            this.dispatchEvent('new-message', { message, conversation_id });
        }

        /**
         * 处理对话更新
         */
        handleConversationUpdate(data) {
            const { conversation } = data;
            
            // 更新对话信息
            this.setData(`conversation_${conversation.id}`, conversation);
            
            // 更新对话列表
            const conversations = this.getData('conversations', []);
            const index = conversations.findIndex(c => c.id === conversation.id);
            if (index >= 0) {
                conversations[index] = conversation;
            } else {
                conversations.unshift(conversation);
            }
            this.setData('conversations', conversations);
            
            this.dispatchEvent('conversation-updated', { conversation });
        }

        /**
         * 处理店铺更新
         */
        handleShopUpdate(data) {
            const { shop } = data;
            this.setData(`shop_${shop.id}`, shop);
            this.dispatchEvent('shop-updated', { shop });
        }

        /**
         * 处理未读计数更新
         */
        handleUnreadCountUpdate(data) {
            const { conversation_id, unread_count } = data;
            
            if (window.ReadStateManager) {
                window.ReadStateManager.setUnreadCount(conversation_id, unread_count);
            }
            
            this.dispatchEvent('unread-count-updated', { conversation_id, unread_count });
        }

        /**
         * 派发自定义事件
         */
        dispatchEvent(eventName, detail) {
            if (window.dispatchEvent) {
                const event = new CustomEvent(eventName, { detail });
                window.dispatchEvent(event);
            }
        }

        /**
         * 检查连接健康状态
         */
        checkConnectionHealth() {
            if (!this.wsConnected && this.reconnectAttempts < this.maxReconnectAttempts) {
                this.logger.info('尝试重连WebSocket...');
                this.reconnectAttempts++;
                
                // 触发重连
                this.dispatchEvent('websocket-reconnect-attempt', {
                    attempt: this.reconnectAttempts,
                    maxAttempts: this.maxReconnectAttempts
                });
            }
        }

        /**
         * 获取连接状态
         */
        getConnectionStatus() {
            return {
                connected: this.wsConnected,
                reconnectAttempts: this.reconnectAttempts,
                maxReconnectAttempts: this.maxReconnectAttempts
            };
        }

        /**
         * 清除所有数据
         */
        clearAllData() {
            this.data.clear();
            this.subscribers.clear();
            this.logger.info('实时数据已清除');
        }

        /**
         * 获取调试信息
         */
        getDebugInfo() {
            return {
                dataKeys: Array.from(this.data.keys()),
                subscriberKeys: Array.from(this.subscribers.keys()),
                connectionStatus: this.getConnectionStatus()
            };
        }
    }

    // 创建全局单例
    window.RealtimeDataManager = new RealtimeDataManager();

    // 模块注册
    if (typeof window.ModuleLoader?.registerModule === 'function') {
        window.ModuleLoader.registerModule('realtime-data-manager', 'manager', 'RealtimeDataManager 已加载');
    } else {
        console.log('✅ RealtimeDataManager 已加载');
    }
})();