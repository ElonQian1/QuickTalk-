/**
 * 导航红点管理器
 * 专门处理底部导航栏(nav-item)的红点显示和交互逻辑
 * 确保红点只在点击conversation-item时消失，而不是点击nav-item本身
 * 
 * @author GitHub Copilot
 * @version 1.1
 * @date 2025-10-03
 */

// 使用模块加载器防止重复声明，并添加幂等防护
window.ModuleLoader = window.ModuleLoader || { defineClass: (name, fn) => fn() };
if (window.__NavBadgeManagerLoaded) {
    console.log('ℹ️ NavBadgeManager 已加载，跳过重复初始化');
} else {
    window.__NavBadgeManagerLoaded = true;

// 先定义类
class NavBadgeManager {
    constructor() {
        this.__version = '1.1.0';
        this.isDebugMode = false; // 兼容旧逻辑
        this.ns = 'navBadge';
        this.navBadges = new Map(); // 存储各个导航项的红点状态
        this.conversationListeners = new Map(); // 存储conversation-item事件监听器
        // 调试追踪结构
        if (!window.__QT_BADGE_DEBUG) {
            window.__QT_BADGE_DEBUG = { history: [], push(entry){ this.history.push(entry); if (this.history.length>120) this.history.shift(); } };
        }
        
        this.debug('导航红点管理器初始化完成');
        this.setupEventListeners();
        this._subscribeUnreadAggregator();
        // 读回执本地事件: 若当前有未读, 直接触发清零 (带允许原因)
        const readEvt = (window.Events && window.Events.Events.CONVERSATION.READ_LOCAL) || 'conversation.read.local';
        document.addEventListener(readEvt, (e)=>{
            const cur = this.getBadgeCount('messages');
            if (cur>0) {
                // 直接允许清零, 设置强制标志绕过防闪烁一次
                window.__QT_FORCE_BADGE_CLEAR = true;
                this.updateNavBadge('messages', 0);
                setTimeout(()=>{ window.__QT_FORCE_BADGE_CLEAR = false; }, 50);
                this.debug('会话本地已读 -> 清零导航未读');
            }
        });
    }

    /**
     * 开启调试模式
     */
    enableDebug() {
        this.isDebugMode = true;
        return this;
    }

    /**
     * 调试日志
     */
    debug(...args) {
        if (window.QT_LOG) {
            window.QT_LOG.debug(this.ns, ...args);
        } else if (this.isDebugMode) {
            console.log('🧭 NavBadgeManager:', ...args);
        }
    }

    /**
     * 设置全局事件监听器
     */
    setupEventListeners() {
        // 监听导航项点击事件（阻止红点直接消失）
        document.addEventListener('click', (event) => {
            const navItem = event.target.closest('.nav-item');
            if (navItem) {
                this.handleNavItemClick(navItem, event);
            }
        });

        // 监听对话项点击事件（这时才清除红点）
        document.addEventListener('click', (event) => {
            const conversationItem = event.target.closest('.conversation-item');
            if (conversationItem) {
                this.handleConversationItemClick(conversationItem, event);
            }
        });

        // 监听页面切换事件
        document.addEventListener('pageChange', (event) => {
            this.handlePageChange(event.detail);
        });

        this.debug('事件监听器设置完成');
    }

    _subscribeUnreadAggregator(){
        document.addEventListener('unread:update', (e)=>{
            const detail = e.detail || {};
            const total = detail.total || 0;
            const reason = detail.reason || '';
            // 记录最后一次 unread:update 原因
            this.__lastUnreadUpdate = { ts: Date.now(), total, reason };
            // 当 reason = incoming-message 且 total=0 时，可能是聚合尚未及时统计到刚刚自增的本地未读，避免把已有红点清零
            if (detail.reason === 'incoming-message' && total === 0) {
                this.debug('忽略 unread:update (reason=incoming-message & total=0) 以避免闪烁');
                return;
            }
            // 额外保护：若当前已有非零计数，而本次 total=0 且没有明确刷新/清除原因，则忽略
            if (total === 0) {
                const current = this.getBadgeCount('messages');
                const allowReasons = ['refresh','sync','recount','clear','manual-clear'];
                if (current > 0 && (!detail.reason || !allowReasons.includes(detail.reason))) {
                    this.debug('忽略 unread:update (total=0 无明确原因, 保留当前计数=', current, ')');
                    return;
                }
            }
            // Hysteresis: 对 total=0 延迟隐藏，给后续增量一个窗口，避免先 0 后 +N 闪烁
            if (total === 0) {
                // 若已有计划隐藏，重新计时即可
                clearTimeout(this.__pendingHideTimer);
                const delay = (window.QT_CONFIG && window.QT_CONFIG.badgeHideDelay) ? window.QT_CONFIG.badgeHideDelay : 1500;
                this.__pendingHideTimer = setTimeout(()=>{
                    // 窗口期内若出现了新的未读或增量，则放弃隐藏
                    const cur = this.getBadgeCount('messages');
                    if (cur > 0) {
                        this.debug('延迟隐藏放弃，期间出现新未读 cur=', cur);
                        return;
                    }
                    this.updateNavBadge('messages', 0);
                    this.debug('延迟隐藏执行 (reason=', reason, ')');
                }, delay);
                this.debug('计划延迟隐藏 messages badge, delay=', delay, 'ms reason=', reason);
            } else {
                // 有正向未读：取消待执行隐藏
                clearTimeout(this.__pendingHideTimer);
                this.__pendingHideTimer = null;
                this.updateNavBadge('messages', total);
                this.debug('收到 unread:update 事件 -> messages =', total, 'reason=', detail.reason);
            }
        });
        // 高水位策略：若存在 highwater 事件，则使用其 total 覆盖低估值
        document.addEventListener('unread:highwater', (e)=>{
            const d = e.detail||{};
            const high = d.total||0;
            const current = this.getBadgeCount('messages');
            if (high>current) {
                clearTimeout(this.__pendingHideTimer);
                this.updateNavBadge('messages', high);
                this.debug('高水位覆盖 ->', high);
            }
        });
    }

    /**
     * 处理导航项点击事件
     */
    handleNavItemClick(navItem, event) {
        const page = navItem.getAttribute('data-page');
        const badge = navItem.querySelector('.nav-badge');
        
        this.debug(`导航项被点击: ${page}`, navItem);
        
        // 阻止红点立即消失 - 只是切换页面，不清除红点
        if (badge && !badge.classList.contains('hidden')) {
            this.debug(`保持 ${page} 页面红点显示，等待用户查看具体对话`);
            // 不清除红点，让用户在对应页面中点击具体对话项时再清除
        }
        
        // 更新当前活动页面
        this.setActivePage(page);
    }

    /**
     * 处理对话项点击事件
     */
    handleConversationItemClick(conversationItem, event) {
        const conversationId = conversationItem.getAttribute('data-conversation-id');
        const shopId = conversationItem.getAttribute('data-shop-id');
        
        this.debug(`对话项被点击: ${conversationId}, 店铺: ${shopId}`, conversationItem);
        
        // 这时才清除相关的红点
        this.clearRelevantBadges(conversationId, shopId);
    }

    /**
     * 设置活动页面
     */
    setActivePage(page) {
        // 更新导航项的active状态
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeItem = document.querySelector(`[data-page="${page}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
            this.debug(`切换到页面: ${page}`);
        }
    }

    /**
     * 处理页面切换事件
     */
    handlePageChange(pageInfo) {
        this.debug('页面切换事件:', pageInfo);
        
        if (pageInfo && pageInfo.page) {
            this.setActivePage(pageInfo.page);
        }
    }

    /**
     * 更新导航红点数量
     */
    updateNavBadge(navPage, count) {
        const navItem = document.querySelector(`[data-page="${navPage}"]`);
        if (!navItem) {
            this.debug(`未找到导航项: ${navPage}`);
            return false;
        }

        const badge = navItem.querySelector('.nav-badge');
        if (!badge) {
            this.debug(`导航项 ${navPage} 没有红点元素`);
            return false;
        }

        const newCount = Math.max(0, parseInt(count) || 0);
        
        // 更新红点显示
        // 反闪烁：若尝试隐藏(=0)且距离上次正向变为>0 时间过短且无允许原因，则忽略
        if (newCount === 0) {
            const now = Date.now();
            this.__lastBadgeMeta = this.__lastBadgeMeta || {};
            const meta = this.__lastBadgeMeta[navPage] || {}; // {lastRaiseTs, lastCount}
            const elapsed = meta.lastRaiseTs ? now - meta.lastRaiseTs : Infinity;
            // 允许立刻清零的理由（事件监听层已做原因过滤，这里兜底）
            const allowImmediate = (window.__QT_FORCE_BADGE_CLEAR === true);
            if (meta.lastCount > 0 && elapsed < 1200 && !allowImmediate) {
                this.debug(`忽略过快隐藏 (elapsed=${elapsed}ms <1200ms) 保持 ${meta.lastCount}`);
                return true; // 不执行隐藏
            }
        }

        if (newCount > 0) {
            // 正常显示红点
            badge.textContent = newCount > 99 ? '99+' : newCount.toString();
            badge.classList.remove('hidden');
            badge.removeAttribute('data-zero');
            this.debug(`更新导航红点: ${navPage} -> ${newCount}`);
        } else {
            // 归零：确保真正隐藏并清空文本，防止残留或 :empty 伪内容错误显示
            badge.textContent = '';
            badge.classList.add('hidden');
            badge.setAttribute('data-zero','true');
            this.debug(`隐藏导航红点: ${navPage}`);
        }

        // 记录状态
        this.navBadges.set(navPage, newCount);
        // 记录元数据，用于反闪烁判定
        this.__lastBadgeMeta = this.__lastBadgeMeta || {};
        if (!this.__lastBadgeMeta[navPage]) this.__lastBadgeMeta[navPage] = {};
        if (newCount > 0) {
            this.__lastBadgeMeta[navPage].lastRaiseTs = Date.now();
            this.__lastBadgeMeta[navPage].lastCount = newCount;
        } else {
            this.__lastBadgeMeta[navPage].lastHideTs = Date.now();
        }
        try { window.__QT_BADGE_DEBUG.push({ t: Date.now(), page: navPage, count: newCount, stack: (new Error()).stack.split('\n').slice(1,4).join(' | ') }); } catch(_){ }
        return true;
    }

    /**
     * 清除相关的红点
     */
    clearRelevantBadges(conversationId, shopId) {
        // 清除消息页面的红点（当用户查看了具体对话）
        this.updateNavBadge('messages', 0);
        
        // 如果有店铺相关的红点，也可以考虑清除
        if (shopId && window.shopCardManager) {
            window.shopCardManager.updateShopBadge(shopId, 0).catch(error => {
                console.warn(`清除店铺红点失败 (${shopId}):`, error);
            });
        }
        
        this.debug(`清除相关红点: 对话 ${conversationId}, 店铺 ${shopId}`);
        
        // 触发自定义事件
        document.dispatchEvent(new CustomEvent('badgeCleared', {
            detail: { conversationId, shopId, clearedBy: 'conversation-click' }
        }));
    }

    /**
     * 获取指定导航页面的红点数量
     */
    getBadgeCount(navPage) {
        return this.navBadges.get(navPage) || 0;
    }

    /**
     * 批量更新所有导航红点
     */
    updateAllNavBadges(badgeCounts) {
        Object.entries(badgeCounts).forEach(([page, count]) => {
            this.updateNavBadge(page, count);
        });
        
        this.debug('批量更新导航红点完成:', badgeCounts);
    }

    /**
     * 重置所有红点
     */
    resetAllBadges() {
        this.navBadges.forEach((count, page) => {
            this.updateNavBadge(page, 0);
        });
        this.navBadges.clear();
        this.debug('所有导航红点已重置');
    }

    /**
     * 快速初始化方法
     */
    static quickInit(options = {}) {
        const manager = new NavBadgeManager();
        
        if (options.debug) {
            manager.enableDebug();
        }
        
        // 等待DOM加载完成后进行初始化
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                manager.debug('DOM加载完成，导航红点管理器准备就绪');
            });
        } else {
            manager.debug('导航红点管理器已准备就绪');
        }
        
        return manager;
    }
}

// 使用旧模块系统注册
window.ModuleLoader.defineClass('NavBadgeManager', function() {
    return NavBadgeManager;
});

// 注册到新的模块系统
if (window.registerModule) {
    window.registerModule('NavBadgeManager', NavBadgeManager, ['UnifiedDataSyncManager']);
}

// 向后兼容
window.NavBadgeManager = NavBadgeManager;
console.log('📍 导航徽章管理器已加载');
console.log('✅ NavBadgeManager 已加载');
}