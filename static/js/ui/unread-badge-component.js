/**
 * 未读消息红点组件
 * 模块化设计，用于替换传统的 shop-status 按钮
 * 
 * @author GitHub Copilot
 * @version 1.0
 * @date 2025-09-29
 */

class UnreadBadgeComponent {
    constructor(options = {}) {
        this.options = {
            // 默认配置
            size: 'medium', // 'small', 'medium', 'large'
            position: 'top-right', // 'top-right', 'top-left', 'bottom-right', 'bottom-left', 'inline'
            animation: true, // 是否开启动画
            maxCount: 99, // 最大显示数量
            autoHide: false, // 当计数为0时是否自动隐藏
            showZero: false, // 是否显示0
            clickable: false, // 是否可点击
            ...options
        };
        
        this.count = 0;
        this.element = null;
        this.isDebugMode = false;
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
        if (this.isDebugMode) {
            console.log('🔴 UnreadBadge:', ...args);
        }
    }

    /**
     * 创建红点元素
     * @param {string} containerId - 容器ID或选择器
     * @returns {HTMLElement} 红点元素
     */
    create(containerId) {
        const container = typeof containerId === 'string' 
            ? document.querySelector(containerId) || document.getElementById(containerId)
            : containerId;

        if (!container) {
            throw new Error(`容器未找到: ${containerId}`);
        }

        // 检查是否已存在红点元素
        let existingBadge = container.querySelector('.unread-badge-component');
        if (existingBadge) {
            this.element = existingBadge;
            this.debug('使用现有红点元素');
            return this.element;
        }

        // 创建新的红点元素
        this.element = document.createElement('div');
        this.element.className = this._generateClasses();
        this.element.setAttribute('data-component', 'unread-badge');
        this.element.setAttribute('data-count', '0');

        // 添加点击事件（如果启用）
        if (this.options.clickable) {
            this.element.style.cursor = 'pointer';
            this.element.addEventListener('click', this._handleClick.bind(this));
        }

        // 根据位置决定插入方式
        if (this.options.position === 'inline') {
            container.appendChild(this.element);
        } else {
            // 确保容器具有相对定位
            if (getComputedStyle(container).position === 'static') {
                container.style.position = 'relative';
            }
            container.appendChild(this.element);
        }

        this.debug('创建红点元素', this.element);
        return this.element;
    }

    /**
     * 更新红点数量
     * @param {number} count - 未读数量
     * @returns {UnreadBadgeComponent} this
     */
    updateCount(count) {
        const newCount = Math.max(0, parseInt(count) || 0);
        const oldCount = this.count;
        this.count = newCount;

        if (!this.element) {
            this.debug('红点元素不存在，跳过更新');
            return this;
        }

        // 更新数据属性
        this.element.setAttribute('data-count', newCount);

        // 更新显示文本
        if (newCount > 0) {
            const displayText = newCount > this.options.maxCount 
                ? `${this.options.maxCount}+` 
                : newCount.toString();
            this.element.textContent = displayText;
            this.element.style.display = 'flex';
            
            // 添加新消息动画
            if (this.options.animation && newCount > oldCount) {
                this._playNewMessageAnimation();
            }
        } else {
            this.element.textContent = this.options.showZero ? '0' : '';
            
            if (this.options.autoHide && newCount === 0) {
                this.element.style.display = 'none';
            } else if (this.options.showZero) {
                this.element.style.display = 'flex';
            } else {
                // 显示空的小红点
                this.element.style.display = 'flex';
            }
        }

        this.debug(`更新数量: ${oldCount} -> ${newCount}`);
        return this;
    }

    /**
     * 增加计数
     * @param {number} increment - 增加的数量
     * @returns {UnreadBadgeComponent} this
     */
    increment(increment = 1) {
        return this.updateCount(this.count + increment);
    }

    /**
     * 减少计数
     * @param {number} decrement - 减少的数量
     * @returns {UnreadBadgeComponent} this
     */
    decrement(decrement = 1) {
        return this.updateCount(this.count - decrement);
    }

    /**
     * 清零
     * @returns {UnreadBadgeComponent} this
     */
    clear() {
        return this.updateCount(0);
    }

