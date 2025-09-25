// Time formatting utilities (pure functions)
(function(global){
  function formatRelative(iso){
    if(!iso) return '';
    const date = new Date(iso);
    const now = new Date();
    const diff = now - date;
    if(diff < 60000) return '刚刚';
    if(diff < 3600000) return Math.floor(diff/60000)+'分钟前';
    if(diff < 86400000) return Math.floor(diff/3600000)+'小时前';
    return date.toLocaleDateString();
  }
  global.QuickTalk = global.QuickTalk || {};
  global.QuickTalk.Time = { formatRelative };
})(window);
