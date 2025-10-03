/*
 * 表单验证用例 (form-validation.js)
 * - 常见验证规则：必填、邮箱、URL、手机号、长度限制
 * - 提供 validate 接口，返回验证结果 { valid, errors }
 */
(function(){
  'use strict';

  var RULES = {
    required: function(value, message){ 
      return (value && String(value).trim()) ? null : (message || '此字段为必填项');
    },
    email: function(value, message){
      if (!value || !String(value).trim()) return null; // 可选时不验证
      var re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return re.test(value) ? null : (message || '请输入有效的邮箱地址');
    },
    url: function(value, message){
      if (!value || !String(value).trim()) return null;
      try { new URL(value); return null; } catch(e){ return message || '请输入有效的 URL'; }
    },
    phone: function(value, message){
      if (!value || !String(value).trim()) return null;
      var re = /^1[3-9]\d{9}$/;
      return re.test(value) ? null : (message || '请输入有效的手机号');
    },
    minLength: function(value, min, message){
      if (!value || !String(value).trim()) return null;
      return String(value).length >= min ? null : (message || '至少需要 ' + min + ' 个字符');
    },
    maxLength: function(value, max, message){
      if (!value) return null;
      return String(value).length <= max ? null : (message || '最多允许 ' + max + ' 个字符');
    },
    pattern: function(value, regex, message){
      if (!value || !String(value).trim()) return null;
      return regex.test(value) ? null : (message || '格式不正确');
    },
    equals: function(value, target, message){
      return value === target ? null : (message || '两次输入不一致');
    }
  };

  function validateField(input, rules){
    if (!input || !rules) return null;
    var value = input.value;
    for (var i = 0; i < rules.length; i++){
      var rule = rules[i];
      var error = null;
      if (rule.type === 'required') {
        error = RULES.required(value, rule.message);
      } else if (rule.type === 'email') {
        error = RULES.email(value, rule.message);
      } else if (rule.type === 'url') {
        error = RULES.url(value, rule.message);
      } else if (rule.type === 'phone') {
        error = RULES.phone(value, rule.message);
      } else if (rule.type === 'minLength') {
        error = RULES.minLength(value, rule.min, rule.message);
      } else if (rule.type === 'maxLength') {
        error = RULES.maxLength(value, rule.max, rule.message);
      } else if (rule.type === 'pattern') {
        error = RULES.pattern(value, rule.regex, rule.message);
      } else if (rule.type === 'equals') {
        var targetInput = document.getElementById(rule.target);
        var targetValue = targetInput ? targetInput.value : rule.value;
        error = RULES.equals(value, targetValue, rule.message);
      } else if (rule.type === 'custom' && typeof rule.validator === 'function') {
        error = rule.validator(value);
      }
      if (error) return error;
    }
    return null;
  }

  function validate(form, schema){
    // schema: { fieldId: [{ type, message, ... }], ... }
    var errors = {};
    var valid = true;
    for (var fieldId in schema){
      var input = form.querySelector('#' + fieldId) || form.querySelector('[name="' + fieldId + '"]');
      if (!input) continue;
      var error = validateField(input, schema[fieldId]);
      if (error){
        errors[fieldId] = error;
        valid = false;
        if (window.FormValidationUI && typeof window.FormValidationUI.showError === 'function') {
          window.FormValidationUI.showError(input, error);
        }
      } else {
        if (window.FormValidationUI && typeof window.FormValidationUI.clearError === 'function') {
          window.FormValidationUI.clearError(input);
        }
      }
    }
    return { valid: valid, errors: errors };
  }

  function bindLiveValidation(form, schema){
    // 实时验证：blur 时触发
    for (var fieldId in schema){
      var input = form.querySelector('#' + fieldId) || form.querySelector('[name="' + fieldId + '"]');
      if (!input) continue;
      (function(inp, rules){
        inp.addEventListener('blur', function(){
          var error = validateField(inp, rules);
          if (error && window.FormValidationUI) {
            window.FormValidationUI.showError(inp, error);
          } else if (window.FormValidationUI) {
            window.FormValidationUI.clearError(inp);
          }
        });
      })(input, schema[fieldId]);
    }
  }

  window.FormValidation = {
    validate: validate,
    validateField: validateField,
    bindLiveValidation: bindLiveValidation
  };
  console.log('✅ form-validation 用例已加载');
})();
