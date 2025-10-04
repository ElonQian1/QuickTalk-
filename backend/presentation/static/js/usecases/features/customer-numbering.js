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
  if (window.CustomerNumbering) return;

  const DEFAULT_OPTIONS = {
    prefix: '客户',      // 显示前缀
    padLength: 4,        // 数字填充长度
    strategy: 'sequential-hash', // 生成策略
    debug: false
  };

  class CustomerNumberingImpl {
    constructor(){
      this._opts = { ...DEFAULT_OPTIONS };
      this._map = new Map(); // rawId -> code
      this._counter = 1;     // 顺序分配基数 (仅某些策略使用)
    }

    init(options={}){
      this._opts = { ...this._opts, ...options };
      return this;
    }

    generateCustomerNumber(rawId){
      if (!rawId) return this._opts.prefix + '???';
      if (this._map.has(rawId)) return this._map.get(rawId);
      const code = this._buildCode(rawId);
      this._map.set(rawId, code);
      return code;
    }

    _buildCode(rawId){
      switch(this._opts.strategy){
        case 'sequential':
          return this._formatNumber(this._counter++);
        case 'hash-short':
          return this._formatHash(rawId, 4);
        case 'sequential-hash':
        default:
          // 保持顺序+短 hash 混合, 避免纯顺序被推测
            const seq = this._formatNumber(this._counter++);
            const h = this._formatHash(rawId, 3);
            return `${this._opts.prefix}${seq}${h}`;
      }
    }

    _formatNumber(n){
      const s = String(n);
      if (s.length >= this._opts.padLength) return `${this._opts.prefix}${s}`;
      return `${this._opts.prefix}${s.padStart(this._opts.padLength,'0')}`;
    }

    _formatHash(raw, len){
      // 简易不可逆短 hash (非安全) - 仅展示
      let h = 0;
      for (let i=0;i<raw.length;i++){ h = (h*31 + raw.charCodeAt(i)) >>> 0; }
      const base = h.toString(36);
      return base.slice(0, len).toUpperCase();
    }
  }

  window.CustomerNumbering = new CustomerNumberingImpl();
  console.log('✅ customer-numbering.js 加载完成 (骨架)');
})();
