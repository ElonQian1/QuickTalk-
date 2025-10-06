/**
 * 统一表单管理系统
 * 整合并替代重复的表单相关模块
 * 
 * 替代的模块:
 * - form-validation.js (字段验证和错误显示)
 * - form-feedback.js (提交反馈和加载状态)
 * 
 * 依赖:
 * - UIBase (继承标准化能力)
 * 
 * @author GitHub Copilot
 * @version 1.0
 * @date 2025-10-06
 */

class UnifiedFormManager extends UIBase {
    constructor(options = {}) {
        super();
        
        this.options = {
            // 验证配置
            enableValidation: true,
            showSuccessMessage: true,
            clearOnFocus: true,
            
            // 反馈配置
            enableSubmitFeedback: true,
            loadingText: '提交中...',
            successDuration: 3000,
            
            // 样式配置
            errorColor: '#ff4757',
            successColor: '#26de81',
            
            ...options
        };

        // 状态管理
        this.forms = new Map(); // formId -> formState
        this.validationRules = new Map(); // fieldId -> rules
        
        this.init();
    }

    init() {
        this.log('info', '统一表单管理系统初始化');
        
        // 注入样式
        this.injectFormStyles();
        
        // 绑定全局事件
        this.bindGlobalEvents();
    }

    /**
     * 注入表单样式
     * 整合原有的injectStyle函数
     */
    injectFormStyles() {
        const styles = `
            /* 表单字段样式 */
            .form-field {
                position: relative;
                margin-bottom: 16px;
            }
            
            /* 验证状态样式 */
            .form-field.has-error input, 
            .form-field.has-error textarea, 
            .form-field.has-error select {
                border-color: ${this.options.errorColor} !important;
            }
            
            .form-field.has-success input, 
            .form-field.has-success textarea, 
            .form-field.has-success select {
                border-color: ${this.options.successColor} !important;
            }
            
            /* 错误消息样式 */
            .form-error-msg {
                color: ${this.options.errorColor};
                font-size: 12px;
                margin-top: 4px;
                display: none;
            }
            
            .form-field.has-error .form-error-msg {
                display: block;
            }
            
            /* 成功消息样式 */
            .form-success-msg {
                color: ${this.options.successColor};
                font-size: 12px;
                margin-top: 4px;
                display: none;
            }
            
            .form-field.has-success .form-success-msg {
                display: block;
            }
            
            /* 提交按钮样式 */
            .form-submit-btn {
                position: relative;
                transition: all 0.2s ease;
            }
            
            .form-submit-btn.loading {
                pointer-events: none;
                opacity: 0.6;
            }
            
            .form-submit-btn.loading::after {
                content: "";
                position: absolute;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                background: inherit;
                border-radius: inherit;
            }
            
            /* 反馈消息样式 */
            .form-feedback-msg {
                margin-top: 12px;
                padding: 10px 12px;
                border-radius: 8px;
                font-size: 13px;
                display: none;
            }
            
            .form-feedback-msg.success {
                background: #d4edda;
                color: #155724;
                border: 1px solid #c3e6cb;
                display: block;
            }
            
            .form-feedback-msg.error {
                background: #f8d7da;
                color: #721c24;
                border: 1px solid #f5c6cb;
                display: block;
            }
        `;

        this.injectCSS(styles, 'unified-form-styles');
    }

    /**
     * 绑定全局事件
     */
    bindGlobalEvents() {
        // 表单提交事件
        this.addEventListener(document, 'submit', (e) => {
            const form = e.target;
            if (form.tagName === 'FORM') {
                this.handleFormSubmit(e);
            }
        });

        // 输入字段事件
        if (this.options.clearOnFocus) {
            this.addEventListener(document, 'focus', (e) => {
                const input = e.target;
                if (this.isFormField(input)) {
                    this.clearFieldMessages(input);
                }
            }, true);
        }
    }

