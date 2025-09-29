/**
 * 显示修复器
 * 专门修复shop-stat和last-message显示问题
 * 
 * @author GitHub Copilot
 * @version 2.0
 * @date 2025-09-29
 */

class DisplayFixer {
    constructor() {
        this.fixAttempts = 0;
        this.maxFixAttempts = 5;
        this.isDebugMode = false;
        this.observers = [];
        this.fixedElements = new Set();
    }

    isRealId(id) {
        if (!id || typeof id !== 'string') return false;
        return /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(id);
    }

    /**
     * 开启调试模式
     */
    enableDebugMode() {
        this.isDebugMode = true;
        console.log('🔧 DisplayFixer: 调试模式已开启');
    }

    /**
     * 调试日志
     */
    debug(...args) {
        if (this.isDebugMode) {
            console.log('🔧 DisplayFixer:', ...args);
        }
    }

    /**
     * 初始化显示修复器
     */
    initialize() {
        this.debug('初始化显示修复器');
        
        // 立即修复现有元素
        this.fixAllExistingElements();
        
        // 设置DOM观察器
        this.setupDOMObserver();
        
        // 设置定期检查
        this.startPeriodicCheck();
        
        return this;
    }

    /**
     * 修复所有现有元素
     */
    fixAllExistingElements() {
        this.debug('开始修复所有现有元素');
        
        // 修复shop-stat元素
        this.fixShopStatElements();
        
        // 修复last-message元素
        this.fixLastMessageElements();
        
        // 修复message-time元素
        this.fixMessageTimeElements();
        
        this.debug('现有元素修复完成');
    }

    /**
     * 修复shop-stat元素
     */
    fixShopStatElements() {
        const shopStatElements = document.querySelectorAll('.shop-stat');
        this.debug(`发现 ${shopStatElements.length} 个shop-stat元素`);
        
        shopStatElements.forEach((element, index) => {
            try {
                this.fixSingleShopStat(element, index);
            } catch (error) {
                this.debug(`修复shop-stat元素 ${index} 失败:`, error);
            }
        });
    }

    /**
     * 修复单个shop-stat元素
     */
    fixSingleShopStat(element, index) {
        // 检查元素结构
        const valueElement = element.querySelector('.shop-stat-value');
        const labelElement = element.querySelector('.shop-stat-label');
        
        if (!valueElement || !labelElement) {
            this.debug(`shop-stat元素 ${index} 结构不完整`);
            return;
        }

        // 确保有正确的 data-shop-id：优先使用最近的真实UUID
        let shopId = element.getAttribute('data-shop-id');
        if (!this.isRealId(shopId)) {
            const shopCard = element.closest('.shop-card, [data-shop-id]');
            const parentId = shopCard ? shopCard.getAttribute('data-shop-id') : null;
            if (this.isRealId(parentId)) {
                shopId = parentId;
                element.setAttribute('data-shop-id', shopId);
                this.debug(`为shop-stat元素 ${index} 纠正为真实shop-id: ${shopId}`);
            }
        }

        // 确保有data-stat-type属性
        const label = labelElement.textContent.trim();
        if (!element.getAttribute('data-stat-type')) {
            element.setAttribute('data-stat-type', label);
            this.debug(`为shop-stat元素 ${index} 添加stat-type: ${label}`);
        }

        // 添加修复标记
        element.setAttribute('data-fixed', 'true');
        this.fixedElements.add(`shop-stat-${index}`);

        // 如果有shop-id，尝试刷新数据
        if (shopId && window.DataSyncManager) {
            window.DataSyncManager.queueUpdate('shop', shopId);
        }

        this.debug(`shop-stat元素 ${index} 修复完成`, {
            shopId,
            label,
            currentValue: valueElement.textContent
        });
    }

