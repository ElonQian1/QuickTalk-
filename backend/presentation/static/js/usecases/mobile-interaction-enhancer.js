"use strict";

/**
 * 移动端交互增强模块
 * 负责改善移动端用户体验，包括触摸反馈、滚动优化、模态框交互等
 */

class MobileInteractionEnhancer {
    constructor() {
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        this.isAndroid = /Android/.test(navigator.userAgent);
        this.isTouch = 'ontouchstart' in window;
        this.scrollPosition = 0;
    }

    /**
     * 初始化移动端交互增强
     */
    init() {
        console.log('初始化移动端交互增强');
        this.setupTouchFeedback();
        this.setupModalInteraction();
        this.setupKeyboardHandling();
        this.setupScrollOptimization();
        this.setupViewportFix();
        this.setupFastClick();
    }

    /**
     * 设置触摸反馈
     */
    setupTouchFeedback() {
        // 为所有带 tap-feedback 类的元素添加触摸反馈
        document.addEventListener('touchstart', (e) => {
            const element = e.target.closest('.tap-feedback');
            if (element) {
                element.classList.add('touching');
            }
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            const element = e.target.closest('.tap-feedback');
            if (element) {
                setTimeout(() => {
                    element.classList.remove('touching');
                }, 150);
            }
        }, { passive: true });

        document.addEventListener('touchcancel', (e) => {
            const element = e.target.closest('.tap-feedback');
            if (element) {
                element.classList.remove('touching');
            }
        }, { passive: true });

        // 添加触摸反馈CSS
        this.addTouchFeedbackCSS();
    }

    /**
     * 添加触摸反馈CSS
     */
    addTouchFeedbackCSS() {
        const style = document.createElement('style');
        style.textContent = `
            .tap-feedback {
                transition: all 0.15s ease;
                position: relative;
                overflow: hidden;
            }
            
            .tap-feedback.touching {
                transform: scale(0.98);
                background-color: rgba(0, 0, 0, 0.05);
            }
            
            .tap-feedback:active {
                transform: scale(0.95);
            }
            
            /* 增强按钮触摸反馈 */
            .btn.tap-feedback.touching {
                transform: scale(0.96);
                opacity: 0.8;
            }
            
            /* 导航项触摸反馈 */
            .nav-item.tap-feedback.touching {
                background-color: rgba(102, 126, 234, 0.15);
            }
            
            /* 设置项触摸反馈 */
            .settings-item.tap-feedback.touching {
                background-color: #f0f0f0;
                transform: translateX(4px);
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 设置模态框交互优化
     */
    setupModalInteraction() {
        // 模态框背景点击关闭
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal') && e.target.classList.contains('show')) {
                this.closeCurrentModal();
            }
        });

        // 模态框滑动关闭手势（仅iOS）
        if (this.isIOS) {
            this.setupModalSwipeGesture();
        }

        // 阻止模态框后面的滚动
        this.setupModalScrollPrevention();
    }

    /**
     * 设置模态框滑动关闭手势
     */
    setupModalSwipeGesture() {
        let startY = 0;
        let startTime = 0;
        let modalContent = null;

        document.addEventListener('touchstart', (e) => {
            const modal = e.target.closest('.modal.show');
            if (modal) {
                modalContent = modal.querySelector('.modal-content');
                if (modalContent) {
                    startY = e.touches[0].clientY;
                    startTime = Date.now();
                }
            }
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (modalContent) {
                const currentY = e.touches[0].clientY;
                const deltaY = currentY - startY;
                
                if (deltaY > 0 && modalContent.scrollTop === 0) {
                    // 向下滑动且已在顶部，显示关闭手势
                    const progress = Math.min(deltaY / 200, 1);
                    modalContent.style.transform = `translateY(${deltaY * 0.5}px)`;
                    modalContent.style.opacity = 1 - progress * 0.3;
                }
            }
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            if (modalContent) {
                const currentY = e.changedTouches[0].clientY;
                const deltaY = currentY - startY;
                const deltaTime = Date.now() - startTime;
                const velocity = deltaY / deltaTime;

                if (deltaY > 100 || velocity > 0.5) {
                    // 关闭模态框
                    this.closeCurrentModal();
                } else {
                    // 恢复位置
                    modalContent.style.transform = '';
                    modalContent.style.opacity = '';
                }
                modalContent = null;
            }
        }, { passive: true });
    }

    /**
     * 阻止模态框后面的滚动
     */
    setupModalScrollPrevention() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1 && node.classList && node.classList.contains('modal')) {
                        if (node.classList.contains('show')) {
                            this.preventBodyScroll();
                        }
                    }
                });

                mutation.removedNodes.forEach((node) => {
                    if (node.nodeType === 1 && node.classList && node.classList.contains('modal')) {
                        this.restoreBodyScroll();
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * 阻止页面滚动
     */
    preventBodyScroll() {
        this.scrollPosition = window.pageYOffset;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${this.scrollPosition}px`;
        document.body.style.width = '100%';
    }

