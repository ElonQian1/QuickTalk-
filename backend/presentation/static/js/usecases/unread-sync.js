/* unread-sync.js
 * 目的：集中管理未读计数的本地同步、进入会话清零、统计 UI 更新。
 * 阶段：初版（仅本地内存 + UI），后续可接入后端 mark-read API 与批量节流。
 */
(function(){
	'use strict';
	if (window.UnreadSync) return; // 幂等

	class UnreadSync {
		constructor(opts={}){
			this.debug = !!opts.debug;
			this.conversationsManagerProvider = opts.conversationsManagerProvider || ( ()=> window.MessageModuleRef?.conversationsManager );
			this.currentConversationIdProvider = opts.currentConversationIdProvider || ( ()=> window.MessageModuleRef?.currentConversationId );
			this.statsUIUpdater = opts.statsUIUpdater || this._defaultStatsUIUpdater;
		}
		_log(...args){ if (this.debug) console.log('[UnreadSync]', ...args); }

		onIncomingMessage(msg){
			if (!msg || !msg.conversation_id) return;
			const currentId = this.currentConversationIdProvider();
			// 如果消息是客户发来的，且不在当前打开会话，增加未读
			if (msg.sender_type === 'customer' && String(msg.conversation_id) !== String(currentId||'')){
				const cm = this.conversationsManagerProvider();
				if (cm){
					const target = cm.conversations.find(c => String(c.id) === String(msg.conversation_id));
					if (target){
						target.unread_count = (target.unread_count||0) + 1;
						cm.renderConversationsList();
						this._updateStats(cm);
						this._log('未读 +1', msg.conversation_id, '=>', target.unread_count);
					}
				}
			}
		}

		markCurrentAsRead(){
			const cm = this.conversationsManagerProvider();
			if (!cm) return;
			const currentId = this.currentConversationIdProvider();
			if (!currentId) return;
			const conv = cm.conversations.find(c => String(c.id) === String(currentId));
			if (conv && conv.unread_count > 0){
				conv.unread_count = 0;
				cm.renderConversationsList();
				this._updateStats(cm);
				this._log('清零未读', currentId);
				// 调用后端 mark-read API
				this._callMarkReadAPI(currentId).catch(()=>{});
			}
		}

		_updateStats(cm){
			const total = cm.conversations.length;
			const unread = cm.conversations.reduce((s,c)=> s + (c.unread_count||0), 0);
			try { if (window.ConversationsHeaderUI) window.ConversationsHeaderUI.updateStats(total, unread); } catch(_){ }
		}

		_defaultStatsUIUpdater(total, unread){
			const totalEl = document.getElementById('totalConversationsCount');
			const unreadEl = document.getElementById('unreadConversationsCount');
			if (totalEl) totalEl.textContent = total;
			if (unreadEl) unreadEl.textContent = unread;
		}

		async _callMarkReadAPI(conversationId){
			if (!window.safeRequest) return;
			try {
				await window.safeRequest(`/api/conversations/${conversationId}/read`, { method:'POST', expectedStatus:200, silent:true });
				this._log('后端已读标记成功', conversationId);
			} catch(e){ this._log('后端已读标记失败(忽略)', conversationId, e); }
		}
	}

	window.UnreadSync = new UnreadSync({ debug:false });
	console.log('✅ unread-sync.js 已加载');
})();
