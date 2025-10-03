// 推广赚钱模态相关逻辑（从 mobile-dashboard.html 抽取）
function showPromotionModal() {
  const modal = document.getElementById('promotionModal');
  const currentUser = window.userData ? window.userData.username : 'user';
  const link = `http://localhost:3030?ref=${currentUser}`;
  const linkInput = document.getElementById('promotionLink');
  if (linkInput) {
    linkInput.value = link;
  }
  if (typeof loadPromotionData === 'function') {
    loadPromotionData();
  }
  if (modal) {
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
}

function hidePromotionModal() {
  const modal = document.getElementById('promotionModal');
  if (modal) {
    modal.classList.remove('show');
    document.body.style.overflow = '';
  }
}

function copyPromotionLink() {
  const linkInput = document.getElementById('promotionLink');
  linkInput.select();
  linkInput.setSelectionRange(0, 99999);
  try {
    document.execCommand('copy');
    showToast('推广链接已复制到剪贴板！', 'success');
  } catch (err) {
    navigator.clipboard.writeText(linkInput.value).then(() => {
      showToast('推广链接已复制到剪贴板！', 'success');
    }).catch(() => {
      showToast('复制失败，请手动复制链接', 'error');
    });
  }
}

function shareToWeChat() {
  const link = document.getElementById('promotionLink').value;
  const message = `🎁 邀请您免费体验我们的客服系统！通过我的专属链接注册，我们都能获得优惠哦！\n\n点击链接：${link}`;
  if (navigator.share) {
    navigator.share({ title: '邀请您体验客服系统', text: message, url: link });
  } else {
    navigator.clipboard.writeText(message).then(() => {
      showToast('分享内容已复制，请在微信中粘贴分享！', 'success');
    }).catch(() => {
      showToast('复制失败，请手动复制', 'error');
    });
  }
}

function shareToQQ() {
  const link = document.getElementById('promotionLink').value;
  const title = encodeURIComponent('邀请您体验客服系统');
  const summary = encodeURIComponent('免费体验专业客服系统，通过我的推广链接注册还有优惠！');
  const qqUrl = `https://connect.qq.com/widget/shareqq/index.html?url=${encodeURIComponent(link)}&title=${title}&summary=${summary}`;
  window.open(qqUrl, '_blank');
}

function generateQRCode() {
  const link = document.getElementById('promotionLink').value;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link)}`;
  const qrWindow = window.open('', '_blank', 'width=300,height=350');
  qrWindow.document.write(`
    <html>
    <head>
      <title>推广二维码</title>
      <style>
        body { text-align: center; padding: 20px; font-family: Arial, sans-serif; }
        img { border: 1px solid #ddd; border-radius: 8px; padding: 10px; }
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
