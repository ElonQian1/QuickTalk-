// notify-utils.js — 通知工具
// 提供：showSuccess, showError

(function(){
  'use strict';

  window.showSuccess = function showSuccess(message) {
    console.log('Success:', message);
    // 可扩展为更好的成功提示
  };

  window.showError = function showError(message) {
    console.error('Error:', message);
    alert(message); // 保持原来的临时行为
  };
})();
