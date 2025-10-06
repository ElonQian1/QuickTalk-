/**
 * modal-utils.js — 模态框管理工具（已废弃）
 * 
 * ⚠️ 此文件已被 UnifiedModalSystem 替代
 * @deprecated 请使用 unified-modal-system.js
 * @see /static/js/core/unified-modal-system.js
 * 
 * 功能已整合到统一系统：
 * - openModal → UnifiedModalSystem.open()
 * - closeModal → UnifiedModalSystem.close()
 * - closeAllModals → UnifiedModalSystem.closeAll()
 */

// 为向下兼容保留的适配器实现
(function(){
  'use strict';

  // 如果统一系统已加载，则直接使用
  if (window.UnifiedModalSystem) {
    console.log('🔄 modal-utils.js 已被 UnifiedModalSystem 替代');
    return;
  }

  // 降级实现（兼容旧代码）
  window.openModal = function openModal(modalId) {
    const modal = document.getElementById(modalId);
    const overlay = document.getElementById('modal-overlay');
    if (modal && overlay) {
      overlay.style.display = 'block';
      modal.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
  };

  window.closeModal = function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = 'auto';

    if (modalId && modalId.startsWith('temp-modal-')) {
      if (modal) modal.remove();
      return;
    }
    if (modal) modal.classList.remove('show');
  };

  window.closeAllModals = function closeAllModals() {
    const overlay = document.getElementById('modal-overlay');
    const modals = document.querySelectorAll('.modal.show');
    if (overlay) overlay.style.display = 'none';
    modals.forEach(m => m.classList.remove('show'));
    document.body.style.overflow = 'auto';
  };

  console.log('⚠️ modal-utils.js 降级模式已加载，建议升级到 UnifiedModalSystem');
})();
