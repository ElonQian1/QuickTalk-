/**
 * 图片查看器模块
 * 提供图片点击放大、全屏预览、下载等功能
 */

export interface ImageViewerOptions {
  src: string;
  alt?: string;
  title?: string;
}

export class ImageViewer {
  private static instance: ImageViewer;
  private overlay: HTMLElement | null = null;
  private currentImage: HTMLImageElement | null = null;
  private readonly cssPrefix = 'qt-sdk-';
  private readonly namespace = 'quicktalk-embed';

  static getInstance(): ImageViewer {
    if (!ImageViewer.instance) {
      ImageViewer.instance = new ImageViewer();
    }
    return ImageViewer.instance;
  }

  private constructor() {
    this.createStyles();
    this.bindGlobalEvents();
  }

  /**
   * 显示图片预览
   */
  show(options: ImageViewerOptions): void {
    this.createOverlay();
    this.loadImage(options);
  }

  /**
   * 关闭图片预览
   */
  close(): void {
    if (this.overlay) {
      this.overlay.style.opacity = '0';
      setTimeout(() => {
        if (this.overlay && this.overlay.parentNode) {
          this.overlay.parentNode.removeChild(this.overlay);
        }
        this.overlay = null;
        this.currentImage = null;
      }, 300);
    }
  }

  /**
   * 创建覆盖层
   */
  private createOverlay(): void {
    this.overlay = document.createElement('div');
    this.overlay.className = `${this.namespace} ${this.cssPrefix}image-overlay`;
    
    // 创建关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.className = `${this.cssPrefix}image-close`;
    closeBtn.innerHTML = '✕';
    closeBtn.title = '关闭';
    closeBtn.addEventListener('click', () => this.close());

    // 创建图片容器
    const imageContainer = document.createElement('div');
    imageContainer.className = `${this.cssPrefix}image-container`;

    // 创建加载指示器
    const loading = document.createElement('div');
    loading.className = `${this.cssPrefix}image-loading`;
    loading.innerHTML = '📷 加载中...';

    // 创建下载按钮
    const downloadBtn = document.createElement('button');
    downloadBtn.className = `${this.cssPrefix}image-download`;
    downloadBtn.innerHTML = '⬇️ 下载';
    downloadBtn.title = '下载图片';
    downloadBtn.style.display = 'none';

    this.overlay.appendChild(closeBtn);
    this.overlay.appendChild(imageContainer);
    this.overlay.appendChild(loading);
    this.overlay.appendChild(downloadBtn);

    // 点击覆盖层关闭
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay || e.target === imageContainer) {
        this.close();
      }
    });

    document.body.appendChild(this.overlay);

    // 添加进入动画
    setTimeout(() => {
      if (this.overlay) {
        this.overlay.style.opacity = '1';
      }
    }, 10);
  }

  /**
   * 加载图片
   */
  private loadImage(options: ImageViewerOptions): void {
    if (!this.overlay) return;

    const imageContainer = this.overlay.querySelector(`.${this.cssPrefix}image-container`) as HTMLElement;
    const loading = this.overlay.querySelector(`.${this.cssPrefix}image-loading`) as HTMLElement;
    const downloadBtn = this.overlay.querySelector(`.${this.cssPrefix}image-download`) as HTMLElement;

    const img = document.createElement('img');
    img.className = `${this.cssPrefix}image-preview`;
    img.alt = options.alt || '图片预览';

    // 图片加载成功
    img.onload = () => {
      if (loading) loading.style.display = 'none';
      if (downloadBtn) {
        downloadBtn.style.display = 'block';
        downloadBtn.onclick = () => this.downloadImage(options.src, options.title);
      }
      imageContainer.appendChild(img);
      
      // 添加图片进入动画
      img.style.opacity = '0';
      img.style.transform = 'scale(0.8)';
      setTimeout(() => {
        img.style.transition = 'all 0.3s ease';
        img.style.opacity = '1';
        img.style.transform = 'scale(1)';
      }, 10);
    };

    // 图片加载失败
    img.onerror = () => {
      if (loading) {
        loading.innerHTML = '❌ 图片加载失败';
        loading.style.color = '#ff6b6b';
      }
    };

    img.src = options.src;
    this.currentImage = img;
  }

  /**
   * 下载图片
   */
  private downloadImage(url: string, filename?: string): void {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'image.jpg';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * 绑定全局事件
   */
  private bindGlobalEvents(): void {
    // ESC键关闭
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.overlay) {
        this.close();
      }
    });
  }

  /**
   * 创建样式
   */
  private createStyles(): void {
    const styleId = `${this.cssPrefix}image-viewer-styles`;
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
/* 图片查看器样式 */
.${this.namespace} .${this.cssPrefix}image-overlay {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  background: rgba(0, 0, 0, 0.9) !important;
  z-index: 999999 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  opacity: 0 !important;
  transition: opacity 0.3s ease !important;
  padding: 20px !important;
  box-sizing: border-box !important;
}

.${this.namespace} .${this.cssPrefix}image-container {
  position: relative !important;
  max-width: 90vw !important;
  max-height: 90vh !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.${this.namespace} .${this.cssPrefix}image-preview {
  max-width: 100% !important;
  max-height: 100% !important;
  object-fit: contain !important;
  border-radius: 8px !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5) !important;
  cursor: pointer !important;
}

.${this.namespace} .${this.cssPrefix}image-close {
  position: absolute !important;
  top: 20px !important;
  right: 20px !important;
  width: 40px !important;
  height: 40px !important;
  border: none !important;
  border-radius: 50% !important;
  background: rgba(255, 255, 255, 0.2) !important;
  color: white !important;
  font-size: 18px !important;
  cursor: pointer !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: all 0.3s ease !important;
  backdrop-filter: blur(10px) !important;
  z-index: 1000000 !important;
}

.${this.namespace} .${this.cssPrefix}image-close:hover {
  background: rgba(255, 255, 255, 0.3) !important;
  transform: scale(1.1) !important;
}

.${this.namespace} .${this.cssPrefix}image-download {
  position: absolute !important;
  bottom: 20px !important;
  right: 20px !important;
  padding: 12px 20px !important;
  border: none !important;
  border-radius: 25px !important;
  background: rgba(255, 255, 255, 0.2) !important;
  color: white !important;
  font-size: 14px !important;
  cursor: pointer !important;
  transition: all 0.3s ease !important;
  backdrop-filter: blur(10px) !important;
  z-index: 1000000 !important;
}

.${this.namespace} .${this.cssPrefix}image-download:hover {
  background: rgba(255, 255, 255, 0.3) !important;
  transform: translateY(-2px) !important;
}

.${this.namespace} .${this.cssPrefix}image-loading {
  color: white !important;
  font-size: 18px !important;
  text-align: center !important;
  padding: 20px !important;
}

/* 移动端优化 */
@media (max-width: 768px) {
  .${this.namespace} .${this.cssPrefix}image-overlay {
    padding: 10px !important;
  }
  
  .${this.namespace} .${this.cssPrefix}image-close {
    width: 35px !important;
    height: 35px !important;
    font-size: 16px !important;
    top: 15px !important;
    right: 15px !important;
  }
  
  .${this.namespace} .${this.cssPrefix}image-download {
    bottom: 15px !important;
    right: 15px !important;
    padding: 10px 16px !important;
    font-size: 13px !important;
  }
}
    `;

    document.head.appendChild(style);
  }
}