    /**
     * 注册表单
     */
    registerForm(formElement, options = {}) {
        const formId = formElement.id || this.generateFormId();
        if (!formElement.id) {
            formElement.id = formId;
        }

        const formState = {
            element: formElement,
            options: { ...this.options, ...options },
            isValid: true,
            isSubmitting: false,
            fields: new Map()
        };

        this.forms.set(formId, formState);
        this.log('info', '注册表单:', formId);
        
        return formId;
    }

    /**
     * 显示字段错误
     * 整合自form-validation.js
     */
    showFieldError(input, message) {
        const field = this.getFieldContainer(input);
        if (!field) return;

        // 清除成功状态
        field.classList.remove('has-success');
        field.classList.add('has-error');

        // 创建或更新错误消息
        let errorMsg = field.querySelector('.form-error-msg');
        if (!errorMsg) {
            errorMsg = this.createElement('div', {
                className: 'form-error-msg'
            });
            field.appendChild(errorMsg);
        }
        
        errorMsg.textContent = message || '输入有误';
        
        // 更新表单状态
        this.updateFormValidationState(input, false);
    }

    /**
     * 清除字段错误
     */
    clearFieldError(input) {
        const field = this.getFieldContainer(input);
        if (!field) return;

        field.classList.remove('has-error');
        const errorMsg = field.querySelector('.form-error-msg');
        if (errorMsg) {
            errorMsg.textContent = '';
        }

        this.updateFormValidationState(input, true);
    }

    /**
     * 显示字段成功
     */
    showFieldSuccess(input, message) {
        if (!this.options.showSuccessMessage) return;

        const field = this.getFieldContainer(input);
        if (!field) return;

        // 清除错误状态
        field.classList.remove('has-error');
        field.classList.add('has-success');

        // 创建或更新成功消息
        if (message) {
            let successMsg = field.querySelector('.form-success-msg');
            if (!successMsg) {
                successMsg = this.createElement('div', {
                    className: 'form-success-msg'
                });
                field.appendChild(successMsg);
            }
            successMsg.textContent = message;
        }

        this.updateFormValidationState(input, true);
    }

    /**
     * 清除字段成功状态
     */
    clearFieldSuccess(input) {
        const field = this.getFieldContainer(input);
        if (!field) return;

        field.classList.remove('has-success');
        const successMsg = field.querySelector('.form-success-msg');
        if (successMsg) {
            successMsg.textContent = '';
        }
    }

    /**
     * 清除字段所有消息
     */
    clearFieldMessages(input) {
        this.clearFieldError(input);
        this.clearFieldSuccess(input);
    }

    /**
     * 显示表单加载状态
     * 整合自form-feedback.js
     */
    showFormLoading(form, text) {
        const btn = this.getSubmitButton(form);
        if (btn) {
            btn.classList.add('loading');
            btn.disabled = true;
            if (text) {
                btn.dataset.originalText = btn.textContent;
                btn.textContent = text;
            }
        }

        // 隐藏之前的反馈消息
        this.hideFeedbackMessage(form);

        // 更新表单状态
        const formState = this.getFormState(form);
        if (formState) {
            formState.isSubmitting = true;
        }
    }

    /**
     * 显示表单成功反馈
     */
    showFormSuccess(form, message) {
        this.clearFormLoading(form);
        
        const msg = this.getFeedbackMessageElement(form);
        msg.className = 'form-feedback-msg success';
        msg.textContent = message || '提交成功';

        // 自动隐藏成功消息
        if (this.options.successDuration > 0) {
            setTimeout(() => {
                this.hideFeedbackMessage(form);
            }, this.options.successDuration);
        }
    }

    /**
     * 显示表单错误反馈
     */
    showFormError(form, message) {
        this.clearFormLoading(form);
        
        const msg = this.getFeedbackMessageElement(form);
        msg.className = 'form-feedback-msg error';
        msg.textContent = message || '提交失败，请重试';
    }

