"use strict";

// shop-utils.js — 店铺相关工具（从 mobile-dashboard.html 抽取）
// 提供：getEffectiveStatus(shop)
// 说明：统一计算店铺有效状态（优先后端审核字段），默认 'pending'

(function(){
  window.getEffectiveStatus = function getEffectiveStatus(shop) {
    return (shop && (shop.approvalStatus || shop.status)) || 'pending';
  };

  // 店铺状态显示文本（含表情符号），与原内联实现保持一致
  window.getShopStatusText = function getShopStatusText(status) {
    const statusMap = {
      'active': '✅ 运行中',
      'approved': '✅ 已通过',
      'pending': '⏳ 待审核',
      'rejected': '❌ 已拒绝',
      'inactive': '💤 未激活'
    };
    return statusMap[status] || '⏳ 待审核';
  };
})();
