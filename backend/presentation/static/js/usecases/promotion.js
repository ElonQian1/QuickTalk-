"use strict";

// promotion.js — 推广赚钱功能模块（从 mobile-dashboard.html 抽取）
// 提供：showPromotionModal, hidePromotionModal, copyPromotionLink, shareToWeChat, generateQRCode, loadPromotionData
// 依赖：userData, showToast

(function(){
  // 显示推广模态框
  window.showPromotionModal = function showPromotionModal() {
    const modal = document.getElementById('promotionModal');
    
    // 更新推广链接
    const currentUser = (typeof userData !== 'undefined' && userData) ? userData.username : 'user';
    const link = `http://localhost:3030?ref=${currentUser}`;
    const linkInput = document.getElementById('promotionLink');
    if (linkInput) {
      linkInput.value = link;
    }
    
    // 加载推广数据
    if (typeof loadPromotionData === 'function') loadPromotionData();
    
    // 显示模态框
    if (modal) {
      modal.classList.add('show');
      document.body.style.overflow = 'hidden'; // 防止背景滚动
    }
  };

  // 隐藏推广模态框
  window.hidePromotionModal = function hidePromotionModal() {
    const modal = document.getElementById('promotionModal');
    if (modal) {
      modal.classList.remove('show');
      document.body.style.overflow = ''; // 恢复背景滚动
    }
  };

  // 复制推广链接
  window.copyPromotionLink = function copyPromotionLink() {
    const linkInput = document.getElementById('promotionLink');
    if (!linkInput) return;
    
    linkInput.select();
    linkInput.setSelectionRange(0, 99999); // 移动端兼容
    
    try {
      document.execCommand('copy');
      if (typeof showToast === 'function') showToast('推广链接已复制到剪贴板！', 'success');
    } catch (err) {
      // 使用现代API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(linkInput.value).then(() => {
          if (typeof showToast === 'function') showToast('推广链接已复制到剪贴板！', 'success');
        }).catch(() => {
          if (typeof showToast === 'function') showToast('复制失败，请手动复制链接', 'error');
        });
      } else {
        if (typeof showToast === 'function') showToast('复制失败，请手动复制链接', 'error');
      }
    }
  };

  // 分享到微信
  window.shareToWeChat = function shareToWeChat() {
    const linkInput = document.getElementById('promotionLink');
    if (!linkInput) return;
    
    const link = linkInput.value;
    const message = `🎁 邀请您免费体验我们的客服系统！通过我的专属链接注册，我们都能获得优惠哦！\n\n点击链接：${link}`;
    
    // 创建分享文本
    if (navigator.share) {
      navigator.share({
        title: '邀请您体验客服系统',
        text: message,
        url: link
      }).catch(() => {
        // 分享失败，尝试复制
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(message);
          if (typeof showToast === 'function') showToast('分享内容已复制，请在微信中粘贴分享！', 'success');
        }
      });
    } else {
      // 复制到剪贴板
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(message).then(() => {
          if (typeof showToast === 'function') showToast('分享内容已复制，请在微信中粘贴分享！', 'success');
        }).catch(() => {
          if (typeof showToast === 'function') showToast('复制失败，请手动复制', 'error');
        });
      } else {
        if (typeof showToast === 'function') showToast('复制失败，请手动复制', 'error');
      }
    }
  };

  // 生成二维码
  window.generateQRCode = function generateQRCode() {
    const linkInput = document.getElementById('promotionLink');
    if (!linkInput) return;
    
    const link = linkInput.value;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link)}`;
    
    // 在新窗口显示二维码
    const qrWindow = window.open('', '_blank', 'width=300,height=350');
    if (qrWindow) {
      qrWindow.document.write(`
        <html>
        <head>
          <title>推广二维码</title>
          <style>
            body { 
              text-align: center; 
              padding: 20px; 
              font-family: Arial, sans-serif; 
            }
            img { 
              border: 1px solid #ddd; 
              border-radius: 8px; 
              padding: 10px; 
            }
          </style>
        </head>
        <body>
          <h3>📱 推广二维码</h3>
          <img src="${qrUrl}" alt="推广二维码" />
          <p>扫描二维码访问推广链接</p>
        </body>
        </html>
      `);
    }
  };

  // 加载推广数据
  window.loadPromotionData = async function loadPromotionData() {
    // 这里可以从后端API获取真实的推广数据
    // 暂时使用模拟数据
    try {
      // 模拟API调用
      const promotionData = {
        referralCount: 0,
        totalCommission: 0,
        monthlyCommission: 0
      };
      
      // 更新显示
      const stats = document.querySelectorAll('.stat-item .stat-number');
      if (stats.length >= 3) {
        stats[0].textContent = promotionData.referralCount;
        stats[1].textContent = `￥${promotionData.totalCommission}`;
        stats[2].textContent = `￥${promotionData.monthlyCommission}`;
      }
    } catch (error) {
      console.error('加载推广数据失败:', error);
    }
  };
})();
