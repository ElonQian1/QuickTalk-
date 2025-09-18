/**
 * Ruilong版本 - 集成代码生成模块
 * 为店铺生成第三方网站嵌入代码
 */

class RuilongIntegration {
    
    /**
     * 生成店铺集成代码（ruilong原版功能）
     * @param {string} shopId - 店铺ID
     */
    static async generateCode(shopId) {
        try {
            console.log('📋 [Ruilong] 开始生成集成代码:', shopId);
            
            // 使用ruilong原版API
            const sessionId = localStorage.getItem('sessionId') || localStorage.getItem('token');
            const response = await fetch(`/api/shops/${shopId}/integration-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Id': sessionId,
                    'Authorization': `Bearer ${sessionId}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.showMobileIntegrationCodeModal(data);
            } else {
                const error = await response.json();
                alert('生成集成代码失败: ' + (error.error || '未知错误'));
            }
            
        } catch (error) {
            console.error('❌ [Ruilong] 代码生成失败:', error);
            alert(`代码生成失败: ${error.message}`);
        }
    }
    
    /**
     * 显示移动端集成代码模态框（ruilong原版功能）
     * @param {Object} data - 集成代码数据
     */
    static showMobileIntegrationCodeModal(data) {
        const modal = document.createElement('div');
        modal.className = 'integration-code-modal';
        modal.innerHTML = `
            <div class="integration-code-content">
                <div class="integration-code-header">
                    <h3>📋 集成代码</h3>
                    <button class="close-btn" onclick="this.closest('.integration-code-modal').remove()">✕</button>
                </div>
                <div class="integration-code-body">
                    <div class="code-type-tabs">
                        <button class="tab-btn active" data-type="script">脚本代码</button>
                        <button class="tab-btn" data-type="iframe">iframe嵌入</button>
                        <button class="tab-btn" data-type="api">API接口</button>
                    </div>
                    <div class="code-content">
                        <div class="code-description active" data-type="script">
                            <h4>JavaScript脚本代码</h4>
                            <p>将以下代码复制到您的网站页面中，即可启用客服功能。</p>
                        </div>
                        <div class="code-description" data-type="iframe">
                            <h4>iframe嵌入代码</h4>
                            <p>直接在页面中嵌入客服窗口，适合专门的客服页面。</p>
                        </div>
                        <div class="code-description" data-type="api">
                            <h4>API接口信息</h4>
                            <p>用于自定义集成的API接口地址和密钥。</p>
                        </div>
                        <div class="code-display">
                            <textarea class="code-textarea" readonly>${data.scriptCode || data.integrationCode || ''}</textarea>
                            <div class="code-actions">
                                <button class="copy-btn" onclick="RuilongIntegration.copyIntegrationCode(this)">📋 复制代码</button>
                                <button class="download-btn" onclick="RuilongIntegration.downloadCode(this)">💾 下载文件</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 初始化标签页切换
        this.initMobileCodeTabs(modal, data);
    }
    
    /**
     * 初始化移动端代码标签页
     * @param {Element} modal - 模态框元素
     * @param {Object} data - 代码数据
     */
    static initMobileCodeTabs(modal, data) {
        const tabs = modal.querySelectorAll('.tab-btn');
        const textarea = modal.querySelector('.code-textarea');
        const descriptions = modal.querySelectorAll('.code-description');
        
        // 默认显示脚本代码
        textarea.value = data.scriptCode || data.integrationCode || '';
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // 切换标签页
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // 切换描述
                descriptions.forEach(d => d.classList.remove('active'));
                const targetDesc = modal.querySelector(`.code-description[data-type="${tab.dataset.type}"]`);
                if (targetDesc) targetDesc.classList.add('active');
                
                // 切换代码内容
                const codeType = tab.dataset.type;
                if (codeType === 'script') {
                    textarea.value = data.scriptCode || data.integrationCode || '';
                } else if (codeType === 'iframe') {
                    textarea.value = data.iframeCode || `<iframe src="${window.location.origin}/embed/${data.shopId}" width="400" height="600" frameborder="0"></iframe>`;
                } else if (codeType === 'api') {
                    textarea.value = JSON.stringify({
                        apiUrl: `${window.location.origin}/api`,
                        shopId: data.shopId,
                        apiKey: data.apiKey || '请联系管理员获取'
                    }, null, 2);
                }
            });
        });
    }
    
    /**
     * 复制集成代码（ruilong原版功能）
     * @param {Element} button - 复制按钮
     */
    static async copyIntegrationCode(button) {
        const textarea = button.closest('.code-content').querySelector('.code-textarea');
        
        try {
            await navigator.clipboard.writeText(textarea.value);
            const originalText = button.textContent;
            button.textContent = '✅ 已复制';
            button.style.background = '#28a745';
            
            setTimeout(() => {
                button.textContent = originalText;
                button.style.background = '';
            }, 2000);
        } catch (error) {
            // 兼容性处理
            textarea.select();
            try {
                document.execCommand('copy');
                alert('✅ 集成代码已复制到剪贴板');
            } catch (err) {
                console.error('复制失败:', err);
                alert('❌ 复制失败，请手动选择并复制代码');
            }
        }
    }
    
    /**
     * 获取店铺信息
     * @param {string} shopId - 店铺ID
     * @returns {Object} - 店铺信息
     */
    static async getShopInfo(shopId) {
        try {
            const response = await fetch(`/api/shops/${shopId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('获取店铺信息失败:', error);
            return null;
        }
    }
    
