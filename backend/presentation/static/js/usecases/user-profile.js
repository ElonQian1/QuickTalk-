/**
 * 用户配置模块
 * 提供用户信息查看、密码修改、通知设置等功能
 */
(function() {
    'use strict';

    // 显示用户信息
    window.showUserInfo = async function() {
        const getUserData = typeof window.getUserData === 'function' ? window.getUserData : () => ({});
        const getAuthToken = typeof window.getAuthToken === 'function' ? window.getAuthToken : () => '';
        const showModal = typeof window.showModal === 'function' ? window.showModal : null;
        const showToast = typeof window.showToast === 'function' ? window.showToast : (msg) => alert(msg);

        if (!showModal) {
            showToast('模态框功能未加载', 'error');
            return;
        }

        const u = getUserData() || {};
        let email = '-';
        
        try {
            const token = getAuthToken();
            // 优先使用后端提供的管理员信息端点，避免依赖可能不存在的 users 表
            let res = await fetch('/api/admin/me', { 
                headers: token ? { 'Authorization': `Bearer ${token}`, 'X-Session-Id': token } : {} 
            });
            
            if (res.status === 404) {
                // 兼容别名
                res = await fetch('/api/auth/me', { 
                    headers: token ? { 'Authorization': `Bearer ${token}`, 'X-Session-Id': token } : {} 
                });
            }
            
            if (res.ok) {
                try {
                    const data = await res.json();
                    if (data && data.success && data.data) {
                        email = data.data.email || '-';
                    }
                } catch (_) { /* 非 JSON 响应，忽略 */ }
            } else if (u.id) {
                // 回退到 users 端点（如存在）
                const res2 = await fetch(`/api/users/${u.id}`, { 
                    headers: token ? { 'Authorization': `Bearer ${token}`, 'X-Session-Id': token } : {} 
                });
                if (res2.ok) {
                    try {
                        const data2 = await res2.json();
                        if (data2 && data2.success && data2.data) {
                            email = data2.data.email || '-';
                        }
                    } catch (_) {}
                }
            }
        } catch (e) { /* 忽略网络错误，使用默认 '-' */ }

        const content = `
            <style>
                /* 专用于模态内的用户信息布局，避免受全局 .user-info 影响 */
                .user-info-modal { display: flex; flex-direction: column; gap: 12px; }
                .user-info-modal .detail-item { margin: 0; }
                .user-info-modal .detail-item label { display: block; color: #6c757d; font-size: 12px; margin-bottom: 4px; }
                .user-info-modal .detail-item .value { display: block; color: #212529; font-size: 14px; word-break: break-all; }
                .user-info-modal .email-actions { display:flex; gap:8px; align-items:center; }
                .user-info-modal input[type="email"] { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #dee2e6; border-radius: 8px; }
                .user-info-modal .btn { padding: 8px 12px; border-radius: 8px; border: none; background: #0d6efd; color: #fff; }
                .user-info-modal .btn.secondary { background: #6c757d; }
            </style>
            <div class="user-info-modal">
                <div class="detail-item">
                    <label>用户名</label>
                    <div class="value">${u.username || '-'}</div>
                </div>
                <div class="detail-item">
                    <label>邮箱</label>
                    <div class="value" id="user-email-value">${email}</div>
                    ${(!email || email === '-') ? `
                    <div class="email-actions">
                        <input type="email" id="email-input" placeholder="填写邮箱用于找回/通知" />
                        <button class="btn" id="save-email-btn">保存</button>
                    </div>
                    ` : ''}
                </div>
                <div class="detail-item">
                    <label>用户ID</label>
                    <div class="value">${u.id || '-'}</div>
                </div>
            </div>
        `;
        showModal('用户信息', content);

        // 如无邮箱，绑定保存事件
        const saveBtn = document.getElementById('save-email-btn');
        if (saveBtn) {
            saveBtn.onclick = async function() {
                const input = document.getElementById('email-input');
                const v = (input?.value || '').trim();
                if (!v) { showToast('请输入邮箱', 'error'); return; }
                if (!v.includes('@')) { showToast('邮箱格式不正确', 'error'); return; }
                
                try {
                    const token = getAuthToken();
                    const res = await fetch('/api/admin/profile', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json', 
                            ...(token ? { 'Authorization': `Bearer ${token}`, 'X-Session-Id': token } : {}) 
                        },
                        body: JSON.stringify({ email: v })
                    });
                    
                    let data = { success: false };
                    try { data = await res.json(); } catch(_) {}
                    
                    if (data.success) {
                        const holder = document.getElementById('user-email-value');
                        if (holder) holder.textContent = v;
                        showToast('邮箱已保存', 'success');
                        // 隐藏输入区
                        if (input && input.parentElement) input.parentElement.style.display = 'none';
                    } else {
                        showToast(data.message || '保存失败', 'error');
                    }
                } catch (e) {
                    console.error('保存邮箱失败:', e);
                    showToast('网络错误，请稍后重试', 'error');
                }
            };
        }
    };

    // 修改密码
    window.changePassword = async function() {
        const getAuthToken = typeof window.getAuthToken === 'function' ? window.getAuthToken : () => '';
        const showToast = typeof window.showToast === 'function' ? window.showToast : (msg) => alert(msg);
        const closeModal = typeof window.closeModal === 'function' ? window.closeModal : () => {};

        // 使用简易模态表单而不是 prompt
        const modalId = 'temp-modal-' + Date.now();
        const html = `
            <div id="${modalId}" class="modal" style="display:flex;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>修改密码</h3>
                        <button class="modal-close" onclick="closeModal('${modalId}')">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label style="display:flex;justify-content:space-between;align-items:center;">
                                当前密码
                                <a href="#" style="font-size:12px;color:#6c757d;"
                                   onclick="(function(el){var i=document.getElementById('cp-old'); if(i){i.type=i.type==='password'?'text':'password'; el.textContent=i.type==='password'?'显示':'隐藏';} return false;})(this)">显示</a>
                            </label>
                            <input type="password" id="cp-old" placeholder="输入当前密码" autocomplete="off">
                        </div>
                        <div class="form-group">
                            <label style="display:flex;justify-content:space-between;align-items:center;">
                                新密码
                                <a href="#" style="font-size:12px;color:#6c757d;"
                                   onclick="(function(el){var i=document.getElementById('cp-new'); if(i){i.type=i.type==='password'?'text':'password'; el.textContent=i.type==='password'?'显示':'隐藏';} return false;})(this)">显示</a>
                            </label>
                            <input type="password" id="cp-new" placeholder="至少6位" autocomplete="new-password">
                        </div>
                        <div class="form-group">
                            <label style="display:flex;justify-content:space-between;align-items:center;">
                                确认新密码
                                <a href="#" style="font-size:12px;color:#6c757d;"
                                   onclick="(function(el){var i=document.getElementById('cp-confirm'); if(i){i.type=i.type==='password'?'text':'password'; el.textContent=i.type==='password'?'显示':'隐藏';} return false;})(this)">显示</a>
                            </label>
                            <input type="password" id="cp-confirm" placeholder="再次输入新密码" autocomplete="new-password">
                        </div>
                        <div class="form-buttons" style="margin-top:12px; display:flex; gap:8px; justify-content:flex-end;">
                            <button onclick="closeModal('${modalId}')">取消</button>
                            <button id="cp-submit" class="btn primary">确定</button>
                        </div>
                    </div>
                </div>
            </div>`;
        
        document.body.insertAdjacentHTML('beforeend', html);
        const overlay = document.getElementById('modal-overlay');
        const modal = document.getElementById(modalId);
        if (overlay && modal) { 
            overlay.style.display = 'flex'; 
            modal.classList.add('show'); 
            document.body.style.overflow = 'hidden'; 
        }

        // 打开弹窗后，强制清空所有密码输入框，并重置为隐藏态
        ['cp-old','cp-new','cp-confirm'].forEach(function(id){
            var el = document.getElementById(id);
            if (el) { el.value = ''; el.type = 'password'; }
        });
        // 聚焦到当前密码输入
        var first = document.getElementById('cp-old');
        if (first) first.focus();

        document.getElementById('cp-submit').onclick = async () => {
            // 旧密码不做 trim，避免历史上密码包含首尾空格导致校验失败
            const oldP = (document.getElementById('cp-old').value || '');
            const np = (document.getElementById('cp-new').value || '').trim();
            const cp = (document.getElementById('cp-confirm').value || '').trim();
            
            if (!oldP || !np || !cp) { showToast('请完整填写', 'error'); return; }
            if (np.length < 6) { showToast('新密码至少6位', 'error'); return; }
            if (np !== cp) { showToast('两次输入的新密码不一致', 'error'); return; }
            
            try {
                const token = getAuthToken();
                // 提前校验会话身份，避免使用了失效或错误账户的 token
                if (token) {
                    try {
                        const who = await fetch('/api/system/whoami', { 
                            headers: { 'Authorization': `Bearer ${token}`, 'X-Session-Id': token } 
                        });
                        if (who.status === 401) {
                            showToast('登录已过期，请重新登录', 'error');
                            closeModal(modalId);
                            ['quicktalk_user','admin_token','qt_admin_user','qt_admin_token'].forEach(k => localStorage.removeItem(k));
                            setTimeout(() => { window.location.href = '/mobile/login'; }, 600);
                            return;
                        }
                    } catch (_) { /* 网络问题时继续尝试 */ }
                }
                
                let res = await fetch('/api/admin/change-password', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json', 
                        ...(token ? { 'Authorization': `Bearer ${token}`, 'X-Session-Id': token } : {}) 
                    },
                    body: JSON.stringify({ old_password: oldP, new_password: np })
                });
                
                // 如果接口不存在，尝试备用路径
                if (res.status === 404) {
                    res = await fetch('/api/auth/change-password', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json', 
                            ...(token ? { 'Authorization': `Bearer ${token}`, 'X-Session-Id': token } : {}) 
                        },
                        body: JSON.stringify({ old_password: oldP, new_password: np })
                    });
                }
                
                let data = { success: false };
                try { data = await res.json(); } catch (_) { /* 可能为空响应，保持默认 */ }
                
                if (data.success) {
                    showToast('密码已更新，请重新登录', 'success');
                    closeModal(modalId);
                    // 清理本地登录态并跳转登录
                    localStorage.removeItem('quicktalk_user');
                    localStorage.removeItem('qt_admin_user');
                    localStorage.removeItem('admin_token');
                    setTimeout(() => { window.location.href = '/mobile/login'; }, 800);
                } else {
                    const msg = data.message || data.error || (res.ok ? '修改失败' : `修改失败 (${res.status})`);
                    showToast(msg, 'error');
                }
            } catch (e) {
                console.error('修改密码失败:', e);
                showToast('网络错误，请稍后重试', 'error');
            }
        };
    };

    // 消息通知设置
    window.notificationSettings = function() {
        const showToast = typeof window.showToast === 'function' ? window.showToast : (msg) => alert(msg);
        
        console.log('消息通知设置');
        const enabled = confirm('是否启用消息通知？\n\n• 新消息提醒\n• 系统通知\n• 邮件通知');
        
        if (enabled) {
            showToast('消息通知已启用', 'success');
        } else {
            showToast('消息通知已关闭', 'info');
        }
        
        // 这里可以保存通知设置到localStorage或API
        localStorage.setItem('notification_enabled', enabled);
    };

    // 系统设置
    window.systemSettings = function() {
        console.log('系统设置');
        const settings = [
            '• 当前版本: QuickTalk v1.0.0',
            '• 服务器状态: 运行中',
            '• 数据库: SQLite',
            '• 架构: 纯Rust + WebSocket',
            '• 端口: 3030'
        ];
        alert('系统信息:\n\n' + settings.join('\n'));
    };

    // 关于应用
    window.aboutApp = function() {
        console.log('关于应用');
        const aboutInfo = [
            'QuickTalk 专业客服系统 v1.0.0',
            '',
            '• 纯Rust后端架构',
            '• 实时WebSocket通信',
            '• 移动端优先设计',
            '• 多店铺管理支持',
            '• 完整的权限控制',
            '',
            '© 2025 QuickTalk Team'
        ];
        alert(aboutInfo.join('\n'));
    };

    console.log('✅ 用户配置模块已加载 (user-profile.js)');
})();
