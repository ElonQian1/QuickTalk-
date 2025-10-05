/**
 * CustomerNumbering - 客户编号统一策略 (骨架)
 * 需求来源: message-module / conversationsManager 内多处临时字符串生成造成不一致。
 * 目标:
 *   1. 为不同来源的 customer_id 生成稳定、可读、长度受控的展示编号
 *   2. 支持前缀/填充/自定义策略注入
 *   3. 可缓存 (内存) 避免重复计算
 * 非运行阶段: 仅接口结构 & 不变式校验。
 */
(function(){
  'use strict';
  // 该文件已被统一实现 (utils/customer-numbering.js) 取代。
  // 保留一个极薄包装以兼容早期引用顺序，并在控制台给出提示，全部 API 直接委托。
  if (window.CustomerNumbering && window.CustomerNumbering.__enhanced){
    console.log('ℹ️ features/customer-numbering.js: 已检测到增强版 CustomerNumbering, 无需包装');
    return;
  }
  function deferAccess(){
    if (!window.CustomerNumbering || !window.CustomerNumbering.generateCustomerNumber){
      console.warn('CustomerNumbering 增强版尚未加载，调用被延迟');
      return null;
    }
    return window.CustomerNumbering;
  }
  const wrapper = {
    init: (o)=> { const core=deferAccess(); return core? core.init(o) : wrapper; },
    generateCustomerNumber: (id)=> { const core=deferAccess(); return core? core.generateCustomerNumber(id):'客户???'; },
    // 兼容别名
    generate: (id)=> wrapper.generateCustomerNumber(id),
    getCustomerNumber: (id)=> { const core=deferAccess(); return core? (core.getCustomerNumber?core.getCustomerNumber(id):core.get(id)) : null; }
  };
  if (!window.CustomerNumbering) window.CustomerNumbering = wrapper; // 若稍后增强版加载，会覆盖并保留 API
  console.log('⚠️ (Deprecated) features/customer-numbering.js 已加载，等待增强版接管');
})();
