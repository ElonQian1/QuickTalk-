"use strict";

// format-utils.js — 通用格式化工具（从 mobile-dashboard.html 抽取）
// 提供：formatDate(dateString)

(function(){
  function formatDate(date, fmt = 'yyyy-MM-dd HH:mm') {
    if (!date) return '未知';
    try {
      date = new Date(date);
      const map = {
        'yyyy': date.getFullYear(),
        'MM': ('' + (date.getMonth() + 1)).padStart(2, '0'),
        'dd': ('' + date.getDate()).padStart(2, '0'),
        'HH': ('' + date.getHours()).padStart(2, '0'),
        'mm': ('' + date.getMinutes()).padStart(2, '0')
      };
      return fmt.replace(/yyyy|MM?|dd?|HH?|mm?/g, (matched) => map[matched]);
    } catch (error) {
      return date;
    }
  }

  function formatNumber(num, decimals = 2) {
    if (isNaN(num)) return 'NaN';
    return Number(num).toFixed(decimals);
  }

  function parseQueryString(query) {
    if (!query) return {};
    return JSON.parse('{"' + decodeURI(query.replace(/&/g, '","').replace(/=/g,'":"')) + '"}');
  }

  function formatShopStatus(status) {
    const statusMap = {
      'open': '营业中',
      'closed': '已打烊',
      'pending': '待审核',
      'suspended': '已暂停'
    };
    return statusMap[status] || '未知状态';
  }

  function formatConversationStatus(status) {
    const statusMap = {
      'active': '进行中',
      'resolved': '已解决',
      'pending': '待处理',
      'closed': '已关闭'
    };
    return statusMap[status] || '未知状态';
  }

  // Expose to window
  window.formatDate = formatDate;
  window.formatNumber = formatNumber;
  window.parseQueryString = parseQueryString;
  window.formatShopStatus = formatShopStatus;
  window.formatConversationStatus = formatConversationStatus;
})();
