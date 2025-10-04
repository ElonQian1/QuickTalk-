"use strict";

/**
 * 用户档案管理模块
 * 负责用户信息显示、编辑、密码修改、通知设置等功能
 */

class UserProfileManager {
    constructor() {
        this.currentUser = null;
        this.notifications = {
            newMessage: true,
            employeeJoined: true,
            shopUpdated: false,
            systemNotice: true
        };
    }

    /**
     * 初始化用户档案管理
     */
    async init() {
        console.log('初始化用户档案管理');
        await this.loadUserInfo();
        this.setupEventListeners();
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 监听页面切换事件
        document.addEventListener('pageChanged', (event) => {
            if (event.detail === 'profile') {
                this.refreshUserInfo();
            }
        });
    }

    /**
     * 加载用户信息
     */
    async loadUserInfo() {
        try {
            const response = await fetch('/api/user/profile', {
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.user || data;
            } else {
                // 使用模拟数据
                this.currentUser = this.getMockUserData();
            }
        } catch (error) {
            console.warn('加载用户信息失败，使用模拟数据:', error);
            this.currentUser = this.getMockUserData();
        }

        this.updateUserInfoDisplay();
        this.updateAdminSectionVisibility();
    }

    /**
     * 获取模拟用户数据
     */
    getMockUserData() {
        return {
            id: 'user123',
            name: '演示用户',
            email: 'demo@example.com',
            role: 'shop_owner',
            avatar: null,
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString()
        };
    }

    /**
     * 更新用户信息显示
     */
    updateUserInfoDisplay() {
        if (!this.currentUser) return;

        // 更新头像
        const userAvatar = document.getElementById('userAvatar');
        const avatarText = document.getElementById('userAvatarText');
        if (avatarText) {
            avatarText.textContent = this.getUserInitials(this.currentUser.name);
        }

        // 更新用户名
        const userName = document.getElementById('userName');
        if (userName) {
            userName.textContent = this.currentUser.name || '未设置姓名';
        }

        // 更新邮箱
        const userEmail = document.getElementById('userEmail');
        if (userEmail) {
            userEmail.textContent = this.currentUser.email || '未设置邮箱';
        }

        // 更新角色
        const userRole = document.getElementById('userRole');
        if (userRole) {
            userRole.textContent = this.getRoleName(this.currentUser.role);
        }
    }

    /**
     * 更新管理员专属区域显示
     */
    updateAdminSectionVisibility() {
        const adminSection = document.getElementById('adminOnlySettings');
        const isAdmin = this.isAdmin();
        
        if (adminSection) {
            adminSection.style.display = isAdmin ? 'block' : 'none';
        }
    }

    /**
     * 获取用户姓名首字母
     */
    getUserInitials(name) {
        if (!name) return 'U';
        
        const parts = name.split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        } else if (parts.length === 1 && parts[0].length >= 2) {
            return parts[0].substring(0, 2).toUpperCase();
        } else {
            return parts[0][0].toUpperCase();
        }
    }

    /**
     * 获取角色名称
     */
    getRoleName(role) {
        const roleNames = {
            'super_admin': '超级管理员',
            'admin': '管理员',
            'shop_owner': '店主',
            'manager': '经理',
            'agent': '客服专员',
            'viewer': '观察员'
        };
        return roleNames[role] || role;
    }

    /**
     * 检查是否为管理员
     */
    isAdmin() {
        return this.currentUser?.role === 'super_admin' || this.currentUser?.role === 'admin';
    }

    /**
     * 刷新用户信息
     */
    async refreshUserInfo() {
        await this.loadUserInfo();
    }

    /**
     * 获取认证token
     */
    getAuthToken() {
        return localStorage.getItem('authToken') || '';
    }
}

// 用户档案操作函数

/**
 * 编辑用户档案
 */
function editUserProfile() {
    console.log('编辑用户档案');
    
    const user = window.userProfileManager?.currentUser;
    if (!user) {
        showToast('用户信息加载失败', 'error');
        return;
    }

    showEditProfileModal(user);
}

/**
 * 显示编辑档案模态框
 */
