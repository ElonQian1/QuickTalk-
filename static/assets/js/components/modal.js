/**
 * Modal Component - 模态框组件
 * 提供统一的模态框创建、管理和交互功能
 * 
 * 功能特性:
 * - 支持多种模态框类型（确认、信息、表单、自定义）
 * - 响应式设计，移动端友好
 * - 键盘导航支持（ESC关闭、Tab焦点管理）
 * - 动画效果和过渡
 * - 层级管理，支持嵌套模态框
 * - 事件系统集成
 */

export class Modal {
    constructor(options = {}) {
        // 默认配置
        this.defaults = {
            title: '提示',
            content: '',
            type: 'info', // info, confirm, custom, form
            size: 'medium', // small, medium, large, fullscreen
            closable: true,
            backdrop: true,
            keyboard: true,
            animation: true,
            autoFocus: true,
            className: '',
            zIndex: 1000,
            onShow: null,
            onHide: null,
            onConfirm: null,
            onCancel: null
        };
        
        // 合并配置
        this.options = { ...this.defaults, ...options };
        
        // 状态管理
        this.isVisible = false;
        this.element = null;
        this.backdrop = null;
        this.focusedElementBeforeModal = null;
        
        // 依赖注入
        this.eventBus = options.eventBus || window.EventBus;
        this.utils = options.utils || window.Utils;
        
        // 静态属性管理
        Modal.instances = Modal.instances || [];
        Modal.zIndexCounter = Modal.zIndexCounter || 1000;
        
        this.init();
    }
    
    /**
     * 初始化模态框
     */
    init() {
        this.createElements();
        this.bindEvents();
        this.setupAccessibility();
        
        // 注册实例
        Modal.instances.push(this);
        
        this.logInfo('Modal 组件初始化完成');
    }
    
    /**
     * 创建DOM元素
     */
    createElements() {
        // 创建背景层
        this.backdrop = document.createElement('div');
        this.backdrop.className = 'modal';
        this.backdrop.style.zIndex = this.getNextZIndex();
        
        if (this.options.className) {
            this.backdrop.classList.add(this.options.className);
        }
        
        // 创建模态框内容
        this.element = document.createElement('div');
        this.element.className = `modal-content modal-${this.options.size}`;
        
        // 根据类型创建内容
        this.createContent();
        
        // 组装DOM结构
        this.backdrop.appendChild(this.element);
        
        // 设置动画
        if (this.options.animation) {
            this.backdrop.classList.add('modal-animated');
            this.element.classList.add('modal-content-animated');
        }
    }
    
    /**
     * 创建模态框内容
     */
    createContent() {
        const { type, title, content } = this.options;
        
        let headerHTML = '';
        let bodyHTML = '';
        let footerHTML = '';
        
        // 创建头部
        if (title && this.options.closable) {
            headerHTML = `
                <div class="modal-header">
                    <h3 class="modal-title">${this.escapeHtml(title)}</h3>
                    <button type="button" class="close-btn" aria-label="关闭">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
            `;
        } else if (title) {
            headerHTML = `
                <div class="modal-header">
                    <h3 class="modal-title">${this.escapeHtml(title)}</h3>
                </div>
            `;
        }
        
        // 创建主体内容
        bodyHTML = `<div class="modal-body">${this.createBodyContent()}</div>`;
        
        // 创建底部按钮
        footerHTML = this.createFooter();
        
        // 组装HTML
        this.element.innerHTML = headerHTML + bodyHTML + footerHTML;
    }
    
    /**
     * 创建主体内容
     */
    createBodyContent() {
        const { type, content } = this.options;
        
        switch (type) {
            case 'confirm':
                return `
                    <div class="modal-confirm">
                        <div class="confirm-icon">⚠️</div>
                        <div class="confirm-message">${this.escapeHtml(content)}</div>
                    </div>
                `;
                
            case 'info':
                return `
                    <div class="modal-info">
                        <div class="info-icon">ℹ️</div>
                        <div class="info-message">${this.escapeHtml(content)}</div>
                    </div>
                `;
                
            case 'form':
                return this.createFormContent();
                
            case 'custom':
                return typeof content === 'function' ? content() : content;
                
            default:
                return this.escapeHtml(content);
        }
    }
    
