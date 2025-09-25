// File related helpers
(function(global){
  function formatSize(bytes){
    if(!bytes) return '0 B';
    const k=1024; const sizes=['B','KB','MB','GB'];
    const i=Math.floor(Math.log(bytes)/Math.log(k));
    return (bytes/Math.pow(k,i)).toFixed(2)+' '+sizes[i];
  }
  function isImage(nameOrUrl){
    if(!nameOrUrl) return false;
    return /\.(png|jpg|jpeg|gif|bmp|webp|svg)$/i.test(nameOrUrl);
  }
  global.QuickTalk = global.QuickTalk || {};
  global.QuickTalk.File = { formatSize, isImage };
})(window);
