/**
 * DOM增强器
 * 确保DOM元素有正确的data属性以支持实时更新
 * 
 * @author GitHub Copilot
 * @version 1.0
 * @date 2025-09-29
 */

class DOMEnhancer {
    constructor() {
        this.isDebugMode = false;
        this.enhancedElements = new Set();
    }

    /**
     * 开启调试模式
     */
    enableDebugMode() {
        this.isDebugMode = true;
        console.log('🔧 DOMEnhancer: 调试模式已开启');
    }

    /**
     * 调试日志
     */
    debug(...args) {
        if (this.isDebugMode) {
            console.log('🔧 DOMEnhancer:', ...args);
        }
    }

    /**
     * 增强店铺卡片DOM结构
     */
    enhanceShopCard(shopElement, shopData) {
        if (!shopElement || !shopData) return;
        
        const shopId = shopData.id || shopData.shop_id;
        if (!shopId) {
            this.debug('警告：店铺数据缺少ID');
            return;
        }

        // 添加data-shop-id属性
        shopElement.setAttribute('data-shop-id', shopId);
        
        // 确保shop-stat元素结构正确
        const shopStatElements = shopElement.querySelectorAll('.shop-stat');
        shopStatElements.forEach(statElement => {
            const valueElement = statElement.querySelector('.shop-stat-value');
            const labelElement = statElement.querySelector('.shop-stat-label');
            
            if (valueElement && labelElement) {
                const label = labelElement.textContent.trim();
                statElement.setAttribute('data-stat-type', label);
                
                this.debug(`增强shop-stat: ${label}`, {
                    shopId,
                    currentValue: valueElement.textContent
                });
            }
        });

        // 确保shop-status元素存在
        const shopStatusElement = shopElement.querySelector('.shop-status');
        if (shopStatusElement) {
            shopStatusElement.setAttribute('data-shop-id', shopId);
        }

        this.enhancedElements.add(`shop-${shopId}`);
        this.debug(`店铺卡片增强完成: ${shopId}`);
    }

    /**
     * 增强对话项DOM结构
     */
    enhanceConversationItem(conversationElement, conversationData) {
        if (!conversationElement || !conversationData) return;
        
        const conversationId = conversationData.id || conversationData.conversation_id;
        if (!conversationId) {
            this.debug('警告：对话数据缺少ID');
            return;
        }

        // 添加data-conversation-id属性
        conversationElement.setAttribute('data-conversation-id', conversationId);
        
        // 如果有shop_id，也添加上
        if (conversationData.shop_id) {
            conversationElement.setAttribute('data-shop-id', conversationData.shop_id);
        }

        // 增强message-time元素
        const messageTimeElement = conversationElement.querySelector('.message-time');
        if (messageTimeElement) {
            messageTimeElement.setAttribute('data-conversation-id', conversationId);
            
            // 确保显示最新时间
            if (conversationData.last_message_time) {
                const timeText = new Date(conversationData.last_message_time).toLocaleString();
                messageTimeElement.textContent = timeText;
                this.debug(`设置消息时间: ${timeText}`);
            }
        }

        // 增强last-message元素
        const lastMessageElement = conversationElement.querySelector('.last-message');
        if (lastMessageElement) {
            lastMessageElement.setAttribute('data-conversation-id', conversationId);
            
            // 确保显示最新消息
            if (conversationData.last_message) {
                lastMessageElement.textContent = conversationData.last_message;
                this.debug(`设置最后消息: ${conversationData.last_message}`);
            }
        }

        // 增强或创建unread-badge元素
        let unreadBadge = conversationElement.querySelector('.unread-badge');
        const unreadCount = conversationData.unread_count || 0;
        
        if (unreadCount > 0) {
            if (!unreadBadge) {
                unreadBadge = document.createElement('div');
                unreadBadge.className = 'unread-badge';
                conversationElement.appendChild(unreadBadge);
            }
            unreadBadge.textContent = unreadCount;
            unreadBadge.style.display = 'block';
            unreadBadge.setAttribute('data-conversation-id', conversationId);
            this.debug(`设置未读徽章: ${unreadCount}`);
        } else if (unreadBadge) {
            unreadBadge.style.display = 'none';
        }

        this.enhancedElements.add(`conversation-${conversationId}`);
        this.debug(`对话项增强完成: ${conversationId}`);
    }

