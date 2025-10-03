/**
 * 认证与会话模块
 * 负责登出、会话管理等认证相关功能
 */
(function() {
    'use strict';

    // 登出函数
    window.logout = async function() {
        const getAuthToken = typeof window.getAuthToken === 'function' ? window.getAuthToken : () => '';
        const showToast = typeof window.showToast === 'function' ? window.showToast : (msg) => alert(msg);

        console.log('🚪 退出登录功能被调用');
        const currentUser = localStorage.getItem('quicktalk_user');
        console.log('当前存储的用户信息:', currentUser);
        
        if (!confirm('确定要退出登录吗？')) return;

        const token = getAuthToken();
        if (token) {
            try {
                const res = await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) {
                    console.log('🗑️ 服务器会话已删除');
                } else {
                    console.warn('⚠️ 服务器会话删除失败(可能已失效)');
                }
            } catch (e) {
                console.warn('⚠️ 调用后端注销失败(忽略继续本地清理):', e);
            }
        }

        // 本地清理
        ['quicktalk_user','admin_token','user_data','qt_admin_token','qt_admin_user','qt_admin_last_user'].forEach(k => localStorage.removeItem(k));
        console.log('✅ 本地存储已清理');
        showToast('已退出登录，即将跳转...', 'success');
        setTimeout(() => { window.location.href = '/mobile/login'; }, 800);
    };

    // 消息页面相关全局函数
    window.goBackInMessages = function() {
        if (typeof window.messageModule !== 'undefined' && window.messageModule) {
            window.messageModule.goBack();
        }
    };

    window.sendMessage = function() {
        if (typeof window.messageModule !== 'undefined' && window.messageModule) {
            window.messageModule.sendMessage();
        }
    };

    // 添加键盘事件监听（仅在 DOM 加载后执行）
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMessageInputHandlers);
    } else {
        initMessageInputHandlers();
    }

    function initMessageInputHandlers() {
        const chatInput = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendBtn');
        
        if (chatInput) {
            chatInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    window.sendMessage();
                }
            });
        }
        
        if (sendBtn) {
            sendBtn.addEventListener('click', window.sendMessage);
        }
    }

    console.log('✅ 认证与会话模块已加载 (auth-session.js)');
})();
