/*
 * 表单验证用例 (form-validation.js)
 * - 常见验证规则：必填、邮箱、URL、手机号、长度限制
 * - 提供 validate 接口，返回验证结果 { valid, errors }
 */
(function(){
  'use strict';
  // 薄代理：统一委托到 UnifiedForms，避免重复实现
  function callUF(name, args){
    try { if (window.UnifiedForms && typeof window.UnifiedForms[name] === 'function') { return window.UnifiedForms[name].apply(null, args||[]); } }
    catch(e){ console.warn('form-validation proxy error:', name, e); }
  }
  window.FormValidation = {
    validate: function(form, schema){ return callUF('validate', [form, schema]); },
    validateField: function(input, rules){ return callUF('validateField', [input, rules]); },
    bindLiveValidation: function(form, schema){ return callUF('bindLiveValidation', [form, schema]); }
  };
  console.log('✅ form-validation 用例已加载（→ UnifiedForms 代理）');
})();