    /**
     * 生成WebSocket版本集成代码
     * @param {Object} shopInfo - 店铺信息
     * @returns {string} - 集成代码
     */
    static generateWebSocketCode(shopInfo) {
        const serverUrl = window.location.origin;
        const shopId = shopInfo.id;
        const shopName = shopInfo.name || '在线客服';
        
        return `<!-- ${shopName} - WebSocket客服代码 -->
<div id="quicktalk-chat-${shopId}"></div>
<script>
(function() {
    // QuickTalk WebSocket客服系统
    const SHOP_ID = '${shopId}';
    const SERVER_URL = '${serverUrl}';
    const SHOP_NAME = '${shopName}';
    
    // 创建聊天容器
    function createChatContainer() {
        const container = document.getElementById('quicktalk-chat-' + SHOP_ID);
        if (!container) return;
        
        container.innerHTML = \`
            <div id="quicktalk-widget-\${SHOP_ID}" style="
                position: fixed; bottom: 20px; right: 20px; z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            ">
                <div id="quicktalk-toggle-\${SHOP_ID}" style="
                    width: 60px; height: 60px; border-radius: 30px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white; border: none; cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    transition: transform 0.2s ease;
                " onclick="toggleQuickTalkChat()">💬</div>
                
                <div id="quicktalk-panel-\${SHOP_ID}" style="
                    position: absolute; bottom: 70px; right: 0;
                    width: 350px; height: 500px; background: white;
                    border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.12);
                    display: none; flex-direction: column; overflow: hidden;
                ">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; font-weight: 600;">
                        \${SHOP_NAME}
                    </div>
                    <div id="quicktalk-messages-\${SHOP_ID}" style="flex: 1; padding: 15px; overflow-y: auto; background: #f8f9fa;"></div>
                    <div style="padding: 15px; border-top: 1px solid #eee; background: white;">
                        <div style="display: flex; gap: 8px;">
                            <input type="text" id="quicktalk-input-\${SHOP_ID}" placeholder="输入消息..." style="
                                flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 20px;
                                outline: none; font-size: 14px;
                            " onkeypress="if(event.key==='Enter') sendQuickTalkMessage()">
                            <button onclick="sendQuickTalkMessage()" style="
                                padding: 10px 15px; background: #667eea; color: white;
                                border: none; border-radius: 20px; cursor: pointer; font-size: 14px;
                            ">发送</button>
                        </div>
                    </div>
                </div>
            </div>
        \`;
    }
    
    // WebSocket连接
    let ws = null;
    let conversationId = null;
    
    function connectWebSocket() {
        const wsUrl = SERVER_URL.replace('http', 'ws') + '/ws';
        ws = new WebSocket(wsUrl);
        
        ws.onopen = function() {
            console.log('QuickTalk WebSocket已连接');
        };
        
        ws.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'message' && data.shopId === SHOP_ID) {
                    displayMessage(data.content, false);
                }
            } catch (e) {
                console.error('WebSocket消息解析错误:', e);
            }
        };
        
        ws.onclose = function() {
            console.log('QuickTalk WebSocket连接关闭');
            // 5秒后重连
            setTimeout(connectWebSocket, 5000);
        };
    }
    
    // 切换聊天面板
    window.toggleQuickTalkChat = function() {
        const panel = document.getElementById('quicktalk-panel-' + SHOP_ID);
        if (panel.style.display === 'none' || !panel.style.display) {
            panel.style.display = 'flex';
            if (!conversationId) {
                startConversation();
            }
        } else {
            panel.style.display = 'none';
        }
    };
    
    // 开始对话
    async function startConversation() {
        try {
            const response = await fetch(SERVER_URL + '/api/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shopId: SHOP_ID })
            });
            const data = await response.json();
            conversationId = data.conversationId;
            
            displayMessage('欢迎来到' + SHOP_NAME + '，有什么可以帮助您的吗？', false);
        } catch (error) {
            console.error('连接客服失败:', error);
            displayMessage('连接客服失败，请刷新页面重试。', false);
        }
    }
    
    // 发送消息
    window.sendQuickTalkMessage = async function() {
        const input = document.getElementById('quicktalk-input-' + SHOP_ID);
        const message = input.value.trim();
        if (!message || !conversationId) return;
        
        displayMessage(message, true);
        input.value = '';
        
        try {
            await fetch(SERVER_URL + '/api/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversationId: conversationId,
                    message: message,
                    shopId: SHOP_ID
                })
            });
        } catch (error) {
            console.error('发送消息失败:', error);
        }
    };
    
    // 显示消息
    function displayMessage(message, isUser) {
        const messagesDiv = document.getElementById('quicktalk-messages-' + SHOP_ID);
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = \`
            margin: 8px 0; padding: 8px 12px; border-radius: 12px; max-width: 80%;
            word-wrap: break-word; font-size: 14px; line-height: 1.4;
            \${isUser ? 
                'background: #667eea; color: white; margin-left: auto; text-align: right;' : 
                'background: white; color: #333; margin-right: auto; box-shadow: 0 1px 2px rgba(0,0,0,0.1);'
            }
        \`;
        messageDiv.textContent = message;
        messagesDiv.appendChild(messageDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
    
    // 初始化
    document.addEventListener('DOMContentLoaded', function() {
        createChatContainer();
        connectWebSocket();
    });
    
    // 如果DOM已加载完成，立即初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            createChatContainer();
            connectWebSocket();
        });
    } else {
        createChatContainer();
        connectWebSocket();
    }
})();
</script>`;
    }
    
