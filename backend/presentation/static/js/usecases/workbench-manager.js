"use strict";

/**
 * 工作台功能模块
 * 负责加载和显示工作台数据、快速操作、活动记录等
 */

class WorkbenchManager {
    constructor() {
        this.stats = {
            totalConversations: 0,
            activeConversations: 0,
            unreadMessages: 0,
            totalCustomers: 0
        };
        this.activities = [];
        this.lastUpdateTime = null;
    }

    /**
     * 初始化工作台
     */
    async init() {
        console.log('初始化工作台');
        this.setupEventListeners();
        await this.loadWorkbenchData();
        this.startAutoRefresh();
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 监听页面切换事件
        document.addEventListener('pageChanged', (event) => {
            if (event.detail === 'workbench') {
                this.refresh();
            }
        });

        // 监听WebSocket连接状态变化
        document.addEventListener('wsStatusChanged', (event) => {
            this.updateWebSocketStatus(event.detail);
        });
    }

    /**
     * 加载工作台数据
     */
    async loadWorkbenchData() {
        try {
            await Promise.all([
                this.loadStatistics(),
                this.loadRecentActivity(),
                this.updateSystemStatus()
            ]);
            this.lastUpdateTime = new Date();
            this.updateLastUpdateTime();
        } catch (error) {
            console.error('加载工作台数据失败:', error);
        }
    }

