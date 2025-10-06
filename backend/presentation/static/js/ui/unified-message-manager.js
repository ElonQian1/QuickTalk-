/**
 * 统一消息管理系统
 * 整合并替代重复的消息相关模块
 * 
 * 替代的模块:
 * - message-actions.js (消息操作菜单)
 * - message-bubble.js (消息气泡渲染) 
 * - message-media.js (媒体文件渲染) - 与unified-ui-components.js重复
 * 
 * 依赖:
 * - UIBase (继承标准化能力)
 * - UnifiedUIComponents (复用媒体渲染功能)
 * 
 * @author GitHub Copilot
 * @version 1.0
 * @date 2025-10-06
 */

class UnifiedMessageManager extends UIBase {
    constructor(options = {}) {
        super();
        
        this.options = {
            // 操作菜单配置
            enableActions: true,
            enableCopy: true,
            enableDelete: false,
            enableForward: false,
            
            // 气泡配置
            showAvatars: true,
            defaultAvatarText: { customer: 'C', agent: 'A' },
            
            // 媒体配置
            enableImagePreview: true,
            maxMediaWidth: '100%',
            
            ...options
        };

        // 组件引用
        this.actionsMenu = null;
        this.mediaRenderer = null;
        
        this.init();
    }

    init() {
        this.log('info', '统一消息管理系统初始化');
        
        // 初始化操作菜单
        if (this.options.enableActions) {
            this.initActionMenu();
        }
        
        // 绑定事件
        this.bindEvents();
    }

    /**
     * 初始化操作菜单
     */
    initActionMenu() {
        this.actionsMenu = this.ensureContainer('qt-message-actions', {
            styles: {
                position: 'fixed',
                left: '0',
                top: '0',
                width: '100vw',
                height: '100vh',
                display: 'none',
                zIndex: '9998'
            }
        });

        // 创建遮罩和面板
        const mask = this.createElement('div', {
            className: 'mask',
            styles: {
                position: 'absolute',
                inset: '0',
                background: 'rgba(0,0,0,.2)'
            }
        });

        const panel = this.createElement('div', {
            className: 'panel',
            styles: {
                position: 'absolute',
                minWidth: '160px',
                background: '#fff',
                borderRadius: '12px',
                boxShadow: '0 10px 30px rgba(0,0,0,.18)',
                padding: '8px'
            }
        });

        this.actionsMenu.appendChild(mask);
        this.actionsMenu.appendChild(panel);

        // 绑定关闭事件
        this.addEventListener(mask, 'click', () => this.hideActionMenu());
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 消息长按事件（移动端）
        this.addEventListener(document, 'contextmenu', (e) => {
            const messageElement = e.target.closest('.chat-message');
            if (messageElement) {
                e.preventDefault();
                this.showActionMenu(e.clientX, e.clientY, { messageElement });
            }
        });

        // 消息双击事件（桌面端）
        this.addEventListener(document, 'dblclick', (e) => {
            const messageElement = e.target.closest('.chat-message');
            if (messageElement && this.options.enableCopy) {
                this.copyMessageText(messageElement);
            }
        });
    }

    /**
     * 创建消息气泡
     * 整合自message-bubble.js
     */
    createMessageBubble(message, context = {}) {
        const isCustomer = message.sender_type === 'customer';
        
        const wrap = this.createElement('div', {
            className: `chat-message ${isCustomer ? 'customer' : 'agent'}`,
            attributes: {
                'data-message-id': message.id,
                'data-sender-type': message.sender_type
            }
        });

        // 创建头像
        if (this.options.showAvatars) {
            const avatarText = isCustomer
                ? (context.currentCustomerName ? context.currentCustomerName.charAt(0) : this.options.defaultAvatarText.customer)
                : this.options.defaultAvatarText.agent;

            const avatar = this.createElement('div', {
                className: 'message-avatar',
                textContent: avatarText
            });
            wrap.appendChild(avatar);
        }

        // 创建气泡容器
        const bubble = this.createElement('div', {
            className: 'message-bubble'
        });

        // 添加文本内容
        if (message.content && String(message.content).trim()) {
            const textDiv = this.createElement('div', {
                className: 'message-text',
                textContent: message.content
            });
            bubble.appendChild(textDiv);
        }

        // 添加媒体文件
        if (Array.isArray(message.files) && message.files.length > 0) {
            message.files.forEach(file => {
                const mediaElement = this.createMediaElement(file);
                if (mediaElement) {
                    bubble.appendChild(mediaElement);
                }
            });
        }

        // 添加时间戳
        if (message.created_at) {
            const timeDiv = this.createElement('div', {
                className: 'message-time',
                textContent: this.formatMessageTime(message.created_at)
            });
            bubble.appendChild(timeDiv);
        }

        wrap.appendChild(bubble);
        return wrap;
    }

    /**
     * 创建媒体元素
     * 复用unified-ui-components.js的功能，避免重复
     */
    createMediaElement(file) {
        // 直接使用已重构的unified-ui-components.js中的功能
        if (window.UnifiedUIComponents && window.UnifiedUIComponents.MessageMediaUI) {
            return window.UnifiedUIComponents.MessageMediaUI.createMediaElement(file);
        }
        
        // 回退方案：简单的文件显示
        this.log('warn', 'UnifiedUIComponents未加载，使用回退方案');
        return this.createElement('div', {
            className: 'message-file-fallback',
            textContent: `文件: ${file.name || '未知文件'}`
        });
    }