    /**
     * 生成轮询版本集成代码
     * @param {Object} shopInfo - 店铺信息
     * @returns {string} - 集成代码
     */
    static generatePollingCode(shopInfo) {
        const serverUrl = window.location.origin;
        const shopId = shopInfo.id;
        const shopName = shopInfo.name || '在线客服';
        
        return `<!-- ${shopName} - 轮询客服代码 -->
<div id="quicktalk-chat-${shopId}"></div>
<script>
(function() {
    // QuickTalk 轮询客服系统
    const SHOP_ID = '${shopId}';
    const SERVER_URL = '${serverUrl}';
    const SHOP_NAME = '${shopName}';
    
    let conversationId = null;
    let lastMessageId = 0;
    let pollingInterval = null;
    
    // 创建聊天界面（与WebSocket版本相同的UI）
    function createChatContainer() {
        // ... 相同的UI代码 ...
    }
    
    // 开始轮询
    function startPolling() {
        if (pollingInterval) return;
        
        pollingInterval = setInterval(async function() {
            if (!conversationId) return;
            
            try {
                const response = await fetch(SERVER_URL + '/api/messages/' + conversationId + '?since=' + lastMessageId);
                const messages = await response.json();
                
                messages.forEach(function(msg) {
                    if (msg.id > lastMessageId && !msg.isFromUser) {
                        displayMessage(msg.content, false);
                        lastMessageId = msg.id;
                    }
                });
            } catch (error) {
                console.error('轮询消息失败:', error);
            }
        }, 2000); // 每2秒轮询一次
    }
    
    // 停止轮询
    function stopPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    }
    
    // 其他函数与WebSocket版本相似，但使用HTTP轮询而非WebSocket
    
    // 初始化
    document.addEventListener('DOMContentLoaded', function() {
        createChatContainer();
    });
})();
</script>`;
    }
    