    /**
     * 修复last-message元素
     */
    fixLastMessageElements() {
        const lastMessageElements = document.querySelectorAll('.last-message');
        this.debug(`发现 ${lastMessageElements.length} 个last-message元素`);
        
        lastMessageElements.forEach((element, index) => {
            try {
                this.fixSingleLastMessage(element, index);
            } catch (error) {
                this.debug(`修复last-message元素 ${index} 失败:`, error);
            }
        });
    }

    /**
     * 修复单个last-message元素
     */
    fixSingleLastMessage(element, index) {
        // 确保有data-conversation-id属性
        let conversationId = element.getAttribute('data-conversation-id');
        if (!conversationId) {
            // 尝试从父元素获取
            const conversationItem = element.closest('.conversation-item, [data-conversation-id]');
            if (conversationItem) {
                conversationId = conversationItem.getAttribute('data-conversation-id');
                if (conversationId) {
                    element.setAttribute('data-conversation-id', conversationId);
                    this.debug(`为last-message元素 ${index} 添加conversation-id: ${conversationId}`);
                }
            }
        }

        // 添加CSS类确保样式正确
        if (!element.classList.contains('last-message')) {
            element.classList.add('last-message');
        }

        // 添加修复标记
        element.setAttribute('data-fixed', 'true');
        this.fixedElements.add(`last-message-${index}`);

        // 如果内容为空或默认值，尝试从数据中获取
        const currentText = element.textContent.trim();
        if (!currentText || currentText === '等待客户消息...') {
            if (conversationId && window.DataSyncManager) {
                window.DataSyncManager.queueUpdate('conversation', conversationId);
            }
        }

        this.debug(`last-message元素 ${index} 修复完成`, {
            conversationId,
            currentText
        });
    }

    /**
     * 修复message-time元素
     */
    fixMessageTimeElements() {
        const messageTimeElements = document.querySelectorAll('.message-time');
        this.debug(`发现 ${messageTimeElements.length} 个message-time元素`);
        
        messageTimeElements.forEach((element, index) => {
            try {
                this.fixSingleMessageTime(element, index);
            } catch (error) {
                this.debug(`修复message-time元素 ${index} 失败:`, error);
            }
        });
    }

    /**
     * 修复单个message-time元素
     */
    fixSingleMessageTime(element, index) {
        // 确保有data-conversation-id属性
        let conversationId = element.getAttribute('data-conversation-id');
        if (!conversationId) {
            // 尝试从父元素获取
            const conversationItem = element.closest('.conversation-item, [data-conversation-id]');
            if (conversationItem) {
                conversationId = conversationItem.getAttribute('data-conversation-id');
                if (conversationId) {
                    element.setAttribute('data-conversation-id', conversationId);
                    this.debug(`为message-time元素 ${index} 添加conversation-id: ${conversationId}`);
                }
            }
        }

        // 添加CSS类确保样式正确
        if (!element.classList.contains('message-time')) {
            element.classList.add('message-time');
        }

        // 添加修复标记
        element.setAttribute('data-fixed', 'true');
        this.fixedElements.add(`message-time-${index}`);

        this.debug(`message-time元素 ${index} 修复完成`, {
            conversationId,
            currentText: element.textContent
        });
    }

    /**
     * 设置DOM观察器
     */
    setupDOMObserver() {
        if (!window.MutationObserver) {
            this.debug('浏览器不支持MutationObserver');
            return;
        }

        const observer = new MutationObserver((mutations) => {
            let needsFix = false;
            
            mutations.forEach((mutation) => {
                // 检查新添加的节点
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // 检查是否包含需要修复的元素
                        if (this.needsFixing(node)) {
                            needsFix = true;
                        }
                    }
                });
                
                // 检查属性变化
                if (mutation.type === 'attributes' && mutation.target) {
                    if (this.needsFixing(mutation.target)) {
                        needsFix = true;
                    }
                }
            });
            
