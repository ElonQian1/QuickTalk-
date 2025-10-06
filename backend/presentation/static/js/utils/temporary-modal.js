/**
 * temporary-modal.js — 通用临时模态工具（已废弃）
 * 
 * ⚠️ 此文件已被 UnifiedModalSystem 替代
 * @deprecated 请使用 unified-modal-system.js
 * @see /static/js/core/unified-modal-system.js
 * 
 * 功能已整合到统一系统：
 * - showModal(title, content) → UnifiedModalSystem.alert(title, content)
 */

"use strict";

(function(){
  // 如果统一系统已加载，则直接使用
  if (window.UnifiedModalSystem) {
    console.log('🔄 temporary-modal.js 已被 UnifiedModalSystem 替代');
    return;
  }

  // 降级实现（兼容旧代码）
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

  console.log('⚠️ temporary-modal.js 降级模式已加载，建议升级到 UnifiedModalSystem');
})();
