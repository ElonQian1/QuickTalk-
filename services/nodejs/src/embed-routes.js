// QuickTalk客服系统 - 动态嵌入API
// 提供CSS和JavaScript的动态加载接口

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

class EmbedCodeManager {
    constructor() {
        this.version = '1.3.1'; // � 简化文件上传：单文件上传、移动端友好、简洁UI
        this.lastModified = new Date().toISOString();
    }
    
    // 生成客服系统CSS
    generateCSS() {
        return `
/* QuickTalk客服系统样式 - 动态生成版本 ${this.version} */
/* 生成时间: ${this.lastModified} */

.viewport-nav{outline:#000;position:fixed;right:40px;bottom:40px;z-index:999999}
.viewport-nav .nav-box{background:rgba(0,0,0,.8);border-radius:100%;text-align:center;margin:15px 0;width:100px;height:100px;line-height:100px;box-shadow:0 0 5px 2px rgba(255,255,255,.5)}
.viewport-nav .nav-box p{padding:0 1px;font-size:31px;color:#fff;white-space:normal;font-weight:700}
.viewport-nav .nav-box#cb{position:relative;cursor:pointer}
.viewport-nav .nav-box .nav-dabaowei,.viewport-nav .nav-box .nav-sxsx{font-size:24px}

/* 客服聊天窗口样式 */
.cs-chat{position:fixed;bottom:160px;right:40px;width:380px;height:520px;background:white;border-radius:15px;box-shadow:0 10px 30px rgba(0,0,0,0.3);display:none;flex-direction:column;z-index:999998;overflow:hidden;transform:scale(0);transform-origin:bottom right;transition:all 0.3s ease;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.cs-chat.open{display:flex;transform:scale(1)}
.cs-chat.mini{height:60px}
.cs-chat.mini .cs-body,.cs-chat.mini .cs-input,.cs-chat.mini .cs-status{display:none}
.cs-header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:15px 20px;display:flex;justify-content:space-between;align-items:center}
.cs-header h3{font-size:16px;font-weight:600;margin:0}
.cs-controls{display:flex;gap:10px}
.cs-controls button{background:rgba(255,255,255,0.2);border:none;color:white;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center}
.cs-body{flex:1;padding:20px;overflow-y:auto;background:#fafbfc}
.cs-msg{margin-bottom:15px;display:flex;flex-direction:column}
.cs-msg-text{padding:12px 16px;border-radius:18px;max-width:80%;word-wrap:break-word;line-height:1.4}
.cs-msg-time{font-size:11px;color:#999;margin-top:5px}
.cs-system .cs-msg-text{background:#f0f0f0;color:#666;align-self:center;text-align:center;font-size:13px}
.cs-user{align-items:flex-end}
.cs-user .cs-msg-text{background:#667eea;color:white;align-self:flex-end}
.cs-user .cs-msg-time{text-align:right}
.cs-staff{align-items:flex-start}
.cs-staff .cs-msg-text{background:#f8f9fa;color:#333;border:1px solid #e9ecef;align-self:flex-start}
.cs-staff .cs-msg-time{text-align:left}

/* 图片消息样式 - 支持三阶段上传显示 */
.cs-msg-image{max-width:80%;align-self:flex-start;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)}
.cs-msg-image img{width:100%;height:auto;display:block;cursor:pointer;transition:transform 0.2s ease}
.cs-msg-image img:hover{transform:scale(1.02)}
.cs-msg-image .cs-image-info{padding:8px 12px;background:#f8f9fa;font-size:12px;color:#666;border-top:1px solid #e9ecef}

/* 上传状态显示 */
.cs-upload-status{padding:6px 12px;background:#fff3cd;color:#856404;font-size:11px;border-top:1px solid #ffeaa7;display:flex;align-items:center;gap:4px}
.cs-upload-status:before{content:'⏳';font-size:12px}

/* 图片预览模态框 */
.cs-image-preview{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:none;align-items:center;justify-content:center;z-index:9999999;cursor:pointer}
.cs-image-preview img{max-width:90%;max-height:90%;object-fit:contain;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,0.5)}
.cs-image-preview .cs-close{position:absolute;top:20px;right:20px;color:white;font-size:30px;cursor:pointer;background:rgba(0,0,0,0.5);width:50px;height:50px;border-radius:50%;display:flex;align-items:center;justify-content:center}

.cs-input{padding:15px 20px;border-top:1px solid #eee;background:white;position:relative}
.cs-input-container{display:flex;gap:10px;align-items:center;margin-bottom:10px}
.cs-input-container input{flex:1;padding:10px 15px;border:1px solid #ddd;border-radius:20px;outline:none;font-size:14px}
.cs-file-btn{background:#f8f9fa;color:#666;border:1px solid #ddd;padding:8px 12px;border-radius:50%;cursor:pointer;font-size:16px;transition:all 0.2s ease}
.cs-file-btn:hover{background:#e9ecef;transform:scale(1.1)}
.cs-input button:not(.cs-file-btn){background:#667eea;color:white;border:none;padding:10px 20px;border-radius:20px;cursor:pointer;font-weight:600;width:100%}

/* 文件选择菜单 */
.cs-file-menu{position:absolute;bottom:60px;right:20px;background:white;border:1px solid #ddd;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:1000;min-width:120px}
.cs-file-option{padding:12px 16px;cursor:pointer;border-bottom:1px solid #f0f0f0;font-size:14px;display:flex;align-items:center;gap:8px;transition:background 0.2s ease}
.cs-file-option:last-child{border-bottom:none}
.cs-file-option:hover{background:#f8f9fa}

/* 文件上传模态框 - 简化版 */
.cs-file-modal{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999999}
.cs-modal-content{background:white;border-radius:12px;width:90%;max-width:400px;box-shadow:0 10px 30px rgba(0,0,0,0.3);overflow:hidden}
.cs-modal-header{padding:16px 20px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center}
.cs-modal-header h4{margin:0;font-size:18px;color:#333}
.cs-modal-close{background:none;border:none;font-size:20px;cursor:pointer;color:#999;padding:4px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:4px}
.cs-modal-close:hover{background:#f5f5f5;color:#666}

.cs-modal-body{padding:20px}
.cs-file-select-area{border:2px dashed #ddd;border-radius:8px;padding:30px 20px;text-align:center;cursor:pointer;transition:all 0.3s ease}
.cs-file-select-area:hover{border-color:#667eea;background:#f8f9ff}
.cs-file-icon{font-size:32px;margin-bottom:8px;opacity:0.6}
.cs-file-select-area p{margin:8px 0 4px 0;color:#333;font-size:16px;font-weight:500}
.cs-file-select-area small{color:#666;font-size:12px}

.cs-file-preview{margin-top:16px;padding:12px;border:1px solid #eee;border-radius:6px;background:#f9f9f9;display:flex;align-items:center;gap:12px}
.cs-file-preview img{width:50px;height:50px;object-fit:cover;border-radius:4px}
.cs-file-preview .cs-file-info{flex:1}
.cs-file-preview .cs-file-name{font-weight:600;margin-bottom:4px;word-break:break-all}
.cs-file-preview .cs-file-size{font-size:12px;color:#666}

.cs-modal-footer{padding:16px 20px;border-top:1px solid #eee;display:flex;gap:12px;justify-content:flex-end}
.cs-btn-cancel{background:#f8f9fa;color:#666;border:1px solid #ddd;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:14px}
.cs-btn-cancel:hover{background:#e9ecef}
.cs-btn-confirm{background:#667eea;color:white;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;font-weight:600;font-size:14px}
.cs-btn-confirm:hover{background:#5a6fd8}
.cs-btn-confirm:disabled{background:#ccc;cursor:not-allowed}

/* 手机端优化 */
@media (max-width:768px){
    .cs-modal-content{width:95%;max-width:none;margin:20px auto}
    .cs-modal-body{padding:16px}
    .cs-file-select-area{padding:20px 16px}
    .cs-file-icon{font-size:28px}
    .cs-modal-footer{padding:12px 16px}
}
.cs-status{padding:8px 20px;background:#f8f9fa;border-top:1px solid #eee;display:flex;align-items:center;gap:8px;font-size:12px}
.cs-dot{width:8px;height:8px;border-radius:50%;display:inline-block}
.cs-connected{background:#28a745;animation:pulse 2s infinite}
.cs-disconnected{background:#dc3545}
@keyframes pulse{0%{opacity:1}50%{opacity:0.5}100%{opacity:1}}
@media (max-width:768px){.cs-chat{width:calc(100vw - 20px);right:10px;left:10px}}

/* 动态版本标识 */
.cs-header h3::after {
    content: " (v${this.version})";
    font-size: 10px;
    opacity: 0.7;
}
        `;
    }
    
