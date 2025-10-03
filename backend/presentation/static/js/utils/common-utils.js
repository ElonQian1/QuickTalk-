"use strict";

// common-utils.js — 通用工具函数（从 mobile-dashboard.html 抽取）
// 提供：formatTime(date), showToast(message, type), fetchShops(), openConversation(id), createNewShop()

(function(){
  // 时间格式化
  window.formatTime = function formatTime(date) {
    if (!date) return '未知';
    const dateObj = (date instanceof Date) ? date : new Date(date);
    const now = new Date();
    const diff = now - dateObj;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 1) {
      return '刚刚';
    } else if (minutes < 60) {
      return `${minutes}分钟前`;
    } else if (hours < 24) {
      return `${hours}小时前`;
    } else {
      return `${days}天前`;
    }
  };

  // 显示提示信息（简单实现，可被其他 showToast 覆盖）
  if (typeof window.showToast === 'undefined') {
    window.showToast = function showToast(message, type = 'info') {
      console.log(`[${type.toUpperCase()}] ${message}`);
      // 可在此处添加UI提示逻辑
    };
  }

  // 获取店铺列表
  window.fetchShops = async function fetchShops() {
    try {
      console.log('🔄 正在获取店铺列表...');
      
      const apiUrl = '/api/shops';
      const authToken = (typeof getAuthToken === 'function') ? getAuthToken() : '';
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        headers['X-Session-Id'] = authToken;
      }
      
      console.log(`📡 调用API: ${apiUrl}`, { hasToken: !!authToken });
      
      const response = await fetch(apiUrl, { headers });
      if (response.ok) {
        const result = await response.json();
        console.log('📦 API响应:', result);
        
        // 检查响应格式并正确提取数据
        if (result.success && Array.isArray(result.data)) {
          console.log('✅ 成功获取店铺数据:', result.data);
          return result.data;
        } else if (Array.isArray(result)) {
          console.log('✅ 直接数组格式店铺数据:', result);
          return result;
        } else {
          console.warn('⚠️ 意外的响应格式:', result);
          return [];
        }
      } else {
        console.error('❌ API响应失败:', response.status, response.statusText);
        return [];
      }
    } catch (error) {
      console.error('❌ 获取店铺列表API调用失败:', error);
      return [];
    }
  };

  // 打开对话
  window.openConversation = function openConversation(conversationId) {
    console.log('打开对话:', conversationId);
    if (typeof showToast === 'function') showToast('对话功能开发中...', 'info');
  };

  // 创建新店铺
  window.createNewShop = function createNewShop() {
    console.log('🏪 createNewShop 函数被调用');
    try {
      if (typeof showCreateShopModal === 'function') {
        showCreateShopModal();
      } else {
        console.warn('showCreateShopModal 函数未定义');
        if (typeof showToast === 'function') showToast('创建店铺功能加载中...', 'info');
      }
    } catch (error) {
      console.error('❌ createNewShop 错误:', error);
      if (typeof showToast === 'function') showToast('显示创建店铺对话框时出错: ' + error.message, 'error');
    }
  };

  // 显示店铺管理模态框
  window.showShopManagementModal = function showShopManagementModal(shop) {
    if (!shop) return;
    console.log('显示店铺管理模态框:', shop.name);
    if (typeof showToast === 'function') showToast(`管理店铺"${shop.name}"功能开发中...`, 'info');
    // TODO: 实现店铺管理模态框
  };
})();
