/**
 * Ruilong版本 - 移动端店铺功能模块
 * 包含移动端特有的店铺操作功能
 */

class RuilongMobile {
    
    /**
     * 查看移动端店铺消息详情（ruilong原版功能）
     * @param {string} shopId - 店铺ID
     */
    static async viewShopMessages(shopId) {
        try {
            console.log('📱 [Ruilong] 查看店铺消息详情:', shopId);
            
            // 显示加载状态
            this.showLoadingModal('正在加载消息详情...');
            
            // 获取店铺消息数据 - 使用ruilong原版API
            const sessionId = localStorage.getItem('sessionId') || localStorage.getItem('token');
            const response = await fetch(`/api/shops/${shopId}/messages`, {
                method: 'GET',
                headers: {
                    'X-Session-Id': sessionId,
                    'Authorization': `Bearer ${sessionId}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const messages = await response.json();
            this.showMobileShopMessagesModal(messages, shopId);
            
        } catch (error) {
            console.error('移动端消息查看失败:', error);
            this.showErrorModal('消息加载失败，请稍后重试');
        }
    }
    
    /**
     * 显示店铺消息模态框（ruilong原版功能）
     * @param {Array} messages - 消息列表
     * @param {string} shopId - 店铺ID
     */
    static showMobileShopMessagesModal(messages, shopId) {
        this.hideLoadingModal();
        
        const modal = document.createElement('div');
        modal.className = 'mobile-messages-modal';
        modal.innerHTML = `
            <div class="mobile-messages-content">
                <div class="mobile-messages-header">
                    <h3>💬 店铺消息</h3>
                    <button class="close-btn" onclick="this.closest('.mobile-messages-modal').remove()">✕</button>
                </div>
                <div class="mobile-messages-body">
                    <div class="messages-list">
                        ${messages.length === 0 ? 
                            '<div class="empty-state">暂无消息</div>' :
                            messages.map(msg => `
                                <div class="message-item">
                                    <div class="message-header">
                                        <span class="customer-name">${msg.customer_name || '匿名用户'}</span>
                                        <span class="message-time">${new Date(msg.created_at || msg.createdAt).toLocaleString()}</span>
                                    </div>
                                    <div class="message-content">${msg.content || msg.message}</div>
                                    <div class="message-actions">
                                        <button class="btn-reply" onclick="RuilongMobile.replyToMessage('${msg.id}', '${shopId}')">回复</button>
                                    </div>
                                </div>
                            `).join('')
                        }
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    /**
     * 编辑店铺信息（移动端优化）
     * @param {string} shopId - 店铺ID
     */
    static async editShopInfo(shopId) {
        try {
            console.log('📱 [Ruilong] 编辑店铺信息:', shopId);
            
            // 获取当前店铺信息
            let shop = null;
            if (window.currentShops && window.currentShops.length > 0) {
                shop = window.currentShops.find(s => s.id === shopId);
            }
            
            if (!shop) {
                // 尝试从API获取
                const sessionId = localStorage.getItem('sessionId') || localStorage.getItem('token');
                const response = await fetch(`/api/shops/${shopId}`, {
                    headers: {
                        'X-Session-Id': sessionId,
                        'Authorization': `Bearer ${sessionId}`
                    }
                });
                
                if (!response.ok) {
                    throw new Error('获取店铺信息失败');
                }
                
                shop = await response.json();
            }
            
            this.showMobileEditForm(shop);
            
        } catch (error) {
            console.error('编辑店铺失败:', error);
            this.showErrorModal('获取店铺信息失败');
        }
    }
    
    /**
     * 重新提交店铺审核
     * @param {string} shopId - 店铺ID
     */
    static async resubmitShop(shopId) {
        try {
            console.log('📱 [Ruilong] 重新提交店铺:', shopId);
            
            const confirmed = await this.showConfirmModal(
                '确认重新提交',
                '确定要重新提交此店铺进行审核吗？'
            );
            
            if (!confirmed) return;
            
            const sessionId = localStorage.getItem('sessionId') || localStorage.getItem('token');
            const response = await fetch(`/api/shops/${shopId}/resubmit`, {
                method: 'POST',
                headers: {
                    'X-Session-Id': sessionId,
                    'Authorization': `Bearer ${sessionId}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('重新提交失败');
            }
            
            this.showSuccessModal('店铺已重新提交审核');
            this.refreshShopList();
            
        } catch (error) {
            console.error('重新提交失败:', error);
            this.showErrorModal('重新提交失败，请稍后重试');
        }
    }
    
    /**
     * 提交编辑表单（ruilong原版功能）
     * @param {Event} event - 表单事件
     * @param {string} shopId - 店铺ID
     */
    static async submitEditForm(event, shopId) {
        event.preventDefault();
        
        try {
            const formData = new FormData(event.target);
            const updateData = {
                name: formData.get('name'),
                description: formData.get('description'),
                website: formData.get('website') || formData.get('contact'),
                domain: formData.get('domain')
            };
            
            const sessionId = localStorage.getItem('sessionId') || localStorage.getItem('token');
            const response = await fetch(`/api/shops/${shopId}`, {
                method: 'PUT',
                headers: {
                    'X-Session-Id': sessionId,
                    'Authorization': `Bearer ${sessionId}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });
            
            if (!response.ok) {
                throw new Error('更新失败');
            }
            
            this.showSuccessModal('店铺信息已更新');
            event.target.closest('.mobile-edit-modal').remove();
            this.refreshShopList();
            
        } catch (error) {
            console.error('更新店铺失败:', error);
            this.showErrorModal('更新失败，请稍后重试');
        }
    }
    
    /**
     * 回复消息（ruilong原版功能）
     * @param {string} messageId - 消息ID
     * @param {string} shopId - 店铺ID
     */
    static async replyToMessage(messageId, shopId) {
        const reply = prompt('请输入回复内容:');
        if (!reply || !reply.trim()) return;
        
        try {
            const sessionId = localStorage.getItem('sessionId') || localStorage.getItem('token');
            const response = await fetch(`/api/messages/${messageId}/reply`, {
                method: 'POST',
                headers: {
                    'X-Session-Id': sessionId,
                    'Authorization': `Bearer ${sessionId}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content: reply.trim() })
            });
            
            if (response.ok) {
                this.showSuccessModal('回复发送成功');
                // 重新加载消息
                this.viewShopMessages(shopId);
            } else {
                throw new Error('回复发送失败');
            }
            
        } catch (error) {
            console.error('回复消息失败:', error);
            this.showErrorModal('回复发送失败，请稍后重试');
        }
    }
    
    /**
     * 显示移动端消息详情界面
     * @param {Object} data - 消息数据
     */
    static displayMobileMessages(data) {
        const modal = document.createElement('div');
        modal.className = 'mobile-messages-modal';
        modal.innerHTML = `
            <div class="mobile-messages-content">
                <div class="mobile-messages-header">
                    <h3>📄 店铺消息详情</h3>
                    <button class="close-btn" onclick="this.closest('.mobile-messages-modal').remove()">✕</button>
                </div>
                <div class="mobile-messages-body">
                    <div class="messages-stats">
                        <div class="stat-item">
                            <span class="stat-label">总消息数</span>
                            <span class="stat-value">${data.totalMessages || 0}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">待回复</span>
                            <span class="stat-value">${data.pendingMessages || 0}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">今日消息</span>
                            <span class="stat-value">${data.todayMessages || 0}</span>
                        </div>
                    </div>
                    <div class="recent-conversations">
                        <h4>最近对话</h4>
                        <div class="conversations-list">
                            ${this.renderRecentConversations(data.conversations || [])}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.hideLoadingModal();
    }
    
    /**
     * 显示移动端编辑表单
     * @param {Object} shop - 店铺数据
     */
    static showMobileEditForm(shop) {
        const modal = document.createElement('div');
        modal.className = 'mobile-edit-modal';
        modal.innerHTML = `
            <div class="mobile-edit-content">
                <div class="mobile-edit-header">
                    <h3>✏️ 编辑店铺信息</h3>
                    <button class="close-btn" onclick="this.closest('.mobile-edit-modal').remove()">✕</button>
                </div>
                <div class="mobile-edit-body">
                    <form class="mobile-edit-form" onsubmit="RuilongMobile.submitEditForm(event, '${shop.id}')">
                        <div class="form-group">
                            <label>店铺名称</label>
                            <input type="text" name="name" value="${shop.name || ''}" required>
                        </div>
                        <div class="form-group">
                            <label>店铺描述</label>
                            <textarea name="description" rows="3">${shop.description || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label>联系方式</label>
                            <input type="text" name="contact" value="${shop.contact || ''}">
                        </div>
                        <div class="form-group">
                            <label>店铺域名</label>
                            <input type="text" name="domain" value="${shop.domain || ''}" placeholder="example.com">
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn-cancel" onclick="this.closest('.mobile-edit-modal').remove()">取消</button>
                            <button type="submit" class="btn-save">保存</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    /**
     * 提交编辑表单
     * @param {Event} event - 表单事件
     * @param {string} shopId - 店铺ID
     */
    static async submitEditForm(event, shopId) {
        event.preventDefault();
        
        try {
            const formData = new FormData(event.target);
            const updateData = Object.fromEntries(formData);
            
            const response = await fetch(`/api/shops/${shopId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });
            
            if (!response.ok) {
                throw new Error('更新失败');
            }
            
            this.showSuccessModal('店铺信息已更新');
            event.target.closest('.mobile-edit-modal').remove();
            this.refreshShopList();
            
        } catch (error) {
            console.error('更新店铺失败:', error);
            this.showErrorModal('更新失败，请稍后重试');
        }
    }
    
    /**
     * 渲染最近对话列表
     * @param {Array} conversations - 对话列表
     */
    static renderRecentConversations(conversations) {
        if (!conversations.length) {
            return '<div class="no-conversations">暂无对话记录</div>';
        }
        
        return conversations.map(conv => `
            <div class="conversation-item" onclick="MessageManager.viewShopConversations('${conv.shopId}', '${conv.id}')">
                <div class="conversation-info">
                    <span class="conversation-user">${conv.customerName || '匿名用户'}</span>
                    <span class="conversation-time">${Utils.formatTime(conv.lastMessage?.createdAt, 'MM-DD HH:mm')}</span>
                </div>
                <div class="conversation-preview">${conv.lastMessage?.content || '无消息内容'}</div>
            </div>
        `).join('');
    }
    
    /**
     * 刷新店铺列表
     */
    static refreshShopList() {
        if (typeof window.loadUserShops === 'function') {
            window.loadUserShops();
        }
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
    
    /**
     * 显示移动端编辑表单（ruilong原版UI）
     * @param {Object} shop - 店铺信息
     */
    static showMobileEditForm(shop) {
        const modal = document.createElement('div');
        modal.className = 'mobile-edit-modal';
        modal.innerHTML = `
            <div class="mobile-edit-backdrop" onclick="this.parentElement.remove()"></div>
            <div class="mobile-edit-container">
                <div class="mobile-edit-header">
                    <h3>编辑店铺信息</h3>
                    <button class="mobile-close-btn" onclick="this.closest('.mobile-edit-modal').remove()">&times;</button>
                </div>
                <form class="mobile-edit-form" onsubmit="window.RuilongMobile.submitEditForm(event, '${shop.id}')">
                    <div class="mobile-form-group">
                        <label for="edit-name">店铺名称</label>
                        <input type="text" id="edit-name" name="name" value="${shop.name || ''}" required>
                    </div>
                    <div class="mobile-form-group">
                        <label for="edit-description">店铺描述</label>
                        <textarea id="edit-description" name="description" rows="3">${shop.description || ''}</textarea>
                    </div>
                    <div class="mobile-form-group">
                        <label for="edit-website">网站地址</label>
                        <input type="url" id="edit-website" name="website" value="${shop.website || shop.contact || ''}" placeholder="https://example.com">
                    </div>
                    <div class="mobile-form-group">
                        <label for="edit-domain">客服域名</label>
                        <input type="text" id="edit-domain" name="domain" value="${shop.domain || ''}" placeholder="example.com">
                    </div>
                    <div class="mobile-form-actions">
                        <button type="button" class="mobile-cancel-btn" onclick="this.closest('.mobile-edit-modal').remove()">取消</button>
                        <button type="submit" class="mobile-submit-btn">保存</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 聚焦到第一个输入框
        setTimeout(() => {
            const firstInput = modal.querySelector('input[type="text"]');
            if (firstInput) firstInput.focus();
        }, 100);
    }
    
    /**
     * 显示消息列表（ruilong原版功能）
     * @param {Array} messages - 消息列表
     * @param {string} shopId - 店铺ID
     */
    static showMessageList(messages, shopId) {
        const messageContainer = document.createElement('div');
        messageContainer.className = 'mobile-message-container';
        
        if (!messages || messages.length === 0) {
            messageContainer.innerHTML = '<div class="mobile-no-messages">暂无消息</div>';
        } else {
            messageContainer.innerHTML = messages.map(message => `
                <div class="mobile-message-item ${message.isAdmin ? 'admin-message' : 'user-message'}">
                    <div class="message-header">
                        <span class="message-sender">${message.isAdmin ? '管理员' : '用户'}</span>
                        <span class="message-time">${new Date(message.timestamp).toLocaleString()}</span>
                    </div>
                    <div class="message-content">${message.content}</div>
                    ${!message.isAdmin ? `
                        <div class="message-actions">
                            <button onclick="window.RuilongMobile.replyToMessage('${message.id}', '${shopId}')" class="reply-btn">回复</button>
                        </div>
                    ` : ''}
                </div>
            `).join('');
        }
        
        return messageContainer;
    }
    
    /**
     * 显示错误模态框
     */
    static showErrorModal(message) {
        this.hideLoadingModal();
        this.showToast(message, 'error');
    }
    
    /**
     * 显示成功模态框
     */
    static showSuccessModal(message) {
        this.showToast(message, 'success');
    }
    
    /**
     * 显示确认模态框
     */
    static async showConfirmModal(title, message) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'mobile-confirm-modal';
            modal.innerHTML = `
                <div class="mobile-confirm-backdrop"></div>
                <div class="mobile-confirm-container">
                    <div class="mobile-confirm-header">
                        <h3>${title}</h3>
                    </div>
                    <div class="mobile-confirm-content">
                        <p>${message}</p>
                    </div>
                    <div class="mobile-confirm-actions">
                        <button class="mobile-cancel-btn" onclick="this.resolve(false)">取消</button>
                        <button class="mobile-confirm-btn" onclick="this.resolve(true)">确认</button>
                    </div>
                </div>
            `;
            
            // 添加事件处理
            modal.querySelectorAll('button').forEach(btn => {
                btn.onclick = () => {
                    const result = btn.textContent.includes('确认');
                    modal.remove();
                    resolve(result);
                };
            });
            
            document.body.appendChild(modal);
        });
    }
    
    /**
     * 显示Toast提示（ruilong风格）
     * @param {string} message - 提示消息
     * @param {string} type - 提示类型 success/error/info
     */
    static showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `mobile-toast mobile-toast-${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // 显示动画
        setTimeout(() => toast.classList.add('show'), 100);
        
        // 自动移除
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    /**
     * 刷新店铺列表
     */
    static refreshShopList() {
        if (typeof window.renderShops === 'function') {
            window.renderShops();
        } else if (typeof loadShops === 'function') {
            loadShops();
        } else {
            // 重新加载页面作为最后的手段
            window.location.reload();
        }
    }
    
    /**
     * 格式化时间
     */
    // 改为使用统一的 Utils.formatTime 方法
}

// 全局注册模块
window.RuilongMobile = RuilongMobile;

console.log('📱 [Ruilong] 移动端功能模块已加载');