    // 生成客服系统JavaScript
    generateJS() {
        return `
// QuickTalk客服系统 - 动态生成版本 ${this.version}
// 生成时间: ${this.lastModified}

console.log('🚀 QuickTalk客服系统动态加载 v${this.version}');

window.QuickTalkCustomerService = {
    version: '${this.version}',
    isInitialized: false,
    
    init(config) {
        if (this.isInitialized) {
            console.log('⚠️ QuickTalk已经初始化过了');
            return;
        }
        
        console.log('🔧 初始化QuickTalk客服系统...');
        this.config = config;
        this.userId = 'user_' + Math.random().toString(36).substr(2,9) + '_' + Date.now();
        
        // 🔧 确保服务器URL配置正确
        if (!this.config.serverUrl) {
            // 根据当前脚本加载地址推断服务器URL
            const scripts = document.getElementsByTagName('script');
            for (let script of scripts) {
                if (script.src && script.src.includes('/embed/customer-service.js')) {
                    const url = new URL(script.src);
                    this.config.serverUrl = url.origin;
                    console.log('🔍 自动检测服务器URL:', this.config.serverUrl);
                    break;
                }
            }
            // 如果还是没有，使用默认值
            if (!this.config.serverUrl) {
                this.config.serverUrl = 'http://localhost:3030';
                console.log('⚠️ 使用默认服务器URL:', this.config.serverUrl);
            }
        }
        
        // 🔧 添加消息去重机制
        this.processedMessages = new Set();
        
        this.createHTML();
        this.setupWebSocket();
        this.setupEventHandlers();
        
        this.isInitialized = true;
        console.log('✅ QuickTalk客服系统初始化完成');
    },
    
    createHTML() {
        const html = \`
            <!-- 客服按钮 -->
            <div class="viewport-nav" id="quicktalk-nav">
                <ul>
                    <li>
                        <div class="nav-box animate__animated animate__backInLeft" id="cb">
                            <a><p class="animate__animated animate__infinite animate__heartBeat">客服</p></a>
                        </div>
                    </li>
                </ul>
            </div>

            <!-- 客服聊天窗口 -->
            <div class="cs-chat" id="cs-chat">
                <div class="cs-header">
                    <h3>在线客服</h3>
                    <div class="cs-controls">
                        <button onclick="QuickTalkCustomerService.minimize()">−</button>
                        <button onclick="QuickTalkCustomerService.close()">×</button>
                    </div>
                </div>
                <div class="cs-body" id="cs-body">
                    <div class="cs-msg cs-system">
                        <span class="cs-msg-text">欢迎访问\${this.config.authorizedDomain}！动态客服系统为您服务！📷</span>
                        <span class="cs-msg-time">\${new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'})}</span>
                    </div>
                </div>
                <div class="cs-input">
                    <div class="cs-input-container">
                        <input type="text" id="cs-input" placeholder="请输入您的消息..." onkeypress="if(event.key==='Enter')QuickTalkCustomerService.send()">
                        <button class="cs-file-btn" onclick="QuickTalkCustomerService.showFileOptions()" title="发送文件">📎</button>
                    </div>
                    <button onclick="QuickTalkCustomerService.send()">发送</button>
                    
                    <!-- 文件选择菜单 -->
                    <div class="cs-file-menu" id="cs-file-menu" style="display: none;">
                        <div class="cs-file-option" onclick="QuickTalkCustomerService.selectFileType('image')">
                            📷 图片
                        </div>
                        <div class="cs-file-option" onclick="QuickTalkCustomerService.selectFileType('document')">
                            📄 文档
                        </div>
                        <div class="cs-file-option" onclick="QuickTalkCustomerService.selectFileType('video')">
                            🎥 视频
                        </div>
                        <div class="cs-file-option" onclick="QuickTalkCustomerService.selectFileType('audio')">
                            🎵 音频
                        </div>
                    </div>
                </div>
                
                <!-- 文件上传模态框 - 简化版 -->
                <div class="cs-file-modal" id="cs-file-modal" style="display: none;">
                    <div class="cs-modal-content">
                        <div class="cs-modal-header">
                            <h4>选择文件</h4>
                            <button class="cs-modal-close" onclick="QuickTalkCustomerService.closeFileModal()">×</button>
                        </div>
                        <div class="cs-modal-body">
                            <input type="file" id="cs-file-input" style="display: none;" onchange="QuickTalkCustomerService.handleFileSelect(this.files[0])">
                            <div class="cs-file-select-area" onclick="document.getElementById('cs-file-input').click()">
                                <div class="cs-file-icon">📁</div>
                                <p>点击选择文件</p>
                                <small>支持图片、文档、音频、视频</small>
                            </div>
                            <div class="cs-file-preview" id="cs-file-preview" style="display: none;"></div>
                        </div>
                        <div class="cs-modal-footer">
                            <button onclick="QuickTalkCustomerService.closeFileModal()" class="cs-btn-cancel">取消</button>
                            <button onclick="QuickTalkCustomerService.confirmUpload()" class="cs-btn-confirm" id="cs-confirm-btn" disabled>发送</button>
                        </div>
                    </div>
                </div>
                <div class="cs-status">
                    <span class="cs-dot" id="cs-dot"></span>
                    <span id="cs-status">连接中...</span>
                </div>
            </div>

            <!-- 图片预览模态框 -->
            <div class="cs-image-preview" id="cs-image-preview" onclick="QuickTalkCustomerService.closeImagePreview()">
                <div class="cs-close" onclick="QuickTalkCustomerService.closeImagePreview()">×</div>
                <img src="" alt="图片预览" id="cs-preview-img">
            </div>
        \`;
        
        document.body.insertAdjacentHTML('beforeend', html);
    },
    
    setupWebSocket() {
        this.isConnected = false;
        this.ws = null;
        this.reconnectCount = 0;
        this.maxReconnectAttempts = 5;
        
        this.connectWebSocket();
    },
    
    async connectWebSocket() {
        try {
            // HTTP认证
            const authRes = await fetch(this.config.serverUrl + '/api/secure-connect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shop-Key': this.config.shopKey,
                    'X-Shop-Id': this.config.shopId
                },
                body: JSON.stringify({
                    userId: this.userId,
                    timestamp: Date.now(),
                    shopKey: this.config.shopKey,
                    shopId: this.config.shopId,
                    domain: window.location.hostname,
                    version: this.version
                })
            });
            
            if (!authRes.ok) {
                throw new Error('认证失败');
            }
            
            // WebSocket连接
            console.log('🔗 建立WebSocket连接...');
            this.ws = new WebSocket(this.config.serverUrl.replace('http', 'ws') + '/ws');
            
            this.ws.onopen = () => {
                console.log('✅ WebSocket连接成功');
                this.isConnected = true;
                this.reconnectCount = 0;
                this.updateStatus('connected', '已连接 (动态v${this.version})');
                
                this.ws.send(JSON.stringify({
                    type: 'auth',
                    userId: this.userId,
                    shopKey: this.config.shopKey,
                    shopId: this.config.shopId
                }));
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (e) {
                    console.error('❌ WebSocket消息解析失败:', e);
                }
            };
            
            this.ws.onclose = (event) => {
                console.log('🔌 WebSocket连接关闭:', event.code);
                this.isConnected = false;
                this.updateStatus('disconnected', '连接断开');
                
                if (this.reconnectCount < this.maxReconnectAttempts) {
                    this.reconnectCount++;
                    const delay = Math.min(1000 * Math.pow(2, this.reconnectCount), 10000);
                    console.log(\`🔄 \${delay}ms后尝试重连... (第\${this.reconnectCount}次)\`);
                    setTimeout(() => this.connectWebSocket(), delay);
                }
            };
            
        } catch (e) {
            console.error('❌ WebSocket连接失败:', e);
            this.updateStatus('disconnected', '连接失败: ' + e.message);
        }
    },
    
    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'auth_success':
                console.log('✅ WebSocket认证成功');
                break;
                
            case 'connection_established':
                console.log('🔗 WebSocket连接已建立');
                break;
                
            case 'staff_message':
                // 🔧 添加消息去重检查
                const messageId = data.id || data.timestamp || JSON.stringify(data);
                if (this.processedMessages.has(messageId)) {
                    console.log('⚠️ 跳过重复的staff_message:', messageId);
                    break;
                }
                
                console.log('📨 收到客服消息:', data);
                this.processedMessages.add(messageId);
                this.handleStaffMessage(data);
                
                if (!this.isOpen) {
                    this.open();
                    this.showNotification('收到新的客服消息');
                }
                break;
                
            case 'new_message':
                // 🔧 修复重复消息问题：new_message通常是staff_message的包装格式
                console.log('📨 收到新消息格式:', data);
                if (data.message && data.message.type === 'staff_message') {
                    // 检查是否已经处理过相同的消息
                    const messageId = data.message.id || data.message.timestamp || JSON.stringify(data.message);
                    if (!this.processedMessages.has(messageId)) {
                        console.log('🔧 处理new_message包装的staff_message');
                        this.processedMessages.add(messageId);
                        this.handleStaffMessage(data.message);
                        
                        if (!this.isOpen) {
                            this.open();
                            this.showNotification('收到新的客服消息');
                        }
                    } else {
                        console.log('⚠️ 跳过重复的消息:', messageId);
                    }
                } else if (data.message) {
                    // 其他类型的new_message
                    this.handleStaffMessage(data.message);
                }
                break;
                
            case 'multimedia_message_sent':
                console.log('📷 收到多媒体消息发送确认:', data);
                // 图片已在上传时显示，这里只是确认消息，无需重复显示
                break;
                
            case 'multimedia_message':
                console.log('📷 收到多媒体消息:', data);
                this.handleMultimediaMessage(data);
                
                if (!this.isOpen) {
                    this.open();
                    this.showNotification('收到新的图片消息');
                }
                break;
                
            default:
                console.log('📩 未知消息类型:', data);
        }
    },
    
    // 🖼️ 处理客服消息（支持图片）- 最新版本
    handleStaffMessage(messageData) {
        const messageType = messageData.message_type || messageData.messageType || 'text';
        
        if (messageType === 'image' && messageData.file_url) {
            console.log('🖼️ 处理图片消息 (原始URL):', messageData.file_url);
            
            // 🔧 修复图片URL：确保是完整的服务器URL
            const fullImageUrl = this.ensureFullImageUrl(messageData.file_url);
            console.log('🔧 转换后图片URL:', fullImageUrl);
            
            this.addImageMsg('staff', fullImageUrl, messageData.file_name || '图片', messageData.content);
        } else {
            const message = messageData.message || messageData.content || '[消息]';
            console.log('💬 处理文本消息:', message);
            this.addMsg('staff', message);
        }
    },

    // 🖼️ 处理多媒体消息
    handleMultimediaMessage(messageData) {
        console.log('🖼️ 处理多媒体消息:', messageData);
        
        const fileUrl = messageData.fileUrl || messageData.file_url;
        const fileName = messageData.fileName || messageData.file_name;
        const messageType = messageData.messageType || messageData.message_type;
        const senderType = messageData.senderType || 'staff';
        
        if (messageType === 'image' && fileUrl) {
            console.log('🖼️ 显示图片消息:', fileUrl);
            const fullImageUrl = this.ensureFullImageUrl(fileUrl);
            this.addImageMsg(senderType, fullImageUrl, fileName || '图片', messageData.content || '');
        } else if (fileUrl) {
            console.log('📎 显示文件消息:', fileName);
            this.addMsg(senderType, '📎 ' + (fileName || '文件'));
        } else {
            console.log('⚠️ 多媒体消息缺少文件信息:', messageData);
            this.addMsg(senderType, '[多媒体消息]');
        }
    },
    
    addMsg(type, text) {
        const body = document.getElementById('cs-body');
        const div = document.createElement('div');
        div.className = 'cs-msg cs-' + type;
        div.innerHTML = '<span class="cs-msg-text">' + this.escapeHtml(text) + '</span><span class="cs-msg-time">' + new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'}) + '</span>';
        body.appendChild(div);
        body.scrollTop = body.scrollHeight;
    },
    
    // 🖼️ 添加图片消息 - 支持状态更新的最新实现
    addImageMsg(type, imageUrl, fileName, caption, messageId) {
        const body = document.getElementById('cs-body');
        const div = document.createElement('div');
        div.className = 'cs-msg cs-' + type;
        if (messageId) {
            div.setAttribute('data-message-id', messageId);
        }
        
        const statusHtml = caption && caption !== '[图片]' ? \`<div class="cs-upload-status">\${this.escapeHtml(caption)}</div>\` : '';
        
        let imageHtml = \`
            <div class="cs-msg-image">
                <img src="\${imageUrl}" alt="\${this.escapeHtml(fileName || '图片')}" onclick="QuickTalkCustomerService.previewImage('\${imageUrl}')">
                <div class="cs-image-info">
                    📷 \${this.escapeHtml(fileName || '图片')}
                </div>
                \${statusHtml}
            </div>
            <span class="cs-msg-time">\${new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'})}</span>
        \`;
        
        div.innerHTML = imageHtml;
        body.appendChild(div);
        body.scrollTop = body.scrollHeight;
    },
    
    // 🔧 更新图片消息URL和状态
    updateImageMessage(messageId, newImageUrl, newCaption) {
        const msgElement = document.querySelector('[data-message-id="' + messageId + '"]');
        if (msgElement) {
            const img = msgElement.querySelector('img');
            const statusDiv = msgElement.querySelector('.cs-upload-status');
            
            if (img) {
                img.src = newImageUrl;
                img.onclick = function() { QuickTalkCustomerService.previewImage(newImageUrl); };
                console.log('🔄 图片URL已更新:', newImageUrl);
            }
            
            if (statusDiv) {
                if (newCaption) {
                    statusDiv.textContent = newCaption;
                } else {
                    statusDiv.remove();
                }
            }
        }
    },
    
    // 🗑️ 移除消息
    removeMessage(messageId) {
        const msgElement = document.querySelector('[data-message-id="' + messageId + '"]');
        if (msgElement) {
            msgElement.remove();
            console.log('🗑️ 临时消息已移除:', messageId);
        }
    },
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    // 🔧 工具函数：确保图片URL是完整的，并且协议匹配当前页面
    ensureFullImageUrl(url) {
        if (!url) return '';
        
        // 如果是完整URL，直接返回
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        
        // 🔧 关键修复：对于相对路径，使用文件服务器的完整地址
        // 不要使用当前页面的域名，因为文件在后端服务器上
        const serverBaseUrl = this.config.serverUrl || 'http://localhost:3030';
        
        if (url.startsWith('/')) {
            return serverBaseUrl + url;
        }
        return serverBaseUrl + '/' + url;
    },
    
    previewImage(imageUrl) {
        const preview = document.getElementById('cs-image-preview');
        const img = document.getElementById('cs-preview-img');
        if (preview && img) {
            img.src = imageUrl;
            preview.style.display = 'flex';
        }
    },
    
    closeImagePreview() {
        const preview = document.getElementById('cs-image-preview');
        if (preview) {
            preview.style.display = 'none';
        }
    },
    
    async send() {
        const input = document.getElementById('cs-input');
        const msg = input.value.trim();
        if (!msg) return;
        
        if (!this.isConnected || !this.ws) {
            this.addMsg('system', '连接断开，无法发送消息');
            return;
        }
        
        this.addMsg('user', msg);
        input.value = '';
        
        try {
            this.ws.send(JSON.stringify({
                type: 'send_message',
                userId: this.userId,
                message: msg,
                shopKey: this.config.shopKey,
                shopId: this.config.shopId,
                timestamp: Date.now()
            }));
            
            console.log('✅ 消息发送成功 (WebSocket)');
            
        } catch (e) {
            console.error('❌ WebSocket发送失败:', e);
            this.addMsg('system', '发送失败，请重试');
        }
    },

    // 📤 文件上传模块 - 新增功能
    async uploadAndSendFile(file) {
        if (!file) {
            this.addMsg('system', '请选择要上传的文件');
            return;
        }

        console.log('📤 开始上传文件:', file.name);
        
        // 🎯 第1阶段：立即显示本地预览
        const localPreviewUrl = URL.createObjectURL(file);
        const tempMessageId = 'temp_' + Date.now();
        console.log('📱 显示本地预览:', localPreviewUrl);
        this.addImageMsg('user', localPreviewUrl, file.name, '上传中...', tempMessageId);

        try {
            // 创建FormData
            const formData = new FormData();
            formData.append('file', file);

            // 上传文件
            const response = await fetch(this.config.serverUrl + '/api/files/upload', {
                method: 'POST',
                headers: {
                    'X-Shop-Key': this.config.shopKey,
                    'X-User-Id': this.userId,
                    'X-Shop-Id': this.config.shopId
                },
                body: formData
            });

            const result = await response.json();

            if (response.ok && result.success) {
                // 🎯 第2阶段：更新为服务器URL
                console.log('🔄 更新为服务器图片URL:', result.file.url);
                const serverUrl = this.ensureFullImageUrl(result.file.url);
                this.updateImageMessage(tempMessageId, serverUrl, '');
                
                // 清理本地预览URL
                URL.revokeObjectURL(localPreviewUrl);
                
                // 🎯 第3阶段：发送WebSocket消息通知服务器
                await this.sendMultimediaMessage(result.file);
                console.log('✅ 三阶段图片上传完成');
            } else {
                throw new Error(result.error || '上传失败');
            }

        } catch (error) {
            console.error('❌ 文件上传失败:', error);
            // 移除临时消息并显示错误
            this.removeMessage(tempMessageId);
            this.addMsg('system', '文件上传失败: ' + error.message);
            URL.revokeObjectURL(localPreviewUrl);
        }
    },

    async sendMultimediaMessage(fileInfo) {
        if (!this.isConnected || !this.ws) {
            throw new Error('连接断开，无法发送消息');
        }

        const messageData = {
            type: 'send_multimedia_message',
            userId: this.userId,
            shopKey: this.config.shopKey,
            shopId: this.config.shopId,
            fileId: fileInfo.id,
            fileUrl: fileInfo.url,
            fileName: fileInfo.originalName,
            fileType: fileInfo.type,
            fileSize: fileInfo.size,
            messageType: this.getMessageTypeFromFile(fileInfo),
            content: fileInfo.originalName, // 🔧 确保content是文件名
            message_type: this.getMessageTypeFromFile(fileInfo), // 🔧 添加message_type字段
            timestamp: Date.now()
        };

        console.log('� 发送多媒体消息数据:', messageData);

        // 🔧 不在这里显示消息，因为已经在上传阶段显示了
        // 通过WebSocket发送
        this.ws.send(JSON.stringify(messageData));
        console.log('✅ 多媒体消息发送成功 (WebSocket)');
    },

    getMessageTypeFromFile(fileInfo) {
        if (fileInfo.type.startsWith('image/')) return 'image';
        if (fileInfo.type.startsWith('video/')) return 'video';
        if (fileInfo.type.startsWith('audio/')) return 'audio';
        return 'file';
    },

    // 🎨 文件上传UI交互方法
    showFileOptions() {
        const menu = document.getElementById('cs-file-menu');
        if (menu) {
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        }
    },

    selectFileType(type) {
        this.hideFileOptions();
        this.showFileModal(type);
    },

    hideFileOptions() {
        const menu = document.getElementById('cs-file-menu');
        if (menu) menu.style.display = 'none';
    },

    showFileModal(fileType) {
        const modal = document.getElementById('cs-file-modal');
        const fileInput = document.getElementById('cs-file-input');
        
        if (modal && fileInput) {
            // 设置文件类型过滤
            const acceptMap = {
                'image': 'image/*',
                'document': '.pdf,.doc,.docx,.txt',
                'video': 'video/*',
                'audio': 'audio/*'
            };
            fileInput.accept = acceptMap[fileType] || '*/*';
            
            modal.style.display = 'flex';
        }
    },

    closeFileModal() {
        const modal = document.getElementById('cs-file-modal');
        if (modal) {
            modal.style.display = 'none';
            this.resetFileModal();
        }
    },

    resetFileModal() {
        const fileInput = document.getElementById('cs-file-input');
        const preview = document.getElementById('cs-file-preview');
        const confirmBtn = document.getElementById('cs-confirm-btn');
        
        if (fileInput) fileInput.value = '';
        if (preview) {
            preview.style.display = 'none';
            preview.innerHTML = '';
        }
        if (confirmBtn) confirmBtn.disabled = true;
        
        this.selectedFile = null;
    },

    handleFileSelect(file) {
        if (!file) return;
        
        console.log('文件选择:', file.name, file.type, file.size);
        this.selectedFile = file;
        
        // 显示文件预览
        this.showFilePreview(file);
        
        // 启用确认按钮
        const confirmBtn = document.getElementById('cs-confirm-btn');
        if (confirmBtn) confirmBtn.disabled = false;
    },

    showFilePreview(file) {
        const preview = document.getElementById('cs-file-preview');
        if (!preview) return;

        const fileSize = (file.size / 1024 / 1024).toFixed(2);
        const isImage = file.type.startsWith('image/');
        
        if (isImage) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.innerHTML = 
                    '<img src="' + e.target.result + '" alt="预览">' +
                    '<div class="cs-file-info">' +
                        '<div class="cs-file-name">' + file.name + '</div>' +
                        '<div class="cs-file-size">' + fileSize + ' MB</div>' +
                    '</div>';
            };
            reader.readAsDataURL(file);
        } else {
            const fileIcon = this.getFileIcon(file.type);
            preview.innerHTML = 
                '<div style="font-size: 32px; display: flex; align-items: center; justify-content: center; width: 50px; height: 50px; background: #f0f0f0; border-radius: 4px;">' + fileIcon + '</div>' +
                '<div class="cs-file-info">' +
                    '<div class="cs-file-name">' + file.name + '</div>' +
                    '<div class="cs-file-size">' + fileSize + ' MB</div>' +
                '</div>';
        }
        
        preview.style.display = 'flex';
    },

    getFileIcon(fileType) {
        if (fileType.startsWith('image/')) return '🖼️';
        if (fileType.startsWith('video/')) return '🎥';
        if (fileType.startsWith('audio/')) return '🎵';
        if (fileType.includes('pdf')) return '📄';
        if (fileType.includes('word') || fileType.includes('document')) return '📝';
        return '📁';
    },

    async confirmUpload() {
        if (!this.selectedFile) return;
        
        const sendBtn = document.getElementById('cs-confirm-btn');
        if (!sendBtn) return;
        
        // 显示上传状态
        const originalText = sendBtn.textContent;
        sendBtn.disabled = true;
        sendBtn.textContent = '上传中...';
        
        try {
            await this.uploadAndSendFile(this.selectedFile);
            this.closeFileModal();
        } catch (error) {
            console.error('上传确认失败:', error);
            sendBtn.textContent = originalText;
            sendBtn.disabled = false;
        }
    },
    
    setupEventHandlers() {
        const cbBtn = document.querySelector('#cb');
        if (cbBtn) {
            cbBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggle();
            });
        }
    },
    
    toggle() {
        if (this.isOpen) this.close(); else this.open();
    },
    
    open() {
        const chat = document.getElementById('cs-chat');
        if (chat) {
            chat.classList.add('open');
            chat.classList.remove('mini');
            this.isOpen = true;
            this.isMini = false;
            const input = document.getElementById('cs-input');
            if (input) input.focus();
        }
    },
    
    close() {
        const chat = document.getElementById('cs-chat');
        if (chat) {
            chat.classList.remove('open', 'mini');
            this.isOpen = false;
            this.isMini = false;
        }
    },
    
    minimize() {
        const chat = document.getElementById('cs-chat');
        if (!chat) return;
        
        if (this.isMini) {
            chat.classList.remove('mini');
            this.isMini = false;
            const input = document.getElementById('cs-input');
            if (input) input.focus();
        } else {
            chat.classList.add('mini');
            this.isMini = true;
        }
    },
    
    updateStatus(status, text) {
        const dot = document.getElementById('cs-dot');
        const statusText = document.getElementById('cs-status');
        if (dot) dot.className = 'cs-dot cs-' + status;
        if (statusText) statusText.textContent = text;
    },
    
    showNotification(message) {
        if ("Notification" in window && Notification.permission === "granted") {
            new Notification("QuickTalk客服消息", {
                body: message,
                icon: "/favicon.ico"
            });
        }
        
        const btn = document.querySelector('#cb');
        if (btn) {
            btn.style.animation = 'heartBeat 1s infinite';
            setTimeout(() => {
                btn.style.animation = '';
            }, 3000);
        }
    }
};

// 清理
window.addEventListener('beforeunload', () => {
    if (window.QuickTalkCustomerService.ws) {
        window.QuickTalkCustomerService.ws.close();
    }
});

console.log('📦 QuickTalk客服系统模块加载完成，等待初始化...');

// 🔧 兼容性类：CustomerServiceWidget
class CustomerServiceWidget {
    constructor(config) {
        console.log('🚀 CustomerServiceWidget 构造函数调用，配置:', config);
        
        // 配置继承和兼容性处理
        this.config = {
            shopKey: config.shopKey || config.shopId || 'default',
            shopId: config.shopId || config.shopKey || 'default',
            position: config.position || 'bottom-right',
            serverUrl: config.serverUrl || window.location.origin,
            userId: config.userId || ('user_' + Math.random().toString(36).substr(2,9) + '_' + Date.now())
        };
        
        console.log('🔧 CustomerServiceWidget 最终配置:', this.config);
        
        // 使用主模块初始化
        if (window.QuickTalkCustomerService) {
            window.QuickTalkCustomerService.init(this.config);
            // 传递关键方法的引用
            this.ws = window.QuickTalkCustomerService.ws;
            this.handleWebSocketMessage = window.QuickTalkCustomerService.handleWebSocketMessage?.bind(window.QuickTalkCustomerService);
            this.ensureFullImageUrl = window.QuickTalkCustomerService.ensureFullImageUrl?.bind(window.QuickTalkCustomerService);
            console.log('✅ CustomerServiceWidget 成功关联到主模块');
        } else {
            console.error('❌ QuickTalkCustomerService 主模块未找到');
            throw new Error('主模块未找到');
        }
    }
    
    // 代理方法
    open() {
        return window.QuickTalkCustomerService?.open();
    }
    
    close() {
        return window.QuickTalkCustomerService?.close();
    }
    
    send(message) {
        return window.QuickTalkCustomerService?.send(message);
    }
}

// 将 CustomerServiceWidget 暴露给全局
window.CustomerServiceWidget = CustomerServiceWidget;
console.log('✅ CustomerServiceWidget 类已定义并暴露到全局');
        `;
    }
}

const embedManager = new EmbedCodeManager();

// CSS文件接口
router.get('/customer-service.css', (req, res) => {
    try {
        res.setHeader('Content-Type', 'text/css');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        const css = embedManager.generateCSS();
        res.send(css);
        
        console.log('📦 提供CSS文件:', css.length, '字符');
    } catch (error) {
        console.error('❌ CSS生成失败:', error);
        res.status(500).send('/* CSS生成失败 */');
    }
});

// JavaScript文件接口
router.get('/customer-service.js', (req, res) => {
    try {
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        const js = embedManager.generateJS();
        res.send(js);
        
        console.log('📦 提供JavaScript文件:', js.length, '字符');
    } catch (error) {
        console.error('❌ JavaScript生成失败:', error);
        res.status(500).send('// JavaScript生成失败');
    }
});

// 版本信息接口
router.get('/version', (req, res) => {
    res.json({
        version: embedManager.version,
        lastModified: embedManager.lastModified,
        features: [
            'WebSocket实时通信',
            '图片消息支持（URL修复）',
            '自动重连机制',
            '动态加载',
            'HTML安全转义',
            '跨域图片显示修复'
        ]
    });
});

module.exports = router;