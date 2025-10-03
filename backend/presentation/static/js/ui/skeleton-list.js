(function(){
  'use strict';
  var STYLE_ID = 'qt-skeleton-style';
  function inject(){
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.qt-skeleton-row{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid #f1f3f5;}',
      '.qt-skeleton-avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(90deg,#eceff1,#f5f7fa,#eceff1);animation:qt-shimmer 1.2s infinite;}',
      '.qt-skeleton-lines{flex:1;}',
      '.qt-skeleton-line{height:10px;border-radius:6px;background:linear-gradient(90deg,#eceff1,#f5f7fa,#eceff1);animation:qt-shimmer 1.2s infinite;margin:6px 0;}',
      '@keyframes qt-shimmer{0%{background-position:-200px 0}100%{background-position:200px 0}}'
    ].join('');
    document.head.appendChild(style);
  }

  function buildConversationsSkeleton(count){
    inject();
    var box = document.createElement('div');
    for (var i=0;i<(count||5);i++){
      var row = document.createElement('div'); row.className='qt-skeleton-row';
      var av = document.createElement('div'); av.className='qt-skeleton-avatar';
      var lines = document.createElement('div'); lines.className='qt-skeleton-lines';
      var l1 = document.createElement('div'); l1.className='qt-skeleton-line'; l1.style.width='40%';
      var l2 = document.createElement('div'); l2.className='qt-skeleton-line'; l2.style.width='70%';
      lines.appendChild(l1); lines.appendChild(l2);
      row.appendChild(av); row.appendChild(lines);
      box.appendChild(row);
    }
    return box;
  }

  window.SkeletonListUI = { buildConversationsSkeleton: buildConversationsSkeleton };
  console.log('✅ Skeleton List UI 已加载');
})();
