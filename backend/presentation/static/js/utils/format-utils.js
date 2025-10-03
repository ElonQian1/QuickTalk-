"use strict";

// format-utils.js — 通用格式化工具（从 mobile-dashboard.html 抽取）
// 提供：formatDate(dateString)

(function(){
  window.formatDate = function formatDate(dateString) {
    if (!dateString) return '未知';
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
