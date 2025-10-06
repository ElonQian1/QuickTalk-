/**
 * 统一模板渲染器 - 消除DOM创建和渲染重复代码
 * 
 * 设计目标:
 * 1. 基于 UIBase 构建，避免重复的 createElement 实现
 * 2. 专注于模板渲染功能，统一处理innerHTML和插值
 * 3. 提供高级渲染特性（条件渲染、循环等）
 * 4. 与 UIBase 协同工作，形成完整的UI渲染体系
 * 
 * @version 2.0 - 重构为基于 UIBase 的专用渲染器
 */

class TemplateRenderer extends UIBase {
    constructor() {
        super('TemplateRenderer', {
            debug: false,
            autoAttach: false // 渲染器不需要自动挂载
        });
        
        this.cache = new Map(); // 模板缓存
        this.templates = new Map(); // 注册的模板
        this.directives = new Map(); // 自定义指令
        
        this._initializeBuiltinDirectives();
    }

    /**
     * 初始化内置指令
     */
    _initializeBuiltinDirectives() {
        // if 条件指令
        this.directives.set('if', (element, value, data) => {
            const condition = this._evaluateExpression(value, data);
            element.style.display = condition ? '' : 'none';
            return condition;
        });
        
        // for 循环指令
        this.directives.set('for', (element, value, data) => {
            const [itemName, arrayName] = value.split(' in ').map(s => s.trim());
            const array = this._evaluateExpression(arrayName, data);
            
            if (!Array.isArray(array)) return false;
            
            const template = element.innerHTML;
            element.innerHTML = '';
            
            array.forEach((item, index) => {
                const itemData = { ...data, [itemName]: item, $index: index };
                const itemElement = this.createElement('div', {
                    innerHTML: this._interpolateVariables(template, itemData)
                });
                element.appendChild(itemElement);
            });
            
            return true;
        });
    }

    /**
     * 模板渲染功能
     * 支持变量插值和条件渲染
     */
    renderTemplate(template, data = {}, options = {}) {
        // 缓存检查
        const cacheKey = this._getCacheKey(template, data);
        if (this.cache.has(cacheKey) && !options.noCache) {
            return this.cache.get(cacheKey);
        }

        let rendered = template;
        
        // 变量插值 {{variable}}
        rendered = this._interpolateVariables(rendered, data);
        
        // 条件渲染 {{#if condition}} ... {{/if}}
        rendered = this._processConditionals(rendered, data);
        
        // 循环渲染 {{#each array}} ... {{/each}}
        rendered = this._processLoops(rendered, data);
        
        // HTML转义保护
        if (options.escapeHtml !== false) {
            rendered = this._escapeHtmlInData(rendered, data);
        }
        
        // 缓存结果
        if (!options.noCache) {
            this.cache.set(cacheKey, rendered);
        }
        
        return rendered;
    }

    /**
     * 统一状态UI生成器
     * 替代各manager中重复的状态UI代码
     */
    createStateUI(type, options = {}) {
        // 新策略：将 empty/error/loading 三类委托给 UnifiedState / UnifiedLoading，success 保留简单模板
        const unifiedCapable = (window.UnifiedState && typeof window.UnifiedState.show === 'function');
        const loadingCapable = (window.UnifiedLoading && typeof window.UnifiedLoading.show === 'function');
        if (!this._deprecatedStateNotified) {
            console.warn('[Deprecation] TemplateRenderer.createStateUI 正在退役，empty/error/loading 将由 UnifiedState / UnifiedLoading 接管');
            this._deprecatedStateNotified = true;
        }
        if (type === 'loading') {
            if (loadingCapable) {
                const wrap = this.createElement('span');
                setTimeout(()=> window.UnifiedLoading.show({ scope:'inline', target: wrap, text: options.message || '加载中...' }),0);
                return wrap;
            }
        }
        if ((type === 'empty' || type === 'error') && unifiedCapable) {
            const wrap = this.createElement('div');
            const key = 'tmpl-' + type + '-' + Date.now() + '-' + Math.random().toString(36).slice(2,6);
            const cfg = { type, key, target: wrap, message: options.message };
            if (type === 'error' && options.showRetry && options.retryCallback) cfg.retry = options.retryCallback;
            if (type === 'empty' && options.showAction && options.actionText && options.actionCallback) {
                cfg.action = { text: options.actionText, onClick: options.actionCallback };
            }
            window.UnifiedState.show(cfg);
            return wrap.firstChild || wrap;
        }
        if (type === 'success') {
            const template = `
                <div class="state-ui success-state">
                    <div class="success-icon">✅</div>
                    <div class="success-message">${options.message || '操作成功'}</div>
                </div>`;
            const container = this.createElement('div');
            container.innerHTML = template;
            return container.firstElementChild;
        }
        // 未知或无能力时回退到最小 div
        return this.createElement('div', { textContent: options.message || '状态' });
    }

