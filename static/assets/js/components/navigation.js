/**
 * Navigation Component - 导航组件
 * 提供统一的导航创建和管理功能
 * 
 * 功能特性:
 * - 底部导航栏
 * - 标签页导航
 * - 面包屑导航
 * - 激活状态管理
 * - 徽章和通知支持
 * - 响应式设计
 * - 无障碍访问支持
 */

export class Navigation {
    constructor(container, options = {}) {
        // 默认配置
        this.defaults = {
            type: 'bottom', // bottom, tabs, breadcrumb
            items: [],
            activeItem: null,
            className: '',
            showLabels: true,
            showIcons: true,
            showBadges: true,
            allowMultiple: false, // 是否允许多选（仅限标签页）
            onItemClick: null,
            onActiveChange: null
        };
        
        // 合并配置
        this.options = { ...this.defaults, ...options };
        
        // 容器元素
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        if (!this.container) {
            throw new Error('Navigation container not found');
        }
        
        // 状态管理
        this.items = new Map();
        this.activeItems = new Set();
        this.element = null;
        
        // 依赖注入
        this.eventBus = options.eventBus || window.EventBus;
        this.utils = options.utils || window.Utils;
        
        this.init();
    }
    
    /**
     * 初始化导航
     */
    init() {
        this.createNavigation();
        this.bindEvents();
        this.setupAccessibility();
        this.setInitialActive();
        
        this.logInfo('Navigation 组件初始化完成');
    }
    
    /**
     * 创建导航
     */
    createNavigation() {
        const { type, className } = this.options;
        
        this.element = document.createElement('nav');
        this.element.className = `nav nav-${type} ${className}`.trim();
        
        // 根据类型创建不同的导航结构
        switch (type) {
            case 'bottom':
                this.createBottomNav();
                break;
            case 'tabs':
                this.createTabsNav();
                break;
            case 'breadcrumb':
                this.createBreadcrumbNav();
                break;
            default:
                this.createBottomNav();
        }
        
        this.container.appendChild(this.element);
    }
    
    /**
     * 创建底部导航
     */
    createBottomNav() {
        this.element.className += ' bottom-nav';
        
        this.options.items.forEach(item => {
            const navItem = this.createBottomNavItem(item);
            this.element.appendChild(navItem);
            this.items.set(item.id, { ...item, element: navItem });
        });
    }
    
    /**
     * 创建底部导航项
     */
    createBottomNavItem(item) {
        const { id, icon, label, badge, disabled = false, href } = item;
        
        const navItem = document.createElement(href ? 'a' : 'div');
        navItem.className = 'nav-item';
        navItem.setAttribute('data-nav-id', id);
        
        if (href) {
            navItem.href = href;
        }
        
        if (disabled) {
            navItem.classList.add('nav-item-disabled');
            navItem.setAttribute('aria-disabled', 'true');
        }
        
        let content = '';
        
        // 图标
        if (this.options.showIcons && icon) {
            content += `<div class="nav-icon">${icon}</div>`;
        }
        
        // 标签
        if (this.options.showLabels && label) {
            content += `<div class="nav-label">${this.escapeHtml(label)}</div>`;
        }
        
        // 徽章
        if (this.options.showBadges && badge) {
            content += this.createBadge(badge);
        }
        
        navItem.innerHTML = content;
        
        return navItem;
    }
    
    /**
     * 创建标签页导航
     */
    createTabsNav() {
        this.element.className += ' tab-nav';
        
        this.options.items.forEach(item => {
            const tabItem = this.createTabItem(item);
            this.element.appendChild(tabItem);
            this.items.set(item.id, { ...item, element: tabItem });
        });
    }
    
