/**
 * layout-toggle.js
 * 聊天/列表布局模式切换：horizontal(默认) | vertical
 * 存储键：qt.layout.mode
 */
(function(){
  const STORAGE_KEY='qt.layout.mode';
  const DEFAULT_MODE='horizontal';
  if (window.LayoutToggle) return;
  function apply(mode){
    const body=document.body; if(!body) return;
    body.classList.remove('layout-horizontal','layout-vertical');
    body.classList.add('layout-'+(mode||DEFAULT_MODE));
  }
  function load(){ try { return localStorage.getItem(STORAGE_KEY)||DEFAULT_MODE; } catch(_){ return DEFAULT_MODE;} }
  function save(mode){ try { localStorage.setItem(STORAGE_KEY, mode); } catch(_){ } }
  function createButton(){
    const btn=document.createElement('button');
    btn.id='layoutModeToggle';
    btn.className='layout-toggle-btn';
    btn.type='button';
    btn.title='切换布局';
    btn.innerHTML='<span class="icon">🗂️</span><span class="label">布局</span>';
    btn.addEventListener('click', ()=>{
      const current = load();
      const next = current === 'horizontal' ? 'vertical' : 'horizontal';
      save(next); apply(next);
    });
    return btn;
  }
  function mount(){
    const container = document.querySelector('.top-bar, .toolbar, header') || document.body;
    if (!container) return;
    if (document.getElementById('layoutModeToggle')) return;
    container.appendChild(createButton());
  }
  document.addEventListener('DOMContentLoaded', ()=>{ apply(load()); mount(); });
  window.LayoutToggle={ apply, load, save };
})();
