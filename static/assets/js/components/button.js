/**
 * Button Component - 按钮组件
 * 提供统一的按钮创建和交互功能
 * 
 * 功能特性:
 * - 多种按钮类型和样式
 * - 加载状态和禁用状态
 * - 图标支持
 * - 点击防抖处理
 * - 无障碍访问支持
 * - 事件系统集成
 */

export class Button {
    constructor(element, options = {}) {
        // 默认配置
        this.defaults = {
            type: 'button', // button, submit, reset
            variant: 'primary', // primary, secondary, success, warning, danger, info
            size: 'medium', // small, medium, large
            disabled: false,
            loading: false,
            icon: null,
            iconPosition: 'left', // left, right
            text: '',
            tooltip: '',
            debounce: 300, // 防抖延迟
            className: '',
            onClick: null,
            onMouseEnter: null,
            onMouseLeave: null
        };
        
        // 合并配置
        this.options = { ...this.defaults, ...options };
        
        // 按钮元素
        this.element = typeof element === 'string' ? document.querySelector(element) : element;
        if (!this.element) {
            throw new Error('Button element not found');
        }
        
        // 状态管理
        this.isLoading = this.options.loading;
        this.isDisabled = this.options.disabled;
        this.originalContent = '';
        this.debounceTimer = null;
        
        // 依赖注入
        this.eventBus = options.eventBus || window.EventBus;
        this.utils = options.utils || window.Utils;
        
        this.init();
    }
    
    /**
     * 初始化按钮
     */
    init() {
        this.saveOriginalContent();
        this.setupButton();
        this.bindEvents();
        this.setupAccessibility();
        
        this.logInfo('Button 组件初始化完成');
    }
    
    /**
     * 保存原始内容
     */
    saveOriginalContent() {
        this.originalContent = this.element.innerHTML;
    }
    
    /**
     * 设置按钮
     */
    setupButton() {
        const { type, variant, size, disabled, className, text, icon } = this.options;
        
        // 设置基础类名
        const classes = ['btn', `btn-${variant}`, `btn-${size}`];
        
        if (className) {
            classes.push(className);
        }
        
        if (this.isLoading) {
            classes.push('btn-loading');
        }
        
        this.element.className = classes.join(' ');
        
        // 设置按钮类型
        this.element.type = type;
        
        // 设置禁用状态
        this.element.disabled = disabled;
        
        // 设置内容
        this.updateContent();
        
        // 设置提示
        if (this.options.tooltip) {
            this.element.title = this.options.tooltip;
        }
    }
    
    /**
     * 更新按钮内容
     */
    updateContent() {
        const { text, icon, iconPosition } = this.options;
        
        if (this.isLoading) {
            this.element.innerHTML = this.createLoadingContent();
            return;
        }
        
        let content = '';
        
        // 添加图标
        if (icon) {
            const iconElement = `<span class="btn-icon btn-icon-${iconPosition}">${icon}</span>`;
            
            if (iconPosition === 'left') {
                content = iconElement + (text ? `<span class="btn-text">${this.escapeHtml(text)}</span>` : '');
            } else {
                content = (text ? `<span class="btn-text">${this.escapeHtml(text)}</span>` : '') + iconElement;
            }
        } else if (text) {
            content = `<span class="btn-text">${this.escapeHtml(text)}</span>`;
        } else {
            content = this.originalContent;
        }
        
        this.element.innerHTML = content;
    }
    
    /**
     * 创建加载状态内容
     */
    createLoadingContent() {
        return `
            <span class="btn-spinner">
                <svg class="spinner" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="31.416" stroke-dashoffset="31.416">
                        <animate attributeName="stroke-dashoffset" dur="2s" values="31.416;0" repeatCount="indefinite"/>
                        <animate attributeName="stroke-dasharray" dur="2s" values="31.416;15.708;31.416" repeatCount="indefinite"/>
                    </circle>
                </svg>
            </span>
            <span class="btn-text">加载中...</span>
        `;
    }
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 点击事件
        this.element.addEventListener('click', (e) => {
            this.handleClick(e);
        });
        
        // 鼠标事件
        this.element.addEventListener('mouseenter', (e) => {
            this.handleMouseEnter(e);
        });
        
        this.element.addEventListener('mouseleave', (e) => {
            this.handleMouseLeave(e);
        });
        
        // 键盘事件
        this.element.addEventListener('keydown', (e) => {
            this.handleKeydown(e);
        });
        
        // 焦点事件
        this.element.addEventListener('focus', () => {
            this.element.classList.add('btn-focused');
        });
        
