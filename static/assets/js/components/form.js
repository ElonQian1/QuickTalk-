/**
 * Form Component - 表单组件
 * 提供统一的表单创建、验证和提交功能
 * 
 * 功能特性:
 * - 多种字段类型支持（文本、选择器、复选框等）
 * - 实时验证和错误显示
 * - 自定义验证规则
 * - 表单序列化和数据处理
 * - 无障碍访问支持
 * - 响应式设计
 */

export class Form {
    constructor(container, options = {}) {
        // 默认配置
        this.defaults = {
            fields: [],
            submitText: '提交',
            cancelText: '取消',
            showCancel: true,
            validateOnBlur: true,
            validateOnInput: true,
            autoFocus: true,
            className: '',
            onSubmit: null,
            onCancel: null,
            onValidate: null,
            onFieldChange: null
        };
        
        // 合并配置
        this.options = { ...this.defaults, ...options };
        
        // 容器元素
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        if (!this.container) {
            throw new Error('Form container not found');
        }
        
        // 状态管理
        this.fields = new Map();
        this.validators = new Map();
        this.errors = new Map();
        this.isValid = true;
        this.element = null;
        
        // 依赖注入
        this.eventBus = options.eventBus || window.EventBus;
        this.utils = options.utils || window.Utils;
        
        this.init();
    }
    
    /**
     * 初始化表单
     */
    init() {
        this.setupValidators();
        this.createForm();
        this.bindEvents();
        this.setupAccessibility();
        
        // 自动聚焦第一个字段
        if (this.options.autoFocus) {
            this.focusFirstField();
        }
        
        this.logInfo('Form 组件初始化完成');
    }
    
    /**
     * 设置验证器
     */
    setupValidators() {
        // 内置验证器
        this.validators.set('required', {
            validate: (value) => {
                return value !== null && value !== undefined && String(value).trim() !== '';
            },
            message: '此字段为必填项'
        });
        
        this.validators.set('email', {
            validate: (value) => {
                if (!value) return true; // 空值由required验证
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return emailRegex.test(value);
            },
            message: '请输入有效的邮箱地址'
        });
        
        this.validators.set('phone', {
            validate: (value) => {
                if (!value) return true;
                const phoneRegex = /^1[3-9]\d{9}$/;
                return phoneRegex.test(value.replace(/\D/g, ''));
            },
            message: '请输入有效的手机号码'
        });
        
        this.validators.set('url', {
            validate: (value) => {
                if (!value) return true;
                try {
                    new URL(value);
                    return true;
                } catch {
                    return false;
                }
            },
            message: '请输入有效的URL地址'
        });
        
        this.validators.set('minLength', {
            validate: (value, params) => {
                if (!value) return true;
                const minLength = params.minLength || 0;
                return String(value).length >= minLength;
            },
            message: (params) => `至少需要${params.minLength}个字符`
        });
        
        this.validators.set('maxLength', {
            validate: (value, params) => {
                if (!value) return true;
                const maxLength = params.maxLength || Infinity;
                return String(value).length <= maxLength;
            },
            message: (params) => `最多允许${params.maxLength}个字符`
        });
        
        this.validators.set('number', {
            validate: (value) => {
                if (!value) return true;
                return !isNaN(value) && isFinite(value);
            },
            message: '请输入有效的数字'
        });
        
        this.validators.set('pattern', {
            validate: (value, params) => {
                if (!value) return true;
                const pattern = new RegExp(params.pattern);
                return pattern.test(value);
            },
            message: (params) => params.message || '格式不正确'
        });
    }
    
    /**
     * 创建表单
     */
    createForm() {
        this.element = document.createElement('form');
        this.element.className = `form-component ${this.options.className}`.trim();
        this.element.noValidate = true; // 使用自定义验证
        
        // 创建字段
        this.options.fields.forEach(fieldConfig => {
            const fieldElement = this.createField(fieldConfig);
            this.element.appendChild(fieldElement);
        });
        
        // 创建提交按钮
        const buttonsContainer = this.createButtons();
        this.element.appendChild(buttonsContainer);
        
        // 添加到容器
        this.container.appendChild(this.element);
    }
    
