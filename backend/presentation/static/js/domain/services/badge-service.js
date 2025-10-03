/**
 * 红点领域服务
 * 处理红点显示逻辑和状态管理
 * 
 * @author GitHub Copilot
 * @version 1.0
 * @date 2025-10-03
 */

class BadgeDomainService {
    constructor(dependencies = {}) {
        this.eventBus = dependencies.eventBus || window.eventBus;
        this.logger = dependencies.logger || window.logger;
        
        // 红点状态存储
        this.badges = new Map();
        this.aggregations = new Map(); // 聚合红点（如导航栏总数）
        
        // 订阅相关事件
        this._subscribeToEvents();
    }

    /**
     * 创建或更新红点
     */
    updateBadge(target, count, metadata = {}) {
        if (!target) {
            throw new Error('红点目标不能为空');
        }

        const normalizedCount = Math.max(0, parseInt(count) || 0);
        const oldBadge = this.badges.get(target);
        const oldCount = oldBadge ? oldBadge.count : 0;

        const badge = {
            target,
            count: normalizedCount,
            isVisible: normalizedCount > 0,
            lastUpdated: new Date().toISOString(),
            metadata: { ...metadata }
        };

        this.badges.set(target, badge);

        // 发布红点更新事件
        this.eventBus.emit(window.APP_CONSTANTS.EVENTS.BADGE_UPDATE, {
            target,
            oldCount,
            newCount: normalizedCount,
            isVisible: badge.isVisible,
            metadata
        });

        this.logger.debug('BadgeService', 
            `红点已更新: ${target} (${oldCount} -> ${normalizedCount})`);

        // 更新聚合红点
        this._updateAggregations(target, oldCount, normalizedCount);

        return badge;
    }

    /**
     * 获取红点信息
     */
    getBadge(target) {
        return this.badges.get(target) || null;
    }

    /**
     * 获取红点数量
     */
    getBadgeCount(target) {
        const badge = this.badges.get(target);
        return badge ? badge.count : 0;
    }

    /**
     * 检查红点是否可见
     */
    isBadgeVisible(target) {
        const badge = this.badges.get(target);
        return badge ? badge.isVisible : false;
    }

    /**
     * 清除红点
     */
    clearBadge(target) {
        const badge = this.badges.get(target);
        if (!badge || badge.count === 0) {
            return false;
        }

        const oldCount = badge.count;
        this.updateBadge(target, 0);

        this.eventBus.emit(window.APP_CONSTANTS.EVENTS.BADGE_CLEAR, {
            target,
            clearedCount: oldCount
        });

        this.logger.info('BadgeService', `红点已清除: ${target} (${oldCount})`);
        return true;
    }

    /**
     * 增加红点数量
     */
    incrementBadge(target, increment = 1, metadata = {}) {
        const currentCount = this.getBadgeCount(target);
        const newCount = currentCount + increment;
        return this.updateBadge(target, newCount, metadata);
    }

    /**
     * 减少红点数量
     */
    decrementBadge(target, decrement = 1, metadata = {}) {
        const currentCount = this.getBadgeCount(target);
        const newCount = Math.max(0, currentCount - decrement);
        return this.updateBadge(target, newCount, metadata);
    }

    /**
     * 批量更新红点
     */
    batchUpdateBadges(updates) {
        const results = [];
        
        updates.forEach(update => {
            try {
                const result = this.updateBadge(
                    update.target, 
                    update.count, 
                    update.metadata
                );
                results.push({ success: true, target: update.target, result });
            } catch (error) {
                results.push({ 
                    success: false, 
                    target: update.target, 
                    error: error.message 
                });
                this.logger.error('BadgeService', 
                    `批量更新红点失败: ${update.target}`, error);
            }
        });

        this.logger.info('BadgeService', 
            `批量更新完成: ${results.filter(r => r.success).length}/${results.length}`);

        return results;
    }

    /**
     * 创建聚合红点
     */
    createAggregation(name, targets, options = {}) {
        const aggregation = {
            name,
            targets: [...targets],
            options: {
                maxDisplay: options.maxDisplay || 99,
                hideWhenZero: options.hideWhenZero !== false,
                ...options
            },
            count: 0,
            lastUpdated: new Date().toISOString()
        };

        this.aggregations.set(name, aggregation);
        this._recalculateAggregation(name);

        this.logger.info('BadgeService', 
            `聚合红点已创建: ${name} (目标: ${targets.join(', ')})`);

        return aggregation;
    }

