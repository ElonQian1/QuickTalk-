/**
 * 对话头像和未读消息处理工具模块
 * 作者：GitHub Copilot
 * 日期：2025-09-29
 */

(function(global) {
    'use strict';

    // 头像主题颜色数组
    const AVATAR_THEMES = [
        'theme-blue',
        'theme-green',
        'theme-orange',
        'theme-purple',
        'theme-teal',
        'theme-red'
    ];

    /**
     * 对话工具类
     */
    class ConversationUtils {
        
        /**
         * 根据客户ID生成头像初始字母
         * @param {string} customerId - 客户ID
         * @param {string} customerName - 客户名称（可选）
         * @returns {string} 头像初始字母
         */
        static generateAvatarInitial(customerId, customerName = null) {
            if (customerName && customerName.trim()) {
                // 如果有客户名称，使用名称的第一个字符
                return customerName.trim().charAt(0).toUpperCase();
            }
            
            if (customerId && typeof customerId === 'string') {
                // 尝试从客户ID中提取有意义的字符
                if (customerId.startsWith('user_') || customerId.startsWith('customer_')) {
                    // 提取下划线后的部分
                    const idPart = customerId.split('_')[1];
                    if (idPart && idPart.length > 0) {
                        // 如果是数字，取最后一位数字
                        if (/^\d+$/.test(idPart)) {
                            return idPart.slice(-1);
                        }
                        // 如果包含字母，取第一个字母
                        const firstLetter = idPart.match(/[a-zA-Z]/);
                        if (firstLetter) {
                            return firstLetter[0].toUpperCase();
                        }
                    }
                }
                
                // 使用客户ID的最后一个字符，优先选择字母或数字
                const lastChar = customerId.slice(-1).toUpperCase();
                if (/[A-Z0-9]/.test(lastChar)) {
                    return lastChar;
                }
                
                // 从ID中找到第一个字母或数字
                const match = customerId.match(/[a-zA-Z0-9]/);
                if (match) {
                    return match[0].toUpperCase();
                }
            }
            
            // 默认返回 'C'（Customer）
            return 'C';
        }

        /**
         * 根据客户ID生成一致的头像主题颜色
         * @param {string} customerId - 客户ID
         * @returns {string} 主题颜色类名
         */
        static generateAvatarTheme(customerId) {
            if (!customerId || typeof customerId !== 'string') {
                return AVATAR_THEMES[0]; // 默认蓝色主题
            }
            
            // 使用客户ID的哈希值来确定颜色，确保同一客户始终使用相同颜色
            let hash = 0;
            for (let i = 0; i < customerId.length; i++) {
                const char = customerId.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // 转换为32位整数
            }
            
            const index = Math.abs(hash) % AVATAR_THEMES.length;
            return AVATAR_THEMES[index];
        }

        /**
         * 格式化未读消息数量显示
         * @param {number} count - 未读消息数量
         * @returns {string} 格式化后的数量字符串
         */
        static formatUnreadCount(count) {
            if (!count || count <= 0) {
                return '';
            }
            
            if (count > 99) {
                return '99+';
            }
            
            return count.toString();
        }

        /**
         * 生成完整的头像HTML
         * @param {Object} options - 配置选项
         * @param {string} options.customerId - 客户ID
         * @param {string} options.customerName - 客户名称（可选）
         * @param {number} options.unreadCount - 未读消息数量（可选）
         * @param {string} options.extraClasses - 额外的CSS类（可选）
         * @returns {string} 头像HTML字符串
         */
        static generateAvatarHTML(options = {}) {
            const {
                customerId,
                customerName = null,
                unreadCount = 0,
                extraClasses = ''
            } = options;

            const initial = this.generateAvatarInitial(customerId, customerName);
            const theme = this.generateAvatarTheme(customerId);
            const formattedCount = this.formatUnreadCount(unreadCount);
            
            let badgeHTML = '';
            if (unreadCount > 0) {
                const badgeClasses = unreadCount > 99 ? 'unread-badge large-count' : 'unread-badge';
                badgeHTML = `<div class="${badgeClasses}">${formattedCount}</div>`;
            }

            return `
                <div class="conversation-avatar ${theme} ${extraClasses}">
                    <span class="avatar-text">${initial}</span>
                    ${badgeHTML}
                </div>
            `;
        }

        /**
         * 更新现有头像的未读消息红点
         * @param {HTMLElement} avatarElement - 头像元素
         * @param {number} unreadCount - 未读消息数量
         */
        static updateUnreadBadge(avatarElement, unreadCount) {
            if (!avatarElement) {
                console.warn('ConversationUtils.updateUnreadBadge: avatarElement is null');
                return;
            }

            // 移除现有红点
            const existingBadge = avatarElement.querySelector('.unread-badge');
            if (existingBadge) {
                existingBadge.remove();
            }

            // 添加新红点（如果有未读消息）
            if (unreadCount > 0) {
                const formattedCount = this.formatUnreadCount(unreadCount);
                const badgeClasses = unreadCount > 99 ? 'unread-badge large-count' : 'unread-badge';
                
                const badgeElement = document.createElement('div');
                badgeElement.className = badgeClasses;
                badgeElement.textContent = formattedCount;
                
                avatarElement.appendChild(badgeElement);
            }
        }

        /**
         * 批量更新对话列表中的未读消息红点
         * @param {Array} conversations - 对话数据数组
         * @param {string} containerSelector - 容器选择器
         */
        static updateConversationUnreadBadges(conversations, containerSelector = '#conversationsList') {
            const container = document.querySelector(containerSelector);
            if (!container) {
                console.warn(`ConversationUtils.updateConversationUnreadBadges: Container ${containerSelector} not found`);
                return;
            }

            conversations.forEach(conv => {
                const conversationItem = container.querySelector(`[data-conversation-id="${conv.id}"]`);
                if (conversationItem) {
                    const avatarElement = conversationItem.querySelector('.conversation-avatar');
                    if (avatarElement) {
                        this.updateUnreadBadge(avatarElement, conv.unread_count || 0);
                    }
                }
            });
        }

        /**
         * 格式化客户名称显示
         * @param {string} customerId - 客户ID
         * @param {string} customerName - 客户名称（可选）
         * @returns {string} 格式化后的客户名称
         */
        static formatCustomerName(customerId, customerName = null) {
            if (customerName && customerName.trim()) {
                return customerName.trim();
            }
            
            if (customerId && typeof customerId === 'string') {
                // 生成客户编号
                if (customerId.startsWith('user_') || customerId.startsWith('customer_')) {
                    const idPart = customerId.split('_')[1];
                    if (idPart) {
                        return `客户 ${idPart.slice(-6).toUpperCase()}`;
                    }
                }
                
                // 使用客户ID的最后6位
                const shortId = customerId.slice(-6).toUpperCase();
                return `客户 ${shortId}`;
            }
            
            return '匿名客户';
        }

        /**
         * 获取对话项是否有未读消息的CSS类
         * @param {number} unreadCount - 未读消息数量
         * @returns {string} CSS类名
         */
        static getUnreadClass(unreadCount) {
            return unreadCount > 0 ? 'has-unread' : '';
        }
    }

    // 导出到全局
    global.ConversationUtils = ConversationUtils;

    // 如果支持模块化，也导出模块
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ConversationUtils;
    }

})(typeof window !== 'undefined' ? window : global);

// 初始化时的一些工具函数（向后兼容）
window.generateCustomerAvatar = function(customerId, customerName, unreadCount = 0) {
    return window.ConversationUtils.generateAvatarHTML({
        customerId,
        customerName,
        unreadCount
    });
};

window.updateUnreadBadge = function(avatarElement, unreadCount) {
    return window.ConversationUtils.updateUnreadBadge(avatarElement, unreadCount);
};

window.formatCustomerName = function(customerId, customerName) {
    return window.ConversationUtils.formatCustomerName(customerId, customerName);
};