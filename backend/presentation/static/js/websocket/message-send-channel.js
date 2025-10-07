/**
 * MessageSendChannel - 统一消息发送通道
 * 继承自WebSocketBase，专注于消息发送、队列管理和状态跟踪
 * 
 * 优化内容：
 * - 移除重复的事件总线访问代码
 * - 使用WebSocketBase的统一事件和日志系统
 * - 保持原有的发送队列和重试逻辑
 */
(function(){
    'use strict';

    class MessageSendChannel extends WebSocketBase {
        constructor(options = {}) {
            super('MessageSendChannel', {
                maxRetries: 3,
                baseRetryDelayMs: 800,
                debug: false,
                ...options
            });

            // 消息发送队列
            this.queue = [];
            this._sending = false;

            // 默认配置
            this.defaults = {
                fingerprint: draft => {
                    const c = (draft.payload.content || '').slice(0, 32);
                    return `${draft.conversation_id}|${draft.type}|${c}|${draft.createdAt}`;
                },
                now: () => Date.now()
            };

            this.log('info', '消息发送通道初始化完成');
        }

        // 错误码映射（第一阶段：基础推断，后续可由后端 error_code 增强）
        _mapSendError(err){
            const raw = (err && err.message) ? String(err.message) : '';
            const T = (k,f)=> (typeof window.getText==='function') ? window.getText(k,f) : ((window.StateTexts && window.StateTexts[k]) || f || k);
            // 规则顺序：特征匹配 -> 默认
            if (/未建立连接|not connected|WebSocket.*closed/i.test(raw)) return { code:'NOT_CONNECTED', key:'MESSAGE_NOT_CONNECTED', text: T('MESSAGE_NOT_CONNECTED','尚未建立连接') };
            if (/timeout|超时/i.test(raw)) return { code:'TIMEOUT', key:'MESSAGE_TIMEOUT', text: T('MESSAGE_TIMEOUT','发送超时') };
            if (/429|rate limit|频繁/i.test(raw)) return { code:'RATE_LIMIT', key:'MESSAGE_RATE_LIMIT', text: T('MESSAGE_RATE_LIMIT','发送过于频繁，请稍后再试') };
            if (/payload|content|不合法|invalid/i.test(raw)) return { code:'PAYLOAD_INVALID', key:'MESSAGE_PAYLOAD_INVALID', text: T('MESSAGE_PAYLOAD_INVALID','消息内容不合法') };
            if (/5\d{2}|服务器|server error/i.test(raw)) return { code:'SERVER_ERROR', key:'MESSAGE_SERVER_ERROR', text: T('MESSAGE_SERVER_ERROR','服务器处理失败') };
            return { code:'UNKNOWN', key:'MESSAGE_SEND_FINAL_FAIL', text: T('MESSAGE_SEND_FINAL_FAIL','消息发送失败') };
        }

        // 调试辅助：外部可快速模拟查看映射。
        static debugMapError(sample){
            const ch = window.MessageSendChannelInstance || new MessageSendChannel({debug:true});
            return ch._mapSendError(new Error(sample));
        }

        /**
         * 单例初始化
         */
        static init(options) {
            if (window.MessageSendChannelInstance) {
                return window.MessageSendChannelInstance;
            }
            window.MessageSendChannelInstance = new MessageSendChannel(options || {});
            return window.MessageSendChannelInstance;
        }

        /**
         * 发送文本消息
         */
        sendText(content) {
            const conversationId = this._resolveConversation();
            if (!conversationId || !content || !content.trim()) {
                this.log('warn', '发送文本消息失败：缺少对话ID或内容');
                return null;
            }

            const draft = this._buildDraft({
                type: 'text',
                conversation_id: conversationId,
                payload: { content: content.trim() }
            });

            return this._enqueue(draft);
        }

        /**
         * 发送文件消息
         */
        sendFile(file, additionalData = {}) {
            const conversationId = this._resolveConversation();
            if (!conversationId || !file) {
                this.log('warn', '发送文件消息失败：缺少对话ID或文件');
                return null;
            }

            const draft = this._buildDraft({
                type: 'file',
                conversation_id: conversationId,
                payload: {
                    file_name: file.name,
                    file_size: file.size,
                    file_type: file.type,
                    ...additionalData
                },
                file: file
            });

            return this._enqueue(draft);
        }

        /**
         * 发送语音消息
         */
        sendVoice(audioBlob, duration = 0) {
            const conversationId = this._resolveConversation();
            if (!conversationId || !audioBlob) {
                this.log('warn', '发送语音消息失败：缺少对话ID或音频数据');
                return null;
            }

            const draft = this._buildDraft({
                type: 'voice',
                conversation_id: conversationId,
                payload: {
                    duration: duration,
                    file_type: 'audio/webm'
                },
                audioBlob: audioBlob
            });

            return this._enqueue(draft);
        }

        /**
         * 构建消息草稿
         */
        _buildDraft(data) {
            const now = this.defaults.now();
            const tempId = this.generateMessageId();

            return {
                temp_id: tempId,
                conversation_id: data.conversation_id,
                type: data.type,
                payload: data.payload,
                file: data.file,
                audioBlob: data.audioBlob,
                createdAt: now,
                fingerprint: null // 稍后计算
            };
        }

        /**
         * 添加到发送队列
         */
        _enqueue(draft) {
            // 计算指纹
            draft.fingerprint = this.defaults.fingerprint(draft);

            // 检查重复
            const existing = this.queue.find(item => 
                item.draft.fingerprint === draft.fingerprint &&
                item.status !== 'failed'
            );

            if (existing) {
                this.log('debug', '忽略重复消息:', draft.fingerprint);
                return existing.queueId;
            }

            // 创建队列项
            const queueItem = {
                queueId: draft.temp_id,
                draft: draft,
                status: 'pending', // pending | sending | sent | failed
                retryCount: 0,
                error: null,
                createdAt: draft.createdAt,
                sentAt: null
            };

            this.queue.push(queueItem);
            this.log('debug', '消息已加入队列:', queueItem.queueId);

            // 触发UI更新
            this.emit('message:queued', {
                queueId: queueItem.queueId,
                draft: draft
            });

            // 启动发送处理
            this._processQueue();

            return queueItem.queueId;
        }

        /**
         * 处理发送队列
         */
        async _processQueue() {
            if (this._sending) return;

            const pendingItem = this.queue.find(item => item.status === 'pending');
            if (!pendingItem) return;

            this._sending = true;

            try {
                await this._sendQueueItem(pendingItem);
            } catch (error) {
                this.log('error', '发送队列处理失败:', error);
            } finally {
                this._sending = false;
                // 继续处理其他待发送项
                this.delayCall('_processQueue', 100);
            }
        }

        /**
         * 发送队列项
         */
        async _sendQueueItem(queueItem) {
            queueItem.status = 'sending';
            queueItem.error = null;

            this.emit('message:sending', {
                queueId: queueItem.queueId,
                draft: queueItem.draft
            });

            try {
                let result;

                if (queueItem.draft.type === 'text') {
                    result = await this._sendTextMessage(queueItem.draft);
                } else if (queueItem.draft.type === 'file') {
                    result = await this._sendFileMessage(queueItem.draft);
                } else if (queueItem.draft.type === 'voice') {
                    result = await this._sendVoiceMessage(queueItem.draft);
                } else {
                    throw new Error(`不支持的消息类型: ${queueItem.draft.type}`);
                }

                // 发送成功
                queueItem.status = 'sent';
                queueItem.sentAt = this.defaults.now();
                queueItem.serverResponse = result;

                this.log('info', '消息发送成功:', queueItem.queueId);
                this.emit('message:sent', {
                    queueId: queueItem.queueId,
                    draft: queueItem.draft,
                    response: result
                });

            } catch (error) {
                this._handleSendError(queueItem, error);
            }
        }

        /**
         * 发送文本消息
         */
        async _sendTextMessage(draft) {
            const payload = {
                temp_id: draft.temp_id,
                conversation_id: draft.conversation_id,
                content: draft.payload.content,
                type: 'text'
            };

            return this._sendToServer('/api/messages', payload);
        }

        /**
         * 发送文件消息
         */
        async _sendFileMessage(draft) {
            // 先上传文件
            const uploadResponse = await this._uploadFile(draft.file);
            
            // 然后发送消息
            const payload = {
                temp_id: draft.temp_id,
                conversation_id: draft.conversation_id,
                content: draft.payload.file_name,
                type: 'file',
                file_url: uploadResponse.url,
                file_name: draft.payload.file_name,
                file_size: draft.payload.file_size
            };

            return this._sendToServer('/api/messages', payload);
        }

        /**
         * 发送语音消息
         */
        async _sendVoiceMessage(draft) {
            // 先上传音频
            const uploadResponse = await this._uploadAudio(draft.audioBlob);
            
            // 然后发送消息
            const payload = {
                temp_id: draft.temp_id,
                conversation_id: draft.conversation_id,
                content: '语音消息',
                type: 'voice',
                file_url: uploadResponse.url,
                duration: draft.payload.duration
            };

            return this._sendToServer('/api/messages', payload);
        }

        /**
         * 统一HTTP请求方法 - 消除重复的fetch调用
         */
        async _makeRequest(url, options = {}) {
            try {
                const response = await window.unifiedFetch.fetch(url, options);
                
                if (!response.ok) {
                    const err = new Error(`请求失败: ${response.statusText}`);
                    // 根据状态码附加潜在分类标签
                    if (response.status >= 500) err._server = true;
                    if (response.status === 429) err._rate = true;
                    throw err;
                }
                
                return response.json();
            } catch (error) {
                console.error('HTTP请求失败:', error);
                throw error;
            }
        }

        /**
         * 统一上传方法 - 消除FormData重复代码
         */
        async _uploadToServer(formData, errorMessageKey, defaultErrorMessage) {
            try {
                return await this._makeRequest('/api/upload', {
                    method: 'POST',
                    body: formData
                });
            } catch (error) {
                const base = (typeof window.getText === 'function') 
                    ? window.getText(errorMessageKey, defaultErrorMessage) 
                    : ((window.StateTexts && window.StateTexts[errorMessageKey]) || defaultErrorMessage);
                throw new Error(base + ': ' + error.message);
            }
        }

        /**
         * 上传文件
         */
        async _uploadFile(file) {
            const formData = new FormData();
            formData.append('file', file);

            return this._uploadToServer(formData, 'UPLOAD_FILE_FAIL', '文件上传失败');
        }

        /**
         * 上传音频
         */
        async _uploadAudio(audioBlob) {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'voice.webm');

            return this._uploadToServer(formData, 'UPLOAD_AUDIO_FAIL', '音频上传失败');
        }

        /**
         * 发送到服务器
         */
        async _sendToServer(url, payload) {
            return this._makeRequest(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
        }

        /**
         * 处理发送错误
         */
        _handleSendError(queueItem, error) {
            const mapped = this._mapSendError(error);
            queueItem.error = mapped.text + (error && error.message ? (' | ' + error.message) : '');
            queueItem.errorCode = mapped.code;
            queueItem.errorKey = mapped.key;
            queueItem.retryCount++;

            // 派发统一错误事件（便于 UI 监听聚合）
            try { this.emit('message:sendError', { queueId: queueItem.queueId, code: mapped.code, key: mapped.key, raw: error?.message }); } catch(_){}

            if (queueItem.retryCount <= this.options.maxRetries) {
                queueItem.status = 'pending';
                const delay = this.options.baseRetryDelayMs * Math.pow(2, queueItem.retryCount - 1);
                const retryTip = (typeof window.getText==='function') ? window.getText('MESSAGE_SEND_RETRYING','消息发送失败，正在重试') : ((window.StateTexts && window.StateTexts.MESSAGE_SEND_RETRYING) || '消息发送失败，正在重试');
                this.log('warn', `${retryTip} (${mapped.code})，${delay}ms 后重试 (${queueItem.retryCount}/${this.options.maxRetries}) :`, error.message);
                this.delayCall('_processQueue', delay);
            } else {
                queueItem.status = 'failed';
                const finalTip = (typeof window.getText==='function') ? window.getText('MESSAGE_SEND_FINAL_FAIL','消息发送失败') : ((window.StateTexts && window.StateTexts.MESSAGE_SEND_FINAL_FAIL) || '消息发送失败');
                this.log('error', `${finalTip} (${mapped.code}) :`, error.message);
                this.emit('message:failed', {
                    queueId: queueItem.queueId,
                    draft: queueItem.draft,
                    error: queueItem.error,
                    code: mapped.code,
                    key: mapped.key
                });
            }
        }

        /**
         * 解析当前对话ID
         */
        _resolveConversation() {
            // 尝试从全局状态获取
            if (window.MessageCoordinator && window.MessageCoordinator.currentConversationId) {
                return window.MessageCoordinator.currentConversationId;
            }

            // 尝试从URL参数获取
            const params = new URLSearchParams(window.location.search);
            return params.get('conversation_id');
        }

        /**
         * 标记服务器消息（用于回流覆盖）
         */
        markServerMessage(serverMessage) {
            if (!serverMessage || !serverMessage.temp_id) return;

            const queueItem = this.queue.find(item => 
                item.draft.temp_id === serverMessage.temp_id
            );

            if (queueItem && queueItem.status === 'sent') {
                queueItem.serverMessage = serverMessage;
                this.log('debug', '服务器消息已标记:', serverMessage.temp_id);
            }
        }

        /**
         * 重试失败消息
         */
        retry(queueId) {
            const queueItem = this.queue.find(item => item.queueId === queueId);
            if (!queueItem || queueItem.status !== 'failed') {
                this.log('warn', '无法重试消息:', queueId);
                return false;
            }

            queueItem.status = 'pending';
            queueItem.retryCount = 0;
            queueItem.error = null;

            this.log('info', '重试消息:', queueId);
            this._processQueue();
            return true;
        }

        /**
         * 取消消息
         */
        cancel(queueId) {
            const index = this.queue.findIndex(item => item.queueId === queueId);
            if (index === -1) return false;

            const queueItem = this.queue[index];
            if (queueItem.status === 'sending') {
                this.log('warn', '无法取消正在发送的消息:', queueId);
                return false;
            }

            this.queue.splice(index, 1);
            this.log('info', '消息已取消:', queueId);
            
            this.emit('message:cancelled', {
                queueId: queueId,
                draft: queueItem.draft
            });

            return true;
        }

        /**
         * 获取队列快照
         */
        getQueueSnapshot() {
            return {
                total: this.queue.length,
                pending: this.queue.filter(item => item.status === 'pending').length,
                sending: this.queue.filter(item => item.status === 'sending').length,
                sent: this.queue.filter(item => item.status === 'sent').length,
                failed: this.queue.filter(item => item.status === 'failed').length,
                items: this.queue.map(item => ({
                    queueId: item.queueId,
                    status: item.status,
                    type: item.draft.type,
                    retryCount: item.retryCount,
                    error: item.error
                }))
            };
        }

        /**
         * 清空队列
         */
        clearQueue() {
            this.queue = [];
            this.log('info', '发送队列已清空');
        }
    }

    // 暴露到全局
    window.MessageSendChannel = MessageSendChannel;

    console.info('✅ 优化的消息发送通道已加载 (继承WebSocketBase)');

})();