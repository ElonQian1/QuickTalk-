// modal-utils.js — 模态框管理工具（从 mobile-dashboard.html 抽取）
// 提供：openModal, closeModal, closeAllModals

(function(){
  'use strict';

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
})();