    /**
     * 创建标签页项
     */
    createTabItem(item) {
        const { id, label, icon, badge, disabled = false, closable = false } = item;
        
        const tabItem = document.createElement('button');
        tabItem.className = 'tab-btn';
        tabItem.type = 'button';
        tabItem.setAttribute('data-nav-id', id);
        
        if (disabled) {
            tabItem.disabled = true;
            tabItem.classList.add('tab-btn-disabled');
        }
        
        let content = '';
        
        // 图标
        if (icon) {
            content += `<span class="tab-icon">${icon}</span>`;
        }
        
        // 标签
        if (label) {
            content += `<span class="tab-label">${this.escapeHtml(label)}</span>`;
        }
        
        // 徽章
        if (badge) {
            content += this.createBadge(badge);
        }
        
        // 关闭按钮
        if (closable) {
            content += '<span class="tab-close" aria-label="关闭">&times;</span>';
        }
        
        tabItem.innerHTML = content;
        
        return tabItem;
    }
    
    /**
     * 创建面包屑导航
     */
    createBreadcrumbNav() {
        this.element.className += ' breadcrumb-nav';
        
        const breadcrumbList = document.createElement('ol');
        breadcrumbList.className = 'breadcrumb';
        
        this.options.items.forEach((item, index) => {
            const breadcrumbItem = this.createBreadcrumbItem(item, index === this.options.items.length - 1);
            breadcrumbList.appendChild(breadcrumbItem);
            this.items.set(item.id, { ...item, element: breadcrumbItem });
        });
        
        this.element.appendChild(breadcrumbList);
    }
    
    /**
     * 创建面包屑项
     */
    createBreadcrumbItem(item, isLast) {
        const { id, label, href } = item;
        
        const breadcrumbItem = document.createElement('li');
        breadcrumbItem.className = 'breadcrumb-item';
        breadcrumbItem.setAttribute('data-nav-id', id);
        
        if (isLast) {
            breadcrumbItem.classList.add('breadcrumb-item-active');
            breadcrumbItem.setAttribute('aria-current', 'page');
            breadcrumbItem.textContent = label;
        } else {
            if (href) {
                const link = document.createElement('a');
                link.href = href;
                link.textContent = label;
                breadcrumbItem.appendChild(link);
            } else {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'breadcrumb-link';
                button.textContent = label;
                breadcrumbItem.appendChild(button);
            }
        }
        
        return breadcrumbItem;
    }
    
    /**
     * 创建徽章
     */
    createBadge(badge) {
        if (typeof badge === 'number' || typeof badge === 'string') {
            return `<div class="nav-badge">${badge}</div>`;
        }
        
        if (badge && typeof badge === 'object') {
            const { count, type = 'default', visible = true } = badge;
            
            if (!visible || !count) {
                return '';
            }
            
            const badgeClass = `nav-badge nav-badge-${type}`;
            return `<div class="${badgeClass}">${count}</div>`;
        }
        
        return '';
    }
    
    /**
     * 绑定事件
     */
    bindEvents() {
        this.element.addEventListener('click', (e) => {
            this.handleClick(e);
        });
        
        // 键盘导航
        this.element.addEventListener('keydown', (e) => {
            this.handleKeydown(e);
        });
    }
    
    /**
     * 处理点击事件
     */
    handleClick(e) {
        const navItem = e.target.closest('[data-nav-id]');
        if (!navItem) return;
        
        const itemId = navItem.getAttribute('data-nav-id');
        const itemData = this.items.get(itemId);
        
        if (!itemData || itemData.disabled) {
            e.preventDefault();
            return;
        }
        
        // 处理标签页关闭
        if (e.target.classList.contains('tab-close')) {
            e.preventDefault();
            e.stopPropagation();
            this.closeTab(itemId);
            return;
        }
        
        // 处理链接
        if (itemData.href && !e.defaultPrevented) {
            return; // 让浏览器处理链接导航
        }
        
        e.preventDefault();
        this.setActive(itemId);
    }
    
