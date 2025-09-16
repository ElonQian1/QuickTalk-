/**
 * 高级通知系统前端管理器
 */
class NotificationManagerUI {
    constructor() {
        this.notifications = [];
        this.templates = [];
        this.subscriptions = [];
        this.stats = {};
        this.currentUser = null;
        this.currentShop = null;
        
        this.initializeUI();
        this.setupEventListeners();
    }

    /**
     * 初始化UI
     */
    initializeUI() {
        console.log('📡 初始化通知管理器UI...');
        
        // 检查是否有通知容器
        if (!document.getElementById('notification-manager')) {
            this.createNotificationContainer();
        }
        
        this.setupWebSocketConnection();
        this.loadInitialData();
    }

    /**
     * 创建通知管理容器
     */
    createNotificationContainer() {
        const container = document.createElement('div');
        container.id = 'notification-manager';
        container.innerHTML = `
            <div class="notification-manager">
                <div class="notification-header">
                    <h3>📡 通知管理系统</h3>
                    <div class="notification-controls">
                        <button id="send-notification-btn" class="btn btn-primary">发送通知</button>
                        <button id="manage-templates-btn" class="btn btn-secondary">管理模板</button>
                        <button id="view-stats-btn" class="btn btn-info">查看统计</button>
                        <button id="test-notification-btn" class="btn btn-warning">测试通知</button>
                    </div>
                </div>
                
                <div class="notification-tabs">
                    <button class="tab-btn active" data-tab="send">发送通知</button>
                    <button class="tab-btn" data-tab="templates">模板管理</button>
                    <button class="tab-btn" data-tab="subscriptions">订阅管理</button>
                    <button class="tab-btn" data-tab="stats">统计分析</button>
                </div>
                
                <div class="notification-content">
                    <!-- 发送通知标签页 -->
                    <div id="send-tab" class="tab-content active">
                        <div class="send-form">
                            <div class="form-group">
                                <label>标题:</label>
                                <input type="text" id="notification-title" placeholder="输入通知标题">
                            </div>
                            <div class="form-group">
                                <label>内容:</label>
                                <textarea id="notification-message" placeholder="输入通知内容"></textarea>
                            </div>
                            <div class="form-group">
                                <label>类型:</label>
                                <select id="notification-type">
                                    <option value="general">一般通知</option>
                                    <option value="message">消息通知</option>
                                    <option value="order">订单通知</option>
                                    <option value="system">系统通知</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>优先级:</label>
                                <select id="notification-priority">
                                    <option value="normal">普通</option>
                                    <option value="high">高</option>
                                    <option value="urgent">紧急</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>发送渠道:</label>
                                <div class="checkbox-group">
                                    <label><input type="checkbox" value="websocket" checked> WebSocket实时</label>
                                    <label><input type="checkbox" value="email"> 邮件</label>
                                    <label><input type="checkbox" value="push"> 推送</label>
                                    <label><input type="checkbox" value="sms"> 短信</label>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>目标用户 (留空为广播):</label>
                                <input type="text" id="target-user" placeholder="用户ID">
                            </div>
                            <div class="form-group">
                                <label>定时发送:</label>
                                <input type="datetime-local" id="scheduled-time">
                            </div>
                            <button id="send-now-btn" class="btn btn-primary">立即发送</button>
                        </div>
                    </div>
                    
                    <!-- 模板管理标签页 -->
                    <div id="templates-tab" class="tab-content">
                        <div class="templates-header">
                            <button id="create-template-btn" class="btn btn-primary">创建模板</button>
                        </div>
                        <div id="templates-list" class="templates-list">
                            <!-- 模板列表 -->
                        </div>
                    </div>
                    
                    <!-- 订阅管理标签页 -->
                    <div id="subscriptions-tab" class="tab-content">
                        <div id="subscriptions-list" class="subscriptions-list">
                            <!-- 订阅列表 -->
                        </div>
                    </div>
                    
                    <!-- 统计分析标签页 -->
                    <div id="stats-tab" class="tab-content">
                        <div id="stats-dashboard" class="stats-dashboard">
                            <!-- 统计图表 -->
                        </div>
                    </div>
                </div>
                
                <!-- 通知弹窗 -->
                <div id="notification-toast" class="notification-toast">
                    <!-- 实时通知显示区域 -->
                </div>
                
                <!-- 模态框 -->
                <div id="notification-modal" class="modal">
                    <div class="modal-content">
                        <span class="close">&times;</span>
                        <div id="modal-body"></div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(container);
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 标签页切换
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // 发送通知
        document.getElementById('send-now-btn')?.addEventListener('click', () => {
            this.sendNotification();
        });

        // 测试通知
        document.getElementById('test-notification-btn')?.addEventListener('click', () => {
            this.sendTestNotification();
        });

        // 创建模板
        document.getElementById('create-template-btn')?.addEventListener('click', () => {
            this.showCreateTemplateDialog();
        });

        // 模态框关闭
        document.querySelector('.close')?.addEventListener('click', () => {
            this.closeModal();
        });

        // 点击模态框外部关闭
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('notification-modal');
            if (e.target === modal) {
                this.closeModal();
            }
        });
    }

    /**
     * 设置WebSocket连接
     */
    setupWebSocketConnection() {
        try {
            // 使用统一的WebSocket客户端
            if (typeof UnifiedWebSocketClient === 'undefined') {
                console.error('错误: UnifiedWebSocketClient 未加载。请先引入 websocket-client.min.js');
                return;
            }

            this.ws = UnifiedWebSocketClient.createAdminClient({
                debug: true,
                reconnect: true,
                heartbeat: true
            });
            
            this.ws.onOpen(() => {
                console.log('📡 WebSocket连接已建立');
            });
            
            this.ws.onMessage((data) => {
                try {
                    if (data.type === 'notification') {
                        this.displayNotification(data);
                    }
                } catch (error) {
                    console.error('处理WebSocket消息失败:', error);
                }
            });
            
            this.ws.onClose(() => {
                console.log('📡 WebSocket连接已关闭');
                // 重连逻辑
                setTimeout(() => {
                    this.setupWebSocketConnection();
                }, 5000);
            });
            
            this.ws.onError((error) => {
                console.error('WebSocket错误:', error);
            });

            // 连接WebSocket
            this.ws.connect();
            
        } catch (error) {
            console.error('建立WebSocket连接失败:', error);
        }
    }

    /**
     * 切换标签页
     */
    switchTab(tabName) {
        // 更新标签按钮
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // 更新内容区域
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        // 加载对应数据
        switch (tabName) {
            case 'templates':
                this.loadTemplates();
                break;
            case 'subscriptions':
                this.loadSubscriptions();
                break;
            case 'stats':
                this.loadStats();
                break;
        }
    }

    /**
     * 发送通知
     */
    async sendNotification() {
        try {
            const title = document.getElementById('notification-title').value;
            const message = document.getElementById('notification-message').value;
            const type = document.getElementById('notification-type').value;
            const priority = document.getElementById('notification-priority').value;
            const targetUser = document.getElementById('target-user').value;
            const scheduledTime = document.getElementById('scheduled-time').value;

            // 获取选中的渠道
            const channels = [];
            document.querySelectorAll('.checkbox-group input[type="checkbox"]:checked').forEach(cb => {
                channels.push(cb.value);
            });

            if (!title || !message) {
                this.showError('请填写标题和内容');
                return;
            }

            if (channels.length === 0) {
                this.showError('请选择至少一个发送渠道');
                return;
            }

            const notificationData = {
                shopId: this.currentShop || 'default_shop',
                userId: targetUser || null,
                title,
                message,
                type,
                priority,
                channels,
                scheduledAt: scheduledTime || null,
                metadata: {
                    source: 'manual',
                    userAgent: navigator.userAgent
                }
            };

            const response = await fetch('/api/notifications/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(notificationData)
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess('通知发送成功！');
                this.clearSendForm();
            } else {
                this.showError('发送失败: ' + result.error);
            }

        } catch (error) {
            console.error('发送通知失败:', error);
            this.showError('发送失败: ' + error.message);
        }
    }

    /**
     * 发送测试通知
     */
    async sendTestNotification() {
        try {
            const response = await fetch('/api/notifications/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    shopId: this.currentShop || 'test_shop',
                    userId: this.currentUser || 'test_user'
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess('测试通知已发送！');
            } else {
                this.showError('测试失败: ' + result.error);
            }

        } catch (error) {
            console.error('发送测试通知失败:', error);
            this.showError('测试失败: ' + error.message);
        }
    }

    /**
     * 加载模板
     */
    async loadTemplates() {
        try {
            const shopId = this.currentShop || 'default_shop';
            const response = await fetch(`/api/notifications/templates/${shopId}`);
            const result = await response.json();

            if (result.success) {
                this.templates = result.templates;
                this.renderTemplates();
            } else {
                this.showError('加载模板失败: ' + result.error);
            }

        } catch (error) {
            console.error('加载模板失败:', error);
            this.showError('加载模板失败: ' + error.message);
        }
    }

    /**
     * 渲染模板列表
     */
    renderTemplates() {
        const container = document.getElementById('templates-list');
        if (!container) return;

        if (this.templates.length === 0) {
            container.innerHTML = '<p class="no-data">暂无模板</p>';
            return;
        }

        container.innerHTML = this.templates.map(template => `
            <div class="template-item">
                <div class="template-header">
                    <h4>${template.name}</h4>
                    <span class="template-type">${template.type}</span>
                </div>
                <div class="template-content">
                    <p><strong>标题:</strong> ${template.title}</p>
                    <p><strong>内容:</strong> ${template.content.substring(0, 100)}...</p>
                    <p><strong>渠道:</strong> ${template.channels.join(', ')}</p>
                </div>
                <div class="template-actions">
                    <button onclick="notificationManager.useTemplate('${template.id}')" class="btn btn-sm btn-primary">使用</button>
                    <button onclick="notificationManager.editTemplate('${template.id}')" class="btn btn-sm btn-secondary">编辑</button>
                </div>
            </div>
        `).join('');
    }

    /**
     * 加载统计数据
     */
    async loadStats() {
        try {
            const shopId = this.currentShop || 'default_shop';
            const response = await fetch(`/api/notifications/stats/${shopId}`);
            const result = await response.json();

            if (result.success) {
                this.stats = result.stats;
                this.renderStats();
            } else {
                this.showError('加载统计失败: ' + result.error);
            }

        } catch (error) {
            console.error('加载统计失败:', error);
            this.showError('加载统计失败: ' + error.message);
        }
    }

    /**
     * 渲染统计图表
     */
    renderStats() {
        const container = document.getElementById('stats-dashboard');
        if (!container || !this.stats) return;

        container.innerHTML = `
            <div class="stats-grid">
                <div class="stats-card">
                    <h4>总体统计</h4>
                    <div class="stats-item">
                        <span>已发送:</span>
                        <span class="stats-value">${this.stats.totalStats.sent}</span>
                    </div>
                    <div class="stats-item">
                        <span>已送达:</span>
                        <span class="stats-value">${this.stats.totalStats.delivered}</span>
                    </div>
                    <div class="stats-item">
                        <span>失败:</span>
                        <span class="stats-value">${this.stats.totalStats.failed}</span>
                    </div>
                    <div class="stats-item">
                        <span>成功率:</span>
                        <span class="stats-value">${this.stats.totalStats.successRate}</span>
                    </div>
                </div>
                
                <div class="stats-card">
                    <h4>队列状态</h4>
                    <div class="stats-item">
                        <span>待处理:</span>
                        <span class="stats-value">${this.stats.queueStatus.pending}</span>
                    </div>
                    <div class="stats-item">
                        <span>处理中:</span>
                        <span class="stats-value">${this.stats.queueStatus.processing ? '是' : '否'}</span>
                    </div>
                </div>
                
                <div class="stats-card">
                    <h4>按类型统计</h4>
                    ${this.stats.typeStats.map(type => `
                        <div class="stats-item">
                            <span>${type.type}:</span>
                            <span class="stats-value">${type.sent}/${type.delivered}</span>
                        </div>
                    `).join('')}
                </div>
                
                <div class="stats-card">
                    <h4>按渠道统计</h4>
                    ${this.stats.channelStats.slice(0, 5).map(channel => `
                        <div class="stats-item">
                            <span>${channel.channel}:</span>
                            <span class="stats-value">${channel.sent}/${channel.delivered}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * 显示实时通知
     */
    displayNotification(notification) {
        const toast = document.getElementById('notification-toast');
        if (!toast) return;

        const notificationElement = document.createElement('div');
        notificationElement.className = `notification-item priority-${notification.priority || 'normal'}`;
        notificationElement.innerHTML = `
            <div class="notification-header">
                <strong>${notification.title}</strong>
                <span class="notification-time">${new Date(notification.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="notification-body">
                ${notification.message}
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        `;

        toast.appendChild(notificationElement);

        // 自动移除
        setTimeout(() => {
            if (notificationElement.parentElement) {
                notificationElement.remove();
            }
        }, 5000);
    }

    /**
     * 显示成功消息
     */
    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    /**
     * 显示错误消息
     */
    showError(message) {
        this.showMessage(message, 'error');
    }

    /**
     * 显示消息
     */
    showMessage(message, type = 'info') {
        const toast = document.getElementById('notification-toast');
        if (!toast) return;

        const messageElement = document.createElement('div');
        messageElement.className = `message-item message-${type}`;
        messageElement.innerHTML = `
            <div class="message-content">${message}</div>
            <button class="message-close" onclick="this.parentElement.remove()">×</button>
        `;

        toast.appendChild(messageElement);

        setTimeout(() => {
            if (messageElement.parentElement) {
                messageElement.remove();
            }
        }, 3000);
    }

    /**
     * 清空发送表单
     */
    clearSendForm() {
        document.getElementById('notification-title').value = '';
        document.getElementById('notification-message').value = '';
        document.getElementById('target-user').value = '';
        document.getElementById('scheduled-time').value = '';
        document.getElementById('notification-type').value = 'general';
        document.getElementById('notification-priority').value = 'normal';
        
        // 重置渠道选择
        document.querySelectorAll('.checkbox-group input[type="checkbox"]').forEach(cb => {
            cb.checked = cb.value === 'websocket';
        });
    }

    /**
     * 加载初始数据
     */
    loadInitialData() {
        // 设置当前用户和店铺
        this.currentUser = 'demo_user';
        this.currentShop = 'demo_shop';
        
        console.log('✅ 通知管理器UI初始化完成');
    }

    /**
     * 关闭模态框
     */
    closeModal() {
        document.getElementById('notification-modal').style.display = 'none';
    }
}

// 全局实例
let notificationManager;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    notificationManager = new NotificationManagerUI();
});