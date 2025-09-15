// QuickTalk客服系统 - 动态嵌入API
// 提供CSS和JavaScript的动态加载接口

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

class EmbedCodeManager {
    constructor() {
        this.version = '1.0.9'; // 🔧 彻底修复重复消息问题：前端去重+后端单条发送
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

/* 图片消息样式 - 动态版本支持 */
.cs-msg-image{max-width:80%;align-self:flex-start;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)}
.cs-msg-image img{width:100%;height:auto;display:block;cursor:pointer;transition:transform 0.2s ease}
.cs-msg-image img:hover{transform:scale(1.02)}
.cs-msg-image .cs-image-info{padding:8px 12px;background:#f8f9fa;font-size:12px;color:#666;border-top:1px solid #e9ecef}

/* 图片预览模态框 */
.cs-image-preview{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:none;align-items:center;justify-content:center;z-index:9999999;cursor:pointer}
.cs-image-preview img{max-width:90%;max-height:90%;object-fit:contain;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,0.5)}
.cs-image-preview .cs-close{position:absolute;top:20px;right:20px;color:white;font-size:30px;cursor:pointer;background:rgba(0,0,0,0.5);width:50px;height:50px;border-radius:50%;display:flex;align-items:center;justify-content:center}

.cs-input{padding:15px 20px;border-top:1px solid #eee;display:flex;gap:10px;background:white}
.cs-input input{flex:1;padding:10px 15px;border:1px solid #ddd;border-radius:20px;outline:none;font-size:14px}
.cs-input button{background:#667eea;color:white;border:none;padding:10px 20px;border-radius:20px;cursor:pointer;font-weight:600}
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
                    <input type="text" id="cs-input" placeholder="请输入您的消息..." onkeypress="if(event.key==='Enter')QuickTalkCustomerService.send()">
                    <button onclick="QuickTalkCustomerService.send()">发送</button>
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
    
    addMsg(type, text) {
        const body = document.getElementById('cs-body');
        const div = document.createElement('div');
        div.className = 'cs-msg cs-' + type;
        div.innerHTML = '<span class="cs-msg-text">' + this.escapeHtml(text) + '</span><span class="cs-msg-time">' + new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'}) + '</span>';
        body.appendChild(div);
        body.scrollTop = body.scrollHeight;
    },
    
    // 🖼️ 添加图片消息 - 最新实现
    addImageMsg(type, imageUrl, fileName, caption) {
        const body = document.getElementById('cs-body');
        const div = document.createElement('div');
        div.className = 'cs-msg cs-' + type;
        
        let imageHtml = \`
            <div class="cs-msg-image">
                <img src="\${imageUrl}" alt="\${this.escapeHtml(fileName || '图片')}" onclick="QuickTalkCustomerService.previewImage('\${imageUrl}')">
                <div class="cs-image-info">
                    📷 \${this.escapeHtml(fileName || '图片')}
                    \${caption && caption !== '[图片]' ? '<br>' + this.escapeHtml(caption) : ''}
                </div>
            </div>
            <span class="cs-msg-time">\${new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'})}</span>
        \`;
        
        div.innerHTML = imageHtml;
        body.appendChild(div);
        body.scrollTop = body.scrollHeight;
    },
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    // 🔧 工具函数：确保图片URL是完整的
    ensureFullImageUrl(url) {
        if (!url) return '';
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url; // 已经是完整URL
        }
        if (url.startsWith('/')) {
            return this.config.serverUrl + url; // 相对路径转完整URL
        }
        return this.config.serverUrl + '/' + url; // 添加前缀
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