/**
 * 统一前端组件管理器 - Phase 7 架构重构
 * 合并所有重复的MessageManager和ShopManager实现
 */

class UnifiedComponentManager {
    constructor() {
        this.messageAPI = window.unifiedMessageAPI;
        this.currentShopId = null;
        this.currentUserId = null;
        this.conversations = new Map();
        
        console.log('🔧 [UnifiedComponentManager] 统一组件管理器已初始化');
    }

    /**
     * 统一消息管理组件 - 替换3套MessageManager实现
     */
    static createMessageManager() {
        return {
            /**
             * 查看店铺对话列表 - 统一实现
             */
            async viewShopConversations(shopId) {
                try {
                    console.log(`💬 [MessageManager] 查看店铺 ${shopId} 的对话`);
                    
                    const response = await fetch(`/api/conversations/${shopId}`, {
                        headers: {
                            'X-Session-Id': window.unifiedMessageAPI.sessionId
                        }
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        this.renderConversationList(result.conversations, shopId);
                        this.switchToPage('conversations');
                    } else {
                        throw new Error(result.error || '获取对话失败');
                    }
                } catch (error) {
                    console.error('❌ [MessageManager] 获取对话失败:', error);
                    this.showError(`获取对话失败: ${error.message}`);
                }
            },

            /**
             * 打开聊天界面 - 统一实现
             */
            async openChat(shopId, userId) {
                try {
                    console.log(`💬 [MessageManager] 打开聊天: 店铺=${shopId}, 用户=${userId}`);
                    
                    window.unifiedComponentManager.currentShopId = shopId;
                    window.unifiedComponentManager.currentUserId = userId;
                    
                    // 获取历史消息
                    const response = await fetch(`/api/messages/${shopId}/${userId}`, {
                        headers: {
                            'X-Session-Id': window.unifiedMessageAPI.sessionId
                        }
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        this.renderChatInterface(result.messages, shopId, userId);
                        this.switchToPage('chat');
                        this.markMessagesAsRead(shopId, userId);
                    } else {
                        throw new Error(result.error || '获取消息失败');
                    }
                } catch (error) {
                    console.error('❌ [MessageManager] 打开聊天失败:', error);
                    this.showError(`打开聊天失败: ${error.message}`);
                }
            },

            /**
             * 渲染对话列表 - 统一UI组件
             */
            renderConversationList(conversations, shopId) {
                const container = this.findContainer([
                    '#conversations-container',
                    '.conversations-list',
                    '#main-content'
                ]);
                
                if (!container) {
                    console.warn('⚠️ [MessageManager] 未找到对话列表容器');
                    return;
                }
                
                container.innerHTML = `
                    <div class="conversations-header">
                        <h3>店铺 ${shopId} 的对话</h3>
                        <button class="back-btn" onclick="UnifiedComponentManager.goBack()">返回</button>
                    </div>
                    <div class="conversations-list">
                        ${conversations.map(conv => `
                            <div class="conversation-item" onclick="UnifiedComponentManager.messageManager.openChat('${shopId}', '${conv.userId}')">
                                <div class="user-avatar">👤</div>
                                <div class="conversation-info">
                                    <div class="user-name">${conv.userName || conv.userId}</div>
                                    <div class="last-message">${conv.lastMessage || '暂无消息'}</div>
                                    <div class="message-time">${this.formatTime(conv.lastMessageTime)}</div>
                                </div>
                                ${conv.unreadCount > 0 ? `<div class="unread-badge">${conv.unreadCount}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                `;
            },

            /**
             * 渲染聊天界面 - 统一UI组件
             */
            renderChatInterface(messages, shopId, userId) {
                const container = this.findContainer([
                    '#chat-container',
                    '.chat-interface',
                    '#main-content'
                ]);
                
                if (!container) {
                    console.warn('⚠️ [MessageManager] 未找到聊天容器');
                    return;
                }
                
                container.innerHTML = `
                    <div class="chat-header">
                        <button class="back-btn" onclick="UnifiedComponentManager.messageManager.viewShopConversations('${shopId}')">← 返回</button>
                        <div class="chat-title">与用户 ${userId} 的对话</div>
                        <div class="user-status online">在线</div>
                    </div>
                    <div class="chat-messages" id="chat-messages">
                        ${messages.map(msg => this.formatMessage(msg)).join('')}
                    </div>
                    <div class="chat-input-area">
                        <div class="typing-indicator" style="display: none;"></div>
                        <div class="input-container">
                            <textarea id="message-input" placeholder="输入消息..." rows="2"></textarea>
                            <button id="send-button" onclick="UnifiedComponentManager.sendCurrentMessage()">发送</button>
                        </div>
                    </div>
                `;
                
                // 绑定回车发送
                const input = document.getElementById('message-input');
                if (input) {
                    input.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            UnifiedComponentManager.sendCurrentMessage();
                        }
                    });
                }
            },

            /**
             * 格式化消息显示
             */
            formatMessage(message) {
                const time = this.formatTime(message.timestamp);
                const isFromUser = message.sender_type === 'user';
                
                return `
                    <div class="message ${isFromUser ? 'user-message' : 'staff-message'}">
                        <div class="message-content">${this.escapeHtml(message.content)}</div>
                        <div class="message-time">${time}</div>
                    </div>
                `;
            },

            /**
             * 标记消息为已读
             */
            async markMessagesAsRead(shopId, userId) {
                try {
                    await fetch('/api/messages/mark-read', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Session-Id': window.unifiedMessageAPI.sessionId
                        },
                        body: JSON.stringify({ shopId, userId })
                    });
                } catch (error) {
                    console.warn('⚠️ [MessageManager] 标记已读失败:', error);
                }
            },

