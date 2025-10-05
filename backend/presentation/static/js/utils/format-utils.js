"use strict";

// format-utils.js — 通用格式化工具（使用 UnifiedUtils 统一实现）
// 提供：formatDate(dateString) - 向下兼容

(function(){
  window.formatDate = function formatDate(dateString) {
    if (!dateString) return '未知';
    
    // 使用统一工具库进行时间格式化
    if (window.UnifiedUtils) {
      try {
        return window.UnifiedUtils.formatDateTime(dateString, 'YYYY-MM-DD HH:mm');
      } catch (error) {
        return dateString;
      }
    }
    
    // 降级兼容实现
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return dateString;
    }
  };
})();