    /**
     * 销毁红点元素
     */
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
            this.element = null;
            this.debug('销毁红点元素');
        }
        return this;
    }

    /**
     * 设置点击回调
     * @param {function} callback - 点击回调函数
     * @returns {UnreadBadgeComponent} this
     */
    onClick(callback) {
        this.clickCallback = callback;
        return this;
    }

    /**
     * 生成CSS类名
     * @private
     */
    _generateClasses() {
        const classes = ['unread-badge-component'];
        
        // 尺寸类
        classes.push(`size-${this.options.size}`);
        
        // 位置类
        classes.push(`position-${this.options.position}`);
        
        // 动画类
        if (this.options.animation) {
            classes.push('animated');
        }

        return classes.join(' ');
    }

    /**
     * 处理点击事件
     * @private
     */
    _handleClick(event) {
        event.stopPropagation();
        this.debug('红点被点击');
        
        if (typeof this.clickCallback === 'function') {
            this.clickCallback(this.count, this.element);
        }
    }

    /**
     * 播放新消息动画
     * @private
     */
    _playNewMessageAnimation() {
        if (!this.element) return;

        this.element.classList.add('bounce-animation');
        
        setTimeout(() => {
            if (this.element) {
                this.element.classList.remove('bounce-animation');
            }
        }, 600);
    }

    /**
     * 静态方法：为多个元素创建红点
     * @param {string} selector - CSS选择器
     * @param {object} options - 配置选项
     * @returns {Array<UnreadBadgeComponent>} 红点组件数组
     */
    static createForElements(selector, options = {}) {
        const elements = document.querySelectorAll(selector);
        const badges = [];

        elements.forEach((element, index) => {
            try {
                const badge = new UnreadBadgeComponent({
                    ...options,
                    debugId: `${selector}-${index}`
                });
                badge.create(element);
                badges.push(badge);
            } catch (error) {
                console.warn(`创建红点失败 (${selector}[${index}]):`, error);
            }
        });

        return badges;
    }

    /**
     * 静态方法：创建内联红点（替换按钮文本）
     * @param {string} containerId - 容器ID
     * @param {object} options - 配置选项
     * @returns {UnreadBadgeComponent} 红点组件
     */
    static createInline(containerId, options = {}) {
        return new UnreadBadgeComponent({
            ...options,
            position: 'inline'
        }).create(containerId);
    }
}

// CSS样式注入
const injectUnreadBadgeCSS = () => {
    if (document.getElementById('unread-badge-component-styles')) {
        return; // 已注入
    }

    const style = document.createElement('style');
    style.id = 'unread-badge-component-styles';
    style.textContent = `
        /* 未读消息红点组件样式 */
        .unread-badge-component {
            background: #ff4757;
            color: white;
            border-radius: 50%;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: system-ui, -apple-system, sans-serif;
            line-height: 1;
            user-select: none;
            border: 2px solid white;
            box-shadow: 0 2px 8px rgba(255, 71, 87, 0.3);
        }

        /* 尺寸变体 */
        .unread-badge-component.size-small {
            min-width: 14px;
            height: 14px;
            font-size: 8px;
        }

        .unread-badge-component.size-medium {
            min-width: 18px;
            height: 18px;
            font-size: 10px;
        }

        .unread-badge-component.size-large {
            min-width: 24px;
            height: 24px;
            font-size: 12px;
        }

        /* 位置变体 */
        .unread-badge-component.position-top-right {
            position: absolute;
            top: -8px;
            right: -8px;
            z-index: 10;
        }

        .unread-badge-component.position-top-left {
            position: absolute;
            top: -8px;
            left: -8px;
            z-index: 10;
        }

        .unread-badge-component.position-bottom-right {
            position: absolute;
            bottom: -8px;
            right: -8px;
            z-index: 10;
        }

        .unread-badge-component.position-bottom-left {
            position: absolute;
            bottom: -8px;
            left: -8px;
            z-index: 10;
        }

        .unread-badge-component.position-inline {
            position: static;
            display: inline-flex;
            margin-left: 8px;
        }

        /* 动画效果 */
        .unread-badge-component.animated {
            animation: unread-pulse 2s infinite;
            transition: all 0.3s ease;
        }

        .unread-badge-component.bounce-animation {
            animation: unread-bounce 0.6s ease;
        }

        @keyframes unread-pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }

        @keyframes unread-bounce {
            0% { transform: scale(1); }
            20% { transform: scale(1.2); }
            50% { transform: scale(1.1); }
            80% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }

        /* 空状态样式 */
        .unread-badge-component:empty {
            min-width: 8px;
            height: 8px;
        }

        /* 可点击状态 */
        .unread-badge-component[style*="cursor: pointer"]:hover {
            background: #ff3742;
            transform: scale(1.1);
        }
    `;

    document.head.appendChild(style);
};

// 自动注入CSS
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectUnreadBadgeCSS);
} else {
    injectUnreadBadgeCSS();
}

// 导出到全局
window.UnreadBadgeComponent = UnreadBadgeComponent;