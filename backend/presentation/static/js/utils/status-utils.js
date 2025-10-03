// status-utils.js — 状态文本工具
// 提供：getStatusText

(function(){
  'use strict';

  window.getStatusText = function getStatusText(status) {
    const statusMap = {
      'active': '运行中',
      'approved': '已通过',
      'pending': '待审核',
      'rejected': '已拒绝',
      'inactive': '未激活'
    };
    return statusMap[status] || status || '未知';
  };
})();
