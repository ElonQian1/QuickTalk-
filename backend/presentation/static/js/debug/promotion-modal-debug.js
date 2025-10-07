// 推广模态框调试工具
window.debugPromotionModal = function() {
    console.log('=== 推广模态框调试 ===');
    
    // 检查模态框元素是否存在
    const modal = document.getElementById('promotionModal');
    console.log('模态框元素:', modal);
    
    if (!modal) {
        console.error('❌ 找不到推广模态框元素 #promotionModal');
        return;
    }
    
    // 检查CSS类
    console.log('模态框CSS类:', modal.className);
    console.log('模态框样式:', getComputedStyle(modal).display);
    
    // 检查内容
    const content = modal.querySelector('.modal-content');
    console.log('模态框内容元素:', content);
    
    const body = modal.querySelector('.modal-body');
    console.log('模态框主体元素:', body);
    
    const sections = modal.querySelectorAll('.promotion-section');
    console.log('推广部分数量:', sections.length);
    
    // 强制显示模态框
    console.log('🔄 强制显示模态框...');
    modal.classList.add('show');
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
    
    // 启用调试样式
    document.body.classList.add('debug-modal');
    
    // 检查viewport
    console.log('视窗高度:', window.innerHeight);
    console.log('视窗宽度:', window.innerWidth);
    
    // 检查模态框尺寸
    if (content) {
        const rect = content.getBoundingClientRect();
        console.log('模态框内容尺寸:', {
            width: rect.width,
            height: rect.height,
            top: rect.top,
            bottom: rect.bottom
        });
    }
    
    if (body) {
        const bodyRect = body.getBoundingClientRect();
        console.log('模态框主体尺寸:', {
            width: bodyRect.width,
            height: bodyRect.height,
            scrollHeight: body.scrollHeight,
            offsetHeight: body.offsetHeight
        });
    }
    
    console.log('✅ 调试完成，模态框应该已显示');
};

// 关闭调试模态框
window.closeDebugModal = function() {
    const modal = document.getElementById('promotionModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.classList.remove('modal-open', 'debug-modal');
        document.body.style.overflow = '';
    }
    console.log('🔒 调试模态框已关闭');
};

// 页面加载完成后自动加载调试工具
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        console.log('📱 推广模态框调试工具已加载');
        console.log('使用 debugPromotionModal() 来测试模态框');
        console.log('使用 closeDebugModal() 来关闭模态框');
    });
} else {
    console.log('📱 推广模态框调试工具已加载');
    console.log('使用 debugPromotionModal() 来测试模态框');
    console.log('使用 closeDebugModal() 来关闭模态框');
}