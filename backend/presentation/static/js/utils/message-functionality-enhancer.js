/**
 * message-functionality-enhancer.js
 * 消息功能增强器
 * 
 * 目的：修复在重构过程中丢失的功能，增强用户体验
 * 特点：渐进增强，不破坏现有功能，可独立启用/禁用
 */
(function(){
    'use strict';
    
    const ENHANCER_CONFIG = {
        enabled: true,
        autoFocus: true,
        keyboardShortcuts: true,
        sendOnEnter: true,
        autoResize: true,
        fileDropZone: true,
        placeholderAnimation: false,
        debug: false
    };
    
    let state = {
        initialized: false,
        inputElement: null,
        sendButton: null,
        container: null,
        originalSendHandler: null
    };
    
    /**
     * 初始化功能增强器
     */
    function init(config = {}) {
        if (state.initialized) return;
        
        Object.assign(ENHANCER_CONFIG, config);
        
        if (!ENHANCER_CONFIG.enabled) {
            log('功能增强器已禁用');
            return;
        }
        
        // 等待DOM准备就绪
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeEnhancements);
        } else {
            initializeEnhancements();
        }
    }
    
    /**
     * 初始化所有增强功能
     */
    function initializeEnhancements() {
        log('初始化消息功能增强器...');
        
        findElements();
        
        if (!state.inputElement) {
            warn('未找到输入框元素，延迟重试...');
            setTimeout(initializeEnhancements, 500);
            return;
        }
        
        enhanceInput();
        enhanceKeyboardShortcuts();
        enhanceFileHandling();
        enhanceSendFunctionality();
        enhanceUserExperience();
        
        state.initialized = true;
        log('消息功能增强器初始化完成');
    }
    
    /**
     * 查找核心元素
     */
    function findElements() {
        // 查找输入框
        state.inputElement = document.getElementById('chatInput') || 
                            document.querySelector('.mobile-chat-textarea') ||
                            document.querySelector('.chat-input-field') ||
                            document.querySelector('textarea[placeholder*="消息"], input[placeholder*="消息"]');
        
        // 查找发送按钮
        state.sendButton = document.querySelector('.mobile-chat-send-btn') ||
                          document.querySelector('.chat-send-button') ||
                          document.querySelector('[data-action="send"]') ||
                          document.querySelector('button[type="submit"]');
        
        // 查找容器
        state.container = state.inputElement?.closest('.chat-input-container') ||
                         state.inputElement?.closest('.mobile-chat-input-bar') ||
                         state.inputElement?.parentElement;
    }
    
    /**
     * 增强输入框功能
     */
    function enhanceInput() {
        if (!state.inputElement) return;
        
        // 自动调整高度
        if (ENHANCER_CONFIG.autoResize && state.inputElement.tagName === 'TEXTAREA') {
            enhanceAutoResize();
        }
        
        // 自动聚焦
        if (ENHANCER_CONFIG.autoFocus) {
            enhanceAutoFocus();
        }
        
        // 占位符动画
        if (ENHANCER_CONFIG.placeholderAnimation) {
            enhancePlaceholderAnimation();
        }
        
        // 防止意外提交空消息
        enhanceEmptyMessagePrevention();
    }
    
    /**
     * 增强自动调整高度
     */
    function enhanceAutoResize() {
        const textarea = state.inputElement;
        
        function autoResize() {
            textarea.style.height = 'auto';
            const newHeight = Math.min(120, Math.max(40, textarea.scrollHeight));
            textarea.style.height = newHeight + 'px';
        }
        
        textarea.addEventListener('input', autoResize);
        textarea.addEventListener('paste', () => setTimeout(autoResize, 0));
        
        // 初始调整
        autoResize();
        
        log('已启用输入框自动调整高度');
    }
    
    /**
     * 增强自动聚焦
     */
    function enhanceAutoFocus() {
        // 页面加载后聚焦
        setTimeout(() => {
            if (state.inputElement && !document.activeElement?.tagName.match(/INPUT|TEXTAREA/)) {
                state.inputElement.focus();
            }
        }, 300);
        
        // 对话切换后聚焦
        document.addEventListener('conversation:selected', () => {
            setTimeout(() => {
                if (state.inputElement) {
                    state.inputElement.focus();
                }
            }, 100);
        });
        
        log('已启用输入框自动聚焦');
    }
    
    /**
     * 增强占位符动画
     */
    function enhancePlaceholderAnimation() {
        if (!state.inputElement) return;
        
        const placeholders = [
            '输入消息...',
            '有什么需要帮助的吗？',
            '请描述您的问题',
            '我们随时为您服务'
        ];
        
        let currentIndex = 0;
        
        function cyclePlaceholder() {
            if (state.inputElement && !state.inputElement.value) {
                state.inputElement.placeholder = placeholders[currentIndex];
                currentIndex = (currentIndex + 1) % placeholders.length;
            }
        }
        
        // 每5秒切换一次占位符
        setInterval(cyclePlaceholder, 5000);
        
        log('已启用占位符动画');
    }
    
    /**
     * 防止提交空消息
     */
    function enhanceEmptyMessagePrevention() {
        if (!state.sendButton) return;
        
        function updateSendButton() {
            const hasContent = state.inputElement.value.trim().length > 0;
            state.sendButton.disabled = !hasContent;
            
            if (hasContent) {
                state.sendButton.classList.add('has-content');
                state.sendButton.classList.remove('empty-content');
            } else {
                state.sendButton.classList.add('empty-content');
                state.sendButton.classList.remove('has-content');
            }
        }
        
        state.inputElement.addEventListener('input', updateSendButton);
        state.inputElement.addEventListener('paste', () => setTimeout(updateSendButton, 0));
        
        // 初始状态
        updateSendButton();
        
        log('已启用空消息防护');
    }
    
    /**
     * 增强键盘快捷键
     */
    function enhanceKeyboardShortcuts() {
        if (!ENHANCER_CONFIG.keyboardShortcuts || !state.inputElement) return;
        
        state.inputElement.addEventListener('keydown', (e) => {
            // Enter发送 (不按Shift)
            if (e.key === 'Enter' && !e.shiftKey && ENHANCER_CONFIG.sendOnEnter) {
                e.preventDefault();
                triggerSend();
            }
            
            // Escape清空
            if (e.key === 'Escape') {
                state.inputElement.value = '';
                state.inputElement.focus();
            }
            
            // Ctrl/Cmd + Enter 强制发送
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                triggerSend();
            }
        });
        
        log('已启用键盘快捷键 (Enter发送, Esc清空)');
    }
    
    /**
     * 增强文件处理
     */
    function enhanceFileHandling() {
        if (!ENHANCER_CONFIG.fileDropZone || !state.container) return;
        
        // 拖放支持
        state.container.addEventListener('dragover', (e) => {
            e.preventDefault();
            state.container.classList.add('drag-over');
        });
        
        state.container.addEventListener('dragleave', (e) => {
            if (!state.container.contains(e.relatedTarget)) {
                state.container.classList.remove('drag-over');
            }
        });
        
        state.container.addEventListener('drop', (e) => {
            e.preventDefault();
            state.container.classList.remove('drag-over');
            
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                handleFileSelection(files);
            }
        });
        
        // 粘贴图片支持
        state.inputElement.addEventListener('paste', (e) => {
            const items = Array.from(e.clipboardData.items);
            const imageItems = items.filter(item => item.type.startsWith('image/'));
            
            if (imageItems.length > 0) {
                e.preventDefault();
                const files = imageItems.map(item => item.getAsFile()).filter(file => file);
                if (files.length > 0) {
                    handleFileSelection(files);
                }
            }
        });
        
        log('已启用文件拖放和粘贴支持');
    }
    
    /**
     * 处理文件选择
     */
    function handleFileSelection(files) {
        // 尝试调用现有的文件处理器
        if (window.MediaHandler && window.MediaHandler.handleFileSelection) {
            window.MediaHandler.handleFileSelection(files);
            return;
        }
        
        // 尝试调用消息模块的文件处理
        const messageModule = window.MessageModuleInstance || window.messageModule;
        if (messageModule && messageModule.handleFileSelection) {
            messageModule.handleFileSelection(files);
            return;
        }
        
        // 简单处理：显示文件信息
        files.forEach(file => {
            log(`选择了文件: ${file.name} (${formatFileSize(file.size)})`);
        });
        
        // 显示提示
        if (window.Feedback) {
            window.Feedback.show(`选择了 ${files.length} 个文件`, 'info');
        }
    }
    
    /**
     * 增强发送功能
     */
    function enhanceSendFunctionality() {
        if (!state.sendButton) return;
        
        // 保存原始处理器
        const existingHandlers = [];
        
        // 移除现有的点击事件监听器
        state.sendButton.addEventListener('click', handleSendClick);
        
        log('已增强发送功能');
    }
    
    /**
     * 处理发送点击
     */
    function handleSendClick(e) {
        // 防止重复触发
        if (state.sendButton.disabled) {
            e.preventDefault();
            return;
        }
        
        triggerSend();
    }
    
    /**
     * 触发发送
     */
    function triggerSend() {
        const content = state.inputElement.value.trim();
        
        if (!content) {
            // 提示用户输入内容
            state.inputElement.focus();
            if (window.Feedback) {
                window.Feedback.show('请输入消息内容', 'warning');
            }
            return;
        }
        
        // 尝试调用现有的发送方法
        const messageModule = window.MessageModuleInstance || window.messageModule;
        
        if (messageModule && typeof messageModule.sendMessage === 'function') {
            messageModule.sendMessage();
        } else if (window.MessageSendChannelInstance && typeof window.MessageSendChannelInstance.sendText === 'function') {
            window.MessageSendChannelInstance.sendText(content);
            // 手动清空输入框
            state.inputElement.value = '';
            state.inputElement.focus();
        } else {
            warn('未找到可用的发送方法');
            if (window.Feedback) {
                window.Feedback.show('发送功能暂时不可用', 'error');
            }
        }
    }
    
    /**
     * 增强用户体验
     */
    function enhanceUserExperience() {
        // 添加CSS类以支持样式增强
        if (state.container) {
            state.container.classList.add('enhanced-input-container');
        }
        
        if (state.inputElement) {
            state.inputElement.classList.add('enhanced-input');
        }
        
        if (state.sendButton) {
            state.sendButton.classList.add('enhanced-send-btn');
        }
        
        // 添加增强样式
        addEnhancedStyles();
        
        log('已应用用户体验增强');
    }
    
    /**
     * 添加增强样式
     */
    function addEnhancedStyles() {
        if (document.getElementById('message-functionality-enhancer-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'message-functionality-enhancer-styles';
        style.textContent = `
            /* 消息功能增强样式 */
            .enhanced-input-container.drag-over {
                background: rgba(33, 150, 243, 0.1);
                border-color: #2196F3;
            }
            
            .enhanced-send-btn.empty-content {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .enhanced-send-btn.has-content {
                opacity: 1;
                transform: scale(1);
                transition: transform 0.2s ease;
            }
            
            .enhanced-send-btn.has-content:hover {
                transform: scale(1.05);
            }
            
            .enhanced-input {
                transition: all 0.2s ease;
            }
            
            .enhanced-input:focus {
                box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2);
            }
            
            /* 拖放提示 */
            .enhanced-input-container.drag-over::before {
                content: "拖放文件到此处";
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(33, 150, 243, 0.9);
                color: white;
                padding: 8px 16px;
                border-radius: 4px;
                font-size: 14px;
                z-index: 10;
                pointer-events: none;
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * 格式化文件大小
     */
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    /**
     * 日志输出
     */
    function log(...args) {
        if (ENHANCER_CONFIG.debug) {
            console.log('[MessageEnhancer]', ...args);
        }
    }
    
    function warn(...args) {
        console.warn('[MessageEnhancer]', ...args);
    }
    
    // 暴露到全局
    window.MessageFunctionalityEnhancer = {
        init,
        getState: () => ({ ...state }),
        getConfig: () => ({ ...ENHANCER_CONFIG }),
        triggerSend,
        findElements
    };
    
    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => init());
    } else {
        setTimeout(() => init(), 100);
    }
    
})();