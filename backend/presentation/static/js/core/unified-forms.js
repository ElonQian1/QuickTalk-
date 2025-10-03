(function(){
  'use strict';

  // 统一表单校验规则（复用 usecase 版的规则定义思想）
  const Rules = {
    required(value, message){ return (value && String(value).trim()) ? null : (message || '此字段为必填项'); },
    email(value, message){ if (!value || !String(value).trim()) return null; const re=/^[^\s@]+@[^\s@]+\.[^\s@]+$/; return re.test(value)?null:(message||'请输入有效的邮箱地址'); },
    url(value, message){ if (!value || !String(value).trim()) return null; try{ new URL(value); return null;}catch(_){ return message||'请输入有效的 URL'; } },
    phone(value, message){ if (!value || !String(value).trim()) return null; const re=/^1[3-9]\d{9}$/; return re.test(value)?null:(message||'请输入有效的手机号'); },
    minLength(value, min, message){ if (!value || !String(value).trim()) return null; return String(value).length >= min ? null : (message || `至少需要 ${min} 个字符`); },
    maxLength(value, max, message){ if (!value) return null; return String(value).length <= max ? null : (message || `最多允许 ${max} 个字符`); },
    pattern(value, regex, message){ if (!value || !String(value).trim()) return null; return regex.test(value) ? null : (message || '格式不正确'); },
    equals(value, target, message){ return value === target ? null : (message || '两次输入不一致'); }
  };

  function getInput(form, fieldId){
    return form.querySelector('#' + fieldId) || form.querySelector('[name="' + fieldId + '"]');
  }

  function validateField(input, rules){
    if (!input || !rules) return null;
    const value = input.value;
    for (let i=0;i<rules.length;i++){
      const r = rules[i]; let err=null;
      switch(r.type){
        case 'required': err = Rules.required(value, r.message); break;
        case 'email': err = Rules.email(value, r.message); break;
        case 'url': err = Rules.url(value, r.message); break;
        case 'phone': err = Rules.phone(value, r.message); break;
        case 'minLength': err = Rules.minLength(value, r.min, r.message); break;
        case 'maxLength': err = Rules.maxLength(value, r.max, r.message); break;
        case 'pattern': err = Rules.pattern(value, r.regex, r.message); break;
        case 'equals': {
          const targetInput = r.target ? document.getElementById(r.target) : null;
          const targetValue = targetInput ? targetInput.value : r.value;
          err = Rules.equals(value, targetValue, r.message); break;
        }
        case 'custom': if (typeof r.validator === 'function'){ err = r.validator(value); } break;
      }
      if (err) return err;
    }
    return null;
  }

  function clearAllUI(form){
    if (window.FormValidationUI && typeof window.FormValidationUI.clearAll === 'function') {
      window.FormValidationUI.clearAll(form);
    }
  }

  function showFieldError(input, error){
    if (window.FormValidationUI && typeof window.FormValidationUI.showError === 'function') {
      window.FormValidationUI.showError(input, error);
    }
  }

  function clearFieldError(input){
    if (window.FormValidationUI && typeof window.FormValidationUI.clearError === 'function') {
      window.FormValidationUI.clearError(input);
    }
  }

  function validate(form, schema){
    const errors = {}; let valid = true;
    for (const fieldId in (schema||{})){
      const input = getInput(form, fieldId); if (!input) continue;
      const error = validateField(input, schema[fieldId]);
      if (error){ errors[fieldId]=error; valid=false; showFieldError(input, error); }
      else { clearFieldError(input); }
    }
    return { valid, errors };
  }

  function bindLiveValidation(form, schema){
    for (const fieldId in (schema||{})){
      const input = getInput(form, fieldId); if (!input) continue;
      (function(inp, rules){
        inp.addEventListener('blur', function(){
          const error = validateField(inp, rules);
          if (error) showFieldError(inp, error); else clearFieldError(inp);
        });
      })(input, schema[fieldId]);
    }
  }

  function showLoading(form, text){ if (window.FormFeedbackUI && typeof window.FormFeedbackUI.showLoading==='function'){ window.FormFeedbackUI.showLoading(form, text||'提交中...'); } }
  function showSuccess(form, text){ if (window.FormFeedbackUI && typeof window.FormFeedbackUI.showSuccess==='function'){ window.FormFeedbackUI.showSuccess(form, text||'提交成功'); } }
  function showError(form, text){ if (window.FormFeedbackUI && typeof window.FormFeedbackUI.showError==='function'){ window.FormFeedbackUI.showError(form, text||'提交失败，请重试'); } }
  function hideFeedback(form){ if (window.FormFeedbackUI && typeof window.FormFeedbackUI.hide==='function'){ window.FormFeedbackUI.hide(form); } }

  async function submit(form, options){
    options = options || {}; const schema = options.schema || {};
    hideFeedback(form); clearAllUI(form);
    if (schema && Object.keys(schema).length>0){
      const result = validate(form, schema);
      if (!result.valid){ if (window.showToast) window.showToast('请检查输入内容', 'error'); return { success:false, errors: result.errors }; }
    }
    showLoading(form, options.loadingText);
    const formData = new FormData(form); const data = {}; formData.forEach((v,k)=>data[k]=v);
    try{
      const url = options.url || form.action; const method = (options.method || form.method || 'POST').toUpperCase();
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const json = await res.json().catch(()=>({}));
      if (res.ok && json.success !== false){ showSuccess(form, options.successText || json.message); if (window.showToast) window.showToast(options.successText || json.message || '提交成功', 'success'); if (typeof options.onSuccess==='function') options.onSuccess(json); return { success:true, data: json }; }
      const errMsg = options.errorText || json.message || json.error || '提交失败'; showError(form, errMsg); if (window.showToast) window.showToast(errMsg, 'error'); if (typeof options.onError==='function') options.onError(json); return { success:false, error: errMsg, data: json };
    }catch(err){ const errMsg = options.errorText || '网络错误，请稍后重试'; showError(form, errMsg); if (window.showToast) window.showToast(errMsg, 'error'); if (typeof options.onError==='function') options.onError(err); return { success:false, error: errMsg }; }
  }

  const UnifiedForms = { validate, validateField, bindLiveValidation, submit };
  window.UnifiedForms = UnifiedForms;
  if (window.ModuleRegistry){ window.ModuleRegistry.register('UnifiedForms', function(){ return UnifiedForms; }, []); }
  if (window.ModuleLoader && window.ModuleLoader.defineClass){ window.ModuleLoader.defineClass('UnifiedForms', function(){ return UnifiedForms; }); }
  console.log('✅ 统一表单模块已加载 (unified-forms.js)');
})();
