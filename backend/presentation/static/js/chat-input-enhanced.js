/**
 * 聊天输入框增强模块
 * 提供富文本输入、文件上传、表情等功能
 */

class ChatInputEnhanced {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? 
            document.querySelector(container) : container;
        
        this.options = {
            maxLength: 2000,
            placeholder: '输入消息...',
            autoResize: true,
            enableFileUpload: true,
            enableEmoji: false,
            quickReplies: [],
            ...options
        };

        this.callbacks = {
            onSend: options.onSend || (() => {}),
            onFileSelect: options.onFileSelect || (() => {}),
            onTyping: options.onTyping || (() => {})
        };

        this.init();
    }

    init() {
        if (!this.container) {
            console.error('ChatInputEnhanced: 容器元素未找到');
            return;
        }

        this.createElements();
        this.bindEvents();
        
        console.log('💬 聊天输入框增强模块已初始化');
    }

    createElements() {
        this.container.innerHTML = `
            <div class="chat-input-container">
                ${this.options.quickReplies.length > 0 ? this.createQuickReplies() : ''}
                <div class="file-upload-preview" style="display: none;"></div>
                <div class="chat-input-wrapper">
                    ${this.options.enableFileUpload ? this.createFileButton() : ''}
                    <div class="chat-input-enhanced">
                        <textarea 
                            class="chat-input-field" 
                            placeholder="${this.options.placeholder}"
                            maxlength="${this.options.maxLength}"
                            rows="1"
                        ></textarea>
                        <div class="chat-input-counter">0/${this.options.maxLength}</div>
                    </div>
                    ${this.options.enableEmoji ? this.createEmojiButton() : ''}
                    <button class="chat-send-button" disabled>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M22 2L11 13" stroke="currentColor" stroke-width="2"/>
                            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </button>
                </div>
                <input type="file" class="file-input" style="display: none;" multiple 
                       accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt">
            </div>
        `;

        // 获取元素引用
        this.textArea = this.container.querySelector('.chat-input-field');
        this.sendButton = this.container.querySelector('.chat-send-button');
        this.fileInput = this.container.querySelector('.file-input');
        this.fileButton = this.container.querySelector('.chat-attachment-button');
        this.counter = this.container.querySelector('.chat-input-counter');
        this.previewContainer = this.container.querySelector('.file-upload-preview');
        
        this.selectedFiles = [];
    }

    createQuickReplies() {
        const replies = this.options.quickReplies.map(reply => 
            `<button class="quick-reply-button" data-reply="${reply}">${reply}</button>`
        ).join('');
        
        return `<div class="quick-replies">${replies}</div>`;
    }

    createFileButton() {
        return `
            <button class="chat-attachment-button" type="button">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M21.44 11.05L12.25 20.24C11.12 21.37 9.53 22 7.89 22C4.61 22 2 19.39 2 16.11C2 14.47 2.63 12.88 3.76 11.75L12.95 2.56C13.68 1.83 14.67 1.39 15.7 1.39C17.76 1.39 19.44 3.07 19.44 5.13C19.44 6.16 19 7.15 18.27 7.88L10.95 15.2C10.58 15.57 10.07 15.78 9.54 15.78C8.48 15.78 7.62 14.92 7.62 13.86C7.62 13.33 7.83 12.82 8.2 12.45L15.54 5.11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        `;
    }

    createEmojiButton() {
        return `
            <button class="emoji-picker-trigger" type="button">
                😊
            </button>
        `;
    }

    bindEvents() {
        // 输入框事件
        this.textArea.addEventListener('input', (e) => {
            this.handleInput(e);
            this.updateCounter();
            this.updateSendButton();
        });

        this.textArea.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });

        this.textArea.addEventListener('paste', (e) => {
            this.handlePaste(e);
        });

        // 发送按钮
        this.sendButton.addEventListener('click', () => {
            this.sendMessage();
        });

        // 文件上传
        if (this.fileButton) {
            this.fileButton.addEventListener('click', () => {
                this.fileInput.click();
            });
        }

        if (this.fileInput) {
            this.fileInput.addEventListener('change', (e) => {
                this.handleFileSelect(e);
            });
        }

        // 快捷回复
        this.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('quick-reply-button')) {
                this.insertQuickReply(e.target.dataset.reply);
            }
        });

        // 文件预览删除
        this.previewContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('file-preview-remove')) {
                this.removeFile(e.target.dataset.index);
            }
        });
    }

    handleInput(e) {
        if (this.options.autoResize) {
            this.autoResize();
        }

        // 输入中回调
        this.callbacks.onTyping(this.textArea.value);
    }

    handleKeyDown(e) {
        // Ctrl/Cmd + Enter 发送
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            this.sendMessage();
            return;
        }

        // Shift + Enter 换行
        if (e.shiftKey && e.key === 'Enter') {
            return; // 允许默认行为
        }

        // Enter 发送 (可配置)
        if (e.key === 'Enter' && !e.shiftKey && this.options.enterToSend !== false) {
            e.preventDefault();
            this.sendMessage();
        }
    }

    handlePaste(e) {
        const items = e.clipboardData.items;
        
        for (let item of items) {
            if (item.type.indexOf('image') !== -1) {
                const file = item.getAsFile();
                if (file) {
                    this.addFile(file);
                    e.preventDefault();
                }
            }
        }
    }

    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        files.forEach(file => this.addFile(file));
        
        // 清空input
        e.target.value = '';
    }

    addFile(file) {
        // 文件大小检查 (10MB)
        if (file.size > 10 * 1024 * 1024) {
            this.showError('文件大小不能超过 10MB');
            return;
        }

        const fileData = {
            file,
            id: Date.now() + Math.random(),
            name: file.name,
            size: file.size,
            type: file.type
        };

        this.selectedFiles.push(fileData);
        this.updateFilePreview();
        this.updateSendButton();
        
        this.callbacks.onFileSelect(fileData);
    }

    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.updateFilePreview();
        this.updateSendButton();
    }

    updateFilePreview() {
        if (this.selectedFiles.length === 0) {
            this.previewContainer.style.display = 'none';
            return;
        }

        this.previewContainer.style.display = 'flex';
        this.previewContainer.innerHTML = this.selectedFiles.map((fileData, index) => {
            const isImage = fileData.type.startsWith('image/');
            const preview = isImage ? 
                `<img src="${URL.createObjectURL(fileData.file)}" alt="${fileData.name}">` :
                `<div class="file-icon">${this.getFileIcon(fileData.type)}</div>`;
            
            return `
                <div class="file-preview-item">
                    ${preview}
                    <button class="file-preview-remove" data-index="${index}">×</button>
                </div>
            `;
        }).join('');
    }

    insertQuickReply(text) {
        const currentValue = this.textArea.value;
        const newValue = currentValue ? `${currentValue} ${text}` : text;
        
        this.textArea.value = newValue;
        this.textArea.focus();
        
        this.updateCounter();
        this.updateSendButton();
        this.autoResize();
    }

    autoResize() {
        this.textArea.style.height = 'auto';
        const newHeight = Math.min(this.textArea.scrollHeight, 120);
        this.textArea.style.height = newHeight + 'px';
    }

    updateCounter() {
        const length = this.textArea.value.length;
        const maxLength = this.options.maxLength;
        
        this.counter.textContent = `${length}/${maxLength}`;
        
        this.counter.className = 'chat-input-counter';
        if (length > maxLength * 0.9) {
            this.counter.classList.add('warning');
        }
        if (length >= maxLength) {
            this.counter.classList.add('error');
        }
    }

    updateSendButton() {
        const hasText = this.textArea.value.trim().length > 0;
        const hasFiles = this.selectedFiles.length > 0;
        
        this.sendButton.disabled = !hasText && !hasFiles;
    }

    sendMessage() {
        const text = this.textArea.value.trim();
        
        if (!text && this.selectedFiles.length === 0) {
            return;
        }

        const messageData = {
            text,
            files: this.selectedFiles
        };

        this.callbacks.onSend(messageData);
        
        // 清空输入
        this.clear();
    }

    clear() {
        this.textArea.value = '';
        this.selectedFiles = [];
        this.updateFilePreview();
        this.updateCounter();
        this.updateSendButton();
        this.autoResize();
    }

    focus() {
        this.textArea.focus();
    }

    setValue(value) {
        this.textArea.value = value;
        this.updateCounter();
        this.updateSendButton();
        this.autoResize();
    }

    getValue() {
        return this.textArea.value;
    }

    setPlaceholder(placeholder) {
        this.textArea.placeholder = placeholder;
    }

    disable() {
        this.textArea.disabled = true;
        this.sendButton.disabled = true;
        if (this.fileButton) this.fileButton.disabled = true;
    }

    enable() {
        this.textArea.disabled = false;
        this.updateSendButton();
        if (this.fileButton) this.fileButton.disabled = false;
    }

    showError(message) {
        // 简单错误提示
        if (window.toast) {
            window.toast.error(message);
        } else {
            alert(message);
        }
    }

    getFileIcon(type) {
        if (type.startsWith('image/')) return '🖼️';
        if (type.startsWith('video/')) return '🎥';
        if (type.startsWith('audio/')) return '🎵';
        if (type.includes('pdf')) return '📄';
        if (type.includes('word')) return '📝';
        return '📎';
    }
}

// 全局导出
window.ChatInputEnhanced = ChatInputEnhanced;

console.log('💬 聊天输入框增强模块已加载');