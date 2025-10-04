/* message-scroll-coordinator.js
 * 目的：统一管理聊天窗口滚动行为，避免多处直接 scrollTop=scrollHeight 导致用户阅读被打断。
 * 阶段：小步快跑阶段1（核心链路健壮），后续可扩展监听图片加载、虚拟列表。
 */
(function(){
	'use strict';
	if (window.MessageScrollCoordinator) return; // 幂等

	class ScrollCoordinator {
		constructor(container){
			this.container = typeof container === 'string' ? document.getElementById(container) : container;
			this._autoStick = true; // 是否当前允许自动粘底
			this._userScrollThreshold = 120; // 超过此距离视为用户想查看历史，不强制粘底
			this._pendingScroll = false;
			this._bind();
		}
		_bind(){
			if (!this.container) return;
			this.container.addEventListener('scroll', ()=>{
				if (!this.container) return;
				const distanceFromBottom = this.container.scrollHeight - this.container.scrollTop - this.container.clientHeight;
				this._autoStick = distanceFromBottom < this._userScrollThreshold;
			});
		}
		scrollToEnd(opts={}){
			if (!this.container) return;
			const { force=false, reason='unknown', immediate=false } = opts; // reason 预留调试
			if (!force && !this._autoStick) return;
			const doScroll = ()=>{
				try { this.container.scrollTop = this.container.scrollHeight; } catch(_){}
				this._pendingScroll = false;
			};
			if (immediate){ doScroll(); return; }
			if (this._pendingScroll) return;
			this._pendingScroll = true;
			requestAnimationFrame(doScroll);
		}
		stickBottomTemporarily(){ this._autoStick = true; this.scrollToEnd({ force:true }); }
	}

	window.MessageScrollCoordinator = {
		init: function(container){ return new ScrollCoordinator(container); }
	};

	console.log('✅ message-scroll-coordinator.js 已加载');
})();