    /**
     * 获取聚合红点信息
     */
    getAggregation(name) {
        return this.aggregations.get(name) || null;
    }

    /**
     * 获取所有红点状态
     */
    getAllBadges() {
        const badges = {};
        this.badges.forEach((badge, target) => {
            badges[target] = { ...badge };
        });
        return badges;
    }

    /**
     * 获取所有聚合红点状态
     */
    getAllAggregations() {
        const aggregations = {};
        this.aggregations.forEach((agg, name) => {
            aggregations[name] = { ...agg };
        });
        return aggregations;
    }

    /**
     * 获取红点统计
     */
    getStats() {
        let totalBadges = 0;
        let visibleBadges = 0;
        let totalCount = 0;

        this.badges.forEach(badge => {
            totalBadges++;
            if (badge.isVisible) {
                visibleBadges++;
                totalCount += badge.count;
            }
        });

        return {
            totalBadges,
            visibleBadges,
            totalCount,
            aggregations: this.aggregations.size
        };
    }

    /**
     * 清理所有红点
     */
    clearAllBadges() {
        const clearedCount = this.badges.size;
        this.badges.clear();
        this.aggregations.clear();

        this.eventBus.emit('badges.cleared', { clearedCount });
        this.logger.info('BadgeService', `已清理所有红点 (${clearedCount} 个)`);
    }

    /**
     * 订阅相关事件
     * @private
     */
    _subscribeToEvents() {
        // 监听消息接收事件
        this.eventBus.on(window.APP_CONSTANTS.EVENTS.MESSAGE_RECEIVED, (data) => {
            this._handleMessageReceived(data);
        });

        // 监听对话选择事件
        this.eventBus.on(window.APP_CONSTANTS.EVENTS.CONVERSATION_SELECTED, (data) => {
            this._handleConversationSelected(data);
        });
    }

    /**
     * 处理消息接收事件
     * @private
     */
    _handleMessageReceived(data) {
        const { conversationId, messageId } = data;
        
        // 增加对话红点
        this.incrementBadge(`conversation_${conversationId}`, 1, {
            messageId,
            type: 'message_received'
        });

        // 获取对话所属的店铺，增加店铺红点
        // 这里需要从其他服务获取店铺信息
        // 暂时使用事件驱动的方式
        this.eventBus.emit('badge.message.received', {
            conversationId,
            messageId
        });
    }

    /**
     * 处理对话选择事件
     * @private
     */
    _handleConversationSelected(data) {
        const { conversationId } = data;
        
        // 清除对话红点
        this.clearBadge(`conversation_${conversationId}`);
    }

    /**
     * 更新聚合红点
     * @private
     */
    _updateAggregations(changedTarget, oldCount, newCount) {
        this.aggregations.forEach((aggregation, name) => {
            if (aggregation.targets.includes(changedTarget)) {
                this._recalculateAggregation(name);
            }
        });
    }

    /**
     * 重新计算聚合红点
     * @private
     */
    _recalculateAggregation(name) {
        const aggregation = this.aggregations.get(name);
        if (!aggregation) return;

        let totalCount = 0;
        aggregation.targets.forEach(target => {
            totalCount += this.getBadgeCount(target);
        });

        const oldCount = aggregation.count;
        aggregation.count = Math.min(totalCount, aggregation.options.maxDisplay);
        aggregation.lastUpdated = new Date().toISOString();

        // 发布聚合红点更新事件
        this.eventBus.emit('aggregation.updated', {
            name,
            oldCount,
            newCount: aggregation.count,
            isVisible: !aggregation.options.hideWhenZero || aggregation.count > 0
        });

        this.logger.debug('BadgeService', 
            `聚合红点已更新: ${name} (${oldCount} -> ${aggregation.count})`);
    }
}

// 注册到模块系统
window.registerModule('BadgeDomainService', BadgeDomainService, ['EventBus']);

console.log('🔴 红点领域服务已初始化');