/**
 * unified-modal-system.js - 统一模态框系统
 * 
 * 🎯 功能：
 * - 提供统一的Modal基类
 * - 整合 modal-utils.js 和 temporary-modal.js 功能
 * - 标准化模态框生命周期管理
 * - 支持事件驱动和配置化
 * 
 * @version 1.0
 */

(function() {
    'use strict';

    // 防止重复初始化
    if (window.UnifiedModalSystem) return;

    /**
     * 统一模态框基类
     */
    class UnifiedModal {
        constructor(options = {}) {
            this.id = options.id || `modal-${Date.now()}`;
            this.title = options.title || '';
            this.content = options.content || '';
            this.className = options.className || '';
            this.closable = options.closable !== false;
            this.backgroundClose = options.backgroundClose !== false;
            this.onOpen = options.onOpen || null;
            this.onClose = options.onClose || null;
            this.autoRemove = options.autoRemove !== false;
            
            this.element = null;
            this.isOpen = false;
        }

        /**
         * 生成模态框HTML
         */
        generateHTML() {
            const closeButton = this.closable ? 
                `<button class="modal-close" data-modal-close="true">&times;</button>` : '';
            
            return `
                <div id="${this.id}" class="modal ${this.className}" style="display: none;">
                    <div class="modal-content">
                        ${this.title ? `
                            <div class="modal-header">
                                <h3>${this.title}</h3>
                                ${closeButton}
                            </div>
                        ` : ''}
                        <div class="modal-body">
                            ${this.content}
                        </div>
                    </div>
                </div>
            `;
        }

        /**
         * 打开模态框
         */
        open() {
            if (this.isOpen) return;

            // 创建DOM元素
            if (!this.element) {
                document.body.insertAdjacentHTML('beforeend', this.generateHTML());
                this.element = document.getElementById(this.id);
                this.bindEvents();
            }

            // 显示模态框
            this.element.style.display = 'flex';
            this.element.classList.add('show');
            document.body.style.overflow = 'hidden';
            
            this.isOpen = true;

            // 触发打开事件
            if (this.onOpen) {
                this.onOpen(this);
            }

            // 触发全局事件
            window.dispatchEvent(new CustomEvent('modalOpen', { detail: { modal: this } }));
        }

        /**
         * 关闭模态框
         */
        close() {
            if (!this.isOpen || !this.element) return;

            this.element.style.display = 'none';
            this.element.classList.remove('show');
            document.body.style.overflow = 'auto';
            
            this.isOpen = false;

            // 触发关闭事件
            if (this.onClose) {
                this.onClose(this);
            }

            // 自动移除临时模态框
            if (this.autoRemove) {
                setTimeout(() => this.destroy(), 100);
            }

            // 触发全局事件
            window.dispatchEvent(new CustomEvent('modalClose', { detail: { modal: this } }));
        }

        /**
         * 销毁模态框
         */
        destroy() {
            if (this.element) {
                this.element.remove();
                this.element = null;
            }
            this.isOpen = false;
        }

        /**
         * 绑定事件
         */
        bindEvents() {
            if (!this.element) return;

            // 关闭按钮事件
            const closeButtons = this.element.querySelectorAll('[data-modal-close="true"]');
            closeButtons.forEach(btn => {
                btn.addEventListener('click', () => this.close());
            });

            // 背景点击关闭
            if (this.backgroundClose) {
                this.element.addEventListener('click', (e) => {
                    if (e.target === this.element) {
                        this.close();
                    }
                });
            }

            // ESC键关闭
            if (this.closable) {
                const escHandler = (e) => {
                    if (e.key === 'Escape' && this.isOpen) {
                        this.close();
                        document.removeEventListener('keydown', escHandler);
                    }
                };
                document.addEventListener('keydown', escHandler);
            }
        }

        /**
         * 更新内容
         */
        updateContent(content) {
            this.content = content;
            if (this.element) {
                const bodyElement = this.element.querySelector('.modal-body');
                if (bodyElement) {
                    bodyElement.innerHTML = content;
                }
            }
        }

        /**
         * 更新标题
         */
        updateTitle(title) {
            this.title = title;
            if (this.element) {
                const titleElement = this.element.querySelector('.modal-header h3');
                if (titleElement) {
                    titleElement.textContent = title;
                }
            }
        }
    }

    /**
     * 模态框管理器
     */
    class ModalManager {
        constructor() {
            this.modals = new Map();
            this.modalStack = [];
        }

        /**
         * 创建模态框
         */
        create(options) {
            const modal = new UnifiedModal(options);
            this.modals.set(modal.id, modal);
            return modal;
        }

        /**
         * 获取模态框
         */
        get(id) {
            return this.modals.get(id);
        }

        /**
         * 打开模态框
         */
        open(idOrOptions) {
            let modal;
            
            if (typeof idOrOptions === 'string') {
                modal = this.get(idOrOptions);
                if (!modal) {
                    console.warn(`Modal ${idOrOptions} not found`);
                    return null;
                }
            } else {
                modal = this.create(idOrOptions);
            }

            modal.open();
            this.modalStack.push(modal);
            return modal;
        }

        /**
         * 关闭模态框
         */
        close(id) {
            const modal = typeof id === 'string' ? this.get(id) : id;
            if (modal) {
                modal.close();
                const index = this.modalStack.indexOf(modal);
                if (index > -1) {
                    this.modalStack.splice(index, 1);
                }
            }
        }

        /**
         * 关闭所有模态框
         */
        closeAll() {
            [...this.modalStack].forEach(modal => this.close(modal));
            this.modalStack = [];
        }

        /**
         * 获取顶层模态框
         */
        getTop() {
            return this.modalStack[this.modalStack.length - 1] || null;
        }
    }

    // 创建全局实例
    const modalManager = new ModalManager();

    // 统一模态框系统
    const UnifiedModalSystem = {
        UnifiedModal,
        ModalManager,
        manager: modalManager,

        // 便捷方法
        create: (options) => modalManager.create(options),
        open: (idOrOptions) => modalManager.open(idOrOptions),
        close: (id) => modalManager.close(id),
        closeAll: () => modalManager.closeAll(),
        get: (id) => modalManager.get(id),

        // 快速创建方法
        alert: (title, content, options = {}) => {
            return modalManager.open({
                title,
                content,
                className: 'alert-modal',
                ...options
            });
        },

        confirm: (title, content, onConfirm, options = {}) => {
            const confirmContent = `
                ${content}
                <div class="modal-actions">
                    <button class="btn btn-secondary" data-modal-close="true">取消</button>
                    <button class="btn btn-primary" data-modal-confirm="true">确认</button>
                </div>
            `;
            
            const modal = modalManager.open({
                title,
                content: confirmContent,
                className: 'confirm-modal',
                ...options,
                onOpen: (modal) => {
                    const confirmBtn = modal.element.querySelector('[data-modal-confirm="true"]');
                    if (confirmBtn) {
                        confirmBtn.addEventListener('click', () => {
                            if (onConfirm) onConfirm();
                            modal.close();
                        });
                    }
                }
            });
            
            return modal;
        }
    };

    // 向下兼容的全局方法
    window.openModal = function(modalId) {
        // 优先使用新系统
        const existingModal = modalManager.get(modalId);
        if (existingModal) {
            existingModal.open();
            return;
        }

        // 降级到原有逻辑
        const modal = document.getElementById(modalId);
        const overlay = document.getElementById('modal-overlay');
        if (modal && overlay) {
            overlay.style.display = 'block';
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    };

    window.closeModal = function(modalId) {
        // 优先使用新系统
        const existingModal = modalManager.get(modalId);
        if (existingModal) {
            existingModal.close();
            return;
        }

        // 降级到原有逻辑
        const modal = document.getElementById(modalId);
        const overlay = document.getElementById('modal-overlay');
        if (overlay) overlay.style.display = 'none';
        document.body.style.overflow = 'auto';

        if (modalId && modalId.startsWith('temp-modal-')) {
            if (modal) modal.remove();
            return;
        }
        if (modal) modal.classList.remove('show');
    };

    window.closeAllModals = function() {
        modalManager.closeAll();
        
        // 降级处理
        const overlay = document.getElementById('modal-overlay');
        const modals = document.querySelectorAll('.modal.show');
        if (overlay) overlay.style.display = 'none';
        modals.forEach(m => m.classList.remove('show'));
        document.body.style.overflow = 'auto';
    };

    window.showModal = function(title, content, options = {}) {
        return UnifiedModalSystem.alert(title, content, {
            autoRemove: true,
            ...options
        });
    };

    // 暴露到全局
    window.UnifiedModalSystem = UnifiedModalSystem;
    window.UnifiedModal = UnifiedModal;
    window.ModalManager = ModalManager;

    console.log('✅ 统一模态框系统已加载 (UnifiedModalSystem)');

})();