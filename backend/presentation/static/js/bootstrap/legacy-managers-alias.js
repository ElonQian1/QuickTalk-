/*
 * legacy-managers-alias.js — 旧管理器名称兼容层
 * 目的：在移除 shops-manager.js / conversations-manager.js / messages-manager.js 脚本标签后
 *       仍然让尚未重构、仍引用旧全局名称的脚本不报错，指向新的 *Refactored 实现。
 * 设计：仅做一次性映射，不做深拷贝，不重建实例。保持懒加载：外部自己 new。
 * 清理计划：在确认无脚本再引用旧名称后删除此文件。（对应 Todo: 冗余代码审计与清理）
 */
(function(){
  'use strict';

  function alias(oldName, newName){
    if (window[oldName]) return; // 已存在（可能还没删除老文件）
    if (window[newName]) {
      window[oldName] = window[newName];
      console.log('[legacy-managers-alias] 映射', oldName, '=>', newName);
    } else {
      console.warn('[legacy-managers-alias] 目标新类未加载，无法映射:', oldName, '->', newName);
    }
  }

  function run(){
    alias('ShopsManager', 'ShopsManagerRefactored');
    alias('ConversationsManager', 'ConversationsManagerRefactored');
    alias('MessagesManager', 'MessagesManagerRefactored');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
