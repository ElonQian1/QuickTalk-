"use strict";

/**
 * format-utils.js - 重构为 UnifiedUtils 适配器
 * 
 * 🔄 已重构：委托格式化功能给 UnifiedUtils
 * - 保持向下兼容API
 * - 移除重复的格式化逻辑
 * - 统一行为模式
 * 
 * @deprecated 推荐直接使用 UnifiedUtils.formatDateTime
 * @version 2.0 - 适配器版本
 */

(function(){
  window.formatDate = function formatDate(dateString) {
    if (!dateString) return '未知';
    
    // 委托给 UnifiedUtils
    if (window.UnifiedUtils && window.UnifiedUtils.formatDateTime) {
      try {
        return window.UnifiedUtils.formatDateTime(dateString, 'YYYY-MM-DD HH:mm');
      } catch (error) {
        console.warn('formatDate降级处理:', error);
        return dateString;
      }
    }
    
    // 极简降级实现
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return dateString;
    }
  };

  console.log('🔧 format-utils.js 已重构为 UnifiedUtils 适配器');
})();