            // 工具方法
            formatTime: (timestamp) => {
                if (!timestamp) return '';
                const date = new Date(timestamp);
                return date.toLocaleTimeString();
            },

            escapeHtml: (text) => {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            },

            findContainer: (selectors) => {
                for (const selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element) return element;
                }
                return null;
            },

            showError: (message) => {
                window.unifiedMessageAPI.showError(message);
            },

            switchToPage: (page) => {
                // 统一的页面切换逻辑
                document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
                const targetPage = document.querySelector(`#${page}-page, .${page}-page`);
                if (targetPage) {
                    targetPage.style.display = 'block';
                }
            }
        };
    }

    /**
     * 统一店铺管理组件 - 替换3套ShopManager实现
     */
    static createShopManager() {
        return {
            /**
             * 管理店铺 - 统一实现
             */
            async manageShop(shopId) {
                try {
                    console.log(`🏪 [ShopManager] 管理店铺 ${shopId}`);
                    
                    const response = await fetch(`/api/shops/${shopId}`, {
                        headers: {
                            'X-Session-Id': window.unifiedMessageAPI.sessionId
                        }
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        this.renderShopManagement(result.shop);
                        this.switchToPage('shop-management');
                    } else {
                        throw new Error(result.error || '获取店铺信息失败');
                    }
                } catch (error) {
                    console.error('❌ [ShopManager] 管理店铺失败:', error);
                    this.showError(`管理店铺失败: ${error.message}`);
                }
            },

            /**
             * 加载店铺列表 - 统一实现
             */
            async loadShops() {
                try {
                    console.log('🏪 [ShopManager] 加载店铺列表');
                    
                    const response = await fetch('/api/shops', {
                        headers: {
                            'X-Session-Id': window.unifiedMessageAPI.sessionId
                        }
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        this.renderShopList(result.shops);
                    } else {
                        throw new Error(result.error || '获取店铺列表失败');
                    }
                } catch (error) {
                    console.error('❌ [ShopManager] 加载店铺失败:', error);
                    this.showError(`加载店铺失败: ${error.message}`);
                }
            },

            /**
             * 渲染店铺列表 - 统一UI组件
             */
            renderShopList(shops) {
                const container = this.findContainer([
                    '#shops-container',
                    '.shops-list',
                    '#main-content'
                ]);
                
                if (!container) {
                    console.warn('⚠️ [ShopManager] 未找到店铺列表容器');
                    return;
                }
                
                container.innerHTML = `
                    <div class="shops-header">
                        <h3>我的店铺</h3>
                        <button class="create-shop-btn" onclick="UnifiedComponentManager.shopManager.createShop()">创建新店铺</button>
                    </div>
                    <div class="shops-grid">
                        ${shops.map(shop => `
                            <div class="shop-card">
                                <div class="shop-info">
                                    <h4>${shop.name}</h4>
                                    <p class="shop-status ${shop.status}">${this.getStatusText(shop.status)}</p>
                                    <p class="shop-description">${shop.description || '暂无描述'}</p>
                                </div>
                                <div class="shop-actions">
                                    <button class="btn btn-primary" onclick="UnifiedComponentManager.messageManager.viewShopConversations('${shop.id}')">💬 消息</button>
                                    <button class="btn btn-secondary" onclick="UnifiedComponentManager.shopManager.manageShop('${shop.id}')">⚙️ 管理</button>
                                    <button class="btn btn-info" onclick="window.integrationManager.generateCode('${shop.id}')">📋 代码</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            },

            /**
             * 创建新店铺
             */
            createShop() {
                // 显示创建店铺表单
                this.showCreateShopModal();
            },

            // 工具方法
            getStatusText: (status) => {
                const statusMap = {
                    'active': '运营中',
                    'pending': '审核中',
                    'inactive': '已暂停',
                    'rejected': '已拒绝'
                };
                return statusMap[status] || status;
            },

            findContainer: (selectors) => {
                for (const selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element) return element;
                }
                return null;
            },

            showError: (message) => {
                window.unifiedMessageAPI.showError(message);
            },

            switchToPage: (page) => {
                document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
                const targetPage = document.querySelector(`#${page}-page, .${page}-page`);
                if (targetPage) {
                    targetPage.style.display = 'block';
                }
            }
        };
    }

    /**
     * 发送当前输入的消息 - 全局统一方法
     */
    static async sendCurrentMessage() {
        const input = document.getElementById('message-input');
        if (!input || !input.value.trim()) return;
        
        const content = input.value.trim();
        const shopId = window.unifiedComponentManager.currentShopId;
        const userId = window.unifiedComponentManager.currentUserId;
        
        if (!shopId || !userId) {
            console.error('❌ [UnifiedComponentManager] 缺少shopId或userId');
            return;
        }
        
        try {
            await window.unifiedMessageAPI.sendMessage(content, userId, shopId);
            input.value = '';
        } catch (error) {
            console.error('❌ [UnifiedComponentManager] 发送消息失败:', error);
        }
    }

    /**
     * 返回上一页 - 全局统一方法
     */
    static goBack() {
        history.back();
    }
}

// 创建全局实例和组件
window.unifiedComponentManager = new UnifiedComponentManager();
window.unifiedComponentManager.messageManager = UnifiedComponentManager.createMessageManager();
window.unifiedComponentManager.shopManager = UnifiedComponentManager.createShopManager();

// 全局兼容性函数 - 替换所有旧实现
window.MessageManager = window.unifiedComponentManager.messageManager;
window.ShopManager = window.unifiedComponentManager.shopManager;
window.UnifiedComponentManager = UnifiedComponentManager;

console.log('🔧 [Phase 7] 统一组件管理器已加载 - 替换6套重复实现');

export default UnifiedComponentManager;