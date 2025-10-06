/**
 * Toast - 轻通知组件
 * 继承自UIBase，专注于通知消息的显示和管理
 * 
 * 优化内容：
 * - 移除重复的DOM创建、样式注入、容器管理代码
 * - 使用UIBase提供的统一接口
 * - 保持原有的API兼容性
 */
(function(){
    'use strict';

    class Toast extends UIBase {
        constructor(options = {}) {
            super('Toast', {
                debug: false,
                defaultDuration: 2200,
                maxToasts: 5,
                containerSelector: 'body',
                ...options
            });

            this.activeToasts = [];
            this.toastCounter = 0;

            // 注入样式
            this._injectToastStyles();
            
            this.log('info', 'Toast组件初始化完成');
        }

        /**
         * 注入Toast样式
         */
        _injectToastStyles() {
            const styles = `
                #toast-container {
                    position: fixed;
                    left: 0;
                    right: 0;
                    bottom: 20px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    z-index: 9999;
                    pointer-events: none;
                }
                
                .toast-item {
                    color: #fff;
                    padding: 10px 14px;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,.2);
                    opacity: 0.98;
                    pointer-events: auto;
                    max-width: 90%;
                    transform: translateY(10px);
                    transition: all 0.3s ease;
                }
                
                .toast-item.show {
                    transform: translateY(0);
                }
                
                .toast-item.hide {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                
                .toast-success { background: #16a34a; }
                .toast-error { background: #dc2626; }
                .toast-warning { background: #f59e0b; }
                .toast-info { background: #334155; }
            `;
            
            this.injectStyles(styles);
        }

        /**
         * 显示Toast消息
         */
        show(message, options = {}) {
            const config = {
                type: 'info',
                duration: this.options.defaultDuration,
                ...options
            };

            // 限制同时显示的Toast数量
            if (this.activeToasts.length >= this.options.maxToasts) {
                this._removeOldestToast();
            }

            const toastElement = this._createToastElement(message, config.type);
            const container = this._ensureContainer();
            
            container.appendChild(toastElement);
            this.activeToasts.push(toastElement);

            // 显示动画
            requestAnimationFrame(() => {
                toastElement.classList.add('show');
            });

            // 自动隐藏
            this._scheduleHide(toastElement, config.duration);

            this.log('debug', 'Toast已显示:', message, config);
            return toastElement;
        }

        /**
         * 创建Toast元素
         */
        _createToastElement(message, type) {
            return this.createElement('div', {
                className: `toast-item toast-${type}`,
                textContent: message,
                id: `toast-${++this.toastCounter}`
            });
        }

        /**
         * 确保容器存在
         */
        _ensureContainer() {
            return this.ensureContainer('toast-container');
        }

        /**
         * 计划隐藏Toast
         */
        _scheduleHide(toastElement, duration) {
            setTimeout(() => {
                this._hideToast(toastElement);
            }, Math.max(800, duration));
        }

        /**
         * 隐藏Toast
         */
        async _hideToast(toastElement) {
            if (!toastElement.parentNode) return;

            toastElement.classList.add('hide');
            
            await this.delay(300); // 等待动画完成
            
            this._removeToast(toastElement);
        }

        /**
         * 移除Toast
         */
        _removeToast(toastElement) {
            const index = this.activeToasts.indexOf(toastElement);
            if (index > -1) {
                this.activeToasts.splice(index, 1);
            }

            if (toastElement.parentNode) {
                toastElement.parentNode.removeChild(toastElement);
            }

            this.log('debug', 'Toast已移除');
        }

        /**
         * 移除最旧的Toast
         */
        _removeOldestToast() {
            if (this.activeToasts.length > 0) {
                this._hideToast(this.activeToasts[0]);
            }
        }

        /**
         * 清空所有Toast
         */
        clearAll() {
            this.activeToasts.forEach(toast => this._hideToast(toast));
            this.log('info', '所有Toast已清空');
        }

        /**
         * 快捷方法
         */
        success(message, duration) {
            return this.show(message, { type: 'success', duration });
        }

        error(message, duration) {
            return this.show(message, { type: 'error', duration });
        }

        warning(message, duration) {
            return this.show(message, { type: 'warning', duration });
        }

        info(message, duration) {
            return this.show(message, { type: 'info', duration });
        }

        /**
         * 获取Toast统计
         */
        getStats() {
            return {
                activeCount: this.activeToasts.length,
                totalCreated: this.toastCounter,
                maxToasts: this.options.maxToasts
            };
        }
    }

    // 创建全局实例
    const toastInstance = new Toast();

    // 兼容旧版API
    window.Toast = {
        show: (message, options) => toastInstance.show(message, options),
        success: (message, duration) => toastInstance.success(message, duration),
        error: (message, duration) => toastInstance.error(message, duration),
        warning: (message, duration) => toastInstance.warning(message, duration),
        info: (message, duration) => toastInstance.info(message, duration),
        clearAll: () => toastInstance.clearAll(),
        getStats: () => toastInstance.getStats()
    };

    // 兼容旧接口
    window.showToast = function(message, type) {
        toastInstance.show(message, { type: type || 'info' });
    };

    console.log('✅ 优化的Toast组件已加载 (继承UIBase)');

})();