/**
 * (Deprecated Wrapper) 原 root 层 customer-numbering.js 已被
 * utils/customer-numbering.js 统一实现取代。
 * 此文件保留以避免旧引用报错，并将所有调用委托给增强版。
 */
(function(){
  if (window.CustomerNumbering && window.CustomerNumbering.__enhanced){
    console.log('ℹ️ customer-numbering.js(wrapper): 已检测到增强版, 直接复用');
    return;
  }
  function core(){ return window.CustomerNumbering; }
  const wrapper = {
    generateCustomerNumber: (id)=> core()?.generateCustomerNumber? core().generateCustomerNumber(id):'客户???',
    generate: (id)=> core()?.generate? core().generate(id):'客户???',
    getCustomerNumber: (id)=> core()?.getCustomerNumber? core().getCustomerNumber(id): core()?.get? core().get(id):null,
    getAllCustomerNumbers: ()=> core()?.getAllCustomerNumbers? core().getAllCustomerNumbers(): core()?.all? core().all():{},
    getCustomerCount: ()=> core()?.getCustomerCount? core().getCustomerCount(): core()?.count? core().count():0,
    getTotalVisitorCount: ()=> core()?.getTotalVisitorCount? core().getTotalVisitorCount(): core()?.total? core().total():0,
    clearAllCustomerNumbers: ()=> core()?.clearAllCustomerNumbers? core().clearAllCustomerNumbers(): core()?.clearAll? core().clearAll():undefined,
    __deprecated: true
  };
  if (!window.CustomerNumbering) window.CustomerNumbering = wrapper;
  window.generateCustomerNumber = function(id){ return window.CustomerNumbering.generateCustomerNumber(id); };
  console.warn('⚠️ 使用已弃用的 customer-numbering.js wrapper, 请确保引用 utils/customer-numbering.js');
})();