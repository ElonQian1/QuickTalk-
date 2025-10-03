// message-tools.js — 消息页工具（从 mobile-dashboard.html 抽取）
// 提供：viewCustomerInfo, showCustomerSessionTools
// 依赖：messageManager, showToast, window.DebugTools（可选）

(function(){
  'use strict';

  window.viewCustomerInfo = function viewCustomerInfo() {
    try {
      const mm = window.messageManager;
      if (!mm || !mm.currentCustomer) {
        if (typeof window.showToast === 'function') window.showToast('请先选择一个对话', 'error');
        return;
      }
      const customer = mm.currentCustomer;
      const mapRaw = localStorage.getItem('customer_number_map') || '{}';
      const customerNumberMap = JSON.parse(mapRaw);
      alert(
        `客户信息：\n` +
        `显示名称: ${customer.name}\n` +
        `客户ID: ${customer.id}\n` +
        `序列编号: ${customerNumberMap[customer.id] || '未分配'}\n` +
        `对话ID: ${mm.currentConversationId || '未知'}`
      );
    } catch (e) {
      console.error('viewCustomerInfo error:', e);
    }
  };

  window.showCustomerSessionTools = function showCustomerSessionTools() {
    try {
      if (window.DebugTools && typeof window.DebugTools.showCustomerSessionTools === 'function') {
        return window.DebugTools.showCustomerSessionTools();
      }
      // 降级处理
      const mapRaw = localStorage.getItem('customer_number_map') || '{}';
      const customerNumberMap = JSON.parse(mapRaw);
      const count = Object.keys(customerNumberMap).length;
      alert(`客户编号统计: ${count} 个客户\n详细信息请查看控制台`);
      console.log('客户编号映射:', customerNumberMap);
    } catch (e) {
      console.error('showCustomerSessionTools error:', e);
    }
  };
})();
