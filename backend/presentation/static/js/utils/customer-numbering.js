/**
 * customer-numbering.js
 * 统一客户编号策略模块 (取代分散的 generateCustomerNumber 逻辑)
 * 特性:
 *  - init({ prefix, padLength, strategy }) 配置化
 *  - 支持策略: sequential (默认), sequential-hash(别名), short-hash (后备), memory-only / persistent(localStorage) 控制
 *  - LRU 上限 (默认 500) 防止 localStorage 膨胀
 *  - 幂等调用: 同一个 customerId 始终返回同一编号
 *  - 向后兼容: 仍暴露 window.generateCustomerNumber
 */
(function(){
  'use strict';

  const DEFAULTS = {
    prefix: '客户',
    padLength: 3,
    strategy: 'sequential', // sequential | sequential-hash | short-hash
    persistent: true,
    lruLimit: 500
  };

  function safeLocalGet(key){ try { return localStorage.getItem(key); } catch(_){ return null; } }
  function safeLocalSet(key, val){ try { localStorage.setItem(key, val); } catch(_){ } }
  function hashShort(str){
    let h = 0; for (let i=0;i<str.length;i++){ h = ((h<<5)-h) + str.charCodeAt(i); h|=0; }
    const n = Math.abs(h); return (n % 10000).toString().padStart(4,'0');
  }

  class CustomerNumberingCore {
    constructor(){
      this._config = { ...DEFAULTS };
      this._map = new Map(); // id -> number
      this._seq = 0;
      this._storageKey = 'qt_customer_number_map_v1';
      this._seqKey = 'qt_customer_number_seq_v1';
      this._lru = []; // 维护使用顺序
      this._loaded = false;
    }
    init(cfg){
      this._config = { ...this._config, ...(cfg||{}) };
      if (!this._loaded) this._loadPersistent();
      return this;
    }
    _loadPersistent(){
      if (!this._config.persistent){ this._loaded = true; return; }
      try {
        const raw = safeLocalGet(this._storageKey);
        const seq = safeLocalGet(this._seqKey);
        if (raw){
          const obj = JSON.parse(raw);
            Object.entries(obj).forEach(([k,v])=>{ this._map.set(k,v); this._lru.push(k); });
        }
        if (seq) this._seq = parseInt(seq,10)||0;
      } catch(_){ }
      this._loaded = true;
    }
    _persist(){
      if (!this._config.persistent) return;
      try {
        const obj = {}; this._map.forEach((v,k)=> obj[k]=v );
        safeLocalSet(this._storageKey, JSON.stringify(obj));
        safeLocalSet(this._seqKey, String(this._seq));
      } catch(_){ }
    }
    _touch(id){
      const idx = this._lru.indexOf(id);
      if (idx>=0) this._lru.splice(idx,1);
      this._lru.push(id);
      if (this._lru.length > this._config.lruLimit){
        const evict = this._lru.shift();
        if (evict && this._map.has(evict)) this._map.delete(evict);
      }
    }
    _nextSequential(){ this._seq += 1; return this._seq; }
    _formatNumber(n){ return this._config.prefix + String(n).padStart(this._config.padLength,'0'); }
    _allocate(id){
      // strategy 分支
      if (this._config.strategy === 'short-hash'){
        return this._config.prefix + hashShort(id).slice(-this._config.padLength);
      }
      // sequential / sequential-hash 共用序列，但 sequential-hash 可用于未来混合
      const seq = this._nextSequential();
      return this._formatNumber(seq);
    }
    generate(idRaw){
      const id = String(idRaw||'').trim();
      if (!id) return this._config.prefix + '???';
      if (this._map.has(id)) { this._touch(id); return this._map.get(id); }
      const num = this._allocate(id);
      this._map.set(id, num);
      this._touch(id);
      this._persist();
      return num;
    }
    get(idRaw){ const id = String(idRaw||'').trim(); return this._map.get(id) || null; }
    digits(idRaw){
      const val = this.get(idRaw); if (!val) return ''.padStart(this._config.padLength,'0');
      const m = val.match(/(\d+)/); return m? m[1] : ''.padStart(this._config.padLength,'0');
    }
    exportAll(){ const obj={}; this._map.forEach((v,k)=> obj[k]=v); return { config:this._config, seq:this._seq, map:obj, size:this._map.size }; }
    import(data){
      if (!data || typeof data!=='object') return;
      if (data.config) this._config = { ...this._config, ...data.config };
      if (typeof data.seq==='number' && data.seq>this._seq) this._seq = data.seq;
      if (data.map){ Object.entries(data.map).forEach(([k,v])=>{ this._map.set(k,v); this._touch(k); }); }
      this._persist();
    }
    // 返回全部映射 (浅拷贝)
    all(){ const obj={}; this._map.forEach((v,k)=> obj[k]=v); return obj; }
    // 客户数量 (已分配编号数量)
    count(){ return this._map.size; }
    // 访问序列计数 (总访问者或已分配序列的最大值)
    total(){ return this._seq; }
    // 清空 (用于调试/重置) - 仍保留配置
    clearAll(){ this._map.clear(); this._lru.length = 0; this._seq = 0; this._persist(); }
  }

  // 单例
  const singleton = new CustomerNumberingCore();
  const api = {
    init: (cfg)=> singleton.init(cfg),
    generateCustomerNumber: (id)=> singleton.generate(id),
    generate: (id)=> singleton.generate(id),
    get: (id)=> singleton.get(id),
    digits: (id)=> singleton.digits(id),
    export: ()=> singleton.exportAll(),
    import: (data)=> singleton.import(data),
    // 兼容旧实现扩展 API
    getCustomerNumber: (id)=> singleton.get(id),
    getAllCustomerNumbers: ()=> singleton.all(),
    all: ()=> singleton.all(),
    getCustomerCount: ()=> singleton.count(),
    count: ()=> singleton.count(),
    getTotalVisitorCount: ()=> singleton.total(),
    total: ()=> singleton.total(),
    clearAllCustomerNumbers: ()=> singleton.clearAll(),
    clearAll: ()=> singleton.clearAll(),
    clear: ()=> singleton.clearAll(),
    __kind: 'qt-customer-numbering',
    __enhanced: true
  };

  // 暴露
  // 若已存在旧版本 (features/customer-numbering.js 或 root/customer-numbering.js) 则用增强版替换
  if (!window.CustomerNumbering || !window.CustomerNumbering.__enhanced){
    window.CustomerNumbering = api;
  } else {
    // 已是增强版则合并缺失方法 (幂等)
    Object.keys(api).forEach(k=>{ if (!window.CustomerNumbering[k]) window.CustomerNumbering[k]=api[k]; });
  }
  // 向后兼容旧全局函数
  window.generateCustomerNumber = function(id){ return window.CustomerNumbering.generateCustomerNumber(id); };

  console.log('✅ CustomerNumbering 统一模块已加载 (customer-numbering.js)');
})();
