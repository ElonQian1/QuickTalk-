/**
 * Ruilong集成代码生成器 - 服务器端版本
 * 为Node.js环境兼容的集成代码生成功能
 */

class ServerSideIntegrationGenerator {
    
    constructor(database) {
        this.database = database;
    }
    
    /**
     * 生成店铺集成代码
     * @param {string} shopId - 店铺ID
     * @param {Object} options - 配置选项
     * @returns {Object} 集成代码和API密钥
     */
    async generateIntegrationCode(shopId, options = {}) {
        try {
            console.log('📋 [服务器] 开始生成集成代码:', shopId);
            
            // 生成或获取API密钥
            const apiKey = await this.generateApiKey(shopId);
            
            // 生成集成代码
            const integrationCode = this.buildIntegrationCode(shopId, apiKey, options);
            
            return {
                success: true,
                apiKey: apiKey,
                integrationCode: integrationCode,
                shopId: shopId,
                generatedAt: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ [服务器] 集成代码生成失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 生成或获取API密钥
     * @param {string} shopId - 店铺ID
     * @returns {string} API密钥
     */
    async generateApiKey(shopId) {
        try {
            // 检查是否已有API密钥
            const existingKey = await this.database.run(
                'SELECT api_key FROM shops WHERE id = ?', 
                [shopId]
            );
            
            if (existingKey && existingKey.api_key) {
                console.log('🔑 使用现有API密钥');
                return existingKey.api_key;
            }
            
            // 生成新的API密钥
            const newApiKey = 'qk_' + this.generateRandomString(32);
            
            // 保存到数据库
            await this.database.run(
                'UPDATE shops SET api_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newApiKey, shopId]
            );
            
            console.log('🔑 生成新API密钥');
            return newApiKey;
            
        } catch (error) {
            console.error('❌ API密钥生成失败:', error);
            throw new Error('API密钥生成失败');
        }
    }
    
    /**
     * 构建集成代码
     * @param {string} shopId - 店铺ID
     * @param {string} apiKey - API密钥
     * @param {Object} options - 配置选项
     * @returns {string} 完整的集成代码
     */
    buildIntegrationCode(shopId, apiKey, options = {}) {
        const {
            type = 'websocket',
            position = 'bottom-right',
            theme = 'default',
            title = '在线客服'
        } = options;
        
        return `<!-- QuickTalk 客服系统集成代码 -->
<script>
(function() {
    // 配置参数
    const config = {
        shopId: '${shopId}',
        apiKey: '${apiKey}',
        serverUrl: 'http://localhost:3030',
        type: '${type}',
        position: '${position}',
        theme: '${theme}',
        title: '${title}'
    };
    
    // 创建客服窗口
    function createCustomerServiceWidget() {
        // 创建触发按钮
        const button = document.createElement('div');
        button.id = 'quicktalk-trigger';
        button.innerHTML = '💬';
        button.style.cssText = \`
            position: fixed;
            ${position.includes('bottom') ? 'bottom: 20px;' : 'top: 20px;'}
            ${position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
            width: 60px;
            height: 60px;
            background: #007bff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,123,255,0.3);
            z-index: 9999;
            font-size: 24px;
            transition: all 0.3s ease;
        \`;
        
        // 创建聊天窗口
        const chatWindow = document.createElement('div');
        chatWindow.id = 'quicktalk-window';
        chatWindow.style.cssText = \`
            position: fixed;
            ${position.includes('bottom') ? 'bottom: 90px;' : 'top: 90px;'}
            ${position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
            width: 350px;
            height: 500px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.15);
            z-index: 10000;
            display: none;
            flex-direction: column;
            overflow: hidden;
        \`;
        
        // 聊天窗口内容
        chatWindow.innerHTML = \`
            <div style="background: #007bff; color: white; padding: 15px; font-weight: bold;">
                ${title}
                <span style="float: right; cursor: pointer;" onclick="document.getElementById('quicktalk-window').style.display='none'">×</span>
            </div>
            <div style="flex: 1; overflow: hidden;">
                <iframe src="\${config.serverUrl}/customer?shop=\${config.shopId}&api=\${config.apiKey}" 
                        style="width: 100%; height: 100%; border: none;"></iframe>
            </div>
        \`;
        
        // 添加到页面
        document.body.appendChild(button);
        document.body.appendChild(chatWindow);
        
        // 绑定点击事件
        button.addEventListener('click', function() {
            const isVisible = chatWindow.style.display !== 'none';
            chatWindow.style.display = isVisible ? 'none' : 'flex';
        });
        
        // 悬停效果
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.1)';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });
    }
    
    // WebSocket实时连接（如果选择）
    function initWebSocketConnection() {
        if (config.type === 'websocket') {
            const ws = new WebSocket(\`ws://localhost:3030/ws\`);
            
            ws.onopen = function() {
                console.log('QuickTalk 连接已建立');
                // 发送认证信息
                ws.send(JSON.stringify({
                    type: 'auth',
                    apiKey: config.apiKey,
                    shopId: config.shopId
                }));
            };
            
            ws.onmessage = function(event) {
                const data = JSON.parse(event.data);
                // 处理接收到的消息
                console.log('收到客服消息:', data);
            };
            
            ws.onerror = function(error) {
                console.error('QuickTalk 连接错误:', error);
            };
        }
    }
    
    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            createCustomerServiceWidget();
            initWebSocketConnection();
        });
    } else {
        createCustomerServiceWidget();
        initWebSocketConnection();
    }
})();
</script>
<!-- QuickTalk 集成代码结束 -->`;
    }
    
    /**
     * 重新生成API密钥
     * @param {string} shopId - 店铺ID
     * @returns {Object} 新的API密钥和集成代码
     */
    async regenerateApiKey(shopId) {
        try {
            // 生成新的API密钥
            const newApiKey = 'qk_' + this.generateRandomString(32);
            
            // 更新数据库
            await this.database.run(
                'UPDATE shops SET api_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newApiKey, shopId]
            );
            
            // 重新生成集成代码
            const integrationCode = this.buildIntegrationCode(shopId, newApiKey);
            
            console.log('🔄 API密钥重新生成完成');
            
            return {
                success: true,
                apiKey: newApiKey,
                integrationCode: integrationCode
            };
            
        } catch (error) {
            console.error('❌ API密钥重新生成失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 生成随机字符串
     * @param {number} length - 字符串长度
     * @returns {string} 随机字符串
     */
    generateRandomString(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
}

module.exports = ServerSideIntegrationGenerator;