/* state-texts.js
 * 统一文案常量，减少散落硬编码。
 * 后续可做 i18n 切换；当前仅中文。
 */
(function(){
  'use strict';
  if (window.StateTexts) return; // 幂等
  const T = {
    EMPTY_GENERIC: '暂无数据',
    EMPTY_CONVERSATIONS: '暂无对话',
    EMPTY_MESSAGES: '暂无消息',
    EMPTY_SHOPS: '暂无可用店铺',
    EMPTY_WORKBENCH: '暂无数据',
    NETWORK_ERROR_TITLE: '网络连接异常',
    NETWORK_ERROR_DESC: '请检查网络连接后重试',
    ERROR_GENERIC: '加载失败',
    LAST_MESSAGE_PLACEHOLDER: '暂无消息',
    LOADING_GENERIC: '正在加载...',
    LOADING_SHOPS: '正在加载店铺...',
    LOADING_MESSAGES: '正在加载消息...',
    LOADING_WAIT: '加载中...',
    RETRY: '重试',
    ACTION_COPY_FAIL: '复制失败，请手动复制',
    ACTION_COPY_LINK_FAIL: '复制失败，请手动复制链接',
    UPLOAD_FILE_FAIL: '文件上传失败',
    UPLOAD_AUDIO_FAIL: '音频上传失败',
  UPLOAD_GENERIC_FAIL: '上传失败',
  UPLOAD_RETRY_TIP: '上传失败，请稍后重试',
    SEND_MESSAGE_FAIL: '消息发送失败',
    API_GENERIC_FAIL: 'API调用失败',
    API_NETWORK_FAIL: '网络错误，请重试',
    GENERATE_KEY_FAIL: '生成API密钥失败',
    AUTH_FAIL: '认证失败',
    UPDATE_FAIL: '更新失败',
    FETCH_STATS_FAIL: '获取统计失败',
  FETCH_UNREAD_FAIL: '获取未读数失败'
  ,MARK_READ_FAIL: '标记已读失败'
  ,RETRY_LATER: '请稍后重试'
  ,MARK_ALL_READ_FAIL: '标记全部已读失败'
  ,GENERIC_PROCESS_FAIL: '操作失败'
  ,EMPTY_ADD_FIRST_SHOP: '添加您的第一个店铺开始使用客服系统'
  ,EMPTY_ADD_FIRST_SHOP_DESC: '创建后即可开始接入客服消息'
  ,ERROR_LOAD_SHOPS: '无法加载店铺列表，请稍后重试'
  ,ERROR_LOAD_CONVERSATIONS: '无法加载对话列表，请稍后重试'
  ,ERROR_LOAD_MESSAGES: '无法加载消息列表，请稍后重试'
  ,ERROR_GENERIC_RETRY_DESC: '请稍后重试'
  ,MESSAGE_NOT_CONNECTED: '尚未建立连接'
  ,MESSAGE_TIMEOUT: '发送超时'
  ,MESSAGE_RATE_LIMIT: '发送过于频繁，请稍后再试'
  ,MESSAGE_PAYLOAD_INVALID: '消息内容不合法'
  ,MESSAGE_SERVER_ERROR: '服务器处理失败'
  ,MESSAGE_SEND_RETRYING: '消息发送失败，正在重试'
  ,MESSAGE_SEND_FINAL_FAIL: '消息发送失败'
  ,NETWORK_STATE_CHANGE: '连接状态变更'
  ,ADAPTIVE_HEARTBEAT: '自适应心跳'
  ,RECONNECT_LIMIT_REACHED: '达到最大重连次数，停止重连'
  ,RECONNECT_IN_SUFFIX: '后进行第'
  ,RECONNECT_ATTEMPT_SUFFIX: '次重连'
  ,WS_INSTANCE_DESTROYED: '实例已销毁'
  ,HEARTBEAT_SEND_FAIL: '发送心跳失败'
  ,ADAPTIVE_HANDLER_FAIL: 'adaptiveHeartbeat处理失败'
  ,EVENT_EMIT_FAIL: '事件发布失败'
  ,EVENT_LISTENER_FAIL: '事件监听器执行失败'
  ,RECONNECT_UNKNOWN_REASON: '未知原因'
  };
  window.StateTexts = T;
  console.log('✅ StateTexts 已加载 (统一状态文案)');
})();