            if (needsFix) {
                // 延迟修复，确保DOM稳定
                setTimeout(() => {
                    this.fixAllExistingElements();
                }, 100);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-shop-id', 'data-conversation-id', 'class']
        });

        this.observers.push(observer);
        this.debug('DOM观察器已设置');
    }

    /**
     * 检查元素是否需要修复
     */
    needsFixing(element) {
        if (!element || !element.classList) return false;
        
        // 检查是否是需要修复的元素类型
        const needsFixingClasses = ['shop-stat', 'last-message', 'message-time'];
        const hasTargetClass = needsFixingClasses.some(cls => element.classList.contains(cls));
        
        if (hasTargetClass) {
            return !element.getAttribute('data-fixed');
        }
        
        // 检查子元素
        const hasTargetChildren = needsFixingClasses.some(cls => 
            element.querySelector && element.querySelector(`.${cls}:not([data-fixed])`)
        );
        
        return hasTargetChildren;
    }

    /**
     * 开始定期检查
     */
    startPeriodicCheck() {
        // 每5秒检查一次未修复的元素
        setInterval(() => {
            this.checkAndFixUnfixedElements();
        }, 5000);
        
        // 每30秒强制刷新数据
        setInterval(() => {
            this.forceRefreshAllData();
        }, 30000);
        
        this.debug('定期检查已启动');
    }

    /**
     * 检查并修复未修复的元素
     */
    checkAndFixUnfixedElements() {
        const unfixedShopStats = document.querySelectorAll('.shop-stat:not([data-fixed])');
        const unfixedLastMessages = document.querySelectorAll('.last-message:not([data-fixed])');
        const unfixedMessageTimes = document.querySelectorAll('.message-time:not([data-fixed])');
        
        const totalUnfixed = unfixedShopStats.length + unfixedLastMessages.length + unfixedMessageTimes.length;
        
        if (totalUnfixed > 0) {
            this.debug(`发现 ${totalUnfixed} 个未修复元素，开始修复`);
            this.fixAllExistingElements();
        }
    }

    /**
     * 强制刷新所有数据
     */
    async forceRefreshAllData() {
        this.debug('开始强制刷新所有数据');
        
        if (window.DataSyncManager) {
            try {
                await window.DataSyncManager.refreshAllVisibleShops();
                await window.DataSyncManager.refreshAllVisibleConversations();
                this.debug('数据刷新完成');
            } catch (error) {
                this.debug('数据刷新失败:', error);
            }
        }
    }

    /**
     * 手动触发修复
     */
    manualFix() {
        this.debug('手动触发修复');
        this.fixAllExistingElements();
        this.forceRefreshAllData();
    }

    /**
     * 获取修复状态
     */
    getFixStatus() {
        const totalShopStats = document.querySelectorAll('.shop-stat').length;
        const fixedShopStats = document.querySelectorAll('.shop-stat[data-fixed]').length;
        const totalLastMessages = document.querySelectorAll('.last-message').length;
        const fixedLastMessages = document.querySelectorAll('.last-message[data-fixed]').length;
        const totalMessageTimes = document.querySelectorAll('.message-time').length;
        const fixedMessageTimes = document.querySelectorAll('.message-time[data-fixed]').length;
        
        return {
            shopStats: { total: totalShopStats, fixed: fixedShopStats },
            lastMessages: { total: totalLastMessages, fixed: fixedLastMessages },
            messageTimes: { total: totalMessageTimes, fixed: fixedMessageTimes },
            fixedElementsCount: this.fixedElements.size,
            isDebugMode: this.isDebugMode
        };
    }

    /**
     * 停止所有观察器
     */
    destroy() {
        this.observers.forEach(observer => observer.disconnect());
        this.observers = [];
        this.fixedElements.clear();
        this.debug('显示修复器已销毁');
    }
}

// 创建全局实例
window.DisplayFixer = new DisplayFixer();

// 向后兼容函数
window.fixDisplayElements = function() {
    return window.DisplayFixer.manualFix();
};

window.getDisplayFixStatus = function() {
    return window.DisplayFixer.getFixStatus();
};

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DisplayFixer;
}