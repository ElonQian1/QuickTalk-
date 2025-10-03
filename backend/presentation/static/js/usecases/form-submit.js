/*
 * 表单提交用例 (form-submit.js)
 * - 封装表单提交流程：验证 → loading → 请求 → 成功/失败反馈
 * - 提供 submit 接口
 */
(function(){
  'use strict';
  // 薄代理：统一委托到 UnifiedForms
  function callUF(name, args){
    try { if (window.UnifiedForms && typeof window.UnifiedForms[name] === 'function') { return window.UnifiedForms[name].apply(null, args||[]); } }
    catch(e){ console.warn('form-submit proxy error:', name, e); }
  }
  function bindSubmit(form, options){ if (!form) return; form.addEventListener('submit', function(e){ e.preventDefault(); callUF('submit', [form, options]); }); }
  window.FormSubmit = { submit: function(form, options){ return callUF('submit', [form, options]); }, bindSubmit: bindSubmit };
  console.log('✅ form-submit 用例已加载（→ UnifiedForms 代理）');
})();