    /**
     * 处理键盘事件
     */
    handleKeydown(e) {
        const currentItem = e.target.closest('[data-nav-id]');
        if (!currentItem) return;
        
        const items = Array.from(this.element.querySelectorAll('[data-nav-id]'));
        const currentIndex = items.indexOf(currentItem);
        
        let targetIndex = currentIndex;
        
        switch (e.key) {
            case 'ArrowLeft':
            case 'ArrowUp':
                e.preventDefault();
                targetIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
                break;
                
            case 'ArrowRight':
            case 'ArrowDown':
                e.preventDefault();
                targetIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
                break;
                
            case 'Home':
                e.preventDefault();
                targetIndex = 0;
                break;
                
            case 'End':
                e.preventDefault();
                targetIndex = items.length - 1;
                break;
                
            case 'Enter':
            case ' ':
                e.preventDefault();
                const itemId = currentItem.getAttribute('data-nav-id');
                this.setActive(itemId);
                break;
        }
        
        if (targetIndex !== currentIndex) {
            const targetItem = items[targetIndex];
            if (targetItem) {
                targetItem.focus();
            }
        }
    }
    
    /**
     * 设置激活状态
     */
    setActive(itemId) {
        const itemData = this.items.get(itemId);
        if (!itemData || itemData.disabled) return;
        
        const { allowMultiple } = this.options;
        
        if (!allowMultiple) {
            // 清除其他激活状态
            this.activeItems.forEach(activeId => {
                if (activeId !== itemId) {
                    this.setItemActive(activeId, false);
                }
            });
            this.activeItems.clear();
        }
        
        // 切换当前项状态
        const isCurrentlyActive = this.activeItems.has(itemId);
        const newActiveState = !isCurrentlyActive;
        
        this.setItemActive(itemId, newActiveState);
        
        if (newActiveState) {
            this.activeItems.add(itemId);
        } else {
            this.activeItems.delete(itemId);
        }
        
        // 触发事件
        this.eventBus?.emit('navigation:activeChange', {
            itemId: itemId,
            active: newActiveState,
            activeItems: Array.from(this.activeItems),
            navigation: this
        });
        
        this.eventBus?.emit('navigation:itemClick', {
            itemId: itemId,
            item: itemData,
            navigation: this
        });
        
        // 调用回调
        if (this.options.onActiveChange && typeof this.options.onActiveChange === 'function') {
            this.options.onActiveChange(itemId, newActiveState, Array.from(this.activeItems), this);
        }
        
        if (this.options.onItemClick && typeof this.options.onItemClick === 'function') {
            this.options.onItemClick(itemId, itemData, this);
        }
    }
    
    /**
     * 设置单个项的激活状态
     */
    setItemActive(itemId, active) {
        const itemData = this.items.get(itemId);
        if (!itemData) return;
        
        const element = itemData.element;
        
        if (active) {
            element.classList.add('active');
            element.setAttribute('aria-selected', 'true');
        } else {
            element.classList.remove('active');
            element.setAttribute('aria-selected', 'false');
        }
    }
    
    /**
     * 关闭标签页
     */
    closeTab(itemId) {
        const itemData = this.items.get(itemId);
        if (!itemData) return;
        
        // 触发关闭事件
        this.eventBus?.emit('navigation:tabClose', {
            itemId: itemId,
            item: itemData,
            navigation: this
        });
        
        // 移除元素
        itemData.element.remove();
        
        // 从状态中移除
        this.items.delete(itemId);
        this.activeItems.delete(itemId);
        
        // 如果关闭的是激活项，激活下一个或上一个
        if (this.activeItems.size === 0 && this.items.size > 0) {
            const nextItem = this.items.keys().next().value;
            if (nextItem) {
                this.setActive(nextItem);
            }
        }
    }
    
    /**
     * 添加导航项
     */
    addItem(item, position = 'end') {
        const { type } = this.options;
        let navItem;
        
        switch (type) {
            case 'bottom':
                navItem = this.createBottomNavItem(item);
                break;
            case 'tabs':
                navItem = this.createTabItem(item);
                break;
            case 'breadcrumb':
                navItem = this.createBreadcrumbItem(item, false);
                break;
        }
        
        if (navItem) {
            if (position === 'start') {
                this.element.insertBefore(navItem, this.element.firstChild);
            } else {
                this.element.appendChild(navItem);
            }
            
            this.items.set(item.id, { ...item, element: navItem });
        }
    }
    
