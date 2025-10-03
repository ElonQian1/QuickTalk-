/*
 * 表单提交用例 (form-submit.js)
 * - 封装表单提交流程：验证 → loading → 请求 → 成功/失败反馈
 * - 提供 submit 接口
 */
(function(){
  'use strict';

  async function submit(form, options){
    // options: { schema, url, method, onSuccess, onError, loadingText, successText, errorText }
    options = options || {};
    var schema = options.schema || {};
    
    // 1. 清空之前的反馈
    if (window.FormFeedbackUI && typeof window.FormFeedbackUI.hide === 'function') {
      window.FormFeedbackUI.hide(form);
    }
    if (window.FormValidationUI && typeof window.FormValidationUI.clearAll === 'function') {
      window.FormValidationUI.clearAll(form);
    }
    
    // 2. 验证
    if (schema && Object.keys(schema).length > 0 && window.FormValidation) {
      var result = window.FormValidation.validate(form, schema);
      if (!result.valid) {
        if (window.showToast) window.showToast('请检查输入内容', 'error');
        return { success: false, errors: result.errors };
      }
    }
    
    // 3. 显示 loading
    if (window.FormFeedbackUI && typeof window.FormFeedbackUI.showLoading === 'function') {
      window.FormFeedbackUI.showLoading(form, options.loadingText || '提交中...');
    }
    
    // 4. 收集表单数据
    var formData = new FormData(form);
    var data = {};
    formData.forEach(function(value, key){ data[key] = value; });
    
    // 5. 发送请求
    try {
      var url = options.url || form.action;
      var method = (options.method || form.method || 'POST').toUpperCase();
      var response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      var json = await response.json();
      
      if (response.ok && json.success !== false) {
        // 成功
        if (window.FormFeedbackUI && typeof window.FormFeedbackUI.showSuccess === 'function') {
          window.FormFeedbackUI.showSuccess(form, options.successText || json.message || '提交成功');
        }
        if (window.showToast) window.showToast(options.successText || json.message || '提交成功', 'success');
        if (typeof options.onSuccess === 'function') {
          options.onSuccess(json);
        }
        return { success: true, data: json };
      } else {
        // 失败
        var errorMsg = options.errorText || json.message || json.error || '提交失败';
        if (window.FormFeedbackUI && typeof window.FormFeedbackUI.showError === 'function') {
          window.FormFeedbackUI.showError(form, errorMsg);
        }
        if (window.showToast) window.showToast(errorMsg, 'error');
        if (typeof options.onError === 'function') {
          options.onError(json);
        }
        return { success: false, error: errorMsg, data: json };
      }
    } catch(err) {
      // 网络错误
      var errorMsg = options.errorText || '网络错误，请稍后重试';
      if (window.FormFeedbackUI && typeof window.FormFeedbackUI.showError === 'function') {
        window.FormFeedbackUI.showError(form, errorMsg);
      }
      if (window.showToast) window.showToast(errorMsg, 'error');
      if (typeof options.onError === 'function') {
        options.onError(err);
      }
      return { success: false, error: errorMsg };
    }
  }

  function bindSubmit(form, options){
    // 绑定表单提交事件
    if (!form) return;
    form.addEventListener('submit', function(e){
      e.preventDefault();
      submit(form, options);
    });
  }

  window.FormSubmit = {
    submit: submit,
    bindSubmit: bindSubmit
  };
  console.log('✅ form-submit 用例已加载');
})();
