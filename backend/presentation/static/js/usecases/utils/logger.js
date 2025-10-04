/**
 * Logger - 统一结构化日志 (骨架)
 * 目标: 用轻量包装替换到处散落的 console.log/console.warn, 便于后续接入远程收集。
 * 特性:
 *  - 分级: debug/info/warn/error
 *  - 主题: topic + action + msg + meta
 *  - 可设置全局 level (隐藏低级日志)
 * 非运行验证阶段: 保持简单, 无外部依赖
 */
(function(){
  'use strict';
  if (window.AppLogger) return;

  const LEVELS = ['debug','info','warn','error'];

  class AppLoggerImpl {
    constructor(){
      this._level = 'info'; // 默认隐藏 debug
    }
    setLevel(l){ if (LEVELS.includes(l)) this._level = l; }
    _should(level){ return LEVELS.indexOf(level) >= LEVELS.indexOf(this._level); }
    _fmt(ts){ const d=new Date(ts); return d.toISOString().split('T')[1].replace('Z',''); }
    _emit(level, topic, action, message, meta){
      if (!this._should(level)) return;
      const ts = Date.now();
      const base = `[${this._fmt(ts)}][${level.toUpperCase()}][${topic}] ${action || ''} ${message||''}`.trim();
      if (meta) {
        try { console[level === 'debug' ? 'log' : level](base, meta); } catch(_){ console.log(base, meta); }
      } else {
        try { console[level === 'debug' ? 'log' : level](base); } catch(_){ console.log(base); }
      }
    }
    debug(topic, action, message, meta){ this._emit('debug', topic, action, message, meta); }
    info(topic, action, message, meta){ this._emit('info', topic, action, message, meta); }
    warn(topic, action, message, meta){ this._emit('warn', topic, action, message, meta); }
    error(topic, action, message, meta){ this._emit('error', topic, action, message, meta); }
    log(topic, action, message, meta){ this.info(topic, action, message, meta); }
  }

  window.AppLogger = new AppLoggerImpl();
  console.log('✅ logger.js 加载完成 (骨架)');
})();
