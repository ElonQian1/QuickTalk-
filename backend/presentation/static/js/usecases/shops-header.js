/* shops-header.js
 * 统一管理店铺页头部：搜索 / 筛选 / 排序 / 新建按钮 / 状态恢复
 * 设计目标：
 *  - 幂等初始化（多次调用不重复绑定）
 *  - 集中 FilterState，避免分散逻辑
 *  - 支持“活跃”按钮 toggle 激活态（再次点击还原）
 *  - reset 恢复初始 DOM 顺序（缓存第一次出现的顺序）
 */
(function(){
	'use strict';
	if (window.ShopsHeaderController) return; // 幂等保护
	const state = {
		searchKeyword: '',
		onlyActive: false,
		sortByName: false,
		originalOrder: null, // Node[]
	};
	function captureOriginalOrder(){
		if (state.originalOrder) return;
		const container = document.querySelector('#shopsList .shop-list, #shopsListView .shop-grid, #shopsList');
		if (!container) return;
		const cards = Array.from(container.querySelectorAll('.shop-card[data-shop-id]'));
		if (cards.length) { state.originalOrder = cards.slice(); }
	}
	function restoreOriginalOrder(){
		if (!state.originalOrder) return;
		const container = document.querySelector('#shopsList .shop-list, #shopsListView .shop-grid, #shopsList');
		if (!container) return;
		container.innerHTML = '';
		state.originalOrder.forEach(n => container.appendChild(n));
	}
	function applyFilters(){
		const cards = document.querySelectorAll('.shop-card[data-shop-id]');
		cards.forEach(card => {
			let visible = true;
			if (state.searchKeyword){
				const name = (card.querySelector('.shop-name')?.textContent || '').toLowerCase();
				visible = name.includes(state.searchKeyword);
			}
			if (visible && state.onlyActive){
				const status = (card.querySelector('.status-badge')?.textContent || '').toLowerCase();
				visible = /active|approved/.test(status);
			}
			card.style.display = visible ? '' : 'none';
		});
	}
	function applySort(){
		if (!state.sortByName) return;
		const container = document.querySelector('#shopsList .shop-list, #shopsListView .shop-grid, #shopsList');
		if (!container) return;
		const cards = Array.from(container.querySelectorAll('.shop-card[data-shop-id]'));
		cards.sort((a,b)=>{
			const an = (a.querySelector('.shop-name')?.textContent || '').trim();
			const bn = (b.querySelector('.shop-name')?.textContent || '').trim();
			return an.localeCompare(bn, 'zh');
		});
		container.innerHTML='';
		cards.forEach(c=>container.appendChild(c));
	}
	function updateActiveStyles(){
		const activeBtn = document.querySelector('[data-shops-action="filter-active"]');
		if (activeBtn){ activeBtn.classList.toggle('active', !!state.onlyActive); }
		const sortBtn = document.querySelector('[data-shops-action="sort-name"]');
		if (sortBtn){ sortBtn.classList.toggle('active', !!state.sortByName); }
	}
	function resetAll(){
		state.searchKeyword = '';
		state.onlyActive = false;
		state.sortByName = false;
		restoreOriginalOrder();
		const search = document.getElementById('shopSearch');
		if (search) search.value='';
		applyFilters();
		updateActiveStyles();
		if (window.showToast) window.showToast('筛选与排序已重置', 'info');
	}
	function bind(){
		const toolbar = document.getElementById('shopToolbar');
		if (!toolbar || toolbar.__shopsHeaderBound) return;
		toolbar.__shopsHeaderBound = true;
		captureOriginalOrder();
		// 搜索
		const search = document.getElementById('shopSearch');
		if (search){
			search.addEventListener('input', function(){
				state.searchKeyword = (this.value||'').toLowerCase();
				applyFilters();
			});
		}
		// 排序
		toolbar.addEventListener('click', function(e){
			const sortBtn = e.target.closest('[data-shops-action="sort-name"]');
			if (sortBtn){
				// 第一次点击：启用排序；再次点击：取消并恢复原始顺序
				if (!state.sortByName){
					state.sortByName = true;
					applySort();
				} else {
					state.sortByName = false;
					restoreOriginalOrder();
					applyFilters();
				}
				updateActiveStyles();
				return;
			}
			const activeBtn = e.target.closest('[data-shops-action="filter-active"]');
			if (activeBtn){
				state.onlyActive = !state.onlyActive;
				applyFilters();
				updateActiveStyles();
				return;
			}
			const resetBtn = e.target.closest('[data-shops-action="reset-filters"]');
			if (resetBtn){
				resetAll();
				return;
			}
		});
		// 新建店铺按钮
		const createBtn = document.getElementById('createShopBtn');
		if (createBtn && !createBtn.__wired){
			createBtn.__wired = true;
			createBtn.addEventListener('click', function(){
				if (typeof window.createNewShop === 'function') return window.createNewShop();
				if (window.CreateShopModal && typeof window.CreateShopModal.open === 'function') return window.CreateShopModal.open();
				if (window.showToast) window.showToast('创建店铺功能暂不可用', 'warning');
			});
		}
	}
	function init(){
		bind();
		// 监听列表 DOM 变化以捕获初始序列（只捕获一次）
		if (!state.originalOrder){
			const listRoot = document.querySelector('#shopsListView');
			if (listRoot){
				const mo = new MutationObserver(()=>{
					if (!state.originalOrder){ captureOriginalOrder(); }
				});
				mo.observe(listRoot, { childList:true, subtree:true });
			}
		}
	}
	window.ShopsHeaderController = { init, state, applyFilters, applySort, resetAll };
	if (document.readyState === 'loading'){
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();