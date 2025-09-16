/**
 * 移动端管理后台主应用
 * 从admin-mobile.html中提取的JavaScript代码
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
            case 'home':
                HomeManager.loadData();
                break;
            case 'messages':
                console.log('💬 切换到消息页面');
                // 🎯 使用新版多店铺客服系统
                if (window.customerServiceManager) {
                    console.log('🏪 使用多店铺客服系统');
                    const messageContainer = document.getElementById('messageContent');
                    if (messageContainer) {
                        window.customerServiceManager.renderToContainer(messageContainer);
                    }
                } else if (window.messageManager) {
                    console.log('💬 使用备用消息管理器');
                    window.messageManager.showMessageOverview();
                } else {
                    console.error('❌ 没有可用的消息管理器');
                    const messageContainer = document.getElementById('messageContent');
                    if (messageContainer) {
                        messageContainer.innerHTML = `
                            <div class="error-container">
                                <div class="error-icon">⚠️</div>
                                <div class="error-title">消息系统未初始化</div>
                                <div class="error-message">请稍后重试或刷新页面</div>
                            </div>
                        `;
                    }
                }
                break;
            case 'shops':
                console.log('📱 切换到店铺页面');
                // 确保sessionId全局可访问
                window.sessionId = sessionId;
                console.log('🔍 使用sessionId:', sessionId);
                
                // 直接使用已测试过的旧版店铺管理系统
                console.log('🏪 调用 ShopManager.loadShops()');
                ShopManager.loadShops();
                break;
            case 'chat':
                MessageManager.loadChatMessages(params.shopId, params.userId);
                break;
        }
    }
}

// 首页管理
class HomeManager {
    static async loadData() {
        try {
            // 加载统计数据
            const response = await fetch('/api/admin/stats', {
                headers: { 'X-Session-Id': sessionId }
            });
            
            if (response.ok) {
                const stats = await response.json();
                document.getElementById('totalShops').textContent = stats.totalShops || 0;
                document.getElementById('totalMessages').textContent = stats.unreadMessages || 0;
            }

            // 显示管理员功能（如果是超级管理员）
            if (currentUser && currentUser.role === 'super_admin') {
                document.getElementById('adminActions').style.display = 'block';
            }
        } catch (error) {
            console.error('加载首页数据失败:', error);
        }
    }
}

// 消息管理系统 - 复用之前开发的代码
class MessageManager {
    static loadShopList() {
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

            content.innerHTML = `<div class="shop-list">${shopListHTML}</div>`;
        }, 500);
    }

    static viewShopConversations(shopId) {
        const shop = currentShops.find(s => s.id === shopId);
        if (!shop) return;

        const content = document.getElementById('messagesContent');
        const title = document.getElementById('messagesTitle');
        
        title.textContent = shop.name;
        content.innerHTML = '<div class="loading">正在加载对话...</div>';

        // 模拟加载对话列表
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
    }

    static openChat(shopId, userId) {
        PageManager.switchPage('chat', { shopId, userId });
    }

    static loadChatMessages(shopId, userId) {
        currentChatShop = shopId;
        currentChatUser = userId;
        
        const shop = currentShops.find(s => s.id === shopId);
        const title = document.getElementById('chatTitle');
        const messagesContainer = document.getElementById('chatMessages');
        
        title.textContent = `${shop?.name || '店铺'} - 用户${userId}`;
        messagesContainer.innerHTML = '<div class="loading">正在加载消息...</div>';

        // 模拟加载聊天消息
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

            this.renderChatMessages(mockMessages);
        }, 500);
    }

    static renderChatMessages(messages) {
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
    }

    // 改为使用统一的 Utils.formatRelativeTime 方法
}

// 店铺管理
class ShopManager {
    static async loadShops() {
        const content = document.getElementById('shopsContent');
        content.innerHTML = '<div class="loading">正在加载店铺...</div>';

        console.log('开始加载店铺, sessionId:', sessionId);

        try {
            // 根据用户角色选择正确的API端点
            const apiEndpoint = currentUser && currentUser.role === 'super_admin' 
                ? '/api/admin/shops'  // 超级管理员看所有店铺
                : '/api/shops';       // 普通用户看自己的店铺
            
            console.log(`📡 使用API端点: ${apiEndpoint} (用户角色: ${currentUser?.role || '未知'})`);
            
            const response = await fetch(apiEndpoint, {
                headers: { 'X-Session-Id': sessionId }
            });

            console.log('API响应状态:', response.status, response.statusText);

            if (response.ok) {
                const responseData = await response.json();
                console.log('📦 API返回的原始数据:', responseData);
                console.log('📦 数据类型:', typeof responseData);
                
                // 处理不同的响应格式
                let currentShops;
                if (Array.isArray(responseData)) {
                    // 直接是数组格式 (来自 /api/shops)
                    currentShops = responseData;
                    console.log('📦 检测到数组格式响应');
                } else if (responseData && responseData.shops && Array.isArray(responseData.shops)) {
                    // 包装对象格式 (来自 /api/auth/me 或其他端点)
                    currentShops = responseData.shops;
                    console.log('📦 检测到对象包装格式响应，提取 shops 数组');
                } else {
                    console.error('❌ 无法识别的响应格式:', responseData);
                    throw new Error(`API返回数据格式错误: 期望数组或包含shops的对象，实际收到 ${typeof responseData}`);
                }
                
                console.log('📦 是否为数组:', Array.isArray(currentShops));
                
                // 确保数据是数组格式
                if (!Array.isArray(currentShops)) {
                    console.error('❌ 处理后的数据仍不是数组格式:', currentShops);
                    content.innerHTML = '<div class="empty-state"><div class="empty-icon">❌</div><div>数据格式错误</div></div>';
                    return;
                }
                
                console.log('✅ 收到店铺数据:', currentShops.length, '个店铺');
                if (currentShops.length > 0) {
                    console.log('📄 店铺数据预览:', currentShops.slice(0, 2));
                }
                this.renderShops(currentShops);
            } else {
                const errorText = await response.text();
                console.error('API响应错误:', errorText);
                content.innerHTML = '<div class="empty-state"><div class="empty-icon">❌</div><div>加载失败: ' + response.status + '</div></div>';
            }
        } catch (error) {
            console.error('加载店铺失败:', error);
            content.innerHTML = '<div class="empty-state"><div class="empty-icon">❌</div><div>网络错误</div></div>';
        }
    }

    static renderShops(shops) {
        const content = document.getElementById('shopsContent');

        console.log('开始渲染店铺列表，店铺数量:', shops.length);

        if (shops.length === 0) {
            content.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🏪</div>
                    <div>暂无店铺</div>
                    <small>点击创建按钮添加第一个店铺</small>
                </div>
            `;
            return;
        }

        const shopsHTML = shops.map((shop, index) => {
            if (index < 3) {
                console.log(`店铺${index}:`, shop.name, shop.domain, shop.approvalStatus);
            }
            const statusClass = this.getStatusClass(shop.approvalStatus || shop.status);
            const statusText = this.getStatusText(shop.approvalStatus || shop.status);
            const userRole = this.getUserRoleInShop(shop);

            return `
                <div class="shop-item">
                    <div class="shop-avatar-container">
                        <div class="shop-avatar">${shop.name.charAt(0)}</div>
                        <div class="shop-role">${this.getRoleText(userRole)}</div>
                    </div>
                    <div class="shop-content">
                        <div class="shop-info">
                            <div class="shop-name">${shop.name}</div>
                            <div class="shop-domain">${shop.domain}</div>
                            <div class="shop-status ${statusClass}">${statusText}</div>
                        </div>
                        <div class="shop-actions">
                            ${(() => {
                                const approvalStatus = shop.approval_status || shop.approvalStatus;
                                
                                if (approvalStatus === 'approved') {
                                    // 根据用户在店铺中的角色显示不同按钮
                                    if (userRole === 'owner' || userRole === 'admin') {
                                        // 店主/管理员：显示所有管理按钮
                                        return `
                                            <button class="shop-btn primary" onclick="ShopManager.manageShop('${shop.id}')">管理</button>
                                            <button class="shop-btn success" onclick="MessageManager.viewShopConversations('${shop.id}')">💬 消息</button>
                                            <button class="shop-btn info" onclick="showIntegrationCode('${shop.id}', '${shop.name}')">📋 代码</button>
                                        `;
                                    } else if (userRole === 'manager') {
                                        // 经理：显示部分管理按钮
                                        return `
                                            <button class="shop-btn success" onclick="MessageManager.viewShopConversations('${shop.id}')">💬 消息</button>
                                            <button class="shop-btn info" onclick="showIntegrationCode('${shop.id}', '${shop.name}')">📋 代码</button>
                                        `;
                                    } else if (userRole === 'employee') {
                                        // 员工：只显示消息相关按钮
                                        return `
                                            <button class="shop-btn success" onclick="MessageManager.viewShopConversations('${shop.id}')">💬 消息</button>
                                        `;
                                    } else {
                                        // 其他角色：基本查看权限
                                        return `
                                            <button class="shop-btn success" onclick="MessageManager.viewShopConversations('${shop.id}')">💬 消息</button>
                                        `;
                                    }
                                } else if (approvalStatus === 'pending') {
                                    return `
                                        <button class="shop-btn warning" disabled>等待审核</button>
                                    `;
                                } else if (approvalStatus === 'rejected') {
                                    return `
                                        <button class="shop-btn danger" disabled>已拒绝</button>
                                    `;
                                } else {
                                    return `
                                        <button class="shop-btn secondary" onclick="ShopManager.manageShop('${shop.id}')">查看</button>
                                    `;
                                }
                            })()}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        content.innerHTML = `<div class="shop-list">${shopsHTML}</div>`;
    }

    static getStatusClass(status) {
        const statusMap = {
            'approved': 'active',
            'active': 'active',
            'pending': 'pending', 
            'expired': 'expired',
            'inactive': 'expired',
            'rejected': 'expired'
        };
        return statusMap[status] || 'pending';
    }

    static getStatusText(status) {
        const statusMap = {
            'approved': '✅ 已审核',
            'active': '✅ 正常',
            'pending': '⏳ 待审核',
            'expired': '❌ 已过期',
            'inactive': '⏸️ 未激活',
            'rejected': '❌ 已拒绝'
        };
        return statusMap[status] || '未知状态';
    }

    static manageShop(shopId) {
        console.log('🏪 打开店铺管理:', shopId);
        openShopManageModal(shopId);
    }

    // 获取用户在店铺中的角色
    static getUserRoleInShop(shop) {
        // 如果店铺数据中已有userRole属性，直接使用
        if (shop.userRole) {
            return shop.userRole;
        }
        
        // 如果当前用户是超级管理员
        if (currentUser && currentUser.role === 'super_admin') {
            return 'admin';
        }
        
        // 如果当前用户是店主
        if (currentUser && currentUser.role === 'shop_owner') {
            return 'owner';
        }
        
        // 检查是否是员工
        if (currentUser && (currentUser.role === 'employee' || currentUser.role === 'agent')) {
            return 'employee';
        }
        
        // 默认返回
        return 'member';
    }

    // 获取角色显示文本（与桌面版保持一致）
    static getRoleText(role) {
        const roleTexts = {
            'owner': '店主',
            'manager': '经理', 
            'employee': '员工',
            'admin': '管理员',
            'member': '成员'
        };
        return roleTexts[role] || '未知';
    }
}

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
            
            if (response.ok) {
                currentUser = data.user;
                sessionId = data.sessionId;
                
                // 持久化sessionId到localStorage
                localStorage.setItem('sessionId', sessionId);
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                
                // 全局设置sessionId供模块使用
                window.sessionId = sessionId;
                window.currentUser = currentUser;
                
                console.log('✅ 登录成功，用户:', currentUser.username, 'SessionId:', sessionId);
                
                document.getElementById('loginContainer').style.display = 'none';
                document.getElementById('appContainer').style.display = 'flex';
                
                // 更新用户信息显示
                document.getElementById('userInfo').textContent = `${currentUser.username} (${this.getRoleText(currentUser.role)})`;
                
                // 加载初始数据
                HomeManager.loadData();
                
                // 预初始化店铺管理模块
                if (window.mobileShopManager) {
                    console.log('🏪 预初始化店铺管理模块');
                    // 先不加载数据，等切换到店铺页面时再加载
                }
                ShopManager.loadShops();
                
                return { success: true };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            return { success: false, error: '网络错误，请稍后重试' };
        }
    }

    static getRoleText(role) {
        const roleMap = {
            'super_admin': '超级管理员',
            'admin': '管理员',
            'user': '店主'
        };
        return roleMap[role] || '用户';
    }

    static logout() {
        if (confirm('确定要退出登录吗？')) {
            currentUser = null;
            sessionId = null;
            currentShops = [];
            
            // 清除localStorage中的会话数据
            localStorage.removeItem('sessionId');
            localStorage.removeItem('currentUser');
            
            document.getElementById('loginContainer').style.display = 'flex';
            document.getElementById('appContainer').style.display = 'none';
            
            // 重置页面状态
            PageManager.switchPage('home');
            pageStack = ['home'];
        }
    }
}

// 店铺创建
async function createShop() {
    const form = document.getElementById('createShopForm');
    const formData = new FormData(form);
    
    try {
        const response = await fetch('/api/shops/create', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify({
                name: formData.get('shopName'),
                domain: formData.get('shopDomain'),
                description: formData.get('shopDescription')
            })
        });

        const data = await response.json();
        
        if (response.ok) {
            alert('店铺创建成功！请等待审核。');
            hideCreateShopModal();
            form.reset();
            ShopManager.loadShops(); // 重新加载店铺列表
        } else {
            alert(data.error || '创建失败，请重试');
        }
    } catch (error) {
        alert('网络错误，请稍后重试');
    }
}

// 模态框管理
function showCreateShopModal() {
    document.getElementById('createShopModal').style.display = 'flex';
}

function hideCreateShopModal() {
    document.getElementById('createShopModal').style.display = 'none';
}

function showProfileModal() {
    const modal = document.getElementById('profileModal');
    const content = document.getElementById('profileContent');
    
    content.innerHTML = `
        <div style="text-align: center;">
            <div style="font-size: 48px; margin-bottom: 15px;">👤</div>
            <h3>${currentUser?.username || '未知用户'}</h3>
            <p style="color: #666; margin: 10px 0;">${AuthManager.getRoleText(currentUser?.role)}</p>
            <p style="color: #666; font-size: 14px;">登录时间: ${new Date().toLocaleString()}</p>
        </div>
    `;
    
    modal.style.display = 'flex';
}

function hideProfileModal() {
    document.getElementById('profileModal').style.display = 'none';
}

function showAdminPanel() {
    document.getElementById('adminPanelModal').style.display = 'flex';
}

function hideAdminPanel() {
    document.getElementById('adminPanelModal').style.display = 'none';
}

function showReviewPanel() {
    document.getElementById('reviewPanelModal').style.display = 'flex';
}

function hideReviewPanel() {
    document.getElementById('reviewPanelModal').style.display = 'none';
}

function showPromotionModal() {
    alert('推广功能开发中...');
}

// 全局函数
function switchPage(pageName) {
    PageManager.switchPage(pageName);
}

function goBack() {
    PageManager.goBack();
}

// 检查现有会话
async function checkExistingSession() {
    const storedSessionId = localStorage.getItem('sessionId');
    const storedUser = localStorage.getItem('currentUser');
    
    if (storedSessionId && storedUser) {
        console.log('🔍 发现保存的会话，验证中...', storedSessionId);
        
        try {
            // 验证会话是否仍然有效
            const response = await fetch('/api/auth/me', {
                headers: { 'X-Session-Id': storedSessionId }
            });
            
            if (response.ok) {
                const user = await response.json();
                
                // 恢复会话
                sessionId = storedSessionId;
                currentUser = user;
                window.sessionId = sessionId;
                window.currentUser = currentUser;
                
                console.log('✅ 会话恢复成功:', user.username);
                
                // 直接进入应用
                document.getElementById('loginContainer').style.display = 'none';
                document.getElementById('appContainer').style.display = 'flex';
                document.getElementById('userInfo').textContent = `${user.username} (${AuthManager.getRoleText(user.role)})`;
                
                // 加载初始数据
                HomeManager.loadData();
                
                return true;
            } else {
                console.log('⚠️ 保存的会话已过期');
                // 清除过期的会话数据
                localStorage.removeItem('sessionId');
                localStorage.removeItem('currentUser');
            }
        } catch (error) {
            console.error('验证会话失败:', error);
            localStorage.removeItem('sessionId');
            localStorage.removeItem('currentUser');
        }
    }
    
    return false;
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message || !currentChatShop || !currentChatUser) return;

    // 在界面上显示消息
    const messagesContainer = document.getElementById('chatMessages');
    const messageHTML = `
        <div class="message admin">
            <div class="message-content">${message}</div>
            <div class="message-time">刚刚</div>
        </div>
    `;
    messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    input.value = '';
}

function logout() {
    AuthManager.logout();
}

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('客服管理系统启动');
    
    // 检查是否有保存的会话
    checkExistingSession();
    
    // 登录表单处理
    document.getElementById('loginForm').addEventListener('submit', async function(e) {
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

    // 消息输入框回车发送
    document.getElementById('messageInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // 模态框点击外部关闭
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
            }
        });
    });
});

// 全局导出
window.PageManager = PageManager;
window.HomeManager = HomeManager;
window.MessageManager = MessageManager;
window.ShopManager = ShopManager;
window.AuthManager = AuthManager;
window.createShop = createShop;
window.showCreateShopModal = showCreateShopModal;
window.hideCreateShopModal = hideCreateShopModal;
window.showProfileModal = showProfileModal;
window.hideProfileModal = hideProfileModal;
window.showAdminPanel = showAdminPanel;
window.hideAdminPanel = hideAdminPanel;
window.showReviewPanel = showReviewPanel;
window.hideReviewPanel = hideReviewPanel;
window.showPromotionModal = showPromotionModal;
window.switchPage = switchPage;
window.goBack = goBack;
window.sendMessage = sendMessage;
window.logout = logout;

console.log('📱 [MobileAdminApp] 移动端管理后台应用已加载');