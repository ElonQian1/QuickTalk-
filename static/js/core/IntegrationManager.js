/**
 * 统一集成代码管理器
 * 整合所有生成、显示、复制集成代码的功能
 * 替换重复的代码实现，提供统一的API
 */

class IntegrationManager {
    constructor() {
        this.sessionId = null;
        this.initializeSessionId();
    }

    /**
     * 初始化会话ID
     */
    initializeSessionId() {
        this.sessionId = localStorage.getItem('sessionId') || 
                        localStorage.getItem('token') || 
                        localStorage.getItem('adminToken');
    }

    /**
     * 生成店铺集成代码
     * @param {string} shopId - 店铺ID
     * @param {Object} options - 配置选项
     * @returns {Promise<void>}
     */
    async generateCode(shopId, options = {}) {
        try {
            console.log('📋 [IntegrationManager] 开始生成集成代码:', shopId);
            
            const response = await fetch(`/api/shops/${shopId}/integration-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Id': this.sessionId,
                    'Authorization': `Bearer ${this.sessionId}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.showCodeModal(data, options);
            } else {
                const error = await response.json();
                this.showError('生成集成代码失败: ' + (error.error || '未知错误'));
            }
            
        } catch (error) {
            console.error('❌ [IntegrationManager] 代码生成失败:', error);
            this.showError(`代码生成失败: ${error.message}`);
        }
    }

    /**
     * 显示集成代码模态框
     * @param {Object} data - 集成代码数据
     * @param {Object} options - 显示选项
     */
    showCodeModal(data, options = {}) {
        const modal = document.createElement('div');
        modal.className = 'integration-code-modal';
        modal.innerHTML = this.getModalHTML(data, options);
        
        document.body.appendChild(modal);
        
        // 初始化模态框功能
        this.initializeModal(modal, data);
    }

