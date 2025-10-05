/**
 * mobile/shops-mobile-crud.js
 * 移动端店铺管理 CRUD - 第一步: 仅实现“创建店铺”最小可用流程
 * 目标:
 *  1. 提供可复用的 openCreateShopModal() API
 *  2. 基础字段: name(必填), domain(可选), description(可选)
 *  3. 使用 AuthHelper.authorizedFetch / Feedback.show / StatusView 统一交互
 *  4. 成功后触发事件: shop:created -> 由 shops-mobile-adapter 监听刷新
 *  5. Modal 幂等: 多次创建不重复插入 DOM; ESC/遮罩点击关闭
 *  6. 不引入任何框架; 纯原生; 保持 < 300 行
 *
 * 后续增量(不在本提交): 编辑/删除/状态切换/集成代码生成
 */
(function(){
  'use strict';
  if (window.MobileShopsCRUD) return;

  const MODAL_ID = 'mobile-create-shop-modal';
  const EVT_CREATED = 'shop:created';

  function log(){ try { console.log('[MobileShopsCRUD]', ...arguments); } catch(_){} }
  function warn(){ try { console.warn('[MobileShopsCRUD]', ...arguments); } catch(_){} }

  function ensureStyles(){
    if (document.getElementById('mobile-shops-crud-styles')) return;
    const style = document.createElement('style');
    style.id = 'mobile-shops-crud-styles';
    style.textContent = `
      .mobile-modal-mask{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:900;display:flex;align-items:center;justify-content:center;}
      .mobile-modal{width:92%;max-width:440px;background:#fff;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.15);padding:16px 18px 20px;animation:fadeIn .18s ease;display:flex;flex-direction:column;}
      .mobile-modal h3{margin:0 0 12px;font-size:18px;}
      .mobile-modal form{display:flex;flex-direction:column;gap:10px;}
      .mobile-modal label{font-size:13px;color:#555;display:flex;flex-direction:column;gap:4px;}
      .mobile-modal input, .mobile-modal textarea{border:1px solid #ccc;border-radius:6px;padding:8px 10px;font-size:14px;}
      .mobile-modal textarea{resize:vertical;min-height:64px;}
      .mobile-modal .actions{display:flex;gap:10px;margin-top:8px;}
      .mobile-modal button{flex:1;height:38px;border:none;border-radius:6px;font-size:14px;cursor:pointer;}
      .mobile-modal button.primary{background:#2563eb;color:#fff;}
      .mobile-modal button.secondary{background:#f1f2f4;}
      .mobile-modal .error-msg{color:#d93025;font-size:12px;display:none;margin-top:-4px;}
      .mobile-modal .field.invalid input{border-color:#d93025;}
      @media (prefers-color-scheme:dark){.mobile-modal{background:#1e1f22;color:#e2e2e3;} .mobile-modal input,.mobile-modal textarea{background:#2a2b2f;color:#e2e2e3;border-color:#444;}}
      @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    `;
    document.head.appendChild(style);
  }

  function buildModal(){
    ensureStyles();
    let mask = document.getElementById(MODAL_ID);
    if (mask) return mask; // 幂等复用
    mask = document.createElement('div');
    mask.id = MODAL_ID;
    mask.className = 'mobile-modal-mask';
    mask.innerHTML = `
      <div class="mobile-modal" role="dialog" aria-modal="true" aria-labelledby="createShopTitle">
        <h3 id="createShopTitle">新建店铺</h3>
        <form novalidate>
          <label>店铺名称 *
            <input name="name" maxlength="40" autocomplete="off" placeholder="不超过40字符" required />
            <div class="error-msg">请输入店铺名称</div>
          </label>
          <label>域名 (可选)
            <input name="domain" maxlength="60" autocomplete="off" placeholder="例如: example.com" />
            <div class="error-msg"></div>
          </label>
          <label>描述 (可选)
            <textarea name="description" maxlength="200" placeholder="用于内部备注, 最多200字"></textarea>
            <div class="error-msg"></div>
          </label>
          <div class="actions">
            <button type="button" class="secondary btn-cancel">取消</button>
            <button type="submit" class="primary btn-submit">创建</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(mask);

    // 事件绑定
    const form = mask.querySelector('form');
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const btn = form.querySelector('.btn-submit');
      if (btn.disabled) return;
      const data = formToData(form);
      if (!validate(form, data)) return;
      btn.disabled = true; btn.textContent = '创建中...';
      try {
        const created = await createShop(data);
        close();
        if (window.Feedback) Feedback.show('店铺创建成功', 'success');
        document.dispatchEvent(new CustomEvent(EVT_CREATED, { detail:{ shop: created }}));
      } catch(err){
        warn('创建失败', err);
        if (window.Feedback) Feedback.show(err.message || '创建失败', 'error');
        btn.disabled = false; btn.textContent = '创建';
      }
    });
    mask.querySelector('.btn-cancel').addEventListener('click', ()=> close());
    mask.addEventListener('click', (e)=>{ if (e.target === mask) close(); });
    window.addEventListener('keydown', escClose);

    function escClose(ev){ if (ev.key === 'Escape'){ close(); } }
    function close(){
      window.removeEventListener('keydown', escClose);
      if (mask && mask.parentNode){ mask.parentNode.removeChild(mask); }
    }

    return mask;
  }

  function formToData(form){
    const fd = new FormData(form);
    return {
      name: (fd.get('name')||'').trim(),
      domain: (fd.get('domain')||'').trim(),
      description: (fd.get('description')||'').trim()
    };
  }

  function validate(form, data){
    let ok = true;
    const nameField = form.querySelector('input[name="name"]').closest('label');
    if (!data.name){
      nameField.classList.add('invalid');
      nameField.querySelector('.error-msg').style.display='block';
      ok = false;
    } else {
      nameField.classList.remove('invalid');
      nameField.querySelector('.error-msg').style.display='none';
    }
    return ok;
  }

  async function createShop(payload){
    const fetcher = (window.AuthHelper && window.AuthHelper.authorizedFetch) ? window.AuthHelper.authorizedFetch : fetch;
    const resp = await fetcher('/api/shops', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });
    let json = {};
    try { json = await resp.json(); } catch(_){}
    if (!resp.ok){
      const msg = json.message || json.error || ('HTTP '+resp.status);
      throw new Error(msg);
    }
    return json.data || json || payload;
  }

  function openCreateShopModal(){
    const mask = buildModal();
    // 重置表单
    const form = mask.querySelector('form');
    form.reset();
    mask.style.display='flex';
    setTimeout(()=>{ const first = form.querySelector('input[name="name"]'); if (first) first.focus(); }, 30);
  }

  // 事件桥: 被 adapter 监听刷新
  document.addEventListener(EVT_CREATED, ()=>{
    if (window.MobileShopsAdapter && typeof window.MobileShopsAdapter.reload === 'function'){
      setTimeout(()=> window.MobileShopsAdapter.reload(), 80);
    }
  });

  window.MobileShopsCRUD = { openCreateShopModal };
  log('CRUD 模块加载完成 (创建店铺)');
})();