    /**
     * 清除表单加载状态
     */
    clearFormLoading(form) {
        const btn = this.getSubmitButton(form);
        if (btn) {
            btn.classList.remove('loading');
            btn.disabled = false;
            
            // 恢复原始文本
            if (btn.dataset.originalText) {
                btn.textContent = btn.dataset.originalText;
                delete btn.dataset.originalText;
            }
        }

        // 更新表单状态
        const formState = this.getFormState(form);
        if (formState) {
            formState.isSubmitting = false;
        }
    }

    /**
     * 隐藏反馈消息
     */
    hideFeedbackMessage(form) {
        const msg = form.querySelector('.form-feedback-msg');
        if (msg) {
            msg.className = 'form-feedback-msg';
            msg.style.display = 'none';
        }
    }

    /**
     * 清除表单所有状态
     */
    clearAllFormStates(form) {
        // 清除所有字段状态
        const fields = form.querySelectorAll('.form-field, .form-group');
        fields.forEach(field => {
            field.classList.remove('has-error', 'has-success');
            const msgs = field.querySelectorAll('.form-error-msg, .form-success-msg');
            msgs.forEach(msg => msg.textContent = '');
        });

        // 清除加载和反馈状态
        this.clearFormLoading(form);
        this.hideFeedbackMessage(form);
    }

    /**
     * 验证表单
     */
    validateForm(form) {
        let isValid = true;
        const fields = form.querySelectorAll('input, textarea, select');
        
        fields.forEach(field => {
            const fieldIsValid = this.validateField(field);
            if (!fieldIsValid) {
                isValid = false;
            }
        });

        return isValid;
    }

    /**
     * 验证单个字段
     */
    validateField(field) {
        const rules = this.validationRules.get(field.id || field.name);
        if (!rules) return true;

        let isValid = true;
        const value = field.value.trim();

        // 必填验证
        if (rules.required && !value) {
            this.showFieldError(field, rules.requiredMessage || '此字段为必填项');
            isValid = false;
        }
        // 长度验证
        else if (rules.minLength && value.length < rules.minLength) {
            this.showFieldError(field, `最少需要${rules.minLength}个字符`);
            isValid = false;
        }
        else if (rules.maxLength && value.length > rules.maxLength) {
            this.showFieldError(field, `最多允许${rules.maxLength}个字符`);
            isValid = false;
        }
        // 正则验证
        else if (rules.pattern && !rules.pattern.test(value)) {
            this.showFieldError(field, rules.patternMessage || '格式不正确');
            isValid = false;
        }
        // 自定义验证
        else if (rules.custom && typeof rules.custom === 'function') {
            const result = rules.custom(value, field);
            if (result !== true) {
                this.showFieldError(field, result || '验证失败');
                isValid = false;
            }
        }

        if (isValid) {
            this.clearFieldError(field);
            if (value && rules.successMessage) {
                this.showFieldSuccess(field, rules.successMessage);
            }
        }

        return isValid;
    }

    /**
     * 添加验证规则
     */
    addValidationRule(fieldId, rules) {
        this.validationRules.set(fieldId, rules);
    }

    /**
     * 处理表单提交
     */
    handleFormSubmit(event) {
        const form = event.target;
        const formState = this.getFormState(form);
        
        if (!formState || !this.options.enableValidation) return;

        // 验证表单
        const isValid = this.validateForm(form);
        if (!isValid) {
            event.preventDefault();
            this.showFormError(form, '请修正表单错误后重试');
            return false;
        }

        // 如果已在提交中，阻止重复提交
        if (formState.isSubmitting) {
            event.preventDefault();
            return false;
        }

        return true;
    }

    // === 辅助方法 ===

    /**
     * 获取字段容器
     */
    getFieldContainer(input) {
        if (!input) return null;
        return input.closest('.form-field') || input.closest('.form-group');
    }

