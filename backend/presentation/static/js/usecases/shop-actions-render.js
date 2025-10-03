"use strict";

// shop-actions-render.js — 店铺操作按钮渲染（从 mobile-dashboard.html 抽取）
// 提供：getShopActions(shop)
// 依赖：getUserData, getEffectiveStatus, getShopStatusText

(function(){
  window.getShopActions = function getShopActions(shop) {
    const actions = [];
    const userData = (typeof getUserData === 'function') ? getUserData() : null;
    const status = (typeof getEffectiveStatus === 'function') ? getEffectiveStatus(shop) : 'pending';
    const isEmployeeMember = shop && shop.membership === 'employee';
    
    // 权限检查
    const isSuperAdmin = userData && userData.role === 'super_admin';
    const isShopOwner = userData && (shop.owner_id === userData.id || shop.user_id === userData.id);
    
    console.log(`🎯 店铺${shop.id}操作权限: 超级管理员=${isSuperAdmin}, 店铺所有者=${isShopOwner}`);
    
    switch (status) {
      case 'pending':
        // 待审核状态
        if (isSuperAdmin) {
          actions.push(`<div class="shop-action-btn success" onclick="approveShop('${shop.id}', event)">通过</div>`);
          actions.push(`<div class="shop-action-btn danger" onclick="rejectShop('${shop.id}', event)">拒绝</div>`);
        }
        if (isShopOwner) {
          actions.push(`<div class="shop-action-btn primary" onclick="payToActivate('${shop.id}', event)">付费开通</div>`);
        }
        if (!isEmployeeMember) {
          actions.push(`<div class="shop-action-btn" onclick="viewShop('${shop.id}', event)">查看</div>`);
        }
        break;
        
      case 'approved':
        // 已审核=已付费，完整功能
        if (isSuperAdmin && !isEmployeeMember) {
          actions.push(`<div class="shop-action-btn primary" onclick="manageShop('${shop.id}', event)">管理</div>`);
          actions.push(`<div class="shop-action-btn danger" onclick="rejectShop('${shop.id}', event)">撤销批准</div>`);
        }
        if (isShopOwner && !isEmployeeMember) {
          actions.push(`<div class="shop-action-btn primary" onclick="manageShop('${shop.id}', event)">管理</div>`);
        }
        if (!isEmployeeMember) {
          actions.push(`<div class="shop-action-btn" onclick="viewShop('${shop.id}', event)">查看</div>`);
        }
        break;
        
      case 'active':
        // 运行中=已付费
        if (!isEmployeeMember && (isShopOwner || isSuperAdmin)) {
          actions.push(`<div class="shop-action-btn" onclick="viewShopMessages('${shop.id}', event)">消息</div>`);
          actions.push(`<div class="shop-action-btn primary" onclick="manageShop('${shop.id}', event)">管理</div>`);
        }
        if (isSuperAdmin && !isEmployeeMember) {
          actions.push(`<div class="shop-action-btn warning" onclick="deactivateShop('${shop.id}', event)">停用</div>`);
        }
        break;
        
      case 'rejected':
        // 被拒绝状态
        if (isShopOwner && !isEmployeeMember) {
          actions.push(`<div class="shop-action-btn warning" onclick="editShop('${shop.id}', event)">修改</div>`);
          actions.push(`<div class="shop-action-btn" onclick="resubmitShop('${shop.id}', event)">重新申请</div>`);
        }
        if (isSuperAdmin && !isEmployeeMember) {
          actions.push(`<div class="shop-action-btn warning" onclick="manageShop('${shop.id}', event)">重新审核</div>`);
        }
        if (!isEmployeeMember) {
          actions.push(`<div class="shop-action-btn" onclick="viewShop('${shop.id}', event)">查看</div>`);
        }
        break;
        
      case 'inactive':
        // 未激活状态
        if (isSuperAdmin && !isEmployeeMember) {
          actions.push(`<div class="shop-action-btn primary" onclick="manageShop('${shop.id}', event)">管理</div>`);
        }
        if (isShopOwner && !isEmployeeMember) {
          actions.push(`<div class="shop-action-btn primary" onclick="payToActivate('${shop.id}', event)">付费激活</div>`);
        }
        if (!isEmployeeMember) {
          actions.push(`<div class="shop-action-btn" onclick="viewShop('${shop.id}', event)">查看</div>`);
        }
        break;
        
      default:
        if (!isEmployeeMember) {
          actions.push(`<div class="shop-action-btn" onclick="viewShop('${shop.id}', event)">查看</div>`);
        }
    }
    
    return actions.join('');
  };
})();