    /**
     * 创建字段
     */
    createField(config) {
        const {
            type = 'text',
            name,
            label,
            placeholder = '',
            value = '',
            required = false,
            disabled = false,
            readonly = false,
            options = [],
            validation = [],
            className = '',
            help = ''
        } = config;
        
        // 存储字段配置
        this.fields.set(name, { ...config, element: null });
        
        // 创建字段容器
        const fieldGroup = document.createElement('div');
        fieldGroup.className = `form-group ${className}`.trim();
        fieldGroup.setAttribute('data-field', name);
        
        // 创建标签
        if (label) {
            const labelElement = document.createElement('label');
            labelElement.className = 'form-label';
            labelElement.htmlFor = name;
            labelElement.textContent = label;
            
            if (required) {
                const requiredMark = document.createElement('span');
                requiredMark.className = 'required';
                requiredMark.textContent = '*';
                labelElement.appendChild(requiredMark);
            }
            
            fieldGroup.appendChild(labelElement);
        }
        
        // 创建输入元素
        const inputElement = this.createInputElement(config);
        fieldGroup.appendChild(inputElement);
        
        // 创建帮助文本
        if (help) {
            const helpElement = document.createElement('div');
            helpElement.className = 'form-help';
            helpElement.textContent = help;
            fieldGroup.appendChild(helpElement);
        }
        
        // 创建错误消息容器
        const errorElement = document.createElement('div');
        errorElement.className = 'form-error';
        errorElement.style.display = 'none';
        fieldGroup.appendChild(errorElement);
        
        // 存储字段元素引用
        const fieldData = this.fields.get(name);
        fieldData.element = inputElement;
        fieldData.container = fieldGroup;
        fieldData.errorElement = errorElement;
        
        return fieldGroup;
    }
    
    /**
     * 创建输入元素
     */
    createInputElement(config) {
        const {
            type,
            name,
            placeholder,
            value,
            required,
            disabled,
            readonly,
            options,
            multiple,
            rows = 3
        } = config;
        
        let element;
        
        switch (type) {
            case 'textarea':
                element = document.createElement('textarea');
                element.rows = rows;
                break;
                
            case 'select':
                element = document.createElement('select');
                if (multiple) {
                    element.multiple = true;
                }
                
                // 添加选项
                options.forEach(option => {
                    const optionElement = document.createElement('option');
                    optionElement.value = option.value;
                    optionElement.textContent = option.text || option.label;
                    if (option.selected || option.value === value) {
                        optionElement.selected = true;
                    }
                    element.appendChild(optionElement);
                });
                break;
                
            case 'checkbox':
                element = document.createElement('input');
                element.type = 'checkbox';
                element.checked = Boolean(value);
                break;
                
            case 'radio':
                element = document.createElement('div');
                element.className = 'radio-group';
                
                options.forEach(option => {
                    const radioWrapper = document.createElement('label');
                    radioWrapper.className = 'radio-label';
                    
                    const radioInput = document.createElement('input');
                    radioInput.type = 'radio';
                    radioInput.name = name;
                    radioInput.value = option.value;
                    radioInput.checked = option.value === value;
                    
                    const radioText = document.createElement('span');
                    radioText.textContent = option.text || option.label;
                    
                    radioWrapper.appendChild(radioInput);
                    radioWrapper.appendChild(radioText);
                    element.appendChild(radioWrapper);
                });
                break;
                
            default:
                element = document.createElement('input');
                element.type = type;
                element.value = value;
                break;
        }
        
        // 设置通用属性
        if (type !== 'radio') {
            element.id = name;
            element.name = name;
            
            if (placeholder) {
                element.placeholder = placeholder;
            }
            
            if (required) {
                element.setAttribute('aria-required', 'true');
            }
            
            if (disabled) {
                element.disabled = true;
            }
            
            if (readonly) {
                element.readOnly = true;
            }
        }
        
        element.className = 'form-control';
        
        return element;
    }
    
