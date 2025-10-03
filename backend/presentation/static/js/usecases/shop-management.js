/**
 * 店铺管理操作模块
 * 负责店铺管理面板、权限检查、操作分发
 */
(function() {
    'use strict';

    // ============ 权限检查函数 ============

    // 检查是否为管理员
    window.isAdmin = function() {
        const userData = typeof window.userData !== 'undefined' ? window.userData : null;
        const isAdminRole = userData && (userData.role === 'admin' || userData.role === 'super_admin' || userData.role === 'administrator');
        console.log(`管理员权限检查: 用户角色=${userData?.role || 'undefined'}, 是管理员=${isAdminRole}`);
        return isAdminRole;
    };

    // 检查是否可以管理店铺
    window.canManageShops = function() {
        const canManage = window.isAdmin();
        console.log(`店铺管理权限检查: 可管理=${canManage}`);
        return canManage;
    };

    // 检查用户是否有权限执行特定操作
    window.hasActionPermission = function(action, shop = null) {
        const getUserData = typeof window.getUserData === 'function' ? window.getUserData : () => null;
        const userData = getUserData();
        
        if (!userData) {
            console.log('⚠️ 用户数据为空，拒绝所有操作');
            return false;
        }
        
        // 超级管理员有所有权限
        const isSuperAdmin = userData.role === 'super_admin';
        if (isSuperAdmin) {
            console.log('👑 超级管理员，允许所有操作:', action);
            return true;
        }
        
        // 管理员专有操作（审核、激活等）- 只有超级管理员可以执行
        const adminOnlyActions = ['approve', 'reject', 'activate', 'deactivate'];
        if (adminOnlyActions.includes(action)) {
            console.log(`❌ ${action} 操作需要超级管理员权限`);
            return false;
        }
        
        // 对于其他操作，检查店铺所有权
        if (shop) {
            // 检查是否为店铺创建者/所有者
            const isShopOwner = shop.owner_id === userData.id || shop.user_id === userData.id;
            console.log(`🏢 店铺所有权检查: 店铺所有者=${shop.owner_id || shop.user_id}, 当前用户=${userData.id}, 是所有者=${isShopOwner}`);
            
            if (isShopOwner) {
                console.log(`✅ 店铺所有者，允许操作: ${action}`);
                return true;
            } else {
                console.log(`❌ 非店铺所有者，拒绝操作: ${action}`);
                return false;
            }
        }
        
        // 如果没有店铺信息，对于公共操作允许，其他拒绝
        const publicActions = ['edit', 'integration'];
        if (publicActions.includes(action)) {
            console.log(`✅ 公共操作，允许: ${action}`);
            return true;
        }
        
        // 默认拒绝
        console.log(`⚠️ 缺少店铺信息，拒绝操作: ${action}`);
        return false;
    };

    // ============ 店铺管理面板 ============

    // 打开店铺管理面板
    window.openShopManagement = function(shopId) {
        const showToast = typeof window.showToast === 'function' ? window.showToast : (msg) => alert(msg);
        const openModal = typeof window.openModal === 'function' ? window.openModal : () => {};
        const shopsData = typeof window.shopsData !== 'undefined' ? window.shopsData : [];

        window.currentShopId = shopId;
        const shop = shopsData.find(s => s.id === shopId);
        
        if (!shop) {
            showToast('店铺信息未找到', 'error');
            return;
        }
        
        // 根据用户角色生成管理选项
        window.generateManagementOptions(shop);
        openModal('shop-management-modal');
    };

    // 根据用户角色和店铺状态生成管理选项
    window.generateManagementOptions = function(shop) {
        const modalBody = document.querySelector('#shop-management-modal .modal-body');
        if (!modalBody) return;

        const userIsAdmin = window.isAdmin();
        const getStatusText = typeof window.getStatusText === 'function' ? window.getStatusText : (s) => s;
        
        let optionsHtml = '<div class="management-options">';
        
        if (userIsAdmin) {
            // 管理员选项
            optionsHtml += `
                <div class="option-group">
                    <h4>管理员操作</h4>
                    <div class="admin-info">
                        <p><strong>店铺:</strong> ${shop.name}</p>
                        <p><strong>状态:</strong> <span class="status-badge status-${shop.status}">${getStatusText(shop.status)}</span></p>
                    </div>
            `;
            
            // 根据店铺状态显示不同的管理选项
            switch (shop.status) {
                case 'pending':
                    optionsHtml += `
                        <button class="option-btn success" onclick="handleShopAction('approve')">
                            ✅ 批准店铺
                        </button>
                        <button class="option-btn warning" onclick="handleShopAction('reject')">
                            ❌ 拒绝店铺
                        </button>
                    `;
                    break;
                case 'approved':
                    optionsHtml += `
                        <button class="option-btn" onclick="handleShopAction('employees')">
                            👥 员工管理
                        </button>
                        <button class="option-btn" onclick="handleShopAction('integration')">
                            🔗 集成代码
                        </button>
                        <button class="option-btn warning" onclick="handleShopAction('reject')">
                            ❌ 撤销批准
                        </button>
                    `;
                    break;
                case 'active':
                    optionsHtml += `
                        <button class="option-btn warning" onclick="handleShopAction('deactivate')">
                            ⏸️ 停用店铺
                        </button>
                    `;
                    break;
                case 'inactive':
                    optionsHtml += `
                        <button class="option-btn primary" onclick="handleShopAction('activate')">
                            🚀 重新激活
                        </button>
                    `;
                    break;
                case 'rejected':
                    optionsHtml += `
                        <button class="option-btn success" onclick="handleShopAction('approve')">
                            ✅ 重新批准
                        </button>
                    `;
                    break;
            }
            
            optionsHtml += `
                </div>
                <div class="option-group">
                    <h4>通用管理</h4>
                    <button class="option-btn" onclick="handleShopAction('employees')">
                        👥 员工管理
                    </button>
                    ${shop.status !== 'pending' ? `
                    <button class="option-btn" onclick="handleShopAction('edit')">
                        ✏️ 编辑信息
                    </button>
                    ` : ''}
                    <button class="option-btn" onclick="handleShopAction('integration')">
                        🔗 集成代码
                    </button>
                </div>
            `;
        } else {
            // 店主选项
            optionsHtml += `
                <div class="option-group">
                    <h4>店铺管理</h4>
                    <div class="shop-owner-info">
                        <p><strong>店铺:</strong> ${shop.name}</p>
                        <p><strong>状态:</strong> <span class="status-badge status-${shop.status}">${getStatusText(shop.status)}</span></p>
                    </div>
            `;
            
            // 店主只能使用基本功能
            switch (shop.status) {
                case 'pending':
                    optionsHtml += `
                        <div class="info-message">
                            <p>您的店铺正在审核中，请耐心等待管理员审核。</p>
                        </div>
                    `;
                    break;
                case 'approved':
                    optionsHtml += `
                        <button class="option-btn" onclick="handleShopAction('employees')">
                            👥 员工管理
                        </button>
                        <button class="option-btn" onclick="handleShopAction('integration')">
                            🔗 集成代码
                        </button>
                    `;
                    break;
                case 'active':
                    optionsHtml += `
                        <div class="info-message success">
                            <p>您的店铺正在正常运营中。</p>
                        </div>
                        <button class="option-btn" onclick="handleShopAction('employees')">
                            👥 员工管理
                        </button>
                        <button class="option-btn" onclick="handleShopAction('integration')">
                            🔗 集成代码
                        </button>
                        <button class="option-btn" onclick="payToActivate('${shop.id}', event)">
                            💳 续费
                        </button>
                    `;
                    break;
                case 'inactive':
                    optionsHtml += `
                        <div class="info-message warning">
                            <p>您的店铺未审核，请先完成付费以通过审核并启用功能。</p>
                        </div>
                        <button class="option-btn primary" onclick="payToActivate('${shop.id}', event)">
                            💳 付费激活
                        </button>
                    `;
                    break;
                case 'rejected':
                    optionsHtml += `
                        <div class="info-message error">
                            <p>很抱歉，您的店铺审核未通过，请修改后重新申请。</p>
                        </div>
                        <button class="option-btn warning" onclick="handleShopAction('edit')">
                            ✏️ 修改信息
                        </button>
                    `;
                    break;
            }
            
            optionsHtml += `
                    <button class="option-btn" onclick="viewShop('${shop.id}', event)">
                        👁️ 查看详情
                    </button>
                </div>
            `;
        }
        
        optionsHtml += '</div>';
        modalBody.innerHTML = optionsHtml;
    };

    // 处理店铺操作
    window.handleShopAction = function(action, shopId = null) {
        const showToast = typeof window.showToast === 'function' ? window.showToast : (msg) => alert(msg);
        const closeModal = typeof window.closeModal === 'function' ? window.closeModal : () => {};
        const approveShop = typeof window.approveShop === 'function' ? window.approveShop : null;
        const rejectShop = typeof window.rejectShop === 'function' ? window.rejectShop : null;
        const activateShop = typeof window.activateShop === 'function' ? window.activateShop : null;
        const deactivateShop = typeof window.deactivateShop === 'function' ? window.deactivateShop : null;
        const openEditShop = typeof window.openEditShop === 'function' ? window.openEditShop : null;
        const showShopDetails = typeof window.showShopDetails === 'function' ? window.showShopDetails : null;
        const showShopTab = typeof window.showShopTab === 'function' ? window.showShopTab : null;
        const openIntegrationCode = typeof window.openIntegrationCode === 'function' ? window.openIntegrationCode : null;
        const shopsData = typeof window.shopsData !== 'undefined' ? window.shopsData : [];

        // 使用当前店铺ID或传入的ID
        const targetShopId = shopId || window.currentShopId;
        
        // 获取店铺信息
        const shop = shopsData.find(s => s.id === targetShopId);
        if (!shop) {
            showToast('店铺信息不存在', 'error');
            return;
        }
        
        // 权限验证 - 传入店铺信息
        if (!window.hasActionPermission(action, shop)) {
            showToast('您没有权限执行此操作', 'error');
            return;
        }
        
        switch(action) {
            case 'approve':
                if (approveShop) approveShop(targetShopId);
                closeModal('shop-management-modal');
                break;
            case 'reject':
                if (rejectShop) rejectShop(targetShopId);
                closeModal('shop-management-modal');
                break;
            case 'activate':
                if (activateShop) activateShop(targetShopId);
                closeModal('shop-management-modal');
                break;
            case 'deactivate':
                if (deactivateShop) deactivateShop(targetShopId);
                closeModal('shop-management-modal');
                break;
            case 'edit':
                closeModal('shop-management-modal');
                if (openEditShop) openEditShop(targetShopId);
                break;
            case 'employees':
                // 统一使用 店铺详情 -> 员工管理 标签页（已通过即可使用）
                closeModal('shop-management-modal');
                if (showShopDetails) showShopDetails(shop);
                const empTabExists = !!document.getElementById('employeesTab');
                if (empTabExists && showShopTab) {
                    showShopTab('employees');
                } else {
                    showToast('暂时无法打开员工管理，请稍后重试', 'warning');
                }
                break;
            case 'integration':
                // 业务规则：已通过 = 已付费
                closeModal('shop-management-modal');
                if (openIntegrationCode) openIntegrationCode(targetShopId);
                break;
            default:
                console.warn('未知操作:', action);
        }
    };

    // 获取状态显示文本
    window.getStatusText = function(status) {
        const statusMap = {
            'pending': '待审核',
            'approved': '已通过',
            'active': '活跃',
            'rejected': '已拒绝',
            'inactive': '非活跃'
        };
        return statusMap[status] || status;
    };

    // 查看店铺详情
    window.viewShop = function(shopId, event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        
        const showToast = typeof window.showToast === 'function' ? window.showToast : (msg) => alert(msg);
        const showShopDetails = typeof window.showShopDetails === 'function' ? window.showShopDetails : null;
        const shopsData = typeof window.shopsData !== 'undefined' ? window.shopsData : [];

        const shop = shopsData.find(s => s.id === shopId);
        if (!shop) { 
            showToast('店铺信息未找到', 'error'); 
            return; 
        }
        
        if (showShopDetails) showShopDetails(shop);
    };

    console.log('✅ 店铺管理操作模块已加载 (shop-management.js)');
})();
