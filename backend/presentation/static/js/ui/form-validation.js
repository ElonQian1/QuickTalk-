/*
 * UI: 表单验证反馈 (form-validation.js)
 * - 提供字段级错误提示、表单整体验证状态样式
 * - showError/clearError/showSuccess/clearSuccess
 */
(function(){
  'use strict';

  var STYLE_ID = 'qt-form-validation-style';

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.form-field.has-error input, .form-field.has-error textarea, .form-field.has-error select{border-color:#ff4757!important;}',
      '.form-field.has-success input, .form-field.has-success textarea, .form-field.has-success select{border-color:#26de81!important;}',
      '.form-error-msg{color:#ff4757;font-size:12px;margin-top:4px;display:none;}',
      '.form-field.has-error .form-error-msg{display:block;}',
      '.form-success-msg{color:#26de81;font-size:12px;margin-top:4px;display:none;}',
      '.form-field.has-success .form-success-msg{display:block;}',
      '.form-field{position:relative;margin-bottom:16px;}'
    ].join('');
    document.head.appendChild(style);
  }

  function getField(input){
    if (!input) return null;
    return input.closest('.form-field') || input.closest('.form-group');
  }

  function showError(input, message){
    injectStyle();
    var field = getField(input);
    if (!field) return;
    field.classList.remove('has-success');
    field.classList.add('has-error');
    var errorMsg = field.querySelector('.form-error-msg');
    if (!errorMsg){
      errorMsg = document.createElement('div');
      errorMsg.className = 'form-error-msg';
      field.appendChild(errorMsg);
    }
    errorMsg.textContent = message || '输入有误';
  }

  function clearError(input){
    var field = getField(input);
    if (!field) return;
    field.classList.remove('has-error');
    var errorMsg = field.querySelector('.form-error-msg');
    if (errorMsg) errorMsg.textContent = '';
  }

  function showSuccess(input, message){
    injectStyle();
    var field = getField(input);
    if (!field) return;
    field.classList.remove('has-error');
    field.classList.add('has-success');
    if (message){
      var successMsg = field.querySelector('.form-success-msg');
      if (!successMsg){
        successMsg = document.createElement('div');
        successMsg.className = 'form-success-msg';
        field.appendChild(successMsg);
      }
      successMsg.textContent = message;
    }
  }

  function clearSuccess(input){
    var field = getField(input);
    if (!field) return;
    field.classList.remove('has-success');
    var successMsg = field.querySelector('.form-success-msg');
    if (successMsg) successMsg.textContent = '';
  }

  function clearAll(formOrInput){
    var fields = [];
    if (formOrInput.tagName === 'FORM'){
      fields = Array.from(formOrInput.querySelectorAll('.form-field, .form-group'));
    } else {
      var field = getField(formOrInput);
      if (field) fields = [field];
    }
    fields.forEach(function(f){
      f.classList.remove('has-error', 'has-success');
      var msgs = f.querySelectorAll('.form-error-msg, .form-success-msg');
      msgs.forEach(function(m){ m.textContent = ''; });
    });
  }

  window.FormValidationUI = {
    showError: showError,
    clearError: clearError,
    showSuccess: showSuccess,
    clearSuccess: clearSuccess,
    clearAll: clearAll
  };
  console.log('✅ form-validation UI 已加载');
})();
