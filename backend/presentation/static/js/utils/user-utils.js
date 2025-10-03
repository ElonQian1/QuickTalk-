"use strict";

// user-utils.js — 用户数据与权限检查工具（从 mobile-dashboard.html 抽取）
// 提供：getUserData(), canManageEmployees()

(function(){
  // 获取用户数据（优先全局变量，其次 localStorage）
  window.getUserData = function getUserData() {
    // 优先返回全局变量userData（如果存在）
    if (typeof userData !== 'undefined' && userData) {
      return userData;
    }
    
    // 如果全局变量为空，尝试从 localStorage 获取
    try {
      const savedUser = localStorage.getItem('userData');
      if (savedUser) {
        const user = JSON.parse(savedUser);
        console.log('💾 从 localStorage 获取用户数据:', user);
        return user;
      }
    } catch (error) {
      console.error('❌ 解析 localStorage 中的用户数据失败:', error);
    }
    
    // 如果都没有，返回默认值
    console.warn('⚠️ 未找到用户数据，返回默认值');
    return {
      id: null,
      username: 'unknown',
      role: 'guest'
    };
  };

  // 检查是否可以管理员工
  window.canManageEmployees = function canManageEmployees() {
    const user = getUserData();
    if (!user) {
      console.warn('ℹ️ 用户数据为空，无法管理员工');
      return false;
    }
    
    // 超级管理员可以管理所有店铺的员工
    if (user.role === 'super_admin') {
      console.log('👑 超级管理员，可管理所有店铺员工');
      return true;
    }
    
    // 对于普通用户，只能管理自己创建的店铺的员工
    // 这个检查在openEmployeeManagement函数中进行，需要结合店铺所有者信息
    console.log(`💼 普通用户(${user.role})，需要验证店铺所有权`);
    return true; // 在这里返回true，具体权限在openEmployeeManagement中检查
  };
})();