    /**
     * 恢复页面滚动
     */
    restoreBodyScroll() {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, this.scrollPosition);
    }

    /**
     * 关闭当前模态框
     */
    closeCurrentModal() {
        const openModal = document.querySelector('.modal.show');
        if (openModal) {
            openModal.classList.remove('show');
            openModal.style.display = 'none';
            
            // 清理模态框内容
            const overlay = document.getElementById('modal-overlay');
            if (overlay) {
                overlay.style.display = 'none';
                overlay.innerHTML = '';
            }
            
            this.restoreBodyScroll();
        }
    }

    /**
     * 设置键盘处理
     */
    setupKeyboardHandling() {
        if (!this.isIOS) return;

        // iOS键盘弹出时的视口调整
        let initialViewportHeight = window.innerHeight;

        window.addEventListener('resize', () => {
            const currentHeight = window.innerHeight;
            const heightDiff = initialViewportHeight - currentHeight;

            if (heightDiff > 150) {
                // 键盘弹出
                document.body.classList.add('keyboard-open');
                
                // 滚动到聚焦的输入框
                const activeElement = document.activeElement;
                if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                    setTimeout(() => {
                        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 300);
                }
            } else {
                // 键盘收起
                document.body.classList.remove('keyboard-open');
            }
        });

        // 为键盘显示添加样式
        const style = document.createElement('style');
        style.textContent = `
            body.keyboard-open .bottom-nav {
                transform: translateY(100%);
            }
            
            body.keyboard-open .modal-content {
                max-height: 70vh;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 设置滚动优化
     */
    setupScrollOptimization() {
        // 添加 iOS 滚动动量
        if (this.isIOS) {
            const style = document.createElement('style');
            style.textContent = `
                .modal-body,
                .page-content,
                .employees-list,
                .activity-list {
                    -webkit-overflow-scrolling: touch;
                }
            `;
            document.head.appendChild(style);
        }

        // 优化滚动性能
        let ticking = false;

        document.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    // 在这里可以添加滚动时的优化逻辑
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });
    }

    /**
     * 设置视口修复
     */
    setupViewportFix() {
        // 修复iOS视口高度问题
        const setViewportHeight = () => {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };

        setViewportHeight();
        window.addEventListener('resize', setViewportHeight);
        window.addEventListener('orientationchange', () => {
            setTimeout(setViewportHeight, 500);
        });

        // 添加CSS变量支持
        const style = document.createElement('style');
        style.textContent = `
            .full-height {
                height: calc(var(--vh, 1vh) * 100);
            }
            
            .modal {
                height: calc(var(--vh, 1vh) * 100);
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 设置快速点击
     */
    setupFastClick() {
        if (!this.isTouch) return;

        // 简单的快速点击实现
        let lastTouchTime = 0;

        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            const timeSinceLastTouch = now - lastTouchTime;
            
            if (timeSinceLastTouch < 500 && timeSinceLastTouch > 0) {
                e.preventDefault();
                
                // 触发点击事件
                const touch = e.changedTouches[0];
                const target = document.elementFromPoint(touch.clientX, touch.clientY);
                if (target) {
                    target.click();
                }
            }
            
            lastTouchTime = now;
        });
    }

    /**
     * 显示加载提示
     */
    showLoadingToast(message = '加载中...') {
        const toast = document.createElement('div');
        toast.className = 'loading-toast';
        toast.innerHTML = `
            <div class="loading-spinner"></div>
            <span>${message}</span>
        `;
        
        const style = document.createElement('style');
        if (!document.querySelector('#loading-toast-style')) {
            style.id = 'loading-toast-style';
            style.textContent = `
                .loading-toast {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: rgba(0, 0, 0, 0.8);
                    color: white;
                    padding: 16px 20px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    z-index: 9999;
                    font-size: 14px;
                }
                
                .loading-toast .loading-spinner {
                    width: 20px;
                    height: 20px;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-top: 2px solid white;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(toast);
        return toast;
    }

    /**
     * 隐藏加载提示
     */
    hideLoadingToast(toast) {
        if (toast && toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }
}

// 创建全局移动端交互增强器实例
window.mobileInteractionEnhancer = new MobileInteractionEnhancer();

// 当DOM加载完成时初始化
document.addEventListener('DOMContentLoaded', () => {
    if (window.mobileInteractionEnhancer) {
        window.mobileInteractionEnhancer.init();
    }
});