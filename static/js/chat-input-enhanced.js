/**
 * 聊天输入框增强功能模块
 * 作者：GitHub Copilot
 * 日期：2025-09-29
 * 功能：提供聊天输入框的交互增强功能
 */

(function(global) {
    'use strict';

    /**
     * 聊天输入框增强类
     */
    class ChatInputEnhancer {
        
        constructor(options = {}) {
            this.container = null;
            this.chatInput = null;
            this.sendBtn = null;
            this.quickRepliesContainer = null;
            this.inputToolbar = null;
            this.mainInputArea = null;
            
            // 配置选项
            this.options = {
                autoResize: true,
                maxHeight: 120,
                minHeight: 24,
                enableQuickReplies: true,
                enableVoice: true,
                enableEmoji: true,
                enableMedia: true,
                animationDuration: 300,
                placeholder: '输入消息...',
                ...options
            };
            
            this.isInitialized = false;
            this.isExpanded = false;
            this.quickRepliesVisible = false;
        }

        /**
         * 初始化聊天输入框
         * @param {string|HTMLElement} selector - 容器选择器或元素
         */
        init(selector) {
            if (typeof selector === 'string') {
                this.container = document.querySelector(selector);
            } else if (selector instanceof HTMLElement) {
                this.container = selector;
            }
            
            if (!this.container) {
                console.warn('ChatInputEnhancer: Container not found');
                return false;
            }
            
            this.setupElements();
            this.bindEvents();
            this.setupAutoResize();
            this.addAnimationClass();
            this.isInitialized = true;
            
            console.log('✅ ChatInputEnhancer initialized');
            return true;
        }

        /**
         * 设置DOM元素引用
         */
        setupElements() {
            this.chatInput = this.container.querySelector('.chat-input');
            this.sendBtn = this.container.querySelector('.send-btn');
            this.quickRepliesContainer = this.container.querySelector('.quick-replies');
            this.inputToolbar = this.container.querySelector('.input-toolbar');
            this.mainInputArea = this.container.querySelector('.main-input-area');
            
            // 设置初始占位符
            if (this.chatInput && this.options.placeholder) {
                this.chatInput.placeholder = this.options.placeholder;
            }
        }

        /**
         * 绑定事件监听器
         */
        bindEvents() {
            if (this.chatInput) {
                this.chatInput.addEventListener('focus', () => this.onInputFocus());
                this.chatInput.addEventListener('blur', () => this.onInputBlur());
                this.chatInput.addEventListener('input', () => this.onInputChange());
                this.chatInput.addEventListener('keydown', (e) => this.onKeyDown(e));
            }
            
            if (this.sendBtn) {
                this.sendBtn.addEventListener('click', () => this.onSendMessage());
            }
            
            // 快捷回复按钮
            const quickReplyToggle = this.container.querySelector('.quick-reply-toggle');
            if (quickReplyToggle) {
                quickReplyToggle.addEventListener('click', () => this.toggleQuickReplies());
            }
            
            // 快捷回复项点击
            if (this.quickRepliesContainer) {
                this.quickRepliesContainer.addEventListener('click', (e) => {
                    if (e.target.classList.contains('quick-reply-btn')) {
                        this.selectQuickReply(e.target.textContent);
                    }
                });
            }
            
            // 媒体按钮
            const mediaBtn = this.container.querySelector('.media-btn');
            if (mediaBtn) {
                mediaBtn.addEventListener('click', () => this.openMediaSelector());
            }
            
            // 表情按钮
            const emojiBtn = this.container.querySelector('.emoji-btn');
            if (emojiBtn) {
                emojiBtn.addEventListener('click', () => this.openEmojiPicker());
            }
            
            // 语音按钮
            const voiceBtn = this.container.querySelector('.voice-btn');
            if (voiceBtn) {
                voiceBtn.addEventListener('click', () => this.toggleVoiceRecord());
            }
        }

        /**
         * 设置自动调整高度
         */
        setupAutoResize() {
            if (!this.options.autoResize || !this.chatInput) return;
            
            // 如果输入框不是textarea，转换为textarea
            if (this.chatInput.tagName.toLowerCase() !== 'textarea') {
                const textarea = document.createElement('textarea');
                textarea.className = this.chatInput.className + ' textarea';
                textarea.placeholder = this.chatInput.placeholder;
                textarea.value = this.chatInput.value;
                textarea.rows = 1;
                
                this.chatInput.parentNode.replaceChild(textarea, this.chatInput);
                this.chatInput = textarea;
                
                // 重新绑定事件
                this.chatInput.addEventListener('focus', () => this.onInputFocus());
                this.chatInput.addEventListener('blur', () => this.onInputBlur());
                this.chatInput.addEventListener('input', () => this.onInputChange());
                this.chatInput.addEventListener('keydown', (e) => this.onKeyDown(e));
            }
            
            // 设置初始样式
            this.chatInput.style.minHeight = this.options.minHeight + 'px';
            this.chatInput.style.maxHeight = this.options.maxHeight + 'px';
            this.chatInput.style.overflowY = 'hidden';
            this.chatInput.style.resize = 'none';
        }

        /**
         * 添加动画类
         */
        addAnimationClass() {
            if (this.container) {
                this.container.classList.add('animate-in');
                
                setTimeout(() => {
                    this.container.classList.remove('animate-in');
                }, this.options.animationDuration);
            }
        }

        /**
         * 输入框获得焦点事件
         */
        onInputFocus() {
            if (this.mainInputArea) {
                this.mainInputArea.classList.add('focused');
            }
            if (this.container) {
                this.container.classList.add('focused');
            }
        }

        /**
         * 输入框失去焦点事件
         */
        onInputBlur() {
            if (this.mainInputArea) {
                this.mainInputArea.classList.remove('focused');
            }
            if (this.container) {
                this.container.classList.remove('focused');
            }
        }

        /**
         * 输入内容变化事件
         */
        onInputChange() {
            this.adjustInputHeight();
            this.updateSendButtonState();
        }

        /**
         * 键盘按键事件
         */
        onKeyDown(e) {
            // Enter发送消息（Shift+Enter换行）
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.onSendMessage();
            }
            
            // Escape取消输入
            if (e.key === 'Escape') {
                this.clearInput();
                this.chatInput.blur();
            }
        }

        /**
         * 自动调整输入框高度
         */
        adjustInputHeight() {
            if (!this.options.autoResize || !this.chatInput) return;
            
            // 重置高度以获取scrollHeight
            this.chatInput.style.height = 'auto';
            
            const scrollHeight = this.chatInput.scrollHeight;
            const minHeight = this.options.minHeight;
            const maxHeight = this.options.maxHeight;
            
            let newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));
            
            this.chatInput.style.height = newHeight + 'px';
            
            // 如果超过最大高度，显示滚动条
            if (scrollHeight > maxHeight) {
                this.chatInput.style.overflowY = 'auto';
            } else {
                this.chatInput.style.overflowY = 'hidden';
            }
            
            // 更新容器状态
            const isExpanded = newHeight > minHeight + 20;
            if (isExpanded !== this.isExpanded) {
                this.isExpanded = isExpanded;
                this.container?.classList.toggle('expanded', isExpanded);
            }
        }

        /**
         * 更新发送按钮状态
         */
        updateSendButtonState() {
            if (!this.sendBtn || !this.chatInput) return;
            
            const hasContent = this.chatInput.value.trim().length > 0;
            this.sendBtn.disabled = !hasContent;
            
            if (hasContent) {
                this.sendBtn.textContent = '发送';
            } else {
                this.sendBtn.textContent = '发送';
            }
        }

        /**
         * 发送消息
         */
        onSendMessage() {
            if (!this.chatInput) return;
            
            const content = this.chatInput.value.trim();
            if (!content) return;
            
            // 触发发送动画
            this.startSendingAnimation();
            
            // 触发自定义事件
            const event = new CustomEvent('chat:send', {
                detail: { content, timestamp: Date.now() }
            });
            this.container.dispatchEvent(event);
            
            // 清空输入框
            this.clearInput();
            
            // 停止发送动画
            setTimeout(() => {
                this.stopSendingAnimation();
            }, 1000);
        }

        /**
         * 清空输入框
         */
        clearInput() {
            if (this.chatInput) {
                this.chatInput.value = '';
                this.adjustInputHeight();
                this.updateSendButtonState();
            }
        }

        /**
         * 开始发送动画
         */
        startSendingAnimation() {
            if (this.sendBtn) {
                this.sendBtn.classList.add('sending');
                this.sendBtn.textContent = '发送中...';
                this.sendBtn.disabled = true;
            }
        }

        /**
         * 停止发送动画
         */
        stopSendingAnimation() {
            if (this.sendBtn) {
                this.sendBtn.classList.remove('sending');
                this.sendBtn.textContent = '发送';
                this.updateSendButtonState();
            }
        }

        /**
         * 切换快捷回复显示
         */
        toggleQuickReplies() {
            if (!this.quickRepliesContainer) return;
            
            this.quickRepliesVisible = !this.quickRepliesVisible;
            this.quickRepliesContainer.style.display = this.quickRepliesVisible ? 'flex' : 'none';
            
            const toggleBtn = this.container.querySelector('.quick-reply-toggle');
            if (toggleBtn) {
                toggleBtn.classList.toggle('active', this.quickRepliesVisible);
            }
        }

        /**
         * 选择快捷回复
         */
        selectQuickReply(text) {
            if (this.chatInput) {
                this.chatInput.value = text;
                this.chatInput.focus();
                this.adjustInputHeight();
                this.updateSendButtonState();
            }
            
            // 隐藏快捷回复
            this.toggleQuickReplies();
        }

        /**
         * 打开媒体选择器
         */
        openMediaSelector() {
            const fileInput = this.container.querySelector('#fileInput');
            if (fileInput) {
                fileInput.click();
            } else {
                // 创建临时文件输入
                const input = document.createElement('input');
                input.type = 'file';
                input.multiple = true;
                input.accept = 'image/*,audio/*,video/*,.pdf,.doc,.docx,.txt';
                input.onchange = (e) => this.onFileSelected(e);
                input.click();
            }
        }

        /**
         * 文件选择事件
         */
        onFileSelected(e) {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;
            
            // 触发文件选择事件
            const event = new CustomEvent('chat:filesSelected', {
                detail: { files, timestamp: Date.now() }
            });
            this.container.dispatchEvent(event);
        }

        /**
         * 打开表情选择器
         */
        openEmojiPicker() {
            // 简单的表情选择器
            const emojis = ['😊', '😂', '😍', '🤔', '👍', '👎', '❤️', '🎉'];
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            
            if (this.chatInput) {
                const cursorPos = this.chatInput.selectionStart;
                const textBefore = this.chatInput.value.substring(0, cursorPos);
                const textAfter = this.chatInput.value.substring(cursorPos);
                
                this.chatInput.value = textBefore + randomEmoji + textAfter;
                this.chatInput.setSelectionRange(cursorPos + randomEmoji.length, cursorPos + randomEmoji.length);
                
                this.adjustInputHeight();
                this.updateSendButtonState();
                this.chatInput.focus();
            }
            
            // 触发表情选择事件
            const event = new CustomEvent('chat:emojiSelected', {
                detail: { emoji: randomEmoji, timestamp: Date.now() }
            });
            this.container.dispatchEvent(event);
        }

        /**
         * 切换语音录制
         */
        toggleVoiceRecord() {
            const voiceBtn = this.container.querySelector('.voice-btn');
            if (!voiceBtn) return;
            
            const isRecording = voiceBtn.classList.contains('active');
            
            if (isRecording) {
                this.stopVoiceRecord();
            } else {
                this.startVoiceRecord();
            }
        }

        /**
         * 开始语音录制
         */
        startVoiceRecord() {
            const voiceBtn = this.container.querySelector('.voice-btn');
            if (voiceBtn) {
                voiceBtn.classList.add('active');
                voiceBtn.innerHTML = '<span class="voice-icon">⏹️</span>';
            }
            
            // 触发语音录制开始事件
            const event = new CustomEvent('chat:voiceRecordStart', {
                detail: { timestamp: Date.now() }
            });
            this.container.dispatchEvent(event);
        }

        /**
         * 停止语音录制
         */
        stopVoiceRecord() {
            const voiceBtn = this.container.querySelector('.voice-btn');
            if (voiceBtn) {
                voiceBtn.classList.remove('active');
                voiceBtn.innerHTML = '<span class="voice-icon">🎤</span>';
            }
            
            // 触发语音录制结束事件
            const event = new CustomEvent('chat:voiceRecordStop', {
                detail: { timestamp: Date.now() }
            });
            this.container.dispatchEvent(event);
        }

        /**
         * 设置占位符文本
         */
        setPlaceholder(text) {
            if (this.chatInput) {
                this.chatInput.placeholder = text;
            }
        }

        /**
         * 获取输入内容
         */
        getValue() {
            return this.chatInput ? this.chatInput.value : '';
        }

        /**
         * 设置输入内容
         */
        setValue(value) {
            if (this.chatInput) {
                this.chatInput.value = value;
                this.adjustInputHeight();
                this.updateSendButtonState();
            }
        }

        /**
         * 聚焦输入框
         */
        focus() {
            if (this.chatInput) {
                this.chatInput.focus();
            }
        }

        /**
         * 销毁实例
         */
        destroy() {
            // 移除事件监听器和清理
            if (this.container) {
                this.container.classList.remove('animate-in', 'focused', 'expanded');
            }
            
            this.isInitialized = false;
            console.log('ChatInputEnhancer destroyed');
        }
    }

    // 导出到全局
    global.ChatInputEnhancer = ChatInputEnhancer;
    
    // 便捷初始化函数
    global.initChatInput = function(selector, options = {}) {
        const enhancer = new ChatInputEnhancer(options);
        if (enhancer.init(selector)) {
            return enhancer;
        }
        return null;
    };

    // 如果支持模块化，也导出模块
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ChatInputEnhancer;
    }

})(typeof window !== 'undefined' ? window : global);

// DOM加载完成后自动初始化
document.addEventListener('DOMContentLoaded', function() {
    // 自动查找并初始化聊天输入框
    const chatInputContainers = document.querySelectorAll('.chat-input-container');
    
    chatInputContainers.forEach((container, index) => {
        const enhancer = new window.ChatInputEnhancer({
            placeholder: '输入消息...',
            autoResize: true,
            maxHeight: 120
        });
        
        if (enhancer.init(container)) {
            // 保存实例到容器数据属性
            container._chatInputEnhancer = enhancer;
            console.log(`✅ ChatInputEnhancer auto-initialized for container ${index + 1}`);
        }
    });
});