    /**
     * 创建按钮
     */
    createButtons() {
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'form-actions';
        
        // 取消按钮
        if (this.options.showCancel) {
            const cancelButton = document.createElement('button');
            cancelButton.type = 'button';
            cancelButton.className = 'btn btn-secondary';
            cancelButton.textContent = this.options.cancelText;
            cancelButton.addEventListener('click', () => this.handleCancel());
            buttonsContainer.appendChild(cancelButton);
        }
        
        // 提交按钮
        const submitButton = document.createElement('button');
        submitButton.type = 'submit';
        submitButton.className = 'btn btn-primary';
        submitButton.textContent = this.options.submitText;
        buttonsContainer.appendChild(submitButton);
        
        return buttonsContainer;
    }
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 表单提交事件
        this.element.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });
        
        // 字段事件
        this.fields.forEach((fieldData, name) => {
            const element = fieldData.element;
            
            if (element.type === 'radio') {
                // 单选按钮组
                const radioInputs = element.querySelectorAll('input[type="radio"]');
                radioInputs.forEach(radio => {
                    radio.addEventListener('change', () => {
                        this.handleFieldChange(name, radio.value);
                    });
                });
            } else {
                // 其他输入类型
                element.addEventListener('input', () => {
                    const value = this.getFieldValue(name);
                    this.handleFieldChange(name, value);
                    
                    if (this.options.validateOnInput) {
                        this.validateField(name);
                    }
                });
                
                element.addEventListener('blur', () => {
                    if (this.options.validateOnBlur) {
                        this.validateField(name);
                    }
                });
            }
        });
    }
    
    /**
     * 处理字段变化
     */
    handleFieldChange(name, value) {
        // 触发字段变化事件
        this.eventBus?.emit('form:fieldChange', {
            name: name,
            value: value,
            form: this
        });
        
        if (this.options.onFieldChange && typeof this.options.onFieldChange === 'function') {
            this.options.onFieldChange(name, value, this);
        }
    }
    
    /**
     * 处理表单提交
     */
    handleSubmit() {
        // 验证所有字段
        const isValid = this.validate();
        
        if (isValid) {
            const formData = this.getData();
            
            // 触发提交事件
            this.eventBus?.emit('form:submit', {
                data: formData,
                form: this
            });
            
            if (this.options.onSubmit && typeof this.options.onSubmit === 'function') {
                this.options.onSubmit(formData, this);
            }
        } else {
            // 聚焦到第一个错误字段
            this.focusFirstError();
        }
    }
    
    /**
     * 处理取消
     */
    handleCancel() {
        // 触发取消事件
        this.eventBus?.emit('form:cancel', { form: this });
        
        if (this.options.onCancel && typeof this.options.onCancel === 'function') {
            this.options.onCancel(this);
        }
    }
    
    /**
     * 验证表单
     */
    validate() {
        let isValid = true;
        this.errors.clear();
        
        this.fields.forEach((fieldData, name) => {
            if (!this.validateField(name)) {
                isValid = false;
            }
        });
        
        this.isValid = isValid;
        
        // 触发验证事件
        this.eventBus?.emit('form:validate', {
            isValid: isValid,
            errors: Object.fromEntries(this.errors),
            form: this
        });
        
        if (this.options.onValidate && typeof this.options.onValidate === 'function') {
            this.options.onValidate(isValid, Object.fromEntries(this.errors), this);
        }
        
        return isValid;
    }
    
    /**
     * 验证单个字段
     */
    validateField(name) {
        const fieldData = this.fields.get(name);
        if (!fieldData) return true;
        
        const value = this.getFieldValue(name);
        const validation = fieldData.validation || [];
        const errors = [];
        
        // 执行验证规则
        validation.forEach(rule => {
            const validator = this.validators.get(rule.type);
            if (!validator) return;
            
            const isValid = validator.validate(value, rule);
            if (!isValid) {
                const message = typeof validator.message === 'function' 
                    ? validator.message(rule)
                    : validator.message;
                errors.push(rule.message || message);
            }
        });
        
        // 更新错误状态
        this.updateFieldError(name, errors);
        
        return errors.length === 0;
    }
    
    /**
     * 更新字段错误状态
     */
    updateFieldError(name, errors) {
        const fieldData = this.fields.get(name);
        if (!fieldData) return;
        
        const { container, errorElement } = fieldData;
        
        if (errors.length > 0) {
            // 显示错误
            this.errors.set(name, errors);
            container.classList.add('has-error');
            errorElement.textContent = errors[0]; // 显示第一个错误
            errorElement.style.display = 'block';
        } else {
            // 清除错误
            this.errors.delete(name);
            container.classList.remove('has-error');
            errorElement.style.display = 'none';
        }
    }
    
    /**
     * 获取字段值
     */
    getFieldValue(name) {
        const fieldData = this.fields.get(name);
        if (!fieldData) return null;
        
        const element = fieldData.element;
        const type = fieldData.type;
        
        switch (type) {
            case 'checkbox':
                return element.checked;
                
            case 'radio':
                const checkedRadio = element.querySelector('input[type="radio"]:checked');
                return checkedRadio ? checkedRadio.value : null;
                
            case 'select':
                if (element.multiple) {
                    return Array.from(element.selectedOptions).map(option => option.value);
                }
                return element.value;
                
            default:
                return element.value;
        }
    }
    
    /**
     * 设置字段值
     */
    setFieldValue(name, value) {
        const fieldData = this.fields.get(name);
        if (!fieldData) return;
        
        const element = fieldData.element;
        const type = fieldData.type;
        
        switch (type) {
            case 'checkbox':
                element.checked = Boolean(value);
                break;
                
            case 'radio':
                const radioInputs = element.querySelectorAll('input[type="radio"]');
                radioInputs.forEach(radio => {
                    radio.checked = radio.value === value;
                });
                break;
                
            case 'select':
                if (element.multiple) {
                    const values = Array.isArray(value) ? value : [value];
                    Array.from(element.options).forEach(option => {
                        option.selected = values.includes(option.value);
                    });
                } else {
                    element.value = value;
                }
                break;
                
            default:
                element.value = value || '';
                break;
        }
        
        // 触发变化事件
        this.handleFieldChange(name, value);
    }
    
    /**
     * 获取表单数据
     */
    getData() {
        const data = {};
        
        this.fields.forEach((fieldData, name) => {
            data[name] = this.getFieldValue(name);
        });
        
        return data;
    }
    
    /**
     * 设置表单数据
     */
    setData(data) {
        Object.keys(data).forEach(name => {
            if (this.fields.has(name)) {
                this.setFieldValue(name, data[name]);
            }
        });
    }
    
    /**
     * 重置表单
     */
    reset() {
        this.fields.forEach((fieldData, name) => {
            this.setFieldValue(name, fieldData.value || '');
        });
        
        this.clearErrors();
    }
    
    /**
     * 清除错误
     */
    clearErrors() {
        this.errors.clear();
        
        this.fields.forEach((fieldData) => {
            const { container, errorElement } = fieldData;
            container.classList.remove('has-error');
            errorElement.style.display = 'none';
        });
    }
    
    /**
     * 聚焦第一个字段
     */
    focusFirstField() {
        const firstField = this.element.querySelector('.form-control');
        if (firstField) {
            setTimeout(() => firstField.focus(), 100);
        }
    }
    
    /**
     * 聚焦第一个错误字段
     */
    focusFirstError() {
        const firstErrorField = this.element.querySelector('.has-error .form-control');
        if (firstErrorField) {
            firstErrorField.focus();
        }
    }
    
    /**
     * 设置无障碍访问
     */
    setupAccessibility() {
        this.element.setAttribute('role', 'form');
        
        // 为字段设置ARIA属性
        this.fields.forEach((fieldData, name) => {
            const { element, errorElement } = fieldData;
            
            if (element && errorElement) {
                const errorId = `error-${name}`;
                errorElement.id = errorId;
                element.setAttribute('aria-describedby', errorId);
            }
        });
    }
    
    /**
     * 添加自定义验证器
     */
    addValidator(name, validator) {
        this.validators.set(name, validator);
    }
    
    /**
     * 禁用表单
     */
    disable() {
        this.fields.forEach((fieldData) => {
            const element = fieldData.element;
            if (element.type === 'radio') {
                const radioInputs = element.querySelectorAll('input[type="radio"]');
                radioInputs.forEach(radio => {
                    radio.disabled = true;
                });
            } else {
                element.disabled = true;
            }
        });
        
        const submitButton = this.element.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = true;
        }
    }
    
    /**
     * 启用表单
     */
    enable() {
        this.fields.forEach((fieldData) => {
            const element = fieldData.element;
            if (element.type === 'radio') {
                const radioInputs = element.querySelectorAll('input[type="radio"]');
                radioInputs.forEach(radio => {
                    radio.disabled = false;
                });
            } else {
                element.disabled = false;
            }
        });
        
        const submitButton = this.element.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = false;
        }
    }
    
    /**
     * 销毁表单
     */
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        this.fields.clear();
        this.validators.clear();
        this.errors.clear();
        
        this.logInfo('Form 已销毁');
    }
    
    /**
     * 记录日志
     */
    logInfo(...args) {
        console.log('[Form]', ...args);
    }
}

// 全局注册
if (typeof window !== 'undefined') {
    window.Form = Form;
}

export default Form;