    /**
     * 生成iframe版本集成代码
     * @param {Object} shopInfo - 店铺信息
     * @returns {string} - 集成代码
     */
    static generateIframeCode(shopInfo) {
        const serverUrl = window.location.origin;
        const shopId = shopInfo.id;
        const shopName = shopInfo.name || '在线客服';
        
        return `<!-- ${shopName} - iframe客服代码 -->
<div id="quicktalk-iframe-${shopId}"></div>
<script>
(function() {
    const SHOP_ID = '${shopId}';
    const SERVER_URL = '${serverUrl}';
    
    const container = document.getElementById('quicktalk-iframe-' + SHOP_ID);
    if (container) {
        container.innerHTML = \`
            <iframe 
                src="\${SERVER_URL}/embed/\${SHOP_ID}" 
                width="100%" 
                height="600" 
                frameborder="0"
                style="border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            </iframe>
        \`;
    }
})();
</script>`;
    }
    
    /**
     * 生成浮动按钮代码
     * @param {Object} shopInfo - 店铺信息
     * @returns {string} - 集成代码
     */
    static generateFloatingButtonCode(shopInfo) {
        const serverUrl = window.location.origin;
        const shopId = shopInfo.id;
        const shopName = shopInfo.name || '在线客服';
        
        return `<!-- ${shopName} - 浮动按钮客服代码 -->
<script>
(function() {
    const SHOP_ID = '${shopId}';
    const SERVER_URL = '${serverUrl}';
    const SHOP_NAME = '${shopName}';
    
    // 创建浮动按钮
    const button = document.createElement('div');
    button.style.cssText = \`
        position: fixed; bottom: 20px; right: 20px; z-index: 10000;
        width: 60px; height: 60px; border-radius: 30px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white; cursor: pointer; display: flex;
        align-items: center; justify-content: center; font-size: 24px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transition: transform 0.2s ease;
    \`;
    button.innerHTML = '💬';
    button.onclick = function() {
        window.open(SERVER_URL + '/client/' + SHOP_ID, 'quicktalk', 'width=400,height=600');
    };
    
    document.body.appendChild(button);
})();
</script>`;
    }
    
