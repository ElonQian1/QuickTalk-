// loading-utils.js — 加载提示工具
// 提供：showLoading, hideLoading

(function(){
  'use strict';

  window.showLoading = function showLoading(message) {
    // 可扩展为真正的 loading UI，这里保持原行为
    console.log('Loading:', message);
  };

  window.hideLoading = function hideLoading() {
    console.log('Loading ended');
  };
})();
