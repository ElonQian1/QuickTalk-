// roles.js — 角色名工具（从 mobile-dashboard.html 抽取）
// 提供：getRoleName

(function(){
  'use strict';
  window.getRoleName = function getRoleName(role) {
    const map = {
      'admin': '管理员',
      'agent': '客服专员',
      'viewer': '观察员',
      'employee': '员工',
      'manager': '经理'
    };
    return map[role] || role || '未知';
  };
})();