    /**
     * 显示代码选择模态框
     * @param {Object} shopInfo - 店铺信息
     * @param {Object} codes - 集成代码对象
     */
    static showCodeSelectionModal(shopInfo, codes) {
        this.hideLoadingModal();
        
        const modal = document.createElement('div');
        modal.className = 'integration-code-modal';
        modal.innerHTML = `
            <div class="integration-code-content">
                <div class="integration-code-header">
                    <h3>📋 ${shopInfo.name} - 集成代码</h3>
                    <button class="close-btn" onclick="this.closest('.integration-code-modal').remove()">✕</button>
                </div>
                <div class="integration-code-body">
                    <div class="code-type-tabs">
                        <button class="tab-btn active" data-type="websocket">WebSocket (推荐)</button>
                        <button class="tab-btn" data-type="polling">轮询模式</button>
                        <button class="tab-btn" data-type="iframe">iframe嵌入</button>
                        <button class="tab-btn" data-type="button">浮动按钮</button>
                    </div>
                    <div class="code-content">
                        <div class="code-description">
                            <div class="desc-item active" data-type="websocket">
                                <h4>WebSocket模式</h4>
                                <p>实时双向通信，推荐用于现代浏览器。支持即时消息推送，用户体验最佳。</p>
                            </div>
                            <div class="desc-item" data-type="polling">
                                <h4>轮询模式</h4>
                                <p>兼容性最好，适用于所有浏览器。定时请求新消息，延迟稍高但稳定可靠。</p>
                            </div>
                            <div class="desc-item" data-type="iframe">
                                <h4>iframe嵌入</h4>
                                <p>完整的客服界面嵌入，功能最全面。适合专门的客服页面。</p>
                            </div>
                            <div class="desc-item" data-type="button">
                                <h4>浮动按钮</h4>
                                <p>最简单的集成方式，点击按钮在新窗口打开客服。适合快速部署。</p>
                            </div>
                        </div>
                        <div class="code-display">
                            <textarea class="code-textarea" readonly></textarea>
                            <div class="code-actions">
                                <button class="copy-btn" onclick="RuilongIntegration.copyCode(this)">📋 复制代码</button>
                                <button class="download-btn" onclick="RuilongIntegration.downloadCode(this)">💾 下载文件</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 初始化标签页切换
        this.initCodeTabs(modal, codes);
    }
    
    /**
     * 初始化代码标签页
     * @param {Element} modal - 模态框元素
     * @param {Object} codes - 代码对象
     */
    static initCodeTabs(modal, codes) {
        const tabs = modal.querySelectorAll('.tab-btn');
        const textarea = modal.querySelector('.code-textarea');
        const descriptions = modal.querySelectorAll('.desc-item');
        
        // 显示WebSocket代码
        textarea.value = codes.websocket;
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // 切换标签页
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // 切换描述
                descriptions.forEach(d => d.classList.remove('active'));
                const targetDesc = modal.querySelector(`.desc-item[data-type="${tab.dataset.type}"]`);
                if (targetDesc) targetDesc.classList.add('active');
                
                // 切换代码
                const codeType = tab.dataset.type;
                textarea.value = codes[codeType] || '';
            });
        });
    }
    
    /**
     * 复制代码到剪贴板
     * @param {Element} button - 复制按钮
     */
    static async copyCode(button) {
        const textarea = button.closest('.code-content').querySelector('.code-textarea');
        
        try {
            await navigator.clipboard.writeText(textarea.value);
            const originalText = button.textContent;
            button.textContent = '✅ 已复制';
            button.style.background = '#28a745';
            
            setTimeout(() => {
                button.textContent = originalText;
                button.style.background = '';
            }, 2000);
        } catch (error) {
            // 兼容性处理
            textarea.select();
            document.execCommand('copy');
            alert('代码已复制到剪贴板');
        }
    }
    
    /**
     * 下载代码文件
     * @param {Element} button - 下载按钮
     */
    static downloadCode(button) {
        const textarea = button.closest('.code-content').querySelector('.code-textarea');
        const activeTab = document.querySelector('.tab-btn.active');
        const codeType = activeTab ? activeTab.dataset.type : 'websocket';
        
        const blob = new Blob([textarea.value], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `quicktalk-${codeType}-integration.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    /**
     * 显示加载模态框
     */
    static showLoadingModal(message) {
        const existing = document.querySelector('.loading-modal');
        if (existing) existing.remove();
        
        const modal = document.createElement('div');
        modal.className = 'loading-modal';
        modal.innerHTML = `
            <div class="loading-content">
                <div class="spinner"></div>
                <div class="loading-text">${message}</div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    /**
     * 隐藏加载模态框
     */
    static hideLoadingModal() {
        const modal = document.querySelector('.loading-modal');
        if (modal) modal.remove();
    }
}

// 全局注册模块
window.RuilongIntegration = RuilongIntegration;

console.log('📋 [Ruilong] 集成代码模块已加载');