// user-utils.js — 用户信息与权限工具（从 mobile-dashboard.html 拆分）
// 依赖：userData

// 用户与权限相关工具函数

window.updateUserInfo = function updateUserInfo() {
    if (window.userData) {
        document.getElementById('userAvatar').textContent = window.userData.avatar || window.userData.username.charAt(0).toUpperCase();
        document.getElementById('userName').textContent = window.userData.username;
        const adminOnlySettings = document.getElementById('adminOnlySettings');
        if (window.userData.role === 'super_admin' || window.userData.role === 'administrator') {
            adminOnlySettings.style.display = 'block';
            console.log('👨‍💼 显示超级管理员功能');
        } else {
            adminOnlySettings.style.display = 'none';
            console.log('🔒 隐藏超级管理员功能');
        }
    }
};

window.getRoleDisplayName = function getRoleDisplayName(role) {
    const roleMap = {
        'super_admin': '超级管理员',
        'administrator': '超级管理员',
        'admin': '管理员',
        'shop_owner': '店主',
        'agent': '客服'
    };
    return roleMap[role] || role;
};

window.isAdmin = function isAdmin() {
    const isAdminRole = window.userData && (window.userData.role === 'admin' || window.userData.role === 'super_admin' || window.userData.role === 'administrator');
    console.log(`管理员权限检查: 用户角色=${window.userData?.role || 'undefined'}, 是管理员=${isAdminRole}`);
    return isAdminRole;
};

window.canManageShops = function canManageShops() {
    const canManage = isAdmin();
    console.log(`店铺管理权限检查: 可管理=${canManage}`);
    return canManage;
};

window.canApproveShops = function canApproveShops() {
    const canApprove = isAdmin();
    console.log(`店铺批准权限检查: 可批准=${canApprove}`);
    return canApprove;
};

window.canActivateShops = function canActivateShops() {
    return isAdmin();
};

async function checkLoginStatus() {
    // ...原实现代码...
}