    /**
     * 批量增强所有现有元素
     */
    enhanceAllExistingElements() {
        this.debug('开始批量增强现有元素');
        
        // 增强店铺卡片
        const shopCards = document.querySelectorAll('.shop-card');
        shopCards.forEach((card, index) => {
            // 尝试从卡片内容中提取店铺信息
            const shopNameElement = card.querySelector('.shop-name');
            const shopDomainElement = card.querySelector('.shop-domain');
            
            if (shopNameElement) {
                // 临时从全局数据中匹配
                if (window.shopsData && window.shopsData.length > index) {
                    this.enhanceShopCard(card, window.shopsData[index]);
                } else {
                    // 创建临时数据结构
                    const tempShopData = {
                        id: `temp-shop-${index}`,
                        name: shopNameElement.textContent,
                        domain: shopDomainElement ? shopDomainElement.textContent : ''
                    };
                    this.enhanceShopCard(card, tempShopData);
                }
            }
        });

        // 增强对话项
        const conversationItems = document.querySelectorAll('.conversation-item');
        conversationItems.forEach((item, index) => {
            const customerNameElement = item.querySelector('.customer-name');
            const lastMessageElement = item.querySelector('.last-message');
            const messageTimeElement = item.querySelector('.message-time');
            
            if (customerNameElement) {
                // 尝试从全局数据中匹配
                if (window.conversationsData && window.conversationsData.length > index) {
                    this.enhanceConversationItem(item, window.conversationsData[index]);
                } else {
                    // 创建临时数据结构
                    const tempConversationData = {
                        id: `temp-conversation-${index}`,
                        customer_name: customerNameElement.textContent,
                        last_message: lastMessageElement ? lastMessageElement.textContent : '',
                        last_message_time: messageTimeElement ? new Date().toISOString() : null,
                        unread_count: 0
                    };
                    this.enhanceConversationItem(item, tempConversationData);
                }
            }
        });

        this.debug(`批量增强完成，共增强 ${this.enhancedElements.size} 个元素`);
    }

    /**
     * 监视DOM变化并自动增强新元素
     */
    startAutoEnhancement() {
        if (!window.MutationObserver) {
            this.debug('浏览器不支持MutationObserver，跳过自动增强');
            return;
        }

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // 检查是否是店铺卡片
                        if (node.classList && node.classList.contains('shop-card')) {
                            this.debug('检测到新的店铺卡片');
                            // 延迟增强，确保内容已填充
                            setTimeout(() => {
                                this.enhanceAllExistingElements();
                            }, 100);
                        }
                        
                        // 检查是否是对话项
                        if (node.classList && node.classList.contains('conversation-item')) {
                            this.debug('检测到新的对话项');
                            setTimeout(() => {
                                this.enhanceAllExistingElements();
                            }, 100);
                        }

                        // 检查子元素
                        const shopCards = node.querySelectorAll ? node.querySelectorAll('.shop-card') : [];
                        const conversationItems = node.querySelectorAll ? node.querySelectorAll('.conversation-item') : [];
                        
                        if (shopCards.length > 0 || conversationItems.length > 0) {
                            this.debug('检测到包含店铺卡片或对话项的容器');
                            setTimeout(() => {
                                this.enhanceAllExistingElements();
                            }, 100);
                        }
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        this.debug('DOM自动增强监视已启动');
        return observer;
    }

    /**
     * 修复现有元素的数据属性
     */
    fixExistingDataAttributes() {
        this.debug('开始修复现有元素的数据属性');
        
        // 修复缺少data-shop-id的店铺相关元素
        const shopStats = document.querySelectorAll('.shop-stat');
        shopStats.forEach((statElement) => {
            const shopCard = statElement.closest('.shop-card');
            if (shopCard && !statElement.hasAttribute('data-shop-id')) {
                const shopId = shopCard.getAttribute('data-shop-id');
                if (shopId) {
                    statElement.setAttribute('data-shop-id', shopId);
                }
            }
        });

        // 修复缺少data-conversation-id的对话相关元素
        const messageTimes = document.querySelectorAll('.message-time');
        const lastMessages = document.querySelectorAll('.last-message');
        
        [...messageTimes, ...lastMessages].forEach((element) => {
            const conversationItem = element.closest('.conversation-item');
            if (conversationItem && !element.hasAttribute('data-conversation-id')) {
                const conversationId = conversationItem.getAttribute('data-conversation-id');
                if (conversationId) {
                    element.setAttribute('data-conversation-id', conversationId);
                }
            }
        });

        this.debug('数据属性修复完成');
    }

    /**
     * 获取增强状态信息
     */
    getEnhancementStatus() {
        return {
            enhancedElementsCount: this.enhancedElements.size,
            enhancedElements: Array.from(this.enhancedElements),
            isDebugMode: this.isDebugMode
        };
    }

    /**
     * 重置增强状态
     */
    reset() {
        this.enhancedElements.clear();
        this.debug('增强状态已重置');
    }
}

// 创建全局实例
window.DOMEnhancer = new DOMEnhancer();

// 向后兼容函数
window.enhanceShopCard = function(element, data) {
    return window.DOMEnhancer.enhanceShopCard(element, data);
};

window.enhanceConversationItem = function(element, data) {
    return window.DOMEnhancer.enhanceConversationItem(element, data);
};

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DOMEnhancer;
}