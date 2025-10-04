/**
 * MediaHandler - 媒体处理器
 * 职责：文件上传、文件发送、语音录制、媒体元素创建
 * 依赖：Notify, MessagesManager
 */
(function() {
    'use strict';

    class MediaHandler {
        constructor(options = {}) {
            this.messagesManager = options.messagesManager || null;
            this.debug = options.debug || false;
            
            // 语音录制状态
            this.isRecording = false;
            this.mediaRecorder = null;
            this.recordedChunks = [];
            
            // 支持的文件类型
            this.supportedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            this.supportedAudioTypes = ['audio/wav', 'audio/mp3', 'audio/ogg', 'audio/m4a'];
            this.supportedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg'];
            
            // 文件大小限制 (10MB)
            this.maxFileSize = 10 * 1024 * 1024;
            
            this.initEventListeners();
        }

        /**
         * 初始化事件监听器
         */
        initEventListeners() {
            // 文件选择按钮
            const mediaBtn = document.getElementById('mediaBtn');
            const fileInput = document.getElementById('fileInput');
            const voiceBtn = document.getElementById('voiceBtn');

            if (mediaBtn && fileInput) {
                mediaBtn.addEventListener('click', () => {
                    fileInput.click();
                });

                fileInput.addEventListener('change', (e) => {
                    this.handleFileSelection(e.target.files);
                    e.target.value = ''; // 重置，允许重复选择相同文件
                });
            }

            if (voiceBtn) {
                voiceBtn.addEventListener('click', () => {
                    this.toggleVoiceRecording();
                });
            }
        }

        /**
         * 处理文件选择
         */
        async handleFileSelection(files) {
            if (!files || files.length === 0) return;
            
            if (!this.messagesManager || !this.messagesManager.getCurrentConversationId()) {
                if (window.Notify) {
                    window.Notify.error('请先选择一个对话');
                }
                return;
            }

            if (window.Notify) {
                window.Notify.info('正在发送文件...');
            }

            const fileArray = Array.from(files);
            
            // 验证文件
            for (const file of fileArray) {
                if (!this.validateFile(file)) {
                    continue;
                }
                
                await this.sendFileDirectly(file);
            }
        }

        /**
         * 验证文件
         */
        validateFile(file) {
            // 检查文件大小
            if (file.size > this.maxFileSize) {
                if (window.Notify) {
                    window.Notify.error(`文件 "${file.name}" 过大，最大支持 ${this.formatFileSize(this.maxFileSize)}`);
                }
                return false;
            }

            // 检查文件类型（可选，服务器也会验证）
            const allSupportedTypes = [
                ...this.supportedImageTypes,
                ...this.supportedAudioTypes,
                ...this.supportedVideoTypes,
                'application/pdf',
                'text/plain',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ];

            if (!allSupportedTypes.includes(file.type) && this.debug) {
                console.warn('[MediaHandler] 未知文件类型:', file.type);
            }

            return true;
        }

        /**
         * 直接发送文件
         */
        async sendFileDirectly(file) {
            try {
                // 上传文件
                const uploadResult = await this.uploadFile(file);
                if (!uploadResult.success) {
                    if (window.Notify) {
                        window.Notify.error(`${file.name} 上传失败`);
                    }
                    return false;
                }

                // 构建文件信息
                const fileInfo = {
                    url: uploadResult.url,
                    type: file.type,
                    name: file.name,
                    size: file.size
                };

                if (this.debug) {
                    console.log('[MediaHandler] 发送文件信息:', fileInfo);
                }

                // 通过消息管理器发送
                if (this.messagesManager) {
                    const success = await this.messagesManager.sendFileMessage(fileInfo);
                    if (success && window.Notify) {
                        window.Notify.success(`${file.name} 已发送`);
                    }
                    return success;
                } else {
                    // 降级：直接发送WebSocket消息
                    return this.sendFileMessageLegacy(fileInfo);
                }
            } catch (error) {
                console.error('[MediaHandler] 文件发送失败:', error);
                if (window.Notify) {
                    window.Notify.error(`${file.name} 发送失败`);
                }
                return false;
            }
        }

        /**
         * 上传文件到服务器
         */
        async uploadFile(file) {
            const conversationId = this.messagesManager 
                ? this.messagesManager.getCurrentConversationId()
                : (window.messageModule ? window.messageModule.currentConversationId : null);

            if (!conversationId) {
                throw new Error('未选择对话');
            }

            const formData = new FormData();
            formData.append('file', file);
            formData.append('conversation_id', conversationId);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (result.success && result.data && result.data.files && result.data.files.length > 0) {
                const fileInfo = result.data.files[0];
                return {
                    success: true,
                    url: fileInfo.url
                };
            } else {
                throw new Error(result.error || result.message || '上传失败');
            }
        }

        /**
         * 降级发送文件消息
         */
        sendFileMessageLegacy(fileInfo) {
            const conversationId = window.messageModule ? window.messageModule.currentConversationId : null;
            if (!conversationId) return false;

            const messageData = {
                type: 'message',
                conversation_id: conversationId,
                content: '',
                files: [fileInfo],
                sender_type: 'agent',
                timestamp: Date.now()
            };

            // 发送WebSocket消息
            if (window.messageModule && window.messageModule.wsAdapter) {
                return window.messageModule.wsAdapter.send(messageData);
            } else if (window.messageModule && window.messageModule.websocket && 
                       window.messageModule.websocket.readyState === WebSocket.OPEN) {
                window.messageModule.websocket.send(JSON.stringify(messageData));
                return true;
            }

            return false;
        }

        /**
         * 切换语音录制
         */
        async toggleVoiceRecording() {
            const voiceBtn = document.getElementById('voiceBtn');
            const voiceIcon = voiceBtn?.querySelector('.voice-icon');

            if (!this.isRecording) {
                const started = await this.startVoiceRecording();
                if (started) {
                    if (voiceBtn) voiceBtn.classList.add('recording');
                    if (voiceIcon) voiceIcon.textContent = '⏹️';
                }
            } else {
                this.stopVoiceRecording();
                if (voiceBtn) voiceBtn.classList.remove('recording');
                if (voiceIcon) voiceIcon.textContent = '🎤';
            }
        }

        /**
         * 开始语音录制
         */
        async startVoiceRecording() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this.mediaRecorder = new MediaRecorder(stream);
                this.recordedChunks = [];

                this.mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        this.recordedChunks.push(event.data);
                    }
                };

                this.mediaRecorder.onstop = async () => {
                    const blob = new Blob(this.recordedChunks, { type: 'audio/wav' });
                    const file = new File([blob], `语音消息_${Date.now()}.wav`, { type: 'audio/wav' });
                    
                    // 发送语音文件
                    await this.sendFileDirectly(file);
                    
                    // 停止所有音轨
                    stream.getTracks().forEach(track => track.stop());
                };

                this.mediaRecorder.start();
                this.isRecording = true;
                
                if (window.Notify) {
                    window.Notify.info('开始录音...');
                }
                
                return true;
            } catch (error) {
                console.error('[MediaHandler] 录音启动失败:', error);
                if (window.Notify) {
                    window.Notify.error('录音功能不可用');
                }
                return false;
            }
        }

        /**
         * 停止语音录制
         */
        stopVoiceRecording() {
            if (this.mediaRecorder && this.isRecording) {
                this.mediaRecorder.stop();
                this.isRecording = false;
                
                if (window.Notify) {
                    window.Notify.success('录音完成');
                }
            }
        }

        /**
         * 创建媒体元素（用于消息渲染）
         */
        createMediaElement(file) {
            if (!file || !file.url) {
                return this.createFallbackElement(file);
            }

            const fileType = file.type || '';
            
            if (this.supportedImageTypes.some(type => fileType.startsWith(type))) {
                return this.createImageElement(file);
            } else if (this.supportedAudioTypes.some(type => fileType.startsWith(type))) {
                return this.createAudioElement(file);
            } else if (this.supportedVideoTypes.some(type => fileType.startsWith(type))) {
                return this.createVideoElement(file);
            } else {
                return this.createFileElement(file);
            }
        }

        /**
         * 创建图片元素
         */
        createImageElement(file) {
            const container = document.createElement('div');
            container.className = 'message-image';
            
            const img = document.createElement('img');
            img.src = file.url;
            img.alt = file.name || '图片';
            img.style.maxWidth = '200px';
            img.style.maxHeight = '200px';
            img.style.cursor = 'pointer';
            
            img.addEventListener('click', () => {
                this.openImageModal(file.url);
            });
            
            container.appendChild(img);
            return container;
        }

        /**
         * 创建音频元素
         */
        createAudioElement(file) {
            const container = document.createElement('div');
            container.className = 'message-audio';
            
            const audio = document.createElement('audio');
            audio.src = file.url;
            audio.controls = true;
            audio.preload = 'metadata';
            
            container.appendChild(audio);
            
            // 添加文件信息
            const info = document.createElement('div');
            info.className = 'file-info';
            info.textContent = `🎵 ${file.name || '音频文件'}`;
            container.appendChild(info);
            
            return container;
        }

        /**
         * 创建视频元素
         */
        createVideoElement(file) {
            const container = document.createElement('div');
            container.className = 'message-video';
            
            const video = document.createElement('video');
            video.src = file.url;
            video.controls = true;
            video.preload = 'metadata';
            video.style.maxWidth = '300px';
            video.style.maxHeight = '200px';
            
            container.appendChild(video);
            
            // 添加文件信息
            const info = document.createElement('div');
            info.className = 'file-info';
            info.textContent = `🎥 ${file.name || '视频文件'}`;
            container.appendChild(info);
            
            return container;
        }

        /**
         * 创建文件元素
         */
        createFileElement(file) {
            const container = document.createElement('div');
            container.className = 'message-file';
            
            const link = document.createElement('a');
            link.href = file.url;
            link.target = '_blank';
            link.download = file.name || 'file';
            
            const icon = this.getFileIcon(file.type || '');
            const name = file.name || '未知文件';
            const size = file.size ? this.formatFileSize(file.size) : '';
            
            link.innerHTML = `
                <div class="file-item">
                    <span class="file-icon">${icon}</span>
                    <div class="file-details">
                        <div class="file-name">${name}</div>
                        ${size ? `<div class="file-size">${size}</div>` : ''}
                    </div>
                </div>
            `;
            
            container.appendChild(link);
            return container;
        }

        /**
         * 创建降级元素
         */
        createFallbackElement(file) {
            const div = document.createElement('div');
            div.className = 'message-file-fallback';
            div.textContent = file?.name || 'file';
            return div;
        }

        /**
         * 打开图片模态框
         */
        openImageModal(src) {
            // 优先使用现有的图片灯箱
            if (window.ImageLightbox && typeof window.ImageLightbox.open === 'function') {
                window.ImageLightbox.open(src);
                return;
            }

            // 降级：简单模态框
            const modal = document.createElement('div');
            modal.className = 'image-modal';
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.8); z-index: 9999; display: flex;
                align-items: center; justify-content: center; cursor: pointer;
            `;
            
            const img = document.createElement('img');
            img.src = src;
            img.style.maxWidth = '90%';
            img.style.maxHeight = '90%';
            img.style.objectFit = 'contain';
            
            modal.appendChild(img);
            document.body.appendChild(modal);
            
            modal.addEventListener('click', () => {
                document.body.removeChild(modal);
            });
        }

        /**
         * 获取文件图标
         */
        getFileIcon(mimeType) {
            if (mimeType.startsWith('image/')) return '🖼️';
            if (mimeType.startsWith('audio/')) return '🎵';
            if (mimeType.startsWith('video/')) return '🎥';
            if (mimeType.includes('pdf')) return '📄';
            if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
            if (mimeType.includes('text')) return '📃';
            if (mimeType.includes('zip') || mimeType.includes('rar')) return '📦';
            return '📁';
        }

        /**
         * 格式化文件大小
         */
        formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        /**
         * 设置消息管理器
         */
        setMessagesManager(messagesManager) {
            this.messagesManager = messagesManager;
        }

        /**
         * 获取录制状态
         */
        getRecordingState() {
            return {
                isRecording: this.isRecording,
                hasRecorder: !!this.mediaRecorder
            };
        }

        /**
         * 销毁处理器
         */
        destroy() {
            if (this.isRecording) {
                this.stopVoiceRecording();
            }
            
            this.messagesManager = null;
            this.mediaRecorder = null;
            this.recordedChunks = [];
        }
    }

    // 暴露到全局
    window.MediaHandler = MediaHandler;
    
    console.log('✅ 媒体处理器已加载 (media-handler.js)');
})();