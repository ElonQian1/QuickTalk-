/**
 * @deprecated Duplicate UIStates implementation removed.
 * 该文件曾包含一份 UI 状态骨架实现，现在项目已统一使用 `utils/ui-states.js` 版本。
 * 保留本文件仅做向后兼容：如果 utils 版已注册，则直接退出；若未加载则动态加载兜底简化版本。
 * 后续可安全删除本文件（确认无外部直接 script 引用后）。
 */
(function(){
  'use strict';
  if (window.UIStates) {
    console.log('[ui-states(usecases)] 已存在全局 UIStates, 跳过重复注册');
    return;
  }
  // 兜底最小占位，提示开发者加载顺序问题
  window.UIStates = {
    showLoading(c){ if (c) c.innerHTML = '<div style="padding:24px;text-align:center;color:#666;">加载中...</div>'; },
    showEmpty(c){ if (c) c.innerHTML = '<div style="padding:32px;text-align:center;color:#888;">暂无数据</div>'; },
    showError(c){ if (c) c.innerHTML = '<div style="padding:32px;text-align:center;color:#c00;">加载失败</div>'; },
    clear(c){ if (c) c.innerHTML=''; },
    show(type,c,opt){ if(!c) return; if(type==='loading') return this.showLoading(c,opt&&opt.text); if(type==='empty') return this.showEmpty(c,opt&&opt.text); if(type==='error') return this.showError(c,opt&&opt.text); }
  };
  console.warn('[ui-states(usecases)] 使用兜底 UIStates，占位实现已注入，建议确保 utils/ui-states.js 先加载');
})();
