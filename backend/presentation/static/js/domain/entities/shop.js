/**
 * 店铺实体
 * 封装店铺的业务逻辑和统计信息
 * 
 * @author GitHub Copilot
 * @version 1.0
 * @date 2025-10-03
 */

class Shop {
    constructor(data = {}) {
        this.id = data.id || null;
        this.name = data.name || '';
        this.domain = data.domain || '';
        this.ownerId = data.ownerId || null;
        this.ownerName = data.ownerName || '';
        this.status = data.status || 'active';
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
        
        // 统计信息
        this.stats = {
            totalConversations: data.totalConversations || 0,
            activeConversations: data.activeConversations || 0,
            unreadMessages: data.unreadMessages || 0,
            totalMessages: data.totalMessages || 0,
            lastActivityTime: data.lastActivityTime || null
        };

        // 配置信息
        this.config = {
            allowGuestChat: data.allowGuestChat !== false,
            autoReply: data.autoReply || false,
            workingHours: data.workingHours || null,
            maxConcurrentChats: data.maxConcurrentChats || 10
        };

        // 事件存储
        this.events = [];
    }

    /**
     * 更新店铺名称
     */
    updateName(newName) {
        if (!newName || !newName.trim()) {
            throw new Error('店铺名称不能为空');
        }

        const oldName = this.name;
        this.name = newName.trim();
        this.updatedAt = new Date().toISOString();

        this.events.push({
            type: 'shop.name.updated',
            data: { shopId: this.id, oldName, newName: this.name },
            timestamp: new Date().toISOString()
        });

        window.log.info('Shop', `店铺 ${this.id} 名称已更新: ${oldName} -> ${this.name}`);
    }

    /**
     * 更新域名
     */
    updateDomain(newDomain) {
        if (!newDomain || !newDomain.trim()) {
            throw new Error('域名不能为空');
        }

        // 简单的域名格式验证
        if (!newDomain.includes('.') || newDomain.includes(' ')) {
            throw new Error('域名格式不正确');
        }

        const oldDomain = this.domain;
        this.domain = newDomain.trim().toLowerCase();
        this.updatedAt = new Date().toISOString();

        this.events.push({
            type: 'shop.domain.updated',
            data: { shopId: this.id, oldDomain, newDomain: this.domain },
            timestamp: new Date().toISOString()
        });

        window.log.info('Shop', `店铺 ${this.id} 域名已更新: ${oldDomain} -> ${this.domain}`);
    }

    /**
     * 更新统计信息
     */
    updateStats(newStats) {
        const oldStats = { ...this.stats };
        this.stats = { ...this.stats, ...newStats };
        this.updatedAt = new Date().toISOString();

        // 检查是否有新的未读消息
        if (newStats.unreadMessages && newStats.unreadMessages > oldStats.unreadMessages) {
            this.events.push({
                type: window.APP_CONSTANTS.EVENTS.BADGE_UPDATE,
                data: { 
                    shopId: this.id, 
                    oldCount: oldStats.unreadMessages,
                    newCount: newStats.unreadMessages
                },
                timestamp: new Date().toISOString()
            });
        }

        // 更新最后活动时间
        if (newStats.lastActivityTime) {
            this.stats.lastActivityTime = newStats.lastActivityTime;
        }

        window.log.debug('Shop', `店铺 ${this.id} 统计信息已更新`);
    }

    /**
     * 增加未读消息数
     */
    incrementUnreadMessages(count = 1) {
        const oldCount = this.stats.unreadMessages;
        this.stats.unreadMessages += count;
        this.stats.lastActivityTime = new Date().toISOString();
        this.updatedAt = new Date().toISOString();

        this.events.push({
            type: window.APP_CONSTANTS.EVENTS.BADGE_UPDATE,
            data: { 
                shopId: this.id, 
                oldCount,
                newCount: this.stats.unreadMessages,
                increment: count
            },
            timestamp: new Date().toISOString()
        });

        window.log.debug('Shop', `店铺 ${this.id} 未读消息数增加 ${count} (总计: ${this.stats.unreadMessages})`);
    }

    /**
     * 清除未读消息数
     */
    clearUnreadMessages() {
        const oldCount = this.stats.unreadMessages;
        if (oldCount > 0) {
            this.stats.unreadMessages = 0;
            this.updatedAt = new Date().toISOString();

            this.events.push({
                type: window.APP_CONSTANTS.EVENTS.BADGE_CLEAR,
                data: { shopId: this.id, clearedCount: oldCount },
                timestamp: new Date().toISOString()
            });

            window.log.debug('Shop', `店铺 ${this.id} 未读消息已清除 (${oldCount} 条)`);
        }
    }

    /**
     * 更新配置
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.updatedAt = new Date().toISOString();

        this.events.push({
            type: 'shop.config.updated',
            data: { shopId: this.id, config: newConfig },
            timestamp: new Date().toISOString()
        });

        window.log.info('Shop', `店铺 ${this.id} 配置已更新`);
    }

    /**
     * 检查是否在工作时间
     */
    isInWorkingHours() {
        if (!this.config.workingHours) {
            return true; // 没有设置工作时间，默认为总是可用
        }

        const now = new Date();
        const currentHour = now.getHours();
        const { start, end } = this.config.workingHours;

        return currentHour >= start && currentHour < end;
    }

    /**
     * 检查是否可以接受新对话
     */
    canAcceptNewChat() {
        return this.status === 'active' && 
               this.stats.activeConversations < this.config.maxConcurrentChats;
    }

    /**
     * 获取活跃度评分
     */
    getActivityScore() {
        if (!this.stats.lastActivityTime) {
            return 0;
        }

        const lastActivity = new Date(this.stats.lastActivityTime);
        const now = new Date();
        const diffHours = (now - lastActivity) / (1000 * 60 * 60);

        // 24小时内活跃度最高，之后逐渐降低
        if (diffHours < 1) return 100;
        if (diffHours < 6) return 80;
        if (diffHours < 24) return 60;
        if (diffHours < 72) return 40;
        return 20;
    }

    /**
     * 获取并清理事件
     */
    pullEvents() {
        const events = [...this.events];
        this.events = [];
        return events;
    }

    /**
     * 转为纯数据对象
     */
    toData() {
        return {
            id: this.id,
            name: this.name,
            domain: this.domain,
            ownerId: this.ownerId,
            ownerName: this.ownerName,
            status: this.status,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            stats: { ...this.stats },
            config: { ...this.config }
        };
    }

    /**
     * 从数据创建实例
     */
    static fromData(data) {
        return new Shop(data);
    }
}

// 注册到模块系统
window.registerModule('Shop', Shop);

console.log('🏪 店铺实体已初始化');