    /**
     * 通用渲染到容器方法
     * 统一容器渲染模式
     */
    renderToContainer(container, content, options = {}) {
        if (!container) {
            console.error('[TemplateRenderer] 容器不存在');
            return;
        }

        const config = {
            clearFirst: true,
            append: false,
            position: 'beforeend', // beforebegin, afterbegin, beforeend, afterend
            ...options
        };

        // 清空容器(如果需要)
        if (config.clearFirst && !config.append) {
            container.innerHTML = '';
        }

        // 渲染内容
        let renderedContent;
        if (typeof content === 'string') {
            renderedContent = content;
        } else if (content instanceof Element) {
            container.appendChild(content);
            return;
        } else if (content.template && content.data) {
            renderedContent = this.renderTemplate(content.template, content.data);
        } else {
            console.error('[TemplateRenderer] 无效的内容类型');
            return;
        }

        // 插入内容
        if (config.append) {
            container.insertAdjacentHTML(config.position, renderedContent);
        } else {
            container.innerHTML = renderedContent;
        }
    }

    /**
     * 列表渲染器
     * 统一列表渲染模式，替代各种map+join操作
     */
    renderList(items, itemTemplate, options = {}) {
        if (!Array.isArray(items)) {
            console.error('[TemplateRenderer] items必须是数组');
            return '';
        }

        const config = {
            wrapper: null, // 包装元素模板
            separator: '', // 分隔符
            maxItems: null, // 最大显示数量
            showMore: false, // 显示"更多"按钮
            ...options
        };

        // 限制显示数量
        let displayItems = items;
        if (config.maxItems && items.length > config.maxItems) {
            displayItems = items.slice(0, config.maxItems);
        }

        // 渲染列表项
        const renderedItems = displayItems.map((item, index) => {
            const itemData = {
                ...item,
                _index: index,
                _isFirst: index === 0,
                _isLast: index === displayItems.length - 1
            };
            return this.renderTemplate(itemTemplate, itemData);
        });

        let result = renderedItems.join(config.separator);

        // 添加"更多"按钮
        if (config.maxItems && items.length > config.maxItems && config.showMore) {
            const moreCount = items.length - config.maxItems;
            result += `<div class="list-more">还有 ${moreCount} 项...</div>`;
        }

        // 包装器
        if (config.wrapper) {
            result = this.renderTemplate(config.wrapper, { content: result, count: items.length });
        }

        return result;
    }