function showEditProfileModal(user) {
    const modalOverlay = document.getElementById('modal-overlay');
    if (!modalOverlay) return;

    modalOverlay.innerHTML = `
        <div class="modal show profile-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>✏️ 编辑个人资料</h3>
                    <button class="modal-close" onclick="closeProfileModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="profile-form">
                        <div class="form-avatar-section">
                            <div class="form-avatar">
                                ${window.userProfileManager.getUserInitials(user.name)}
                            </div>
                            <div>
                                <button class="avatar-upload-btn" onclick="uploadAvatar()">
                                    📷 更换头像
                                </button>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="edit-user-name">姓名</label>
                            <input type="text" id="edit-user-name" value="${user.name || ''}" placeholder="请输入姓名">
                        </div>
                        
                        <div class="form-group">
                            <label for="edit-user-email">邮箱</label>
                            <input type="email" id="edit-user-email" value="${user.email || ''}" placeholder="请输入邮箱">
                        </div>
                        
                        <div class="form-group">
                            <label>当前角色</label>
                            <div class="role-display">${window.userProfileManager.getRoleName(user.role)}</div>
                        </div>
                        
                        <div class="form-buttons">
                            <button class="btn btn-secondary" onclick="closeProfileModal()">取消</button>
                            <button class="btn btn-primary" onclick="saveUserProfile()">保存</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    modalOverlay.style.display = 'block';
}

/**
 * 保存用户档案
 */
async function saveUserProfile() {
    const name = document.getElementById('edit-user-name').value.trim();
    const email = document.getElementById('edit-user-email').value.trim();

    if (!name) {
        showToast('请输入姓名', 'error');
        return;
    }

    if (!email || !isValidEmail(email)) {
        showToast('请输入有效的邮箱地址', 'error');
        return;
    }

    try {
        showLoading('正在保存个人资料...');
        
        const response = await fetch('/api/user/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.userProfileManager.getAuthToken()}`
            },
            body: JSON.stringify({ name, email })
        });

        if (response.ok) {
            showToast('个人资料已更新', 'success');
            closeProfileModal();
            await window.userProfileManager.refreshUserInfo();
        } else {
            const error = await response.json();
            showToast(error.message || '保存失败', 'error');
        }
    } catch (error) {
        console.error('保存个人资料失败:', error);
        showToast('网络错误，请重试', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * 关闭档案编辑模态框
 */
function closeProfileModal() {
    const modalOverlay = document.getElementById('modal-overlay');
    if (modalOverlay) {
        modalOverlay.style.display = 'none';
        modalOverlay.innerHTML = '';
    }
}

/**
 * 上传头像
 */
function uploadAvatar() {
    showToast('头像上传功能开发中...', 'info');
}

/**
 * 修改密码
 */
function changePassword() {
    console.log('修改密码');
    showChangePasswordModal();
}

/**
 * 显示修改密码模态框
 */
function showChangePasswordModal() {
    const modalOverlay = document.getElementById('modal-overlay');
    if (!modalOverlay) return;

    modalOverlay.innerHTML = `
        <div class="modal show">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🔐 修改密码</h3>
                    <button class="modal-close" onclick="closePasswordModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="modal-form">
                        <div class="form-group">
                            <label for="current-password">当前密码</label>
                            <input type="password" id="current-password" placeholder="请输入当前密码">
                        </div>
                        
                        <div class="form-group">
                            <label for="new-password">新密码</label>
                            <input type="password" id="new-password" placeholder="请输入新密码">
                        </div>
                        
                        <div class="form-group">
                            <label for="confirm-password">确认新密码</label>
                            <input type="password" id="confirm-password" placeholder="请再次输入新密码">
                        </div>
                        
                        <div class="form-buttons">
                            <button class="btn btn-secondary" onclick="closePasswordModal()">取消</button>
                            <button class="btn btn-primary" onclick="saveNewPassword()">保存</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    modalOverlay.style.display = 'block';
}

/**
 * 保存新密码
 */
async function saveNewPassword() {
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (!currentPassword || !newPassword || !confirmPassword) {
        showToast('请填写所有密码字段', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showToast('新密码两次输入不一致', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showToast('新密码至少6位', 'error');
        return;
    }

    try {
        showLoading('正在修改密码...');
        
        const response = await fetch('/api/user/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.userProfileManager.getAuthToken()}`
            },
            body: JSON.stringify({
                currentPassword,
                newPassword
            })
        });

        if (response.ok) {
            showToast('密码修改成功', 'success');
            closePasswordModal();
        } else {
            const error = await response.json();
            showToast(error.message || '密码修改失败', 'error');
        }
    } catch (error) {
        console.error('修改密码失败:', error);
        showToast('网络错误，请重试', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * 关闭密码修改模态框
 */
function closePasswordModal() {
    const modalOverlay = document.getElementById('modal-overlay');
    if (modalOverlay) {
        modalOverlay.style.display = 'none';
        modalOverlay.innerHTML = '';
    }
}

/**
 * 通知设置
 */
function notificationSettings() {
    console.log('通知设置');
    showNotificationSettingsModal();
}

/**
 * 显示通知设置模态框
 */
function showNotificationSettingsModal() {
    const notifications = window.userProfileManager?.notifications || {};
    
    const modalOverlay = document.getElementById('modal-overlay');
    if (!modalOverlay) return;

    modalOverlay.innerHTML = `
        <div class="modal show">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🔔 消息通知</h3>
                    <button class="modal-close" onclick="closeNotificationModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="notification-settings">
                        <div class="notification-item">
                            <div>
                                <div class="notification-label">新消息通知</div>
                                <div class="notification-description">收到新客服消息时通知</div>
                            </div>
                            <div class="toggle-switch ${notifications.newMessage ? 'active' : ''}" onclick="toggleNotification('newMessage')"></div>
                        </div>
                        
                        <div class="notification-item">
                            <div>
                                <div class="notification-label">员工加入通知</div>
                                <div class="notification-description">新员工加入团队时通知</div>
                            </div>
                            <div class="toggle-switch ${notifications.employeeJoined ? 'active' : ''}" onclick="toggleNotification('employeeJoined')"></div>
                        </div>
                        
                        <div class="notification-item">
                            <div>
                                <div class="notification-label">店铺更新通知</div>
                                <div class="notification-description">店铺状态变化时通知</div>
                            </div>
                            <div class="toggle-switch ${notifications.shopUpdated ? 'active' : ''}" onclick="toggleNotification('shopUpdated')"></div>
                        </div>
                        
                        <div class="notification-item">
                            <div>
                                <div class="notification-label">系统通知</div>
                                <div class="notification-description">系统维护和更新通知</div>
                            </div>
                            <div class="toggle-switch ${notifications.systemNotice ? 'active' : ''}" onclick="toggleNotification('systemNotice')"></div>
                        </div>
                    </div>
                    
                    <div class="form-buttons" style="margin-top: 20px;">
                        <button class="btn btn-secondary" onclick="closeNotificationModal()">取消</button>
                        <button class="btn btn-primary" onclick="saveNotificationSettings()">保存</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    modalOverlay.style.display = 'block';
}

/**
 * 切换通知开关
 */
function toggleNotification(type) {
    const toggle = event.target;
    if (toggle.classList.contains('active')) {
        toggle.classList.remove('active');
        window.userProfileManager.notifications[type] = false;
    } else {
        toggle.classList.add('active');
        window.userProfileManager.notifications[type] = true;
    }
}

/**
 * 保存通知设置
 */
async function saveNotificationSettings() {
    try {
        showLoading('正在保存通知设置...');
        
        const response = await fetch('/api/user/notification-settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.userProfileManager.getAuthToken()}`
            },
            body: JSON.stringify(window.userProfileManager.notifications)
        });

        if (response.ok) {
            showToast('通知设置已保存', 'success');
            closeNotificationModal();
        } else {
            showToast('保存失败', 'error');
        }
    } catch (error) {
        console.error('保存通知设置失败:', error);
        showToast('网络错误，请重试', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * 关闭通知设置模态框
 */
function closeNotificationModal() {
    const modalOverlay = document.getElementById('modal-overlay');
    if (modalOverlay) {
        modalOverlay.style.display = 'none';
        modalOverlay.innerHTML = '';
    }
}

/**
 * 关于应用
 */
function aboutApp() {
    console.log('关于应用');
    showAboutModal();
}

/**
 * 显示关于应用模态框
 */
function showAboutModal() {
    const modalOverlay = document.getElementById('modal-overlay');
    if (!modalOverlay) return;

    modalOverlay.innerHTML = `
        <div class="modal show">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>ℹ️ 关于应用</h3>
                    <button class="modal-close" onclick="closeAboutModal()">×</button>
                </div>
                <div class="modal-body">
                    <div style="text-align: center; padding: 20px;">
                        <div style="font-size: 48px; margin-bottom: 16px;">💬</div>
                        <h3>QuickTalk 客服系统</h3>
                        <p style="color: #6c757d; margin: 16px 0;">版本 1.0.0</p>
                        <p style="color: #6c757d; margin: 16px 0;">一个现代化的客服管理平台</p>
                        
                        <div style="margin: 24px 0; padding: 16px; background: #f8f9fa; border-radius: 8px; text-align: left;">
                            <h4 style="margin: 0 0 8px 0;">功能特性</h4>
                            <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #6c757d;">
                                <li>实时消息处理</li>
                                <li>多店铺管理</li>
                                <li>员工权限控制</li>
                                <li>统计数据分析</li>
                                <li>移动端适配</li>
                            </ul>
                        </div>
                        
                        <p style="font-size: 12px; color: #adb5bd; margin-top: 24px;">
                            © 2024 QuickTalk. All rights reserved.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;
    modalOverlay.style.display = 'block';
}

/**
 * 关闭关于应用模态框
 */
function closeAboutModal() {
    const modalOverlay = document.getElementById('modal-overlay');
    if (modalOverlay) {
        modalOverlay.style.display = 'none';
        modalOverlay.innerHTML = '';
    }
}

/**
 * 验证邮箱格式
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// 创建全局用户档案管理器实例
window.userProfileManager = new UserProfileManager();

// 当DOM加载完成时初始化用户档案管理
document.addEventListener('DOMContentLoaded', () => {
    // 延迟初始化，确保其他模块已加载
    setTimeout(() => {
        if (window.userProfileManager) {
            window.userProfileManager.init();
        }
    }, 1000);
});