    /**
     * 移除导航项
     */
    removeItem(itemId) {
        const itemData = this.items.get(itemId);
        if (!itemData) return;
        
        itemData.element.remove();
        this.items.delete(itemId);
        this.activeItems.delete(itemId);
    }
    
    /**
     * 更新导航项
     */
    updateItem(itemId, updates) {
        const itemData = this.items.get(itemId);
        if (!itemData) return;
        
        // 更新数据
        Object.assign(itemData, updates);
        
        // 重新创建元素
        const newElement = this.createNavItem({ ...itemData });
        itemData.element.replaceWith(newElement);
        itemData.element = newElement;
    }
    
    /**
     * 更新徽章
     */
    updateBadge(itemId, badge) {
        const itemData = this.items.get(itemId);
        if (!itemData) return;
        
        const badgeElement = itemData.element.querySelector('.nav-badge');
        
        if (badge) {
            const newBadgeHTML = this.createBadge(badge);
            
            if (badgeElement) {
                badgeElement.outerHTML = newBadgeHTML;
            } else {
                itemData.element.insertAdjacentHTML('beforeend', newBadgeHTML);
            }
        } else if (badgeElement) {
            badgeElement.remove();
        }
        
        itemData.badge = badge;
    }
    
    /**
     * 获取激活项
     */
    getActiveItems() {
        return Array.from(this.activeItems);
    }
    
    /**
     * 获取导航项数据
     */
    getItem(itemId) {
        return this.items.get(itemId);
    }
    
    /**
     * 获取所有导航项
     */
    getAllItems() {
        return Array.from(this.items.entries()).map(([id, data]) => ({ id, ...data }));
    }
    
    /**
     * 设置初始激活状态
     */
    setInitialActive() {
        if (this.options.activeItem) {
            this.setActive(this.options.activeItem);
        }
    }
    
    /**
     * 设置无障碍访问
     */
    setupAccessibility() {
        const { type } = this.options;
        
        switch (type) {
            case 'bottom':
                this.element.setAttribute('role', 'navigation');
                this.element.setAttribute('aria-label', '底部导航');
                break;
                
            case 'tabs':
                this.element.setAttribute('role', 'tablist');
                this.element.setAttribute('aria-label', '标签页导航');
                
                // 为标签页设置ARIA属性
                this.items.forEach((itemData, itemId) => {
                    itemData.element.setAttribute('role', 'tab');
                    itemData.element.setAttribute('aria-selected', 'false');
                    itemData.element.setAttribute('tabindex', '-1');
                });
                
                // 设置第一个标签页可聚焦
                const firstTab = this.element.querySelector('[role="tab"]');
                if (firstTab) {
                    firstTab.setAttribute('tabindex', '0');
                }
                break;
                
            case 'breadcrumb':
                this.element.setAttribute('role', 'navigation');
                this.element.setAttribute('aria-label', '面包屑导航');
                
                const breadcrumbList = this.element.querySelector('.breadcrumb');
                if (breadcrumbList) {
                    breadcrumbList.setAttribute('role', 'list');
                }
                break;
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
     * 销毁导航
     */
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        this.items.clear();
        this.activeItems.clear();
        
        this.logInfo('Navigation 已销毁');
    }
    
    /**
     * 记录日志
     */
    logInfo(...args) {
        console.log('[Navigation]', ...args);
    }
    
    /**
     * 静态方法：创建底部导航
     */
    static createBottomNav(container, items, options = {}) {
        return new Navigation(container, {
            type: 'bottom',
            items: items,
            ...options
        });
    }
    
    /**
     * 静态方法：创建标签页导航
     */
    static createTabs(container, items, options = {}) {
        return new Navigation(container, {
            type: 'tabs',
            items: items,
            ...options
        });
    }
    
    /**
     * 静态方法：创建面包屑导航
     */
    static createBreadcrumb(container, items, options = {}) {
        return new Navigation(container, {
            type: 'breadcrumb',
            items: items,
            ...options
        });
    }
}

// 全局注册
if (typeof window !== 'undefined') {
    window.Navigation = Navigation;
}

export default Navigation;