    /**
     * 表单渲染器
     * 统一表单元素创建模式
     */
    createFormElement(type, config = {}) {
        const formElements = {
            input: (cfg) => this.createElement('input', {
                attributes: { type: cfg.inputType || 'text', name: cfg.name, value: cfg.value || '' },
                ...cfg
            }),
            
            textarea: (cfg) => this.createElement('textarea', {
                attributes: { name: cfg.name, rows: cfg.rows || 3 },
                textContent: cfg.value || '',
                ...cfg
            }),
            
            select: (cfg) => {
                const select = this.createElement('select', {
                    attributes: { name: cfg.name },
                    ...cfg
                });
                
                if (cfg.options) {
                    cfg.options.forEach(option => {
                        const optionEl = this.createElement('option', {
                            attributes: { value: option.value },
                            textContent: option.text || option.label
                        });
                        if (option.selected || option.value === cfg.value) {
                            optionEl.selected = true;
                        }
                        select.appendChild(optionEl);
                    });
                }
                
                return select;
            },
            
            button: (cfg) => this.createElement('button', {
                attributes: { type: cfg.buttonType || 'button' },
                textContent: cfg.text || cfg.label,
                ...cfg
            })
        };

        const creator = formElements[type];
        if (!creator) {
            console.error(`[TemplateRenderer] 未知表单元素类型: ${type}`);
            return this.createElement('div', { textContent: '表单元素错误' });
        }

        return creator(config);
    }

    // === 私有方法 ===

    /**
     * 应用基本属性
     */
    _applyBasicAttributes(element, options) {
        if (options.className) element.className = options.className;
        if (options.innerHTML) element.innerHTML = options.innerHTML;
        if (options.textContent) element.textContent = options.textContent;
        if (options.id) element.id = options.id;
    }

    /**
     * 变量插值
     */
    _interpolateVariables(template, data) {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return data[key] !== undefined ? data[key] : match;
        });
    }

    /**
     * 处理条件渲染
     */
    _processConditionals(template, data) {
        return template.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
            return data[condition] ? content : '';
        });
    }

    /**
     * 处理循环渲染
     */
    _processLoops(template, data) {
        return template.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, arrayKey, itemTemplate) => {
            const array = data[arrayKey];
            if (!Array.isArray(array)) return '';
            
            return array.map(item => this._interpolateVariables(itemTemplate, item)).join('');
        });
    }

    /**
     * HTML转义 - 使用 UnifiedUtils 统一实现
     */
    _escapeHtmlInData(template, data) {
        // 使用统一工具库进行HTML转义
        Object.keys(data).forEach(key => {
            if (typeof data[key] === 'string') {
                data[key] = window.UnifiedUtils ? 
                    window.UnifiedUtils.escapeHtml(data[key]) : 
                    data[key]; // 降级兼容
            }
        });
        return template;
    }

    /**
     * 生成缓存键
     */
    _getCacheKey(template, data) {
        return `${template.length}_${JSON.stringify(data).length}`;
    }

    /**
     * 获取注册的元素
     */
    getElement(id) {
        return this.elementsRegistry.get(id);
    }

    /**
     * 清空缓存
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * 清空缓存
     */
    clearCache() {
        this.cache.clear();
        this.log('debug', '模板缓存已清空');
    }

    /**
     * 销毁渲染器
     */
    destroy() {
        this.cache.clear();
        this.templates.clear();
        this.directives.clear();
        super.destroy(); // 调用 UIBase 的销毁方法
    }
}

// 注册到模块系统
if (window.registerModule) {
    window.registerModule('TemplateRenderer', TemplateRenderer, ['UIBase']);
}

// 创建全局单例
window.TemplateRenderer = window.getModule ? window.getModule('TemplateRenderer') : new TemplateRenderer();

// 为 UnifiedLogger 创建专用日志器
if (window.Loggers) {
    window.Loggers.TemplateRenderer = window.UnifiedLogger.createModuleLogger('TemplateRenderer');
}

// 模块注册
if (typeof window.ModuleLoader?.registerModule === 'function') {
    window.ModuleLoader.registerModule('template-renderer', 'core', '统一模板渲染器已加载 (基于 UIBase)');
} else {
    console.log('🎨 统一模板渲染器已加载 (基于 UIBase)');
}

export default TemplateRenderer;