    /**
     * 创建表单内容
     */
    createFormContent() {
        const { formFields = [] } = this.options;
        
        let formHTML = '<form class="modal-form">';
        
        formFields.forEach(field => {
            const { type, name, label, placeholder, required, value } = field;
            const requiredAttr = required ? 'required' : '';
            const requiredMark = required ? '<span class="required">*</span>' : '';
            
            switch (type) {
                case 'text':
                case 'email':
                case 'password':
                case 'tel':
                case 'url':
                    formHTML += `
                        <div class="form-group">
                            <label for="${name}">${this.escapeHtml(label)}${requiredMark}</label>
                            <input type="${type}" id="${name}" name="${name}" 
                                   placeholder="${this.escapeHtml(placeholder || '')}" 
                                   value="${this.escapeHtml(value || '')}" ${requiredAttr}>
                        </div>
                    `;
                    break;
                    
                case 'textarea':
                    formHTML += `
                        <div class="form-group">
                            <label for="${name}">${this.escapeHtml(label)}${requiredMark}</label>
                            <textarea id="${name}" name="${name}" 
                                      placeholder="${this.escapeHtml(placeholder || '')}" ${requiredAttr}>${this.escapeHtml(value || '')}</textarea>
                        </div>
                    `;
                    break;
                    
                case 'select':
                    const { options = [] } = field;
                    let optionsHTML = '';
                    options.forEach(opt => {
                        const selected = opt.value === value ? 'selected' : '';
                        optionsHTML += `<option value="${this.escapeHtml(opt.value)}" ${selected}>${this.escapeHtml(opt.text)}</option>`;
                    });
                    
                    formHTML += `
                        <div class="form-group">
                            <label for="${name}">${this.escapeHtml(label)}${requiredMark}</label>
                            <select id="${name}" name="${name}" ${requiredAttr}>
                                ${optionsHTML}
                            </select>
                        </div>
                    `;
                    break;
                    
                case 'checkbox':
                    const checked = value ? 'checked' : '';
                    formHTML += `
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="${name}" name="${name}" value="1" ${checked} ${requiredAttr}>
                                ${this.escapeHtml(label)}${requiredMark}
                            </label>
                        </div>
                    `;
                    break;
            }
        });
        
        formHTML += '</form>';
        return formHTML;
    }
    
    /**
     * 创建底部按钮
     */
    createFooter() {
        const { type, buttons } = this.options;
        
        if (buttons && Array.isArray(buttons)) {
            // 自定义按钮
            let buttonsHTML = buttons.map(btn => {
                const className = `btn ${btn.className || 'btn-secondary'}`;
                const disabled = btn.disabled ? 'disabled' : '';
                return `<button type="button" class="${className}" data-action="${btn.action}" ${disabled}>${this.escapeHtml(btn.text)}</button>`;
            }).join('');
            
            return `<div class="modal-footer">${buttonsHTML}</div>`;
        }
        
        // 默认按钮
        switch (type) {
            case 'confirm':
                return `
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-action="cancel">取消</button>
                        <button type="button" class="btn btn-primary" data-action="confirm">确认</button>
                    </div>
                `;
                
            case 'form':
                return `
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-action="cancel">取消</button>
                        <button type="button" class="btn btn-primary" data-action="submit">提交</button>
                    </div>
                `;
                
            case 'info':
                return `
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" data-action="confirm">确定</button>
                    </div>
                `;
                
            default:
                return '';
        }
    }
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 背景点击关闭
        if (this.options.backdrop) {
            this.backdrop.addEventListener('click', (e) => {
                if (e.target === this.backdrop) {
                    this.hide();
                }
            });
        }
        
        // 键盘事件
        if (this.options.keyboard) {
            document.addEventListener('keydown', this.handleKeydown.bind(this));
        }
        
