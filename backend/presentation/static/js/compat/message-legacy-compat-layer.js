/**
 * MessageLegacyCompatLayer - 消息模块Legacy兼容层
 * 
 * 目的：集中管理所有废弃的方法和接口，避免污染核心模块
 * 特点：
 * - 所有Legacy方法都有使用计数
 * - 提供迁移指导
 * - 可监控和逐步移除
 * - 不包含新功能开发
 */
(function() {
    'use strict';

    // Legacy使用统计
    const legacyUsageStats = {
        loadMessages: 0,
        sendMessage: 0,
        showShops: 0,
        loadConversationsForShop: 0,
        renderShopsList: 0,
        renderConversationsList: 0,
        updateConversationPreview: 0,
        generateCustomerNumber: 0,
        initWebSocket: 0,
        handleWebSocketMessage: 0
    };

    // 日志记录
    function logLegacy(method, ...args) {
        if (legacyUsageStats.hasOwnProperty(method)) {
            legacyUsageStats[method]++;
        }
        
        console.warn(`[Legacy] ${method} 被调用 (第${legacyUsageStats[method] || 0}次)`, ...args);
        
        // 提供迁移建议
        const migration = getLegacyMigrationAdvice(method);
        if (migration) {
            console.info(`[Legacy] 迁移建议: ${migration}`);
        }
    }

    // 获取迁移建议
    function getLegacyMigrationAdvice(method) {
        const migrations = {
            loadMessages: '请使用 MessageCoordinator.loadMessages() 或 MessagesManager.loadMessages()',
            sendMessage: '请使用 MessageCoordinator.sendMessage() 或 MessageSender.sendText()',
            showShops: '请使用 MessageCoordinator.loadShops() 或 ShopsManager.loadShops()',
            loadConversationsForShop: '请使用 MessageCoordinator.loadConversations() 或 ConversationsManager.loadConversations()',
            renderShopsList: '请使用 ShopsManager.renderShopsList() 或 ShopCardUI.render()',
            renderConversationsList: '请使用 ConversationsManager.renderConversationsList()',
            updateConversationPreview: '请使用 ConversationsManager.updateConversationPreview()',
            generateCustomerNumber: '请使用 CustomerNumbering.generateCustomerNumber()',
            initWebSocket: '请使用 MessageWSAdapter 或 WSManager',
            handleWebSocketMessage: '请使用 WsEventRouter.route() 或订阅事件总线'
        };
        return migrations[method];
    }

    class MessageLegacyCompatLayer {
        constructor(modernCoordinator) {
            this.coordinator = modernCoordinator;
            this.initialized = false;
        }

        /**
         * @deprecated 使用 MessageCoordinator.loadMessages()
         */
        async loadMessages(conversationId) {
            logLegacy('loadMessages', conversationId);
            
            if (this.coordinator && this.coordinator.loadMessages) {
                return await this.coordinator.loadMessages(conversationId);
            }

            // 最后的回退实现
            try {
                const response = await fetch(`/api/messages?conversation_id=${conversationId}`);
                const data = await response.json();
                return Array.isArray(data) ? data : (data.data || []);
            } catch (error) {
                console.error('[Legacy] loadMessages 回退实现失败:', error);
                return [];
            }
        }

        /**
         * @deprecated 使用 MessageCoordinator.sendMessage()
         */
        async sendMessage(content) {
            logLegacy('sendMessage', content);
            
            if (this.coordinator && this.coordinator.sendMessage) {
                return await this.coordinator.sendMessage(content);
            }

            // 最后的回退实现
            console.warn('[Legacy] sendMessage 回退实现：仅清空输入框');
            const input = document.getElementById('chatInput');
            if (input) {
                input.value = '';
                input.focus();
            }
        }

        /**
         * @deprecated 使用 MessageCoordinator.loadShops()
         */
        async showShops() {
            logLegacy('showShops');
            
            if (this.coordinator && this.coordinator.loadShops) {
                const shops = await this.coordinator.loadShops();
                // 触发视图更新
                if (window.MessageEventBus) {
                    window.MessageEventBus.emit('shops:loaded', { shops });
                }
                return shops;
            }

            // 最后的回退实现
            try {
                const response = await fetch('/api/shops');
                const data = await response.json();
                const shops = Array.isArray(data) ? data : (data.data || []);
                
                // 简单的列表渲染
                this.renderShopsList(shops);
                return shops;
            } catch (error) {
                console.error('[Legacy] showShops 回退实现失败:', error);
                return [];
            }
        }

        /**
         * @deprecated 使用 MessageCoordinator.loadConversations()
         */
        async loadConversationsForShop(shopId) {
            logLegacy('loadConversationsForShop', shopId);
            
            if (this.coordinator && this.coordinator.loadConversations) {
                return await this.coordinator.loadConversations(shopId);
            }

            // 最后的回退实现
            try {
                const response = await fetch(`/api/conversations?shop_id=${shopId}`);
                const data = await response.json();
                return Array.isArray(data) ? data : (data.data || []);
            } catch (error) {
                console.error('[Legacy] loadConversationsForShop 回退实现失败:', error);
                return [];
            }
        }

        /**
         * @deprecated 使用 ShopsManager.renderShopsList()
         */
        renderShopsList(shops = []) {
            logLegacy('renderShopsList', shops);
            
            const container = document.getElementById('shopsList') || 
                            document.querySelector('.shops-list') ||
                            document.querySelector('.shops-grid');
            
            if (!container) {
                console.warn('[Legacy] 未找到店铺列表容器');
                return;
            }

            // 简单的回退渲染
            container.innerHTML = shops.map(shop => `
                <div class="shop-card legacy-shop-card" data-shop-id="${shop.id}">
                    <div class="shop-name">${shop.name || '未命名店铺'}</div>
                    <div class="shop-domain">${shop.domain || '未设置域名'}</div>
                </div>
            `).join('');

            // 绑定点击事件
            container.addEventListener('click', (e) => {
                const shopCard = e.target.closest('.shop-card');
                if (shopCard) {
                    const shopId = shopCard.dataset.shopId;
                    const shop = shops.find(s => s.id == shopId);
                    if (shop && window.MessageEventBus) {
                        window.MessageEventBus.emit('shop:selected', { detail: { shop, stats: {} } });
                    }
                }
            });
        }

        /**
         * @deprecated 使用 ConversationsManager.renderConversationsList()
         */
        renderConversationsList(conversations = []) {
            logLegacy('renderConversationsList', conversations);
            
            const container = document.getElementById('conversationsList') ||
                            document.querySelector('.conversations-list');
            
            if (!container) {
                console.warn('[Legacy] 未找到对话列表容器');
                return;
            }

            // 简单的回退渲染
            container.innerHTML = conversations.map(conv => `
                <div class="conversation-item legacy-conversation-item" data-conversation-id="${conv.id}">
                    <div class="customer-name">${this.generateCustomerNumber(conv.customer_id)}</div>
                    <div class="last-message">${conv.last_message || '暂无消息'}</div>
                </div>
            `).join('');

            // 绑定点击事件
            container.addEventListener('click', (e) => {
                const convItem = e.target.closest('.conversation-item');
                if (convItem) {
                    const convId = convItem.dataset.conversationId;
                    const conversation = conversations.find(c => c.id == convId);
                    if (conversation && window.MessageEventBus) {
                        window.MessageEventBus.emit('conversation:selected', {
                            detail: {
                                conversation,
                                customer: { id: conversation.customer_id, name: this.generateCustomerNumber(conversation.customer_id) }
                            }
                        });
                    }
                }
            });
        }

        /**
         * @deprecated 使用 ConversationsManager.updateConversationPreview()
         */
        updateConversationPreview(messageData) {
            logLegacy('updateConversationPreview', messageData);
            
            if (!messageData || !messageData.conversation_id) return;

            const convItem = document.querySelector(`[data-conversation-id="${messageData.conversation_id}"]`);
            if (convItem) {
                const lastMessageEl = convItem.querySelector('.last-message');
                if (lastMessageEl) {
                    lastMessageEl.textContent = messageData.content || '新消息';
                }
            }
        }

        /**
         * @deprecated 使用 CustomerNumbering.generateCustomerNumber()
         */
        generateCustomerNumber(customerId) {
            logLegacy('generateCustomerNumber', customerId);
            
            if (window.CustomerNumbering && window.CustomerNumbering.generateCustomerNumber) {
                return window.CustomerNumbering.generateCustomerNumber(customerId);
            }

            // 简单的回退实现
            const raw = String(customerId || '').replace('customer_', '');
            return '客户' + raw.substring(0, 8 || 3);
        }

        /**
         * @deprecated 使用 MessageWSAdapter 或 WSManager
         */
        initWebSocket() {
            logLegacy('initWebSocket');
            console.warn('[Legacy] initWebSocket 不再支持，请使用 MessageWSAdapter');
        }

        /**
         * @deprecated 使用 WsEventRouter.route()
         */
        handleWebSocketMessage(data) {
            logLegacy('handleWebSocketMessage', data);
            
            if (window.WsEventRouter && window.WsEventRouter.route) {
                return window.WsEventRouter.route(this, data);
            }

            console.warn('[Legacy] handleWebSocketMessage 回退处理，功能有限');
            
            // 最基本的回退处理
            if (data && data.type === 'message_appended' && window.MessageEventBus) {
                window.MessageEventBus.emit('message:new', data.data);
            }
        }

        /**
         * 获取使用统计
         */
        getUsageStats() {
            return { ...legacyUsageStats };
        }

        /**
         * 重置使用统计
         */
        resetUsageStats() {
            Object.keys(legacyUsageStats).forEach(key => {
                legacyUsageStats[key] = 0;
            });
        }

        /**
         * 生成迁移报告
         */
        generateMigrationReport() {
            const report = {
                totalCalls: Object.values(legacyUsageStats).reduce((sum, count) => sum + count, 0),
                methodStats: { ...legacyUsageStats },
                recommendations: []
            };

            Object.entries(legacyUsageStats).forEach(([method, count]) => {
                if (count > 0) {
                    report.recommendations.push({
                        method,
                        callCount: count,
                        migration: getLegacyMigrationAdvice(method)
                    });
                }
            });

            return report;
        }
    }

    // 工厂函数
    function createLegacyCompat(modernCoordinator) {
        return new MessageLegacyCompatLayer(modernCoordinator);
    }

    // 暴露到全局
    window.MessageLegacyCompatLayer = MessageLegacyCompatLayer;
    window.createLegacyCompat = createLegacyCompat;

    // 暴露使用统计到全局（用于调试）
    if (!window.__MessageLegacyUsage) {
        window.__MessageLegacyUsage = {
            get: () => ({ ...legacyUsageStats }),
            print: () => {
                console.table(legacyUsageStats);
                return legacyUsageStats;
            },
            reset: () => {
                Object.keys(legacyUsageStats).forEach(key => {
                    legacyUsageStats[key] = 0;
                });
                console.log('[Legacy] 使用统计已重置');
            },
            generateReport: () => {
                const instance = new MessageLegacyCompatLayer();
                return instance.generateMigrationReport();
            }
        };
    }

    console.info('[Legacy] 消息模块Legacy兼容层已加载');
})();