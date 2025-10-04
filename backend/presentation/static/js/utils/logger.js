(function(){
  'use strict';
  /**
   * logger.js - 统一前端日志模块
   * 目标：
   *  - 统一格式: [HH:MM:SS.mmm][level][scope] message
   *  - 可配置全局最小日志级别 window.__LOG_LEVEL__ (默认 'info')
   *  - 支持动态开启调试: window.setLogLevel('debug')
   *  - 低侵入：若控制台方法不存在则安全降级
   *  - 提供 Logger.for(scope) 生成带作用域实例
   */

  var LEVELS = ['trace','debug','info','warn','error'];
  var LEVEL_PRIORITY = { trace:10, debug:20, info:30, warn:40, error:50 }; // 数字越大级别越高
  var DEFAULT_LEVEL = 'info';

  function nowStr(){
    var d = new Date();
    var pad = function(n,len){ n = String(n); while(n.length < len) n='0'+n; return n; };
    return pad(d.getHours(),2)+':'+pad(d.getMinutes(),2)+':'+pad(d.getSeconds(),2)+'.'+pad(d.getMilliseconds(),3);
  }

  function normalizeLevel(l){
    if(!l) return DEFAULT_LEVEL;
    l = String(l).toLowerCase();
    if(LEVEL_PRIORITY[l]) return l;
    return DEFAULT_LEVEL;
  }

  var globalLevel = normalizeLevel(window.__LOG_LEVEL__);

  function setGlobalLevel(l){
    globalLevel = normalizeLevel(l);
    window.__LOG_LEVEL__ = globalLevel;
    if(window.console && console.info){ console.info('[logger] log level set to', globalLevel); }
  }
  window.setLogLevel = setGlobalLevel;

  function shouldLog(level){
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[globalLevel];
  }

  function baseLog(level, scope, args){
    if(!shouldLog(level)) return;
    var prefix = '['+ nowStr() + ']['+ level + (scope? (']['+scope+']') : ']');
    var c = (console && console[level]) ? console[level] : (console && console.log ? console.log : function(){});
    try {
      if(typeof args === 'function'){ args = args(); }
      if(!Array.isArray(args)) args = [args];
      c.apply(console, [prefix].concat(args));
    } catch(e){ /* 忽略日志异常 */ }
  }

  function Logger(scope){ this.scope = scope || ''; }
  LEVELS.forEach(function(l){
    Logger.prototype[l] = function(){ baseLog(l, this.scope, Array.prototype.slice.call(arguments)); };
  });

  var root = new Logger('');
  root.setLevel = setGlobalLevel;
  root.getLevel = function(){ return globalLevel; };
  root.for = function(scope){ return new Logger(scope); };

  // 提供快捷别名
  root.create = root.for;

  // 暴露
  window.Logger = root;

  // 初始提示
  baseLog('info','logger',['Logger 初始化完成 (level='+globalLevel+')']);
})();
