// 最小登录态拦截：若未携带本地 token 则重定向登录页面
(function(){
  try {
    var t = localStorage.getItem('qt_admin_token');
    if(!t){ window.location.replace('/mobile/login'); }
  } catch(_) {}
})();
