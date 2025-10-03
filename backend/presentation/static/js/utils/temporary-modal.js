"use strict";

// temporary-modal.js — 通用临时模态工具（从 mobile-dashboard.html 抽取）
// 提供：showModal(title, content)
// 注意：保持与原内联实现一致，使用 closeModal 关闭；点击背景可关闭。

(function(){
  window.showModal = function showModal(title, content) {
    // 创建临时模态框
    const modalId = 'temp-modal-' + Date.now();
    const modalHtml = `
      <div id="${modalId}" class="modal" style="display: flex;">
        <div class="modal-content">
          <div class="modal-header">
            <h3>${title}</h3>
            <button class="modal-close" onclick="closeModal('${modalId}')">&times;</button>
          </div>
          <div class="modal-body">
            ${content}
          </div>
        </div>
      </div>`;

    // 添加到页面
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // 点击背景关闭
    const el = document.getElementById(modalId);
    if (el) {
      el.addEventListener('click', function(e) {
        if (e.target === this) {
          if (typeof closeModal === 'function') closeModal(modalId);
        }
      });
    }
  };
})();
