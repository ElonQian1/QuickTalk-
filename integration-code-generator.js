// 傻瓜式集成代码生成器
class IntegrationCodeGenerator {
    constructor(database) {
        this.database = database;
    }

    /**
     * 为店铺生成API密钥
     */
    generateApiKey() {
        // 生成32位随机字符串，以sk_开头表示shop key
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let key = 'sk_';
        for (let i = 0; i < 32; i++) {
            key += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return key;
    }

    /**
     * 为店铺生成完整的集成代码
     */
    async generateIntegrationCode(shopId, options = {}) {
        try {
            // 获取店铺信息
            const shops = await this.database.getAllShops();
            const shop = shops.find(s => s.id === shopId);
            
            if (!shop) {
                throw new Error('店铺不存在');
            }

            // 如果店铺还没有API密钥，生成一个
            if (!shop.api_key) {
                const apiKey = this.generateApiKey();
                await this.database.updateShopApiKey(shopId, apiKey);
                shop.api_key = apiKey;
            }

            // 默认配置
            const defaultConfig = {
                position: 'bottom-right',
                theme: 'default',
                welcomeMessage: '您好！有什么可以帮您的吗？',
                title: '在线客服',
                placeholder: '请输入您的消息...',
                sendButton: '发送',
                serverUrl: options.serverUrl || 'http://localhost:3030', // 优先使用传入的服务器地址
                autoOpen: false
            };

            const config = { ...defaultConfig, ...options };

            // 生成集成代码
            const integrationCode = this.generateCodeTemplate(shop, config);
            
            // 记录代码生成日志
            console.log(`🔑 为店铺 "${shop.name}" 生成集成代码，API密钥: ${shop.api_key.substring(0, 8)}...`);

            return {
                success: true,
                shop: {
                    id: shop.id,
                    name: shop.name,
                    domain: shop.domain,
                    apiKey: shop.api_key
                },
                config,
                code: integrationCode,
                generatedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('生成集成代码失败:', error);
            throw error;
        }
    }

    /**
     * 生成HTML集成代码模板
     */
    generateCodeTemplate(shop, config) {
        // 构建代码模板
        const wsUrl = config.serverUrl.replace('http', 'ws');
        
        const codeTemplate = `<!-- QuickTalk客服系统集成代码 -->
<!-- 店铺: ${shop.name} -->
<!-- 域名: ${shop.domain} -->
<!-- 生成时间: ${new Date().toLocaleString('zh-CN')} -->
<!-- 注意: 请勿修改以下代码，直接复制粘贴到您的网站页面中 -->

<!-- 客服按钮样式 -->
<style>
.viewport-nav{outline:#000;position:fixed;right:40px;bottom:40px;z-index:999999}
.viewport-nav .nav-box{background:rgba(0,0,0,.8);border-radius:100%;text-align:center;margin:15px 0;width:100px;height:100px;line-height:100px;box-shadow:0 0 5px 2px rgba(255,255,255,.5)}
.viewport-nav .nav-box p{padding:0 1px;font-size:31px;color:#fff;white-space:normal;font-weight:700}
.viewport-nav .nav-box#cb{position:relative;cursor:pointer}
.viewport-nav .nav-box .nav-dabaowei,.viewport-nav .nav-box .nav-sxsx{font-size:24px}

/* 新增客服聊天窗口样式 */
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
.cs-input{padding:15px 20px;border-top:1px solid #eee;display:flex;gap:10px;background:white}
.cs-input input{flex:1;padding:10px 15px;border:1px solid #ddd;border-radius:20px;outline:none;font-size:14px}
.cs-input button{background:#667eea;color:white;border:none;padding:10px 20px;border-radius:20px;cursor:pointer;font-weight:600}
.cs-status{padding:8px 20px;background:#f8f9fa;border-top:1px solid #eee;display:flex;align-items:center;gap:8px;font-size:12px}
.cs-dot{width:8px;height:8px;border-radius:50%;display:inline-block}
.cs-connected{background:#28a745;animation:pulse 2s infinite}
.cs-disconnected{background:#dc3545}
@keyframes pulse{0%{opacity:1}50%{opacity:0.5}100%{opacity:1}}
@media (max-width:768px){.cs-chat{width:calc(100vw - 20px);right:10px;left:10px}}
</style>

<!-- 客服按钮HTML -->
<div class="viewport-nav">
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
        <h3>${config.title}</h3>
        <div class="cs-controls">
            <button onclick="miniCS()">−</button>
            <button onclick="closeCS()">×</button>
        </div>
    </div>
    <div class="cs-body" id="cs-body">
        <div class="cs-msg cs-system">
            <span class="cs-msg-text">${config.welcomeMessage}</span>
            <span class="cs-msg-time" id="welcome-time"></span>
        </div>
    </div>
    <div class="cs-input">
        <input type="text" id="cs-input" placeholder="${config.placeholder}" onkeypress="if(event.key==='Enter')sendCS()">
        <button onclick="sendCS()">${config.sendButton}</button>
    </div>
    <div class="cs-status">
        <span class="cs-dot" id="cs-dot"></span>
        <span id="cs-status">连接中...</span>
    </div>
</div>

<script>
// QuickTalk客服系统配置
window.QUICKTALK_CONFIG = {
    // 店铺认证信息（请勿修改）
    shopKey: '${shop.api_key}',
    shopId: '${shop.id}',
    shopName: '${shop.name}',
    authorizedDomain: '${shop.domain}',
    
    // 服务器配置
    serverUrl: '${config.serverUrl}',
    apiUrl: '${config.serverUrl}/api',
    wsUrl: '${wsUrl}/ws',
    
    // 界面配置
    ui: {
        position: '${config.position}',
        theme: '${config.theme}',
        title: '${config.title}',
        placeholder: '${config.placeholder}',
        sendButton: '${config.sendButton}',
        autoOpen: ${config.autoOpen}
    },
    
    // 欢迎消息
    welcomeMessage: '${config.welcomeMessage}',
    
    // 系统信息
    version: '1.0.0',
    generatedAt: '${new Date().toISOString()}'
};

// 客服系统实现
(function(){
    let cs = {
        isOpen: false,
        isMini: false,
        isConnected: false,
        userId: 'user_' + Math.random().toString(36).substr(2,9) + '_' + Date.now(),
        interval: null,
        lastId: 0,
        
        init() {
            // 验证域名
            const currentDomain = window.location.hostname;
            const authorizedDomain = window.QUICKTALK_CONFIG.authorizedDomain;
            
            if (currentDomain !== authorizedDomain && 
                !currentDomain.endsWith('.' + authorizedDomain) && 
                currentDomain !== 'localhost') {
                console.error('❌ QuickTalk客服系统：域名未授权');
                console.error('当前域名:', currentDomain);
                console.error('授权域名:', authorizedDomain);
                return;
            }
            
            console.log('✅ 域名验证通过，正在连接客服系统...');
            this.updateTime();
            setTimeout(() => this.connect(), 1000);
        },
        
        async connect() {
            try {
                console.log('🔗 尝试连接到服务器:', window.QUICKTALK_CONFIG.serverUrl);
                
                // 先尝试使用新的安全连接API
                let res = await fetch(window.QUICKTALK_CONFIG.apiUrl + '/secure-connect', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Shop-Key': window.QUICKTALK_CONFIG.shopKey,
                        'X-Shop-Id': window.QUICKTALK_CONFIG.shopId
                    },
                    body: JSON.stringify({
                        userId: this.userId,
                        timestamp: Date.now(),
                        shopKey: window.QUICKTALK_CONFIG.shopKey,
                        shopId: window.QUICKTALK_CONFIG.shopId,
                        domain: window.location.hostname,
                        version: window.QUICKTALK_CONFIG.version
                    })
                });
                
                // 如果安全连接失败，回退到基础连接API
                if (!res.ok) {
                    console.log('🔄 安全连接失败，尝试基础连接...');
                    res = await fetch(window.QUICKTALK_CONFIG.apiUrl + '/connect', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            userId: this.userId,
                            timestamp: Date.now()
                        })
                    });
                }
                
                if (res.ok) {
                    const data = await res.json();
                    this.isConnected = true;
                    this.updateStatus('connected', '已连接');
                    this.startPoll();
                    console.log('✅ 客服连接成功:', data.shop?.name || '基础连接');
                } else {
                    const errorData = await res.json().catch(() => ({}));
                    throw new Error(errorData.error || 'HTTP ' + res.status + ': ' + res.statusText);
                }
            } catch (e) {
                console.error('❌ 客服连接失败:', e);
                this.updateStatus('disconnected', '连接失败: ' + e.message);
                setTimeout(() => this.connect(), 5000);
            }
        },
        
        startPoll() {
            if (this.interval) clearInterval(this.interval);
            this.interval = setInterval(() => this.checkMsg(), 2000);
        },
        
        async checkMsg() {
            if (!this.isConnected) return;
            try {
                const res = await fetch(window.QUICKTALK_CONFIG.apiUrl + '/messages?userId=' + this.userId + '&lastId=' + this.lastId, {
                    headers: {
                        'X-Shop-Key': window.QUICKTALK_CONFIG.shopKey,
                        'X-Shop-Id': window.QUICKTALK_CONFIG.shopId
                    }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.messages && data.messages.length > 0) {
                        data.messages.forEach(msg => {
                            this.handleMsg(msg);
                            this.lastId = Math.max(this.lastId, msg.id || 0);
                        });
                    }
                }
            } catch (e) {
                console.error('获取消息失败:', e);
                this.isConnected = false;
                this.updateStatus('disconnected', '连接断开');
                setTimeout(() => this.connect(), 3000);
            }
        },
        
        handleMsg(msg) {
            if (msg.type === 'staff_message') {
                this.addMsg('staff', msg.message);
            } else if (msg.type === 'system_notification') {
                this.addMsg('system', msg.message);
            }
        },
        
        addMsg(type, text) {
            const body = document.getElementById('cs-body');
            const div = document.createElement('div');
            div.className = 'cs-msg cs-' + type;
            div.innerHTML = '<span class="cs-msg-text">' + text + '</span><span class="cs-msg-time">' + new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'}) + '</span>';
            body.appendChild(div);
            body.scrollTop = body.scrollHeight;
        },
        
        async send() {
            const input = document.getElementById('cs-input');
            const msg = input.value.trim();
            if (!msg) return;
            
            if (!this.isConnected) {
                this.addMsg('system', '连接断开，无法发送消息');
                return;
            }
            
            this.addMsg('user', msg);
            input.value = '';
            
            try {
                await fetch(window.QUICKTALK_CONFIG.apiUrl + '/send', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Shop-Key': window.QUICKTALK_CONFIG.shopKey,
                        'X-Shop-Id': window.QUICKTALK_CONFIG.shopId
                    },
                    body: JSON.stringify({
                        userId: this.userId,
                        message: msg,
                        shopKey: window.QUICKTALK_CONFIG.shopKey,
                        timestamp: Date.now()
                    })
                });
            } catch (e) {
                this.addMsg('system', '发送失败，请重试');
            }
        },
        
        updateStatus(status, text) {
            const dot = document.getElementById('cs-dot');
            const statusText = document.getElementById('cs-status');
            if (dot) dot.className = 'cs-dot cs-' + status;
            if (statusText) statusText.textContent = text;
        },
        
        updateTime() {
            const time = document.getElementById('welcome-time');
            if (time) time.textContent = new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'});
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
                if (this.isConnected && !this.interval) this.startPoll();
            }
        },
        
        close() {
            const chat = document.getElementById('cs-chat');
            if (chat) {
                chat.classList.remove('open', 'mini');
                this.isOpen = false;
                this.isMini = false;
                if (this.interval) {
                    clearInterval(this.interval);
                    this.interval = null;
                }
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
        }
    };
    
    // 全局函数
    window.toggleCS = () => cs.toggle();
    window.closeCS = () => cs.close();
    window.miniCS = () => cs.minimize();
    window.sendCS = () => cs.send();
    
    // 客服按钮点击事件
    document.addEventListener('DOMContentLoaded', function() {
        const cbBtn = document.querySelector('#cb');
        if (cbBtn) {
            cbBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                cs.toggle();
            });
        }
        
        // 初始化
        setTimeout(() => cs.init(), 1000);
    });
    
    // 如果DOM已加载完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(() => cs.init(), 1000));
    } else {
        setTimeout(() => cs.init(), 1000);
    }
    
    // 清理
    window.addEventListener('beforeunload', () => {
        if (cs.interval) clearInterval(cs.interval);
    });
})();
</script>

<!-- 
🔥 QuickTalk客服系统集成完成

【使用说明】
1. 代码已自动配置服务器地址和认证信息
2. 点击右下角的"客服"按钮即可开始对话
3. 系统会自动验证域名和API密钥
4. 如有问题，请联系技术支持

【技术支持】
- 如需修改样式，请联系开发者
- 如需更换域名，请重新生成集成代码
- 如遇连接问题，请检查服务器状态
-->`;

        return codeTemplate;
    }

    /**
     * 验证API密钥和域名
     */
    async verifyApiKey(apiKey, domain, ip) {
        try {
            const shops = await this.database.getAllShops();
            const shop = shops.find(s => s.api_key === apiKey);
            
            if (!shop) {
                return {
                    valid: false,
                    reason: 'API密钥无效',
                    code: 'INVALID_API_KEY'
                };
            }

            // 验证域名
            const normalizedCurrentDomain = this.normalizeDomain(domain);
            const normalizedShopDomain = this.normalizeDomain(shop.domain);
            
            // 检查域名匹配
            const domainMatch = 
                normalizedCurrentDomain === normalizedShopDomain ||
                normalizedCurrentDomain.endsWith('.' + normalizedShopDomain) ||
                normalizedCurrentDomain === 'localhost'; // 开发环境

            if (!domainMatch) {
                return {
                    valid: false,
                    reason: `域名不匹配，当前: ${domain}，授权: ${shop.domain}`,
                    code: 'DOMAIN_MISMATCH',
                    shop: shop
                };
            }

            // 记录成功验证
            console.log(`🔑 API密钥验证成功: ${shop.name} (${domain})`);
            
            return {
                valid: true,
                shop: shop,
                reason: '验证通过',
                matchType: 'api_key_and_domain'
            };

        } catch (error) {
            console.error('API密钥验证失败:', error);
            return {
                valid: false,
                reason: `验证过程出错: ${error.message}`,
                code: 'VERIFICATION_ERROR'
            };
        }
    }

    /**
     * 标准化域名
     */
    normalizeDomain(domain) {
        if (!domain) return '';
        return domain.toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/:\d+$/, '')
            .split('/')[0]
            .replace(/^www\./, '');
    }

    /**
     * 重新生成店铺的API密钥
     */
    async regenerateApiKey(shopId) {
        try {
            const newApiKey = this.generateApiKey();
            await this.database.updateShopApiKey(shopId, newApiKey);
            
            console.log(`🔄 店铺 ${shopId} 的API密钥已重新生成: ${newApiKey.substring(0, 8)}...`);
            
            return {
                success: true,
                shopId,
                newApiKey,
                message: 'API密钥已重新生成，请更新集成代码'
            };
        } catch (error) {
            console.error('重新生成API密钥失败:', error);
            throw error;
        }
    }

    /**
     * 获取店铺的使用统计
     */
    async getShopUsageStats(shopId) {
        // 这里可以扩展为从数据库获取真实的使用统计
        return {
            shopId,
            totalRequests: 0,
            todayRequests: 0,
            lastUsed: null,
            activeConnections: 0
        };
    }
}

module.exports = IntegrationCodeGenerator;
