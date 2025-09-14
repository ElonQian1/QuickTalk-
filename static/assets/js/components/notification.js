/**
 * Notification Component - 通知组件
 * 提供统一的通知和提示功能
 * 
 * 功能特性:
 * - 多种通知类型（成功、错误、警告、信息）
 * - 自动关闭和手动关闭
 * - 堆叠管理
 * - 位置控制
 * - 动画效果
 * - 操作按钮
 * - 进度条
 * - 无障碍访问支持
 */

export class Notification {
    constructor(options = {}) {
        // 默认配置
        this.defaults = {
            type: 'info', // success, error, warning, info
            title: '',
            message: '',
            duration: 5000, // 0 表示不自动关闭
            position: 'top-right', // top-left, top-right, bottom-left, bottom-right, top-center, bottom-center
            showIcon: true,
            showClose: true,
            showProgress: false,
            persistent: false, // 是否持久显示
            actions: [], // 操作按钮
            className: '',
            onShow: null,
            onHide: null,
            onClick: null,
            onAction: null
        };
        
        // 合并配置
        this.options = { ...this.defaults, ...options };
        
        // 状态管理
        this.element = null;
        this.timer = null;
        this.progressTimer = null;
        this.visible = false;
        this.destroyed = false;
        
        // 依赖注入
        this.eventBus = options.eventBus || window.EventBus;
        this.utils = options.utils || window.Utils;
        
        // 生成唯一ID
        this.id = this.generateId();
        
        this.init();
    }
    
    /**
     * 初始化通知
     */
    init() {
        this.createElement();
        this.attachToContainer();
        this.bindEvents();
        this.show();
        
        this.logInfo('Notification 组件初始化完成', this.id);
    }
    
    /**
     * 创建通知元素
     */
    createElement() {
        const { type, title, message, showIcon, showClose, showProgress, className, actions } = this.options;
        
        this.element = document.createElement('div');
        this.element.className = `notification notification-${type} ${className}`.trim();
        this.element.setAttribute('data-notification-id', this.id);
        this.element.setAttribute('role', 'alert');
        this.element.setAttribute('aria-live', 'assertive');
        
        let content = '';
        
        // 图标
        if (showIcon) {
            content += `<div class="notification-icon">${this.getIcon(type)}</div>`;
        }
        
        // 内容区域
        content += '<div class="notification-content">';
        
        // 标题
        if (title) {
            content += `<div class="notification-title">${this.escapeHtml(title)}</div>`;
        }
        
        // 消息
        if (message) {
            content += `<div class="notification-message">${this.escapeHtml(message)}</div>`;
        }
        
        // 操作按钮
        if (actions && actions.length > 0) {
            content += '<div class="notification-actions">';
            actions.forEach((action, index) => {
                const buttonClass = `notification-btn ${action.className || ''}`.trim();
                content += `<button type="button" class="${buttonClass}" data-action-index="${index}">${this.escapeHtml(action.text)}</button>`;
            });
            content += '</div>';
        }
        
        content += '</div>';
        
        // 关闭按钮
        if (showClose) {
            content += '<button type="button" class="notification-close" aria-label="关闭通知">&times;</button>';
        }
        
        // 进度条
        if (showProgress && this.options.duration > 0) {
            content += '<div class="notification-progress"><div class="notification-progress-bar"></div></div>';
        }
        
        this.element.innerHTML = content;
    }
    
    /**
     * 获取图标
     */
    getIcon(type) {
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        
        return icons[type] || icons.info;
    }
    
    /**
     * 附加到容器
     */
    attachToContainer() {
        const container = this.getOrCreateContainer();
        container.appendChild(this.element);
    }
    
    /**
     * 获取或创建容器
     */
    getOrCreateContainer() {
        const position = this.options.position;
        let container = document.querySelector(`.notification-container[data-position="${position}"]`);
        
        if (!container) {
            container = document.createElement('div');
            container.className = 'notification-container';
            container.setAttribute('data-position', position);
            
            // 设置容器样式
            this.setContainerStyles(container, position);
            
            document.body.appendChild(container);
        }
        
        return container;
    }
    
