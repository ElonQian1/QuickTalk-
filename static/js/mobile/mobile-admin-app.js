/**
 * 移动端管理后台主应用 - 统一版本
 * 使用统一组件管理器替代重复的MessageManager和ShopManager类
 */

// 全局变量
let currentUser = null;
let currentShops = [];
let currentConversations = [];
let currentChatUser = null;
let currentChatShop = null;
let pageStack = ['home'];
let messageCounters = {};
let totalUnreadCount = 0;
let sessionId = null;

// 页面管理系统
class PageManager {
    static switchPage(pageName, params = {}) {
        // 隐藏当前页面
        document.querySelectorAll('.page.active').forEach(page => {
            page.classList.remove('active');
        });

        // 显示目标页面
        const targetPage = document.getElementById(pageName + 'Page');
        if (targetPage) {
            targetPage.classList.add('active');
            
            // 更新导航栏状态
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
            });
            document.querySelector(`[data-page="${pageName}"]`)?.classList.add('active');

            // 更新页面栈
            if (pageStack[pageStack.length - 1] !== pageName) {
                pageStack.push(pageName);
            }

            // 根据页面类型加载数据
            this.loadPageData(pageName, params);
        }
    }

    static goBack() {
        if (pageStack.length > 1) {
            pageStack.pop();
            const previousPage = pageStack[pageStack.length - 1];
            this.switchPage(previousPage);
        }
    }

    static loadPageData(pageName, params) {
        switch (pageName) {
            case 'messages':
                if (params.shopId && params.userId) {
                    MessageManager.loadChatMessages(params.shopId, params.userId);
                } else {
                    MessageManager.loadShopList();
                }
                break;
            case 'shops':
                ShopManager.loadShops();
                break;
            case 'chat':
                if (params.shopId && params.userId) {
                    MessageManager.loadChatMessages(params.shopId, params.userId);
                }
                break;
            case 'home':
                this.loadHomeData();
                break;
        }
    }

    static async loadHomeData() {
        try {
            // 加载统计数据
            const stats = {
                totalShops: currentShops.length,
                totalMessages: Object.values(messageCounters).reduce((sum, count) => sum + count, 0),
                activeConversations: Object.keys(messageCounters).filter(key => messageCounters[key] > 0).length
            };

            // 更新首页统计卡片
            document.getElementById('totalShops').textContent = stats.totalShops;
            document.getElementById('totalMessages').textContent = stats.totalMessages;
            document.getElementById('activeConversations').textContent = stats.activeConversations;
        } catch (error) {
            console.error('加载首页数据失败:', error);
        }
    }
}

