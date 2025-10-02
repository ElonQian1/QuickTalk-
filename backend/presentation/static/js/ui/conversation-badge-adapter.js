/**
 * ConversationBadgeAdapter
 * 作用：在 .conversation-item[data-conversation-id] 的 .conversation-avatar 上挂载未读红点
 */
(function () {
  const MAP = new Map(); // convId -> badge instance or proxy

  function log(...args) {
    if (window.__CONV_BADGE_DEBUG__) console.log('💬 ConversationBadgeAdapter:', ...args);
  }

  function ensureBadge(avatarEl, convId) {
    if (!avatarEl || !convId) return null;
    if (MAP.has(convId)) return MAP.get(convId);

    const existing = avatarEl.querySelector('.unread-badge-component');
    if (existing) {
      const proxy = {
        element: existing,
        update(n) {
          const v = Math.max(0, parseInt(n) || 0);
          this.element.setAttribute('data-count', String(v));
          this.element.textContent = v > 0 ? (v > 99 ? '99+' : String(v)) : '';
          this.element.style.display = v > 0 ? 'flex' : 'none';
        },
      };
      MAP.set(convId, proxy);
      return proxy;
    }

    try {
      if (typeof window.UnreadBadgeComponent === 'function') {
        const badge = new window.UnreadBadgeComponent({ size: 'small', position: 'top-right', animation: true, autoHide: true, showZero: false, clickable: false });
        badge.create(avatarEl);
        MAP.set(convId, badge);
        return badge;
      }
    } catch (e) {
      console.warn('创建会话头像未读徽章失败:', e);
    }
    return null;
  }

  function attachAll() {
    const items = document.querySelectorAll('.conversation-item[data-conversation-id]');
    let count = 0;
    items.forEach((item) => {
      const cid = item.getAttribute('data-conversation-id');
      const avatar = item.querySelector('.conversation-avatar');
      if (!cid || !avatar) return;
      const inst = ensureBadge(avatar, cid);
      if (inst) count++;
    });
    if (count > 0) log(`挂载头像徽章 ${count} 个`);
  }

  function update(convId, unread) {
    const items = document.querySelectorAll(`.conversation-item[data-conversation-id="${convId}"]`);
    const v = Math.max(0, parseInt(unread) || 0);
    items.forEach((item) => {
      const avatar = item.querySelector('.conversation-avatar');
      if (!avatar) return;
      const inst = ensureBadge(avatar, convId);
      if (inst) {
        if (typeof inst.updateCount === 'function') inst.updateCount(v); else if (typeof inst.update === 'function') inst.update(v);
      }
      // 兼容已有 .unread-badge（若在列表项内）
      const domBadge = item.querySelector('.unread-badge');
      if (domBadge) {
        domBadge.textContent = v > 0 ? (v > 99 ? '99+' : String(v)) : '';
        domBadge.style.display = v > 0 ? 'inline-flex' : 'none';
      }
    });
  }

  function init() {
    attachAll();
    const mo = new MutationObserver(() => {
      // 延迟一点，避免频繁 attach
      clearTimeout(init._t);
      init._t = setTimeout(attachAll, 80);
    });
    mo.observe(document.body, { childList: true, subtree: true });
    // 首屏延迟刷新
    setTimeout(attachAll, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.ConversationBadgeAdapter = { update };
})();