    /**
     * 设置容器样式
     */
    setContainerStyles(container, position) {
        const styles = {
            position: 'fixed',
            zIndex: '9999',
            pointerEvents: 'none',
            padding: '16px'
        };
        
        switch (position) {
            case 'top-left':
                styles.top = '0';
                styles.left = '0';
                break;
            case 'top-right':
                styles.top = '0';
                styles.right = '0';
                break;
            case 'top-center':
                styles.top = '0';
                styles.left = '50%';
                styles.transform = 'translateX(-50%)';
                break;
            case 'bottom-left':
                styles.bottom = '0';
                styles.left = '0';
                break;
            case 'bottom-right':
                styles.bottom = '0';
                styles.right = '0';
                break;
            case 'bottom-center':
                styles.bottom = '0';
                styles.left = '50%';
                styles.transform = 'translateX(-50%)';
                break;
        }
        
        Object.assign(container.style, styles);
    }
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 关闭按钮
        const closeBtn = this.element.querySelector('.notification-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hide();
            });
        }
        
        // 操作按钮
        const actionBtns = this.element.querySelectorAll('[data-action-index]');
        actionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const actionIndex = parseInt(e.target.getAttribute('data-action-index'));
                this.handleAction(actionIndex);
            });
        });
        
        // 点击通知
        this.element.addEventListener('click', (e) => {
            // 如果点击的是按钮，不触发通知点击事件
            if (e.target.tagName === 'BUTTON') {
                return;
            }
            
            this.handleClick();
        });
        
        // 键盘事件
        this.element.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hide();
            }
        });
    }
    
    /**
     * 处理操作按钮点击
     */
    handleAction(actionIndex) {
        const action = this.options.actions[actionIndex];
        if (!action) return;
        
        // 触发事件
        this.eventBus?.emit('notification:action', {
            action: action,
            actionIndex: actionIndex,
            notification: this
        });
        
        // 调用回调
        if (this.options.onAction && typeof this.options.onAction === 'function') {
            this.options.onAction(action, actionIndex, this);
        }
        
        // 调用操作回调
        if (action.handler && typeof action.handler === 'function') {
            action.handler(this);
        }
        
        // 如果操作配置为关闭通知
        if (action.close !== false) {
            this.hide();
        }
    }
    
    /**
     * 处理通知点击
     */
    handleClick() {
        // 触发事件
        this.eventBus?.emit('notification:click', {
            notification: this
        });
        
        // 调用回调
        if (this.options.onClick && typeof this.options.onClick === 'function') {
            this.options.onClick(this);
        }
    }
    
    /**
     * 显示通知
     */
    show() {
        if (this.visible || this.destroyed) return;
        
        this.visible = true;
        this.element.style.pointerEvents = 'auto';
        
        // 添加显示类
        requestAnimationFrame(() => {
            this.element.classList.add('notification-show');
        });
        
        // 设置自动关闭
        this.setAutoClose();
        
        // 开始进度条动画
        this.startProgress();
        
        // 触发事件
        this.eventBus?.emit('notification:show', {
            notification: this
        });
        
        // 调用回调
        if (this.options.onShow && typeof this.options.onShow === 'function') {
            this.options.onShow(this);
        }
        
        this.logInfo('Notification 显示', this.id);
    }
    
    /**
     * 隐藏通知
     */
    hide() {
        if (!this.visible || this.destroyed) return;
        
        this.visible = false;
        this.clearTimers();
        
        // 添加隐藏类
        this.element.classList.remove('notification-show');
        this.element.classList.add('notification-hide');
        
        // 等待动画完成后移除元素
        setTimeout(() => {
            this.destroy();
        }, 300);
        
        // 触发事件
        this.eventBus?.emit('notification:hide', {
            notification: this
        });
        
        // 调用回调
        if (this.options.onHide && typeof this.options.onHide === 'function') {
            this.options.onHide(this);
        }
        
        this.logInfo('Notification 隐藏', this.id);
    }
    
    /**
     * 设置自动关闭
     */
    setAutoClose() {
        const { duration, persistent } = this.options;
        
        if (duration > 0 && !persistent) {
            this.timer = setTimeout(() => {
                this.hide();
            }, duration);
        }
    }
    
    /**
     * 开始进度条动画
     */
    startProgress() {
        const progressBar = this.element.querySelector('.notification-progress-bar');
        if (!progressBar || this.options.duration <= 0) return;
        
        progressBar.style.transition = `width ${this.options.duration}ms linear`;
        
        requestAnimationFrame(() => {
            progressBar.style.width = '0%';
        });
    }
    
    /**
     * 清除定时器
     */
    clearTimers() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        
        if (this.progressTimer) {
            clearTimeout(this.progressTimer);
            this.progressTimer = null;
        }
    }
    
    /**
     * 更新内容
     */
    updateContent(updates = {}) {
        if (this.destroyed) return;
        
        // 更新配置
        Object.assign(this.options, updates);
        
        // 重新创建元素
        const oldElement = this.element;
        this.createElement();
        this.bindEvents();
        
        // 替换元素
        if (oldElement.parentNode) {
            oldElement.parentNode.replaceChild(this.element, oldElement);
        }
        
        // 如果当前是显示状态，重新设置样式
        if (this.visible) {
            this.element.style.pointerEvents = 'auto';
            this.element.classList.add('notification-show');
        }
    }
    
    /**
     * 销毁通知
     */
    destroy() {
        if (this.destroyed) return;
        
        this.destroyed = true;
        this.clearTimers();
        
        // 移除元素
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        // 清理容器（如果为空）
        this.cleanupContainer();
        
        this.logInfo('Notification 已销毁', this.id);
    }
    
    /**
     * 清理空容器
     */
    cleanupContainer() {
        const container = document.querySelector(`.notification-container[data-position="${this.options.position}"]`);
        if (container && container.children.length === 0) {
            container.remove();
        }
    }
    
    /**
     * 生成唯一ID
     */
    generateId() {
        return 'notification-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * HTML转义
     */
    escapeHtml(text) {
        if (this.utils && this.utils.escapeHtml) {
            return this.utils.escapeHtml(text);
        }
        
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * 记录日志
     */
    logInfo(...args) {
        console.log('[Notification]', ...args);
    }
    
    /**
     * 静态方法：显示成功通知
     */
    static success(message, options = {}) {
        return new Notification({
            type: 'success',
            message: message,
            ...options
        });
    }
    
    /**
     * 静态方法：显示错误通知
     */
    static error(message, options = {}) {
        return new Notification({
            type: 'error',
            message: message,
            duration: 0, // 错误通知默认不自动关闭
            ...options
        });
    }
    
    /**
     * 静态方法：显示警告通知
     */
    static warning(message, options = {}) {
        return new Notification({
            type: 'warning',
            message: message,
            ...options
        });
    }
    
    /**
     * 静态方法：显示信息通知
     */
    static info(message, options = {}) {
        return new Notification({
            type: 'info',
            message: message,
            ...options
        });
    }
    
    /**
     * 静态方法：显示确认对话框样式的通知
     */
    static confirm(message, options = {}) {
        const defaultActions = [
            {
                text: '确定',
                className: 'btn-primary',
                handler: options.onConfirm || (() => {})
            },
            {
                text: '取消',
                className: 'btn-default',
                handler: options.onCancel || (() => {})
            }
        ];
        
        return new Notification({
            type: 'info',
            message: message,
            duration: 0,
            persistent: true,
            actions: options.actions || defaultActions,
            ...options
        });
    }
    
    /**
     * 静态方法：显示加载通知
     */
    static loading(message = '加载中...', options = {}) {
        return new Notification({
            type: 'info',
            message: message,
            duration: 0,
            showClose: false,
            persistent: true,
            className: 'notification-loading',
            ...options
        });
    }
    
    /**
     * 静态方法：清除所有通知
     */
    static clearAll(position = null) {
        const selector = position 
            ? `.notification-container[data-position="${position}"] .notification`
            : '.notification';
            
        const notifications = document.querySelectorAll(selector);
        
        notifications.forEach(element => {
            const notificationId = element.getAttribute('data-notification-id');
            if (notificationId) {
                element.classList.remove('notification-show');
                element.classList.add('notification-hide');
                
                setTimeout(() => {
                    if (element.parentNode) {
                        element.parentNode.removeChild(element);
                    }
                }, 300);
            }
        });
        
        // 清理空容器
        setTimeout(() => {
            const containers = position 
                ? document.querySelectorAll(`.notification-container[data-position="${position}"]`)
                : document.querySelectorAll('.notification-container');
                
            containers.forEach(container => {
                if (container.children.length === 0) {
                    container.remove();
                }
            });
        }, 350);
    }
    
    /**
     * 静态方法：获取当前显示的通知数量
     */
    static getCount(position = null) {
        const selector = position 
            ? `.notification-container[data-position="${position}"] .notification`
            : '.notification';
            
        return document.querySelectorAll(selector).length;
    }
}

// 全局注册
if (typeof window !== 'undefined') {
    window.Notification = Notification;
}

export default Notification;