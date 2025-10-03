"use strict";
// shop-management-modal.js — 店铺管理模态相关函数（从 mobile-dashboard.html 拆分）
// 提供：openShopManagement, generateManagementOptions, handleShopAction, hasActionPermission
// 依赖：isAdmin, getStatusText, showToast, openModal, closeModal, showShopDetails, showShopTab, openEditShop, openIntegrationCode, approveShop, rejectShop, activateShop, deactivateShop, shopsData, currentShopId, getUserData

(function(){
  window.openShopManagement = function openShopManagement(shopId) {
    window.currentShopId = shopId;
    const shop = (typeof shopsData !== 'undefined' && Array.isArray(shopsData)) ? shopsData.find(s => s.id === shopId) : null;
    if (!shop) {
      if (typeof showToast === 'function') showToast('店铺信息未找到', 'error');
      return;
    }
    if (typeof generateManagementOptions === 'function') generateManagementOptions(shop);
    if (typeof openModal === 'function') openModal('shop-management-modal');
  };

  window.generateManagementOptions = function generateManagementOptions(shop) {
    const modalBody = document.querySelector('#shop-management-modal .modal-body');
    const userIsAdmin = (typeof isAdmin === 'function') ? isAdmin() : false;
    let optionsHtml = '<div class="management-options">';
    if (userIsAdmin) {
      optionsHtml += `
        <div class="option-group">
          <h4>管理员操作</h4>
          <div class="admin-info">
            <p><strong>店铺:</strong> ${shop.name}</p>
            <p><strong>状态:</strong> <span class="status-badge status-${shop.status}">${getStatusText(shop.status)}</span></p>
          </div>
      `;
      switch (shop.status) {
        case 'pending':
          optionsHtml += `
            <button class="option-btn success" onclick="handleShopAction('approve')">✅ 批准店铺</button>
            <button class="option-btn warning" onclick="handleShopAction('reject')">❌ 拒绝店铺</button>
          `;
          break;
        case 'approved':
          optionsHtml += `
            <button class="option-btn" onclick="handleShopAction('employees')">👥 员工管理</button>
            <button class="option-btn" onclick="handleShopAction('integration')">🔗 集成代码</button>
            <button class="option-btn warning" onclick="handleShopAction('reject')">❌ 撤销批准</button>
          `;
          break;
        case 'active':
          optionsHtml += `
            <button class="option-btn warning" onclick="handleShopAction('deactivate')">⏸️ 停用店铺</button>
          `;
          break;
        case 'inactive':
          optionsHtml += `
            <button class="option-btn primary" onclick="handleShopAction('activate')">🚀 重新激活</button>
          `;
          break;
        case 'rejected':
          optionsHtml += `
            <button class="option-btn success" onclick="handleShopAction('approve')">✅ 重新批准</button>
          `;
          break;
      }
      optionsHtml += `
        </div>
        <div class="option-group">
          <h4>通用管理</h4>
          <button class="option-btn" onclick="handleShopAction('employees')">👥 员工管理</button>
          ${shop.status !== 'pending' ? `<button class="option-btn" onclick="handleShopAction('edit')">✏️ 编辑信息</button>` : ''}
          <button class="option-btn" onclick="handleShopAction('integration')">🔗 集成代码</button>
        </div>
      `;
    } else {
      optionsHtml += `
        <div class="option-group">
          <h4>店铺管理</h4>
          <div class="shop-owner-info">
            <p><strong>店铺:</strong> ${shop.name}</p>
            <p><strong>状态:</strong> <span class="status-badge status-${shop.status}">${getStatusText(shop.status)}</span></p>
          </div>
      `;
      switch (shop.status) {
        case 'pending':
          optionsHtml += `
            <div class="info-message"><p>您的店铺正在审核中，请耐心等待管理员审核。</p></div>
          `;
          break;
        case 'approved':
          optionsHtml += `
            <button class="option-btn" onclick="handleShopAction('employees')">👥 员工管理</button>
            <button class="option-btn" onclick="handleShopAction('integration')">🔗 集成代码</button>
          `;
          break;
        case 'active':
          optionsHtml += `
            <div class="info-message success"><p>您的店铺正在正常运营中。</p></div>
            <button class="option-btn" onclick="handleShopAction('employees')">👥 员工管理</button>
            <button class="option-btn" onclick="handleShopAction('integration')">🔗 集成代码</button>
            <button class="option-btn" onclick="payToActivate('${shop.id}', event)">💳 续费</button>
          `;
          break;
        case 'inactive':
          optionsHtml += `
            <div class="info-message warning"><p>您的店铺未审核，请先完成付费以通过审核并启用功能。</p></div>
            <button class="option-btn primary" onclick="payToActivate('${shop.id}', event)">💳 付费激活</button>
          `;
          break;
        case 'rejected':
          optionsHtml += `
            <div class="info-message error"><p>很抱歉，您的店铺审核未通过，请修改后重新申请。</p></div>
            <button class="option-btn warning" onclick="handleShopAction('edit')">✏️ 修改信息</button>
          `;
          break;
      }
      optionsHtml += `
          <button class="option-btn" onclick="viewShop('${shop.id}', event)">👁️ 查看详情</button>
        </div>
      `;
    }
    optionsHtml += '</div>';
    if (modalBody) modalBody.innerHTML = optionsHtml;
  };

  window.handleShopAction = function handleShopAction(action, shopId = window.currentShopId) {
    const shop = (typeof shopsData !== 'undefined' && Array.isArray(shopsData)) ? shopsData.find(s => s.id === shopId) : null;
    if (!shop) {
      if (typeof showToast === 'function') showToast('店铺信息不存在', 'error');
      return;
    }
    if (typeof hasActionPermission === 'function' && !hasActionPermission(action, shop)) {
      if (typeof showToast === 'function') showToast('您没有权限执行此操作', 'error');
      return;
    }
    switch(action) {
      case 'approve':
        if (typeof approveShop === 'function') approveShop(shopId);
        if (typeof closeModal === 'function') closeModal('shop-management-modal');
        break;
      case 'reject':
        if (typeof rejectShop === 'function') rejectShop(shopId);
        if (typeof closeModal === 'function') closeModal('shop-management-modal');
        break;
      case 'activate':
        if (typeof activateShop === 'function') activateShop(shopId);
        if (typeof closeModal === 'function') closeModal('shop-management-modal');
        break;
      case 'deactivate':
        if (typeof deactivateShop === 'function') deactivateShop(shopId);
        if (typeof closeModal === 'function') closeModal('shop-management-modal');
        break;
      case 'edit':
        if (typeof closeModal === 'function') closeModal('shop-management-modal');
        if (typeof openEditShop === 'function') openEditShop(shopId);
        break;
      case 'employees':
        if (typeof closeModal === 'function') closeModal('shop-management-modal');
        if (typeof showShopDetails === 'function') showShopDetails(shop);
        const empTabExists = !!document.getElementById('employeesTab');
        if (empTabExists && typeof showShopTab === 'function') {
          showShopTab('employees');
        } else if (typeof showToast === 'function') {
          showToast('暂时无法打开员工管理，请稍后重试', 'warning');
        }
        break;
      case 'integration':
        if (typeof closeModal === 'function') closeModal('shop-management-modal');
        if (typeof openIntegrationCode === 'function') openIntegrationCode(shopId);
        break;
      default:
        if (typeof console !== 'undefined') console.warn('未知操作:', action);
    }
  };

  window.hasActionPermission = function hasActionPermission(action, shop = null) {
    const userData = (typeof getUserData === 'function') ? getUserData() : null;
    if (!userData) {
      if (typeof console !== 'undefined') console.log('⚠️ 用户数据为空，拒绝所有操作');
      return false;
    }
    const isSuperAdmin = userData.role === 'super_admin';
    if (isSuperAdmin) {
      if (typeof console !== 'undefined') console.log('👑 超级管理员，允许所有操作:', action);
      return true;
    }
    const adminOnlyActions = ['approve', 'reject', 'activate', 'deactivate'];
    if (adminOnlyActions.includes(action)) {
      if (typeof console !== 'undefined') console.log(`❌ ${action} 操作需要超级管理员权限`);
      return false;
    }
    if (shop) {
      const isShopOwner = shop.owner_id === userData.id || shop.user_id === userData.id;
      if (typeof console !== 'undefined') console.log(`🏢 店铺所有权检查: 店铺所有者=${shop.owner_id || shop.user_id}, 当前用户=${userData.id}, 是所有者=${isShopOwner}`);
      if (isShopOwner) {
        if (typeof console !== 'undefined') console.log(`✅ 店铺所有者，允许操作: ${action}`);
        return true;
      } else {
        if (typeof console !== 'undefined') console.log(`❌ 非店铺所有者，拒绝操作: ${action}`);
        return false;
      }
    }
    const publicActions = ['edit', 'integration'];
    if (publicActions.includes(action)) {
      if (typeof console !== 'undefined') console.log(`✅ 公共操作，允许: ${action}`);
      return true;
    }
    if (typeof console !== 'undefined') console.log(`⚠️ 缺少店铺信息，拒绝操作: ${action}`);
    return false;
  };
})();
