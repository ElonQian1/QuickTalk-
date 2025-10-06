/**
 * ImageLightbox - 图片预览组件（继承UIBase）
 * 已优化：使用UIBase统一DOM操作和样式注入
 */
(function(){
  'use strict';

  class ImageLightbox extends UIBase {
    constructor(options = {}) {
      super('ImageLightbox', {
        debug: false,
        containerSelector: 'body',
        ...options
      });

      this.lightboxId = 'qt-image-lightbox';
      this.lightboxElement = null;
      this.imageElement = null;

      this._injectStyles();
      this.log('info', 'ImageLightbox组件初始化完成');
    }

    _injectStyles() {
      const styles = `
        #${this.lightboxId} {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,.9);
          display: none;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }
        #${this.lightboxId} img {
          max-width: 92vw;
          max-height: 88vh;
          object-fit: contain;
          box-shadow: 0 8px 24px rgba(0,0,0,.5);
        }
        #${this.lightboxId} .close {
          position: absolute;
          top: 14px;
          right: 14px;
          color: #fff;
          background: rgba(255,255,255,.12);
          border: 1px solid rgba(255,255,255,.3);
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 14px;
          cursor: pointer;
        }
        @media (max-width:480px) {
          #${this.lightboxId} .close {
            padding: 8px 10px;
            font-size: 13px;
          }
        }
      `;
      this.injectCSS(styles, 'qt-lightbox-style');
    }

    _ensureLightbox() {
      if (this.lightboxElement) return this.lightboxElement;

      // 使用UIBase的createElement方法
      this.lightboxElement = this.createElement('div', {
        id: this.lightboxId,
        styles: 'display: none;'
      });

      this.imageElement = this.createElement('img');
      const closeButton = this.createElement('button', {
        className: 'close',
        textContent: '关闭'
      });

      // 绑定事件
      closeButton.addEventListener('click', () => this.hide());
      this.lightboxElement.addEventListener('click', (e) => {
        if (e.target === this.lightboxElement) this.hide();
      });

      // 组装DOM
      this.lightboxElement.appendChild(this.imageElement);
      this.lightboxElement.appendChild(closeButton);
      document.body.appendChild(this.lightboxElement);

      return this.lightboxElement;
    }

    open(src) {
      const lightbox = this._ensureLightbox();
      this.imageElement.src = src;
      lightbox.style.display = 'flex';
      this.log('debug', `打开图片预览: ${src}`);
    }

    hide() {
      if (this.lightboxElement) {
        this.lightboxElement.style.display = 'none';
        this.log('debug', '关闭图片预览');
      }
    }
  }

  // 创建全局实例
  const imageLightbox = new ImageLightbox();

  // 全局方法（向下兼容）
  function open(src) {
    imageLightbox.open(src);
  }

  function hide() {
    imageLightbox.hide();
  }

  // 暴露接口
  window.ImageLightbox = ImageLightbox;
  window.imageLightbox = imageLightbox;
  window.openImageLightbox = open;
  window.hideImageLightbox = hide;

  console.log('✅ ImageLightbox组件已重构为UIBase继承版本');
})();