// 使用统一组件管理器替代旧的重复类
const MessageManager = {
    loadShopList: () => {
        if (window.UnifiedComponentManager) {
            const messageManager = window.UnifiedComponentManager.createMessageManager('mobile');
            messageManager.loadShopList();
        } else {
            console.warn('UnifiedComponentManager not loaded, using fallback');
            MessageManager.fallbackLoadShopList();
        }
    },
    
    fallbackLoadShopList: () => {
        const content = document.getElementById('messagesContent');
        const title = document.getElementById('messagesTitle');
        
        title.textContent = '店铺列表';
        content.innerHTML = '<div class="loading">正在加载店铺...</div>';
        
        setTimeout(() => {
            if (currentShops.length === 0) {
                content.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">🏪</div>
                        <div>暂无店铺</div>
                        <small>请先创建店铺</small>
                    </div>
                `;
                return;
            }
            
            const shopListHTML = currentShops.map(shop => {
                const unreadCount = messageCounters[shop.id] || 0;
                return `
                    <div class="shop-item" onclick="MessageManager.viewShopConversations('${shop.id}')">
                        <div class="shop-avatar">${shop.name.charAt(0)}</div>
                        <div class="shop-info">
                            <div class="shop-name">${shop.name}</div>
                            <div class="shop-domain">${shop.domain}</div>
                        </div>
                        ${unreadCount > 0 ? `<div class="unread-badge">${unreadCount}</div>` : ''}
                    </div>
                `;
            }).join('');
            content.innerHTML = shopListHTML;
        }, 500);
    },
    
    viewShopConversations: (shopId) => {
        if (window.UnifiedComponentManager) {
            const messageManager = window.UnifiedComponentManager.createMessageManager('mobile');
            messageManager.viewShopConversations(shopId);
        } else {
            MessageManager.fallbackViewShopConversations(shopId);
        }
    },
    
    fallbackViewShopConversations: (shopId) => {
        const shop = currentShops.find(s => s.id === shopId);
        if (!shop) return;

        const content = document.getElementById('messagesContent');
        const title = document.getElementById('messagesTitle');
        
        title.textContent = shop.name;
        content.innerHTML = '<div class="loading">正在加载对话...</div>';

        setTimeout(() => {
            const mockConversations = [
                {
                    userId: 'user_123',
                    userName: '用户123',
                    lastMessage: '你好，我想咨询一下产品信息',
                    lastMessageTime: new Date(),
                    unreadCount: 2
                }
            ];

            if (mockConversations.length === 0) {
                content.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">💬</div>
                        <div>暂无对话</div>
                        <small>等待用户发起对话</small>
                    </div>
                `;
                return;
            }

            const conversationListHTML = mockConversations.map(conv => {
                return `
                    <div class="conversation-item" onclick="MessageManager.openChat('${shopId}', '${conv.userId}')">
                        <div class="user-avatar">${conv.userName.charAt(0)}</div>
                        <div class="conversation-info">
                            <div class="conversation-meta">
                                <div class="user-name">${conv.userName}</div>
                                <div class="message-time">${Utils.formatRelativeTime(conv.lastMessageTime)}</div>
                            </div>
                            <div class="last-message">${conv.lastMessage}</div>
                        </div>
                        ${conv.unreadCount > 0 ? `<div class="unread-badge">${conv.unreadCount}</div>` : ''}
                    </div>
                `;
            }).join('');

            content.innerHTML = conversationListHTML;
        }, 500);
    },
    
    openChat: (shopId, userId) => {
        currentChatShop = shopId;
        currentChatUser = userId;
        
        const params = new URLSearchParams();
        params.set('shopId', shopId);
        params.set('userId', userId);
        
        history.pushState({shopId, userId}, '', `?${params.toString()}`);
        PageManager.switchPage('chat', {shopId, userId});
    },
    
    loadChatMessages: (shopId, userId) => {
        if (window.UnifiedComponentManager) {
            const messageManager = window.UnifiedComponentManager.createMessageManager('mobile');
            messageManager.loadChatMessages(shopId, userId);
        } else {
            MessageManager.fallbackLoadChatMessages(shopId, userId);
        }
    },
    
    fallbackLoadChatMessages: (shopId, userId) => {
        currentChatShop = shopId;
        currentChatUser = userId;
        
        const shop = currentShops.find(s => s.id === shopId);
        const title = document.getElementById('chatTitle');
        const messagesContainer = document.getElementById('chatMessages');
        
        title.textContent = `${shop?.name || '店铺'} - 用户${userId}`;
        messagesContainer.innerHTML = '<div class="loading">正在加载消息...</div>';

        setTimeout(() => {
            const mockMessages = [
                {
                    id: '1',
                    content: '你好，我想咨询一下产品信息',
                    sender: 'user',
                    timestamp: new Date(Date.now() - 60000)
                },
                {
                    id: '2',
                    content: '您好！请问您想了解哪方面的产品信息呢？',
                    sender: 'admin',
                    timestamp: new Date()
                }
            ];

            MessageManager.renderChatMessages(mockMessages);
        }, 500);
    },
    
    renderChatMessages: (messages) => {
        const messagesContainer = document.getElementById('chatMessages');
        
        if (messages.length === 0) {
            messagesContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">💭</div>
                    <div>暂无消息</div>
                    <small>开始对话吧</small>
                </div>
            `;
            return;
        }

        const messagesHTML = messages.map(message => {
            const senderClass = message.sender === 'user' ? 'user' : 'admin';
            return `
                <div class="message ${senderClass}">
                    <div class="message-content">${message.content}</div>
                    <div class="message-time">${Utils.formatRelativeTime(message.timestamp)}</div>
                </div>
            `;
        }).join('');

        messagesContainer.innerHTML = messagesHTML;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    },
    
    formatTime: (timestamp) => {
        return new Date(timestamp).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
};

const ShopManager = {
    loadShops: async () => {
        if (window.UnifiedComponentManager) {
            const shopManager = window.UnifiedComponentManager.createShopManager('mobile');
            await shopManager.loadShops();
        } else {
            console.warn('UnifiedComponentManager not loaded, using fallback');
            await ShopManager.fallbackLoadShops();
        }
    },
    
    fallbackLoadShops: async () => {
        const content = document.getElementById('shopsContent');
        content.innerHTML = '<div class="loading">正在加载店铺...</div>';
        
        try {
            const apiEndpoint = currentUser && currentUser.role === 'super_admin' 
                ? '/api/admin/shops'
                : '/api/shops';
            
            const response = await fetch(apiEndpoint, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-session-id': sessionId
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`加载店铺失败: ${response.status}`);
            }

            const data = await response.json();
            if (data.success && data.shops) {
                currentShops = data.shops;
                ShopManager.renderShops(data.shops);
            } else {
                throw new Error(data.error || '加载店铺数据失败');
            }
        } catch (error) {
            console.error('❌ 加载店铺失败:', error);
            content.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">⚠️</div>
                    <div class="error-message">加载失败</div>
                    <div class="error-detail">${error.message}</div>
                    <button class="retry-btn" onclick="ShopManager.loadShops()">重试</button>
                </div>
            `;
        }
    },
    
    renderShops: (shops) => {
        const content = document.getElementById('shopsContent');
        
        if (!shops || shops.length === 0) {
            content.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🏪</div>
                    <div>暂无店铺</div>
                    <small>请先创建店铺</small>
                </div>
            `;
            return;
        }
        
        const shopsHTML = shops.map(shop => `
            <div class="shop-item" data-shop-id="${shop.id}">
                <div class="shop-header">
                    <div class="shop-info">
                        <div class="shop-name">${shop.name}</div>
                        <div class="shop-status">${shop.status || '正常'}</div>
                    </div>
                </div>
                <div class="shop-actions">
                    <button class="action-btn btn-primary" onclick="ShopManager.viewMessages('${shop.id}')">
                        💬 查看消息
                    </button>
                    <button class="action-btn btn-secondary" onclick="ShopManager.manageShop('${shop.id}')">
                        ⚙️ 管理店铺
                    </button>
                </div>
            </div>
        `).join('');
        
        content.innerHTML = shopsHTML;
    },
    
    viewMessages: (shopId) => {
        PageManager.switchPage('messages');
        setTimeout(() => {
            MessageManager.viewShopConversations(shopId);
        }, 100);
    },
    
    manageShop: (shopId) => {
        console.log(`管理店铺 ${shopId}`);
        alert('店铺管理功能开发中...');
    }
};

// 认证管理
class AuthManager {
    static async login(username, password) {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            
            if (data.success) {
                sessionId = data.sessionId;
                currentUser = data.user;
                
                // 切换到主界面
                document.getElementById('loginContainer').style.display = 'none';
                document.getElementById('appContainer').style.display = 'flex';
                
                // 加载初始数据
                await ShopManager.loadShops();
                
                return { success: true };
            } else {
                return { success: false, error: data.error || '登录失败' };
            }
        } catch (error) {
            console.error('登录请求失败:', error);
            return { success: false, error: '网络错误，请稍后重试' };
        }
    }

    static logout() {
        currentUser = null;
        sessionId = null;
        currentShops = [];
        
        // 返回登录界面
        document.getElementById('appContainer').style.display = 'none';
        document.getElementById('loginContainer').style.display = 'flex';
        
        // 清空表单
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        document.getElementById('errorMessage').style.display = 'none';
    }
}

// 工具类
class Utils {
    static formatRelativeTime(timestamp) {
        const now = Date.now();
        const time = new Date(timestamp).getTime();
        const diff = now - time;
        
        if (diff < 60000) { // 1分钟内
            return '刚刚';
        } else if (diff < 3600000) { // 1小时内
            return `${Math.floor(diff / 60000)}分钟前`;
        } else if (diff < 86400000) { // 24小时内
            return `${Math.floor(diff / 3600000)}小时前`;
        } else {
            return new Date(timestamp).toLocaleDateString();
        }
    }
}

// 发送消息函数 - 使用统一消息API
function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message || !currentChatShop || !currentChatUser) return;

    // 使用统一消息API发送消息
    if (window.UnifiedMessageAPI) {
        window.UnifiedMessageAPI.sendMessage({
            content: message,
            shopId: currentChatShop,
            userId: currentChatUser,
            type: 'text',
            sender: 'admin'
        });
    } else {
        // 回退到旧的实现
        const messagesContainer = document.getElementById('chatMessages');
        const messageHTML = `
            <div class="message admin">
                <div class="message-content">${message}</div>
                <div class="message-time">刚刚</div>
            </div>
        `;
        messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    input.value = '';
}

function logout() {
    AuthManager.logout();
}

function checkExistingSession() {
    // 检查是否有保存的会话
    const savedSessionId = localStorage.getItem('sessionId');
    if (savedSessionId) {
        sessionId = savedSessionId;
        // 验证会话是否仍然有效
        // 这里可以添加会话验证逻辑
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('客服管理系统启动 - 统一版本');
    
    // 检查是否有保存的会话
    checkExistingSession();
    
    // 登录表单处理
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const loginBtn = document.getElementById('loginBtn');
            
            loginBtn.disabled = true;
            loginBtn.textContent = '登录中...';
            
            const result = await AuthManager.login(username, password);
            
            if (!result.success) {
                document.getElementById('errorMessage').textContent = result.error;
                document.getElementById('errorMessage').style.display = 'block';
            }
            
            loginBtn.disabled = false;
            loginBtn.textContent = '登录';
        });
    }
    
    // 初始化页面
    if (sessionId && currentUser) {
        // 如果已登录，直接显示主界面
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('appContainer').style.display = 'flex';
        PageManager.switchPage('home');
    }
});

// 导出供全局使用
window.PageManager = PageManager;
window.MessageManager = MessageManager;
window.ShopManager = ShopManager;
window.AuthManager = AuthManager;
window.Utils = Utils;