    /**
     * 获取模态框HTML
     * @param {Object} data - 代码数据
     * @param {Object} options - 选项
     * @returns {string} HTML字符串
     */
    getModalHTML(data, options) {
        const isMobile = options.mobile || window.innerWidth <= 768;
        const modalClass = isMobile ? 'mobile-modal' : 'desktop-modal';
        
        return `
            <div class="integration-code-content ${modalClass}">
                <div class="integration-code-header">
                    <h3>📋 集成代码</h3>
                    <button class="close-btn" onclick="this.closest('.integration-code-modal').remove()">✕</button>
                </div>
                <div class="integration-code-body">
                    ${this.getTabsHTML()}
                    <div class="code-content">
                        ${this.getDescriptionsHTML()}
                        <div class="code-display">
                            <textarea class="code-textarea" readonly>${Utils.escapeHtml(data.scriptCode || data.integrationCode || data.code || '')}</textarea>
                            <div class="code-actions">
                                <button class="copy-btn" onclick="window.integrationManager.copyCode(this)">📋 复制代码</button>
                                <button class="download-btn" onclick="window.integrationManager.downloadCode(this)">💾 下载文件</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 获取标签页HTML
     * @returns {string} 标签页HTML
     */
    getTabsHTML() {
        return `
            <div class="code-type-tabs">
                <button class="tab-btn active" data-type="script">脚本代码</button>
                <button class="tab-btn" data-type="iframe">iframe嵌入</button>
                <button class="tab-btn" data-type="api">API接口</button>
            </div>
        `;
    }

    /**
     * 获取描述HTML
     * @returns {string} 描述HTML
     */
    getDescriptionsHTML() {
        return `
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
        `;
    }

    /**
     * 初始化模态框功能
     * @param {Element} modal - 模态框元素
     * @param {Object} data - 代码数据
     */
    initializeModal(modal, data) {
        const tabs = modal.querySelectorAll('.tab-btn');
        const textarea = modal.querySelector('.code-textarea');
        const descriptions = modal.querySelectorAll('.code-description');
        
        // 默认显示脚本代码
        textarea.value = data.scriptCode || data.integrationCode || data.code || '';
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab, tabs, descriptions, textarea, data);
            });
        });

        // 点击背景关闭模态框
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // ESC键关闭模态框
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    /**
     * 切换标签页
     * @param {Element} activeTab - 当前标签
     * @param {NodeList} allTabs - 所有标签
     * @param {NodeList} descriptions - 所有描述
     * @param {Element} textarea - 文本区域
     * @param {Object} data - 代码数据
     */
    switchTab(activeTab, allTabs, descriptions, textarea, data) {
        // 切换标签页状态
        allTabs.forEach(t => t.classList.remove('active'));
        activeTab.classList.add('active');
        
        // 切换描述
        descriptions.forEach(d => d.classList.remove('active'));
        const targetDesc = document.querySelector(`.code-description[data-type="${activeTab.dataset.type}"]`);
        if (targetDesc) targetDesc.classList.add('active');
        
        // 切换代码内容
        const codeType = activeTab.dataset.type;
        switch (codeType) {
            case 'script':
                textarea.value = data.scriptCode || data.integrationCode || data.code || '';
                break;
            case 'iframe':
                textarea.value = data.iframeCode || this.generateIframeCode(data.shopId);
                break;
            case 'api':
                textarea.value = this.generateApiInfo(data);
                break;
        }
    }

    /**
     * 生成iframe代码
     * @param {string} shopId - 店铺ID
     * @returns {string} iframe代码
     */
    generateIframeCode(shopId) {
        const baseUrl = window.location.origin;
        return `<iframe src="${baseUrl}/embed/${shopId}" width="400" height="600" frameborder="0" style="border: none; border-radius: 8px;"></iframe>`;
    }

    /**
     * 生成API信息
     * @param {Object} data - 代码数据
     * @returns {string} 格式化的API信息
     */
    generateApiInfo(data) {
        return JSON.stringify({
            apiUrl: `${window.location.origin}/api`,
            shopId: data.shopId,
            apiKey: data.apiKey || '请联系管理员获取API密钥',
            endpoints: {
                messages: '/api/messages',
                send: '/api/send',
                connect: '/api/connect'
            }
        }, null, 2);
    }

    /**
     * 复制代码到剪贴板
     * @param {Element} button - 复制按钮
     */
    async copyCode(button) {
        const textarea = button.closest('.code-content').querySelector('.code-textarea');
        
        try {
            await navigator.clipboard.writeText(textarea.value);
            this.showCopySuccess(button);
        } catch (error) {
            // 兼容性处理
            this.fallbackCopyText(textarea);
            this.showCopySuccess(button);
        }
    }

    /**
     * 显示复制成功状态
     * @param {Element} button - 复制按钮
     */
    showCopySuccess(button) {
        const originalText = button.textContent;
        const originalBg = button.style.background;
        
        button.textContent = '✅ 已复制';
        button.style.background = '#28a745';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = originalBg;
        }, 2000);
    }

    /**
     * 兼容性复制文本
     * @param {Element} textarea - 文本区域
     */
    fallbackCopyText(textarea) {
        textarea.select();
        textarea.setSelectionRange(0, 99999); // 移动端兼容
        document.execCommand('copy');
    }

    /**
     * 下载代码文件
     * @param {Element} button - 下载按钮
     */
    downloadCode(button) {
        const textarea = button.closest('.code-content').querySelector('.code-textarea');
        const activeTab = document.querySelector('.tab-btn.active');
        const codeType = activeTab ? activeTab.dataset.type : 'script';
        
        const content = textarea.value;
        const filename = this.getDownloadFilename(codeType);
        
        this.downloadFile(content, filename);
    }

    /**
     * 获取下载文件名
     * @param {string} codeType - 代码类型
     * @returns {string} 文件名
     */
    getDownloadFilename(codeType) {
        const timestamp = new Date().toISOString().slice(0, 10);
        switch (codeType) {
            case 'script':
                return `integration-script-${timestamp}.js`;
            case 'iframe':
                return `integration-iframe-${timestamp}.html`;
            case 'api':
                return `api-info-${timestamp}.json`;
            default:
                return `integration-code-${timestamp}.txt`;
        }
    }

    /**
     * 下载文件
     * @param {string} content - 文件内容
     * @param {string} filename - 文件名
     */
    downloadFile(content, filename) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    /**
     * HTML转义
     * @param {string} text - 需要转义的文本
     * @returns {string} 转义后的文本
     */
    // 改为使用统一的 Utils.escapeHtml 方法

    /**
     * 显示错误信息
     * @param {string} message - 错误信息
     */
    showError(message) {
        // 尝试使用现有的提示系统
        if (window.mobileShopManager && window.mobileShopManager.showToast) {
            window.mobileShopManager.showToast(message, 'error');
        } else if (window.showToast) {
            window.showToast(message, 'error');
        } else {
            alert(message);
        }
    }

    /**
     * 简化的生成代码方法（向后兼容）
     * @param {string} shopId - 店铺ID
     */
    async simpleGenerateCode(shopId) {
        return this.generateCode(shopId, { mobile: true });
    }
}

// 创建全局实例
window.integrationManager = new IntegrationManager();
window.IntegrationManager = IntegrationManager;

console.log('📋 [IntegrationManager] 统一集成代码管理器已加载');