        // 按钮点击事件
        this.element.addEventListener('click', (e) => {
            const button = e.target.closest('[data-action]');
            if (button) {
                this.handleButtonClick(button.dataset.action, e);
            }
            
            // 关闭按钮
            if (e.target.closest('.close-btn')) {
                this.hide();
            }
        });
        
        // 表单提交事件
        const form = this.element.querySelector('.modal-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleButtonClick('submit', e);
            });
        }
    }
    
    /**
     * 处理键盘事件
     */
    handleKeydown(e) {
        if (!this.isVisible) return;
        
        switch (e.key) {
            case 'Escape':
                if (this.options.keyboard) {
                    this.hide();
                }
                break;
                
            case 'Tab':
                this.handleTabKey(e);
                break;
        }
    }
    
    /**
     * 处理Tab键焦点管理
     */
    handleTabKey(e) {
        const focusableElements = this.element.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        if (e.shiftKey) {
            if (document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            }
        } else {
            if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    }
    
    /**
     * 处理按钮点击
     */
    handleButtonClick(action, event) {
        const { onConfirm, onCancel } = this.options;
        
        switch (action) {
            case 'confirm':
                if (onConfirm && typeof onConfirm === 'function') {
                    const result = onConfirm(this);
                    if (result !== false) {
                        this.hide();
                    }
                } else {
                    this.hide();
                }
                break;
                
            case 'cancel':
                if (onCancel && typeof onCancel === 'function') {
                    const result = onCancel(this);
                    if (result !== false) {
                        this.hide();
                    }
                } else {
                    this.hide();
                }
                break;
                
            case 'submit':
                this.handleFormSubmit();
                break;
                
            default:
                // 自定义按钮处理
                this.handleCustomAction(action, event);
                break;
        }
        
        // 触发事件
        this.eventBus?.emit('modal:buttonClick', {
            action: action,
            modal: this,
            event: event
        });
    }
    
    /**
     * 处理表单提交
     */
    handleFormSubmit() {
        const form = this.element.querySelector('.modal-form');
        if (!form) return;
        
        // 验证表单
        if (!this.validateForm(form)) {
            return;
        }
        
        // 收集表单数据
        const formData = this.getFormData(form);
        
        // 调用确认回调
        const { onConfirm } = this.options;
        if (onConfirm && typeof onConfirm === 'function') {
            const result = onConfirm(formData, this);
            if (result !== false) {
                this.hide();
            }
        } else {
            this.hide();
        }
    }
    
    /**
     * 验证表单
     */
    validateForm(form) {
        const requiredFields = form.querySelectorAll('[required]');
        let isValid = true;
        
        // 清除之前的错误状态
        form.querySelectorAll('.form-group').forEach(group => {
            group.classList.remove('has-error');
        });
        
        requiredFields.forEach(field => {
            const value = field.type === 'checkbox' ? field.checked : field.value.trim();
            
            if (!value) {
                isValid = false;
                const formGroup = field.closest('.form-group');
                if (formGroup) {
                    formGroup.classList.add('has-error');
                }
            }
        });
        
        return isValid;
    }
    
    /**
     * 获取表单数据
     */
    getFormData(form) {
        const formData = {};
        const elements = form.querySelectorAll('input, select, textarea');
        
        elements.forEach(element => {
            const { name, type, value, checked } = element;
            
            if (name) {
                if (type === 'checkbox') {
                    formData[name] = checked;
                } else {
                    formData[name] = value;
                }
            }
        });
        
        return formData;
    }
    
    /**
     * 处理自定义按钮动作
     */
    handleCustomAction(action, event) {
        const { buttons } = this.options;
        if (!buttons) return;
        
        const button = buttons.find(btn => btn.action === action);
        if (button && button.handler && typeof button.handler === 'function') {
            const result = button.handler(this, event);
            if (result !== false) {
                this.hide();
            }
        }
    }
    
    /**
     * 设置无障碍访问
     */
    setupAccessibility() {
        this.backdrop.setAttribute('role', 'dialog');
        this.backdrop.setAttribute('aria-modal', 'true');
        
        if (this.options.title) {
            const titleElement = this.element.querySelector('.modal-title');
            if (titleElement) {
                const titleId = 'modal-title-' + Math.random().toString(36).substr(2, 9);
                titleElement.id = titleId;
                this.backdrop.setAttribute('aria-labelledby', titleId);
            }
        }
    }
    
    /**
     * 显示模态框
     */
    show() {
        if (this.isVisible) return this;
        
        // 保存当前焦点元素
        this.focusedElementBeforeModal = document.activeElement;
        
        // 添加到页面
        document.body.appendChild(this.backdrop);
        
        // 强制重排以确保动画生效
        this.backdrop.offsetHeight;
        
        // 显示模态框
        this.backdrop.classList.add('show');
        this.isVisible = true;
        
        // 设置焦点
        if (this.options.autoFocus) {
            this.setInitialFocus();
        }
        
        // 阻止背景滚动
        document.body.style.overflow = 'hidden';
        
        // 触发事件
        this.eventBus?.emit('modal:show', this);
        if (this.options.onShow && typeof this.options.onShow === 'function') {
            this.options.onShow(this);
        }
        
        this.logInfo('Modal 显示');
        return this;
    }
    
    /**
     * 隐藏模态框
     */
    hide() {
        if (!this.isVisible) return this;
        
        this.backdrop.classList.remove('show');
        this.isVisible = false;
        
        // 延迟移除DOM元素以完成动画
        setTimeout(() => {
            if (this.backdrop && this.backdrop.parentNode) {
                document.body.removeChild(this.backdrop);
            }
            
            // 恢复背景滚动
            if (Modal.instances.filter(m => m.isVisible).length === 0) {
                document.body.style.overflow = '';
            }
            
            // 恢复焦点
            if (this.focusedElementBeforeModal) {
                this.focusedElementBeforeModal.focus();
            }
        }, this.options.animation ? 300 : 0);
        
        // 触发事件
        this.eventBus?.emit('modal:hide', this);
        if (this.options.onHide && typeof this.options.onHide === 'function') {
            this.options.onHide(this);
        }
        
        this.logInfo('Modal 隐藏');
        return this;
    }
    
    /**
     * 设置初始焦点
     */
    setInitialFocus() {
        const firstButton = this.element.querySelector('.modal-footer .btn');
        const firstInput = this.element.querySelector('input, select, textarea');
        const focusTarget = firstInput || firstButton;
        
        if (focusTarget) {
            setTimeout(() => focusTarget.focus(), 100);
        }
    }
    
    /**
     * 获取下一个z-index值
     */
    getNextZIndex() {
        return ++Modal.zIndexCounter;
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
     * 销毁模态框
     */
    destroy() {
        this.hide();
        
        // 移除事件监听
        document.removeEventListener('keydown', this.handleKeydown.bind(this));
        
        // 从实例列表中移除
        const index = Modal.instances.indexOf(this);
        if (index > -1) {
            Modal.instances.splice(index, 1);
        }
        
        this.logInfo('Modal 已销毁');
    }
    
    /**
     * 记录日志
     */
    logInfo(...args) {
        console.log('[Modal]', ...args);
    }
    
    /**
     * 静态方法：快速创建确认对话框
     */
    static confirm(message, options = {}) {
        return new Modal({
            type: 'confirm',
            title: '确认操作',
            content: message,
            ...options
        }).show();
    }
    
    /**
     * 静态方法：快速创建信息对话框
     */
    static info(message, options = {}) {
        return new Modal({
            type: 'info',
            title: '提示信息',
            content: message,
            ...options
        }).show();
    }
    
    /**
     * 静态方法：快速创建表单对话框
     */
    static form(title, fields, options = {}) {
        return new Modal({
            type: 'form',
            title: title,
            formFields: fields,
            ...options
        }).show();
    }
    
    /**
     * 静态方法：关闭所有模态框
     */
    static closeAll() {
        Modal.instances.forEach(modal => {
            if (modal.isVisible) {
                modal.hide();
            }
        });
    }
}

// 全局注册
if (typeof window !== 'undefined') {
    window.Modal = Modal;
}

export default Modal;