/**
 * qt-config.js
 * 全局配置与日志中心 (前端轻量版)
 * 目标:
 *  1. 集中管理调试开关与特性开关
 *  2. 提供统一日志接口 (QT_LOG)
 *  3. 为后续模块化(未读聚合/徽章等)提供配置注入点
 *  4. 不依赖构建工具，纯原生 JS，可在任何页面最早阶段引入
 * 
 * 使用:
 *  <script src="/static/js/core/qt-config.js"></script>
 *  在其他脚本中:
 *    QT_LOG.debug('shopCard', '转换完成', {id});
 *    if (QT_CONFIG.features.forceUnreadFallback) { ... }
 * 
 * 动态修改(调试):
 *    QT_CONFIG.debug.global = true; // 打开所有 debug
 *    QT_CONFIG.setDebug('shopCard', true); // 单命名空间
 */
(function(){
  if (window.QT_CONFIG && window.QT_LOG) return; // 幂等

  const DEFAULT_CONFIG = {
    debug: {
      global: false,            // 打开则所有命名空间输出
      namespaces: {             // 精确命名空间开关
        shopCard: false,
        navBadge: false,
        unreadAggregator: false,
        badgeIntegration: false,
        unreadFix: false,
      }
    },
    features: {
      forceUnreadFallback: false,   // 是否启用 DOM 猜测未读兜底 (替代旧 unread-badge-fix.js 行为)
    },
    intervals: {
      unreadPoll: 15000,        // 未读聚合轮询间隔
      shopCardAutoUpdate: 30000 // 店铺红点自动刷新
    },
    version: '1.0.0'
  };

  const QT_CONFIG = window.QT_CONFIG = Object.assign({}, DEFAULT_CONFIG);

  function nsEnabled(ns){
    if (QT_CONFIG.debug.global) return true;
    return !!QT_CONFIG.debug.namespaces[ns];
  }

  const QT_LOG = window.QT_LOG = {
    debug(ns, ...args){ if (nsEnabled(ns)) console.log(`[${ns}]`, ...args); },
    info(ns, ...args){ console.log(`ℹ️[${ns}]`, ...args); },
    warn(ns, ...args){ console.warn(`⚠️[${ns}]`, ...args); },
    error(ns, ...args){ console.error(`❌[${ns}]`, ...args); },
    setDebug(ns, on=true){ QT_CONFIG.debug.namespaces[ns] = !!on; return QT_CONFIG.debug.namespaces[ns]; },
    enableAll(){ QT_CONFIG.debug.global = true; },
    disableAll(){ QT_CONFIG.debug.global = false; }
  };

  // 暴露一个便捷函数用于合并外部配置 (必须在后加载脚本执行之前调用)
  QT_CONFIG.apply = function(partial){
    if (!partial) return QT_CONFIG;
    if (partial.debug){
      if (typeof partial.debug.global === 'boolean') QT_CONFIG.debug.global = partial.debug.global;
      if (partial.debug.namespaces){
        Object.assign(QT_CONFIG.debug.namespaces, partial.debug.namespaces);
      }
    }
    if (partial.features) Object.assign(QT_CONFIG.features, partial.features);
    if (partial.intervals) Object.assign(QT_CONFIG.intervals, partial.intervals);
    return QT_CONFIG;
  };

  console.log('🧩 QT_CONFIG 已初始化 v'+QT_CONFIG.version);
})();
