/*
 * UI: 表单提交反馈 (form-feedback.js)
 * - 统一表单提交时的 loading/success/error 反馈 UI
 * - showLoading/showSuccess/showError/hide
 */
(function(){
  'use strict';

  var STYLE_ID = 'qt-form-feedback-style';

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.form-submit-btn{position:relative;transition:all .2s ease;}',
      '.form-submit-btn.loading{pointer-events:none;opacity:0.6;}',
      '.form-submit-btn.loading::after{content:"";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;}',
      '.form-feedback-msg{margin-top:12px;padding:10px 12px;border-radius:8px;font-size:13px;display:none;}',
      '.form-feedback-msg.success{background:#d4edda;color:#155724;border:1px solid #c3e6cb;display:block;}',
      '.form-feedback-msg.error{background:#f8d7da;color:#721c24;border:1px solid #f5c6cb;display:block;}'
    ].join('');
    document.head.appendChild(style);
  }

  function getSubmitBtn(form){
    return form.querySelector('[type="submit"]') || form.querySelector('.form-submit-btn');
  }

  function getFeedbackMsg(form){
    var msg = form.querySelector('.form-feedback-msg');
    if (!msg){
      msg = document.createElement('div');
      msg.className = 'form-feedback-msg';
      form.appendChild(msg);
    }
    return msg;
  }

  function showLoading(form, text){
    injectStyle();
    var btn = getSubmitBtn(form);
    if (btn){
      btn.classList.add('loading');
      btn.disabled = true;
      if (text) btn.textContent = text;
    }
    var msg = getFeedbackMsg(form);
    msg.className = 'form-feedback-msg';
    msg.style.display = 'none';
  }

  function showSuccess(form, message){
    injectStyle();
    var btn = getSubmitBtn(form);
    if (btn){
      btn.classList.remove('loading');
      btn.disabled = false;
    }
    var msg = getFeedbackMsg(form);
    msg.className = 'form-feedback-msg success';
    msg.textContent = message || '提交成功';
  }

  function showError(form, message){
    injectStyle();
    var btn = getSubmitBtn(form);
    if (btn){
      btn.classList.remove('loading');
      btn.disabled = false;
    }
    var msg = getFeedbackMsg(form);
    msg.className = 'form-feedback-msg error';
    msg.textContent = message || '提交失败，请重试';
  }

  function hide(form){
    var btn = getSubmitBtn(form);
    if (btn){
      btn.classList.remove('loading');
      btn.disabled = false;
    }
    var msg = form.querySelector('.form-feedback-msg');
    if (msg){
      msg.className = 'form-feedback-msg';
      msg.style.display = 'none';
    }
  }

  window.FormFeedbackUI = {
    showLoading: showLoading,
    showSuccess: showSuccess,
    showError: showError,
    hide: hide
  };
  console.log('✅ form-feedback UI 已加载');
})();
