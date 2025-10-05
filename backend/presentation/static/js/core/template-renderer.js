/**
 * 统一模板渲染器 - 消除DOM创建和渲染重复代码
 * 
 * 设计目标:
 * 1. 统一DOM元素创建模式，避免重复的createElement代码
 * 2. 提供模板渲染功能，统一处理innerHTML和插值
 * 3. 统一状态UI生成（加载、错误、空状态）
 * 4. 提供样式应用和属性设置的标准方法
 * 
 * 这个渲染器将替代各文件中的重复DOM操作：
 * - ui-base.js 的 createElement
 * - utils-base.js 的 createElement  
 * - base-manager.js 的状态UI创建
 * - 各manager中的innerHTML设置模式
 */

class TemplateRenderer {
    constructor() {
        this.name = 'TemplateRenderer';
        this.cache = new Map(); // 模板缓存
        this.elementsRegistry = new Map(); // 元素注册表
    }

    /**
     * 统一DOM元素创建方法
     * 整合所有createElement重复实现
     */
    createElement(tag, options = {}) {
        const element = document.createElement(tag);
        
        // 设置基本属性
        this._applyBasicAttributes(element, options);
        
        // 设置样式
        this._applyStyles(element, options.styles);
        
        // 设置HTML属性
        this._applyAttributes(element, options.attributes);
        
        // 注册元素(如果提供ID)
        if (options.id) {
            this.elementsRegistry.set(options.id, element);
        }
        
        return element;
    }

    /**
     * 批量创建DOM元素
     * 统一的批量创建模式
     */
    createElements(elementConfigs) {
        const elements = {};
        
        Object.entries(elementConfigs).forEach(([key, config]) => {
            elements[key] = this.createElement(config.tag, {
                id: key,
                ...config
            });
        });
        
        return elements;
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
        const stateConfigs = {
            loading: {
                template: `
                    <div class="state-ui loading-state">
                        <div class="loading-spinner"></div>
                        <div class="loading-message">{{message}}</div>
                    </div>
                `,
                defaultData: { message: '加载中...' }
            },
            
            error: {
                template: `
                    <div class="state-ui error-state">
                        <div class="error-icon">❌</div>
                        <div class="error-message">{{message}}</div>
                        {{#if showRetry}}
                        <button class="retry-btn" onclick="{{retryCallback}}">重试</button>
                        {{/if}}
                    </div>
                `,
                defaultData: { message: '加载失败' }
            },
            
            empty: {
                template: `
                    <div class="state-ui empty-state">
                        <div class="empty-icon">📭</div>
                        <div class="empty-message">{{message}}</div>
                        {{#if showAction}}
                        <button class="action-btn" onclick="{{actionCallback}}">{{actionText}}</button>
                        {{/if}}
                    </div>
                `,
                defaultData: { message: '暂无数据' }
            },
            
            success: {
                template: `
                    <div class="state-ui success-state">
                        <div class="success-icon">✅</div>
                        <div class="success-message">{{message}}</div>
                    </div>
                `,
                defaultData: { message: '操作成功' }
            }
        };

        const config = stateConfigs[type];
        if (!config) {
            console.error(`[TemplateRenderer] 未知状态类型: ${type}`);
            return this.createElement('div', { textContent: '状态错误' });
        }

        const data = { ...config.defaultData, ...options };
        const html = this.renderTemplate(config.template, data);
        
        const container = this.createElement('div');
        container.innerHTML = html;
        return container.firstElementChild;
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
     * 应用样式
     */
    _applyStyles(element, styles) {
        if (!styles) return;
        
        if (typeof styles === 'string') {
            element.style.cssText = styles;
        } else if (typeof styles === 'object') {
            Object.assign(element.style, styles);
        }
    }

    /**
     * 应用HTML属性
     */
    _applyAttributes(element, attributes) {
        if (!attributes) return;
        
        Object.entries(attributes).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });
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
     * 销毁渲染器
     */
    destroy() {
        this.cache.clear();
        this.elementsRegistry.clear();
    }
}

// 导出单例
window.TemplateRenderer = new TemplateRenderer();

export default TemplateRenderer;