        this.element.addEventListener('blur', () => {
            this.element.classList.remove('btn-focused');
        });
    }
    
    /**
     * 处理点击事件
     */
    handleClick(e) {
        // 如果按钮被禁用或正在加载，阻止事件
        if (this.isDisabled || this.isLoading) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        
        // 防抖处理
        if (this.options.debounce > 0) {
            if (this.debounceTimer) {
                return; // 忽略重复点击
            }
            
            this.debounceTimer = setTimeout(() => {
                this.debounceTimer = null;
            }, this.options.debounce);
        }
        
        // 添加点击效果
        this.addClickEffect();
        
        // 触发事件
        this.eventBus?.emit('button:click', {
            button: this,
            element: this.element,
            event: e
        });
        
        // 调用回调函数
        if (this.options.onClick && typeof this.options.onClick === 'function') {
            this.options.onClick(e, this);
        }
    }
    
    /**
     * 处理鼠标进入事件
     */
    handleMouseEnter(e) {
        this.element.classList.add('btn-hover');
        
        // 触发事件
        this.eventBus?.emit('button:mouseEnter', {
            button: this,
            element: this.element,
            event: e
        });
        
        if (this.options.onMouseEnter && typeof this.options.onMouseEnter === 'function') {
            this.options.onMouseEnter(e, this);
        }
    }
    
    /**
     * 处理鼠标离开事件
     */
    handleMouseLeave(e) {
        this.element.classList.remove('btn-hover');
        
        // 触发事件
        this.eventBus?.emit('button:mouseLeave', {
            button: this,
            element: this.element,
            event: e
        });
        
        if (this.options.onMouseLeave && typeof this.options.onMouseLeave === 'function') {
            this.options.onMouseLeave(e, this);
        }
    }
    
    /**
     * 处理键盘事件
     */
    handleKeydown(e) {
        // 空格键和回车键触发点击
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            this.handleClick(e);
        }
    }
    
    /**
     * 添加点击效果
     */
    addClickEffect() {
        this.element.classList.add('btn-active');
        
        setTimeout(() => {
            this.element.classList.remove('btn-active');
        }, 150);
        
        // 添加波纹效果
        this.createRippleEffect();
    }
    
    /**
     * 创建波纹效果
     */
    createRippleEffect() {
        const ripple = document.createElement('span');
        ripple.className = 'btn-ripple';
        
        const rect = this.element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (rect.width / 2 - size / 2) + 'px';
        ripple.style.top = (rect.height / 2 - size / 2) + 'px';
        
        this.element.appendChild(ripple);
        
        setTimeout(() => {
            if (ripple.parentNode) {
                ripple.parentNode.removeChild(ripple);
            }
        }, 600);
    }
    
    /**
     * 设置加载状态
     */
    setLoading(loading = true) {
        this.isLoading = loading;
        
        if (loading) {
            this.element.classList.add('btn-loading');
            this.element.disabled = true;
        } else {
            this.element.classList.remove('btn-loading');
            this.element.disabled = this.isDisabled;
        }
        
        this.updateContent();
        
        // 触发事件
        this.eventBus?.emit('button:loadingChange', {
            button: this,
            loading: loading
        });
    }
    
    /**
     * 设置禁用状态
     */
    setDisabled(disabled = true) {
        this.isDisabled = disabled;
        this.element.disabled = disabled || this.isLoading;
        
        if (disabled) {
            this.element.classList.add('btn-disabled');
        } else {
            this.element.classList.remove('btn-disabled');
        }
        
        // 触发事件
        this.eventBus?.emit('button:disabledChange', {
            button: this,
            disabled: disabled
        });
    }
    
    /**
     * 设置文本
     */
    setText(text) {
        this.options.text = text;
        this.updateContent();
    }
    
    /**
     * 设置图标
     */
    setIcon(icon) {
        this.options.icon = icon;
        this.updateContent();
    }
    
    /**
     * 设置变体
     */
    setVariant(variant) {
        // 移除旧的变体类
        this.element.classList.remove(`btn-${this.options.variant}`);
        
        // 添加新的变体类
        this.options.variant = variant;
        this.element.classList.add(`btn-${variant}`);
    }
    
    /**
     * 设置大小
     */
    setSize(size) {
        // 移除旧的大小类
        this.element.classList.remove(`btn-${this.options.size}`);
        
        // 添加新的大小类
        this.options.size = size;
        this.element.classList.add(`btn-${size}`);
    }
    
    /**
     * 设置提示
     */
    setTooltip(tooltip) {
        this.options.tooltip = tooltip;
        this.element.title = tooltip;
    }
    
    /**
     * 触发点击
     */
    click() {
        this.element.click();
    }
    
    /**
     * 聚焦按钮
     */
    focus() {
        this.element.focus();
    }
    
    /**
     * 失去焦点
     */
    blur() {
        this.element.blur();
    }
    
    /**
     * 设置无障碍访问
     */
    setupAccessibility() {
        // 确保按钮有适当的ARIA属性
        if (!this.element.getAttribute('aria-label') && !this.options.text) {
            this.element.setAttribute('aria-label', '按钮');
        }
        
        // 设置角色
        if (this.element.tagName !== 'BUTTON') {
            this.element.setAttribute('role', 'button');
            this.element.setAttribute('tabindex', '0');
        }
        
        // 设置状态
        this.updateAriaStates();
    }
    
    /**
     * 更新ARIA状态
     */
    updateAriaStates() {
        this.element.setAttribute('aria-disabled', String(this.isDisabled));
        
        if (this.isLoading) {
            this.element.setAttribute('aria-busy', 'true');
        } else {
            this.element.removeAttribute('aria-busy');
        }
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
     * 销毁按钮
     */
    destroy() {
        // 清除定时器
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        // 恢复原始内容
        this.element.innerHTML = this.originalContent;
        
        // 移除事件监听器
        this.element.removeEventListener('click', this.handleClick);
        this.element.removeEventListener('mouseenter', this.handleMouseEnter);
        this.element.removeEventListener('mouseleave', this.handleMouseLeave);
        this.element.removeEventListener('keydown', this.handleKeydown);
        
        this.logInfo('Button 已销毁');
    }
    
    /**
     * 记录日志
     */
    logInfo(...args) {
        console.log('[Button]', ...args);
    }
    
    /**
     * 静态方法：创建按钮
     */
    static create(options = {}) {
        const button = document.createElement('button');
        button.type = options.type || 'button';
        
        if (options.text) {
            button.textContent = options.text;
        }
        
        return new Button(button, options);
    }
    
    /**
     * 静态方法：批量初始化按钮
     */
    static initAll(selector = '.btn', options = {}) {
        const buttons = document.querySelectorAll(selector);
        const instances = [];
        
        buttons.forEach(button => {
            const instance = new Button(button, options);
            instances.push(instance);
        });
        
        return instances;
    }
}

// 全局注册
if (typeof window !== 'undefined') {
    window.Button = Button;
}

export default Button;