    /**
     * 加载统计数据
     */
    async loadStatistics() {
        try {
            // 这里可以调用API获取真实统计数据
            // 暂时使用模拟数据
            const response = await fetch('/api/dashboard/stats', {
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.stats = data;
            } else {
                // 使用模拟数据
                this.stats = {
                    totalConversations: Math.floor(Math.random() * 100) + 50,
                    activeConversations: Math.floor(Math.random() * 20) + 5,
                    unreadMessages: Math.floor(Math.random() * 50) + 10,
                    totalCustomers: Math.floor(Math.random() * 200) + 100
                };
            }
        } catch (error) {
            console.warn('加载统计数据失败，使用模拟数据:', error);
            this.stats = {
                totalConversations: Math.floor(Math.random() * 100) + 50,
                activeConversations: Math.floor(Math.random() * 20) + 5,
                unreadMessages: Math.floor(Math.random() * 50) + 10,
                totalCustomers: Math.floor(Math.random() * 200) + 100
            };
        }

        this.updateStatisticsDisplay();
    }

    /**
     * 更新统计数据显示
     */
    updateStatisticsDisplay() {
        const elements = {
            totalConversations: document.getElementById('totalConversations'),
            activeConversations: document.getElementById('activeConversations'),
            unreadMessages: document.getElementById('unreadMessages'),
            totalCustomers: document.getElementById('totalCustomers')
        };

        Object.keys(elements).forEach(key => {
            if (elements[key]) {
                elements[key].textContent = this.stats[key] || 0;
            }
        });
    }

    /**
     * 加载最近活动
     */
    async loadRecentActivity() {
        try {
            // 这里可以调用API获取真实活动数据
            // 暂时使用模拟数据
            this.activities = this.generateMockActivities();
        } catch (error) {
            console.warn('加载活动记录失败，使用模拟数据:', error);
            this.activities = this.generateMockActivities();
        }

        this.updateActivityDisplay();
    }

    /**
     * 生成模拟活动数据
     */
    generateMockActivities() {
        const activities = [
            { type: 'message', text: '收到新消息来自客户 #1234', time: new Date(Date.now() - 5 * 60 * 1000) },
            { type: 'shop', text: '店铺 "测试商店" 状态更新为已激活', time: new Date(Date.now() - 15 * 60 * 1000) },
            { type: 'employee', text: '员工 "张三" 加入店铺团队', time: new Date(Date.now() - 30 * 60 * 1000) },
            { type: 'message', text: '完成对话 #5678 的处理', time: new Date(Date.now() - 45 * 60 * 1000) },
            { type: 'system', text: '系统自动备份完成', time: new Date(Date.now() - 60 * 60 * 1000) }
        ];

        return activities.slice(0, 5); // 只显示最近5条
    }

    /**
     * 更新活动显示
     */
    updateActivityDisplay() {
        const container = document.getElementById('activityList');
        if (!container) return;

        if (this.activities.length === 0) {
            container.innerHTML = `
                <div class="empty-activity">
                    <div class="empty-activity-icon">📋</div>
                    <div class="empty-activity-text">暂无最近活动</div>
                </div>
            `;
            return;
        }

        container.innerHTML = this.activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon activity-${activity.type}">
                    ${this.getActivityIcon(activity.type)}
                </div>
                <div class="activity-content">
                    <div class="activity-text">${activity.text}</div>
                    <div class="activity-time">${this.formatRelativeTime(activity.time)}</div>
                </div>
            </div>
        `).join('');
    }

    /**
     * 获取活动图标
     */
    getActivityIcon(type) {
        const icons = {
            message: '💬',
            shop: '🏪',
            employee: '👥',
            system: '⚙️'
        };
        return icons[type] || '📋';
    }

    /**
     * 格式化相对时间
     */
    formatRelativeTime(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(minutes / 60);

        if (minutes < 1) return '刚刚';
        if (minutes < 60) return `${minutes}分钟前`;
        if (hours < 24) return `${hours}小时前`;
        return date.toLocaleDateString();
    }

    /**
     * 更新系统状态
     */
    async updateSystemStatus() {
        // 更新API状态
        try {
            const response = await fetch('/api/health');
            const apiStatus = document.getElementById('apiStatus');
            if (apiStatus) {
                apiStatus.textContent = response.ok ? '正常' : '异常';
                apiStatus.className = 'status-value ' + (response.ok ? 'status-online' : 'status-offline');
            }
        } catch (error) {
            const apiStatus = document.getElementById('apiStatus');
            if (apiStatus) {
                apiStatus.textContent = '异常';
                apiStatus.className = 'status-value status-offline';
            }
        }

        // 更新数据库状态（这里只是示例）
        const dbStatus = document.getElementById('dbStatus');
        if (dbStatus) {
            dbStatus.textContent = '正常';
            dbStatus.className = 'status-value status-online';
        }
    }

    /**
     * 更新WebSocket状态
     */
    updateWebSocketStatus(status) {
        const wsStatus = document.getElementById('wsStatus');
        if (wsStatus) {
            const statusMap = {
                'connected': { text: '已连接', class: 'status-online' },
                'connecting': { text: '连接中', class: 'status-warning' },
                'disconnected': { text: '未连接', class: 'status-offline' }
            };
            
            const statusInfo = statusMap[status] || { text: '未知', class: 'status-offline' };
            wsStatus.textContent = statusInfo.text;
            wsStatus.className = `status-value ${statusInfo.class}`;
        }
    }

    /**
     * 更新最后更新时间
     */
    updateLastUpdateTime() {
        const element = document.getElementById('lastUpdate');
        if (element && this.lastUpdateTime) {
            element.textContent = this.lastUpdateTime.toLocaleTimeString();
        }
    }

    /**
     * 刷新工作台数据
     */
    async refresh() {
        console.log('刷新工作台数据');
        await this.loadWorkbenchData();
    }

    /**
     * 启动自动刷新
     */
    startAutoRefresh() {
        // 每5分钟自动刷新一次数据
        setInterval(() => {
            const currentPage = document.querySelector('.page.active')?.id;
            if (currentPage === 'workbenchPage') {
                this.refresh();
            }
        }, 5 * 60 * 1000);
    }

    /**
     * 获取认证token
     */
    getAuthToken() {
        return localStorage.getItem('authToken') || '';
    }
}

// 快速操作函数
function quickCreateShop() {
    console.log('快速创建店铺');
    if (typeof showCreateShopModal === 'function') {
        showCreateShopModal();
    } else if (typeof openModal === 'function') {
        openModal('create-shop-modal');
    } else {
        showToast('创建店铺功能开发中...', 'info');
    }
}

function quickViewMessages() {
    console.log('快速查看消息');
    if (typeof showPage === 'function') {
        showPage('messages');
    } else {
        showToast('正在跳转到消息页面...', 'info');
    }
}

function quickManageShops() {
    console.log('快速管理店铺');
    if (typeof showPage === 'function') {
        showPage('shops');
    } else {
        showToast('正在跳转到店铺管理页面...', 'info');
    }
}

function quickViewProfile() {
    console.log('快速查看个人设置');
    if (typeof showPage === 'function') {
        showPage('profile');
    } else {
        showToast('正在跳转到个人设置页面...', 'info');
    }
}

// 创建全局工作台管理器实例
window.workbenchManager = new WorkbenchManager();

// 当DOM加载完成时初始化工作台
document.addEventListener('DOMContentLoaded', () => {
    // 延迟初始化，确保其他模块已加载
    setTimeout(() => {
        if (window.workbenchManager) {
            window.workbenchManager.init();
        }
    }, 1000);
});