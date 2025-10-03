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

    // 检查登录状态（从 HTML 抽取并增强健壮性）
    window.checkLoginStatus = async function() {
        try {
            let savedUser = localStorage.getItem('quicktalk_user');

            if (!savedUser) {
                // 兼容旧键：若仅存在 qt_admin_user，则复用并回填
                const legacyUser = localStorage.getItem('qt_admin_user');
                if (legacyUser) {
                    try {
                        localStorage.setItem('quicktalk_user', legacyUser);
                        savedUser = legacyUser;
                    } catch (error) {
                        console.warn('无法回填 legacy 用户信息:', error);
                    }
                }
            }

            if (savedUser) {
                try {
                    window.userData = JSON.parse(savedUser);
                    if (typeof window.updateUserInfo === 'function') {
                        window.updateUserInfo();
                    }
                    return true;
                } catch (error) {
                    console.error('解析保存的用户信息失败:', error);
                    localStorage.removeItem('quicktalk_user');
                    localStorage.removeItem('qt_admin_user');
                }
            }
            
            // 如果没有登录信息，跳转到登录页面（同时清理所有凭证，避免重定向循环）
            console.log('未找到登录信息，跳转到登录页面');
            localStorage.removeItem('qt_admin_token');
            localStorage.removeItem('admin_token');
            localStorage.removeItem('qt_admin_user');
            window.location.href = '/mobile/login';
            return false;
        } catch (e) {
            console.warn('checkLoginStatus 出错，回退到登录页:', e);
            try {
                window.location.href = '/mobile/login';
            } catch(_) {}
            return false;
        }
    };

    // 更新用户信息显示（从 HTML 抽取）
    window.updateUserInfo = function() {
        try {
            const u = typeof window.userData !== 'undefined' ? window.userData : null;
            if (!u) return;
            const avatar = document.getElementById('userAvatar');
            const name = document.getElementById('userName');
            if (avatar) avatar.textContent = u.avatar || (u.username ? u.username.charAt(0).toUpperCase() : 'U');
            if (name) name.textContent = u.username || 'User';
            
            // 根据用户角色显示/隐藏超级管理员功能
            const adminOnlySettings = document.getElementById('adminOnlySettings');
            if (adminOnlySettings) {
                if (u.role === 'super_admin' || u.role === 'administrator') {
                    adminOnlySettings.style.display = 'block';
                    console.log('👨‍💼 显示超级管理员功能');
                } else {
                    adminOnlySettings.style.display = 'none';
                    console.log('🔒 隐藏超级管理员功能');
                }
            }
        } catch (e) {
            console.warn('updateUserInfo 出错:', e);
        }
    };
})();
