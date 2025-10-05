/**
 * WsEventRouter - WebSocket事件路由器
 * 继承自WebSocketBase，专注于事件路由和处理函数映射
 * 
 * 优化内容：
 * - 移除重复的事件总线访问代码
 * - 使用WebSocketBase的统一事件系统
 * - 保持原有的事件映射和处理逻辑
 */
(function(){
    'use strict';

    if (window.WsEventRouter) return; // 幂等

    class WsEventRouter extends WebSocketBase {
        constructor(context, options = {}) {
            super('WsEventRouter', {
                debug: false,
                ...options
            });

            this.context = context;
            this.recentMessages = [];
            this.RECENT_LIMIT = 50;

            // 事件映射配置
            this.setupEventMaps();
            
            this.log('info', 'WebSocket事件路由器初始化完成');
        }

        /**
         * 设置事件映射
         */
        setupEventMaps() {
            // 旧版事件与通用事件（平铺）
            this.EVENT_MAP = {
                'message': (ctx, data) => ctx.handleNewMessage && ctx.handleNewMessage(data),
                'typing': (ctx, data) => ctx.handleTypingIndicator && ctx.handleTypingIndicator(data),
                'conversation_update': (ctx) => {
                    if (ctx.currentShopId && ctx.loadConversationsForShop) {
                        ctx.loadConversationsForShop(ctx.currentShopId);
                    }
                },
                'system.welcome': () => {}, // NOOP
                'Pong': () => {}, // NOOP
            };

            // 领域事件映射 (domain.event.*)
            this.DOMAIN_EVENT_MAP = {
                'message_appended': (ctx, payload) => {
                    this._handleMessageAppended(ctx, payload);
                },
                'conversation_created': (ctx, payload) => {
                    this._handleConversationCreated(ctx, payload);
                },
                'conversation_updated': (ctx, payload) => {
                    this._handleConversationUpdated(ctx, payload);
                }
            };
        }

        /**
         * 处理消息追加事件
         */
        _handleMessageAppended(ctx, payload) {
            // 先交给通道做回流覆盖（若存在）
            try {
                if (window.MessageSendChannelInstance && 
                    typeof window.MessageSendChannelInstance.markServerMessage === 'function') {
                    window.MessageSendChannelInstance.markServerMessage(payload);
                }
            } catch(e) { 
                this.log('warn', 'sendChannel 回流覆盖失败', e); 
            }

            // 再委托到上下文管理器
            if (ctx.handleDomainMessageAppended) {
                ctx.handleDomainMessageAppended(payload);
            }

            // 广播DOM事件
            this._dispatchDomainEvent('message_appended', { 
                message: (payload && (payload.message || payload)) 
            });
        }

        /**
         * 处理对话创建事件
         */
        _handleConversationCreated(ctx, payload) {
            if (ctx.handleDomainConversationCreated) {
                ctx.handleDomainConversationCreated(payload);
            }
            this._dispatchDomainEvent('conversation_created', payload);
        }

        /**
         * 处理对话更新事件
         */
        _handleConversationUpdated(ctx, payload) {
            if (ctx.handleDomainConversationUpdated) {
                ctx.handleDomainConversationUpdated(payload);
            }
            this._dispatchDomainEvent('conversation_updated', payload);
        }

        /**
         * 派发领域事件到DOM
         */
        _dispatchDomainEvent(eventName, payload) {
            try {
                if (this.options.debug) {
                    this.log('debug', `🔔 dispatch ws:domain.event.${eventName}`, payload);
                }
                document.dispatchEvent(new CustomEvent(`ws:domain.event.${eventName}`, { 
                    detail: payload 
                }));
            } catch(e) {
                this.log('error', '派发领域事件失败:', eventName, e);
            }
        }

        /**
         * 去重检查
         */
        _pushRecent(key) {
            this.recentMessages.push(key);
            if (this.recentMessages.length > this.RECENT_LIMIT) {
                this.recentMessages.shift();
            }
        }

        _seen(key) { 
            return this.recentMessages.includes(key); 
        }

        /**
         * 路由WebSocket消息
         */
        routeMessage(eventType, data) {
            try {
                // 生成消息标识
                const msgKey = this._generateMessageKey(eventType, data);
                
                // 去重检查
                if (this._seen(msgKey)) {
                    this.log('debug', '忽略重复消息:', eventType, msgKey);
                    return;
                }
                this._pushRecent(msgKey);

                // 分发到对应处理器
                this._dispatchToHandler(eventType, data);

            } catch (error) {
                this.log('error', '路由消息失败:', eventType, error);
            }
        }

        /**
         * 生成消息标识
         */
        _generateMessageKey(eventType, data) {
            if (data && data.id) return `${eventType}:${data.id}`;
            if (data && data.message_id) return `${eventType}:${data.message_id}`;
            if (data && data.timestamp) return `${eventType}:${data.timestamp}`;
            return `${eventType}:${JSON.stringify(data).substring(0, 50)}`;
        }

        /**
         * 分发到处理器
         */
        _dispatchToHandler(eventType, data) {
            // 优先检查领域事件
            if (eventType.startsWith('domain.event.')) {
                const domainEventType = eventType.replace('domain.event.', '');
                const handler = this.DOMAIN_EVENT_MAP[domainEventType];
                if (handler) {
                    this.log('debug', '处理领域事件:', domainEventType);
                    handler(this.context, data);
                    return;
                }
            }

            // 处理普通事件
            const handler = this.EVENT_MAP[eventType];
            if (handler) {
                this.log('debug', '处理事件:', eventType);
                handler(this.context, data);
            } else {
                this.log('debug', '未知事件类型:', eventType);
            }
        }

        /**
         * 批量路由消息
         */
        routeMessages(messages) {
            if (!Array.isArray(messages)) {
                this.log('warn', '批量路由参数必须为数组');
                return;
            }

            messages.forEach(msg => {
                if (msg && msg.type) {
                    this.routeMessage(msg.type, msg.data || msg);
                }
            });
        }

        /**
         * 更新上下文
         */
        updateContext(newContext) {
            this.context = newContext;
            this.log('info', '事件路由器上下文已更新');
        }

        /**
         * 获取路由统计
         */
        getRoutingStats() {
            return {
                recentMessageCount: this.recentMessages.length,
                eventMapCount: Object.keys(this.EVENT_MAP).length,
                domainEventMapCount: Object.keys(this.DOMAIN_EVENT_MAP).length,
                context: !!this.context
            };
        }

        /**
         * 清空消息历史
         */
        clearRecentMessages() {
            this.recentMessages = [];
            this.log('info', '消息历史已清空');
        }
    }

    // 工厂函数
    function createWsEventRouter(context, options) {
        return new WsEventRouter(context, options);
    }

    // 暴露到全局
    window.WsEventRouter = WsEventRouter;
    window.createWsEventRouter = createWsEventRouter;

    console.info('✅ 优化的WebSocket事件路由器已加载 (继承WebSocketBase)');

})();