    /**
     * 显示操作菜单
     */
    showActionMenu(x, y, options = {}) {
        if (!this.actionsMenu) {
            this.log('warn', '操作菜单未初始化');
            return;
        }

        const panel = this.actionsMenu.querySelector('.panel');
        if (!panel) return;

        // 清空现有内容
        panel.innerHTML = '';

        // 生成菜单项
        const menuItems = this.getMenuItems(options);
        menuItems.forEach(item => {
            const itemElement = this.createElement('div', {
                className: 'item',
                textContent: item.label,
                styles: {
                    padding: '10px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#334155'
                }
            });

            // 添加悬停效果
            this.addEventListener(itemElement, 'mouseenter', () => {
                itemElement.style.background = '#f1f5f9';
            });
            this.addEventListener(itemElement, 'mouseleave', () => {
                itemElement.style.background = '';
            });

            // 添加点击事件
            this.addEventListener(itemElement, 'click', () => {
                this.hideActionMenu();
                this.handleMenuAction(item.key, options);
            });

            panel.appendChild(itemElement);
        });

        // 定位面板
        this.positionActionMenu(panel, x, y);
        
        // 显示菜单
        this.actionsMenu.style.display = 'block';
    }

    /**
     * 隐藏操作菜单
     */
    hideActionMenu() {
        if (this.actionsMenu) {
            this.actionsMenu.style.display = 'none';
        }
    }

    /**
     * 获取菜单项配置
     */
    getMenuItems(options) {
        const items = [];

        if (this.options.enableCopy) {
            items.push({ key: 'copy', label: '复制文本' });
        }

        if (this.options.enableDelete) {
            items.push({ key: 'delete', label: '删除消息' });
        }

        if (this.options.enableForward) {
            items.push({ key: 'forward', label: '转发消息' });
        }

        return items;
    }

    /**
     * 处理菜单操作
     */
    handleMenuAction(action, options) {
        const { messageElement } = options;

        switch (action) {
            case 'copy':
                this.copyMessageText(messageElement);
                break;
            case 'delete':
                this.deleteMessage(messageElement);
                break;
            case 'forward':
                this.forwardMessage(messageElement);
                break;
            default:
                this.log('warn', '未知的菜单操作:', action);
        }
    }

    /**
     * 复制消息文本
     */
    copyMessageText(messageElement) {
        if (!messageElement) return;

        const textElement = messageElement.querySelector('.message-text');
        if (!textElement) {
            this.showToast('无文本内容可复制', 'info');
            return;
        }

        const text = textElement.textContent;
        
        // 使用统一剪贴板工具
        if (window.UnifiedClipboard) {
            window.UnifiedClipboard.copyText(text, {
                successMessage: '消息已复制到剪贴板',
                errorMessage: '复制失败，请手动复制'
            });
        } else {
            this.log('warn', 'UnifiedClipboard未加载，请检查依赖');
            this.showToast('复制功能不可用', 'error');
        }
    }

    /**
     * 删除消息（占位实现）
     */
    deleteMessage(messageElement) {
        this.log('info', '删除消息功能待实现');
        this.showToast('删除功能暂未实现', 'info');
    }

    /**
     * 转发消息（占位实现）
     */
    forwardMessage(messageElement) {
        this.log('info', '转发消息功能待实现');
        this.showToast('转发功能暂未实现', 'info');
    }

    /**
     * 定位操作菜单
     */
    positionActionMenu(panel, x, y) {
        const rect = panel.getBoundingClientRect();
        const viewport = { width: window.innerWidth, height: window.innerHeight };

        // 调整位置避免超出屏幕
        let left = x;
        let top = y;

        if (left + rect.width > viewport.width) {
            left = viewport.width - rect.width - 10;
        }

        if (top + rect.height > viewport.height) {
            top = y - rect.height - 10;
        }

        panel.style.left = `${Math.max(10, left)}px`;
        panel.style.top = `${Math.max(10, top)}px`;
    }

    /**
     * 格式化消息时间
     */
    formatMessageTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));

        if (diffMins < 1) return '刚刚';
        if (diffMins < 60) return `${diffMins}分钟前`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}小时前`;
        
        return date.toLocaleDateString();
    }

    /**
     * 显示提示消息
     */
    showToast(message, type = 'info') {
        if (window.UnifiedNotification) {
            window.UnifiedNotification.notify(type, message);
        } else {
            // 简单回退
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    /**
     * 批量创建消息
     */
    createMessageList(messages, context = {}) {
        const fragment = document.createDocumentFragment();
        
        messages.forEach(message => {
            const bubble = this.createMessageBubble(message, context);
            fragment.appendChild(bubble);
        });

        return fragment;
    }

    /**
     * 销毁管理器
     */
    destroy() {
        // 隐藏菜单
        this.hideActionMenu();
        
        // 清理组件
        if (this.actionsMenu && this.actionsMenu.parentNode) {
            this.actionsMenu.parentNode.removeChild(this.actionsMenu);
        }

        // 调用父类销毁
        super.destroy();

        this.log('info', '统一消息管理系统已销毁');
    }
}

// 全局单例
window.UnifiedMessageManager = UnifiedMessageManager;

// 兼容性：提供旧API接口
window.MessageBubbleUI = {
    create: (message, context) => {
        if (!window.unifiedMessageManager) {
            window.unifiedMessageManager = new UnifiedMessageManager();
        }
        return window.unifiedMessageManager.createMessageBubble(message, context);
    }
};

// 自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.unifiedMessageManager = new UnifiedMessageManager();
    });
} else {
    window.unifiedMessageManager = new UnifiedMessageManager();
}

console.log('✅ 统一消息管理系统已加载 (UnifiedMessageManager)');