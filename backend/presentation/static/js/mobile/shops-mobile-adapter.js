/**
 * mobile/shops-mobile-adapter.js
 * 移动端阶段2 - 店铺管理(第一步: 列表只读 + 占位动作按钮)
 * 目标 (本步交付):
 *  1. 在移动端骨架完成后自动初始化店铺列表渲染
 *  2. 统一使用 StatusView 显示 loading / empty / error
 *  3. 复用现有 ShopsManager / messageModule.showShops 逻辑，不复制数据处理
 *  4. 结构化挂载容器与事件，为后续 CRUD (创建/编辑/删除) 扩展留出插槽
 *  5. 保证幂等 (多次 init 不重复绑定 / 不重复 DOM 注入)
 *
 * 后续增量(不在本提交内):
 *  - 店铺创建表单 (modal + 验证)
 *  - 编辑 / 删除 动作实现与确认对话
 *  - 集成代码生成 (复制/预览)
 *  - 统计侧边信息/徽章刷新策略
 */
(function(){
  'use strict';
  if (window.MobileShopsAdapter) return; // 幂等

  const STATE = { inited:false, lastRenderTs:0 };
  const LOG_PREFIX = '[MobileShopsAdapter]';
  function log(){ try { console.log(LOG_PREFIX, ...arguments); } catch(_){} }
  function warn(){ try { console.warn(LOG_PREFIX, ...arguments); } catch(_){} }

  function isMobile(){
    if (!window.MobileBootstrap || !MobileBootstrap.isMobile) return false;
    try { return MobileBootstrap.isMobile(); } catch(_) { return false; }
  }

  function getContainer(){
    let el = document.querySelector('#shopsListView');
    if (!el){
      el = document.createElement('div');
      el.id = 'shopsListView';
      el.className = 'mobile-section auto-created';
      document.body.appendChild(el);
    }
    return el;
  }

  function ensureHeader(container){
    if (container.querySelector('.shops-mobile-header')) return;
    const header = document.createElement('div');
    header.className = 'shops-mobile-header';
    header.innerHTML = [
      '<div class="shops-mobile-header-left">',
        '<h2 class="shops-mobile-title">店铺列表</h2>',
      '</div>',
      '<div class="shops-mobile-header-actions">',
        '<button class="btn btn-primary btn-create-shop" type="button">新建店铺</button>',
      '</div>'
    ].join('');
    container.prepend(header);
    // 仅占位：后续绑定创建逻辑
    header.querySelector('.btn-create-shop').addEventListener('click', ()=>{
      if (window.MobileShopsCRUD && typeof window.MobileShopsCRUD.openCreateShopModal === 'function'){
        return window.MobileShopsCRUD.openCreateShopModal();
      }
      warn('CRUD 模块未加载，使用占位提示');
      if (window.Feedback){ try { Feedback.show('创建功能模块尚未加载', 'warn'); } catch(_){} }
    });
  }

  async function loadAndRender(){
    const container = getContainer();
    ensureHeader(container);
    const listHostId = 'shops-mobile-list-host';
    let listHost = container.querySelector('#'+listHostId);
    if (!listHost){
      listHost = document.createElement('div');
      listHost.id = listHostId;
      listHost.className = 'shops-mobile-list';
      container.appendChild(listHost);
    }
    // 状态视图宿主: 使用 listHost
    if (window.StatusView){ try { StatusView.clear(listHost); } catch(_){} }

    // 数据来源策略: 优先 ShopsManager, 其次 messageModule.showShops() 回退，再兜底 fetch
    let shops = [];
    try {
      if (window.messageModule && window.messageModule.shopsManager){
        if (!window.messageModule.shops || window.messageModule.shops.length === 0){
          // 触发加载 (showShops 会内部调用 shopsManager.loadAndShowShops)
          if (window.StatusView) StatusView.loading(listHost, '加载店铺...');
          await window.messageModule.showShops();
        }
        shops = (window.messageModule.shops || []).slice();
      } else if (window.ShopsManager){
        if (!window.__mobileShopsManagerInstance){
          window.__mobileShopsManagerInstance = new window.ShopsManager({ debug:false });
        }
        if (window.StatusView) StatusView.loading(listHost, '加载店铺...');
        shops = await window.__mobileShopsManagerInstance.loadAndShowShops();
      } else {
        // 直接网络 fallback
        if (window.StatusView) StatusView.loading(listHost, '加载店铺...');
        const authFetch = (window.AuthHelper && window.AuthHelper.authorizedFetch) ? window.AuthHelper.authorizedFetch : fetch;
        const resp = await authFetch('/api/shops');
        const json = await (resp.json ? resp.json(): Promise.resolve([]));
        shops = Array.isArray(json) ? json : (json.data||[]);
      }
    } catch(e){
      warn('加载店铺失败', e);
      if (window.StatusView){ StatusView.error(listHost, '店铺加载失败', { retry: loadAndRender }); }
      return;
    }

    if (!shops || shops.length === 0){
      if (window.StatusView){ StatusView.empty(listHost, '暂无店铺'); }
      else listHost.innerHTML = '<div class="empty">暂无店铺</div>';
      return;
    }

    // 渲染列表 (不复制已存在的 UI 组件逻辑, 仅最小结构; 后续可替换为 ShopCardUI)
    const frag = document.createDocumentFragment();
    shops.forEach(shop => {
      const card = document.createElement('div');
      card.className = 'shop-mobile-item';
      card.setAttribute('data-shop-id', shop.id);
      card.innerHTML = [
        '<div class="shop-line">',
          '<div class="shop-name">'+escapeHtml(shop.name||('店铺'+shop.id))+'</div>',
          '<div class="shop-meta">'+(shop.domain||'未设置域名')+'</div>',
        '</div>',
        '<div class="shop-actions">',
          '<button class="act-btn act-enter" type="button">进入</button>',
          '<button class="act-btn act-edit" type="button" disabled title="待实现">编辑</button>',
          '<button class="act-btn act-del" type="button" disabled title="待实现">删除</button>',
        '</div>'
      ].join('');
      // 进入动作: 复用 messageModule.selectShop，确保会话列表/消息模块一致
      card.querySelector('.act-enter').addEventListener('click', async ()=>{
        try {
          if (window.messageModule && typeof window.messageModule.selectShop === 'function'){
            await window.messageModule.selectShop(shop);
            // 切换到底部导航 messages tab (若存在)
            const navItem = document.querySelector('.bottom-nav .nav-item[data-page="messages"]');
            if (navItem) navItem.click();
          } else {
            warn('messageModule 不存在或未初始化, 进入店铺仅高亮');
            card.classList.add('active');
          }
        } catch(err){
          warn('进入店铺失败', err);
          if (window.Feedback) Feedback.show('进入店铺失败', 'error');
        }
      });
      frag.appendChild(card);
    });
    listHost.innerHTML = '';
    listHost.appendChild(frag);
    STATE.lastRenderTs = Date.now();
  }

  function escapeHtml(str){
    return String(str).replace(/[&<>"]+/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[s]||s));
  }

  function init(){
    if (STATE.inited){ log('已初始化，跳过'); return; }
    if (!isMobile()){ log('检测为非移动端，跳过 shops adapter'); return; }
    STATE.inited = true;
    log('初始化移动端店铺适配器');
    // 立即加载 (允许稍后 retry)
    loadAndRender();
    document.addEventListener('pageChange', (e)=>{
      if (e.detail && e.detail.page === 'shops'){ // 重新进入可考虑刷新
        // 简单节流: 距上次渲染 > 30s 自动刷新
        if (Date.now() - STATE.lastRenderTs > 30000){ loadAndRender(); }
      }
    });
  }

  // 事件驱动: 等待 mobile bootstrap 就绪; 若已就绪或未加载则尝试延迟
  document.addEventListener('mobile:bootstrap:ready', init);
  // 兜底: DOMContentLoaded 后尝试 (避免错过事件)
  if (document.readyState === 'complete' || document.readyState === 'interactive'){
    setTimeout(init, 50);
  } else {
    document.addEventListener('DOMContentLoaded', ()=> setTimeout(init, 50));
  }

  window.MobileShopsAdapter = { init, reload: loadAndRender };
  log('模块定义完成');
})();