    /**
     * 获取提交按钮
     */
    getSubmitButton(form) {
        return form.querySelector('[type="submit"]') || form.querySelector('.form-submit-btn');
    }

    /**
     * 获取反馈消息元素
     */
    getFeedbackMessageElement(form) {
        let msg = form.querySelector('.form-feedback-msg');
        if (!msg) {
            msg = this.createElement('div', {
                className: 'form-feedback-msg'
            });
            form.appendChild(msg);
        }
        return msg;
    }

    /**
     * 检查是否为表单字段
     */
    isFormField(element) {
        return element && ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName);
    }

    /**
     * 获取表单状态
     */
    getFormState(form) {
        const formId = form.id;
        return formId ? this.forms.get(formId) : null;
    }

    /**
     * 更新表单验证状态
     */
    updateFormValidationState(input, isValid) {
        const form = input.closest('form');
        if (!form) return;

        const formState = this.getFormState(form);
        if (formState) {
            formState.fields.set(input.name || input.id, isValid);
            
            // 更新整体验证状态
            const allValid = Array.from(formState.fields.values()).every(v => v);
            formState.isValid = allValid;
        }
    }

    /**
     * 生成表单ID
     */
    generateFormId() {
        return this.generateId('form');
    }

    /**
     * 销毁管理器
     */
    destroy() {
        // 清理所有表单状态
        this.forms.clear();
        this.validationRules.clear();

        // 调用父类销毁
        super.destroy();

        this.log('info', '统一表单管理系统已销毁');
    }
}

// 全局单例
window.UnifiedFormManager = UnifiedFormManager;

// 兼容性：提供旧API接口
window.FormValidationUI = {
    showError: (input, message) => {
        if (!window.unifiedFormManager) {
            window.unifiedFormManager = new UnifiedFormManager();
        }
        return window.unifiedFormManager.showFieldError(input, message);
    },
    clearError: (input) => {
        if (!window.unifiedFormManager) {
            window.unifiedFormManager = new UnifiedFormManager();
        }
        return window.unifiedFormManager.clearFieldError(input);
    },
    showSuccess: (input, message) => {
        if (!window.unifiedFormManager) {
            window.unifiedFormManager = new UnifiedFormManager();
        }
        return window.unifiedFormManager.showFieldSuccess(input, message);
    },
    clearSuccess: (input) => {
        if (!window.unifiedFormManager) {
            window.unifiedFormManager = new UnifiedFormManager();
        }
        return window.unifiedFormManager.clearFieldSuccess(input);
    },
    clearAll: (form) => {
        if (!window.unifiedFormManager) {
            window.unifiedFormManager = new UnifiedFormManager();
        }
        return window.unifiedFormManager.clearAllFormStates(form);
    }
};

window.FormFeedbackUI = {
    showLoading: (form, text) => {
        if (!window.unifiedFormManager) {
            window.unifiedFormManager = new UnifiedFormManager();
        }
        return window.unifiedFormManager.showFormLoading(form, text);
    },
    showSuccess: (form, message) => {
        if (!window.unifiedFormManager) {
            window.unifiedFormManager = new UnifiedFormManager();
        }
        return window.unifiedFormManager.showFormSuccess(form, message);
    },
    showError: (form, message) => {
        if (!window.unifiedFormManager) {
            window.unifiedFormManager = new UnifiedFormManager();
        }
        return window.unifiedFormManager.showFormError(form, message);
    },
    hide: (form) => {
        if (!window.unifiedFormManager) {
            window.unifiedFormManager = new UnifiedFormManager();
        }
        return window.unifiedFormManager.hideFeedbackMessage(form);
    }
};

// 自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.unifiedFormManager = new UnifiedFormManager();
    });
} else {
    window.unifiedFormManager = new UnifiedFormManager();
}

console.log('✅ 统一表单管理系统已加载 (UnifiedFormManager)');