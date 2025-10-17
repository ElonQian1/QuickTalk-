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
  private static enabled = true;
  private overlay: HTMLElement | null = null;
  private currentImage: HTMLImageElement | null = null;
  private readonly cssPrefix = 'qt-sdk-';
  private readonly namespace = 'quicktalk-embed';

  // 交互状态（零依赖手势缩放/拖拽）
  private scale = 1;
  private minScale = 1;
  private maxScale = 4;
  private translate = { x: 0, y: 0 };
  private pointers: Map<number, { x: number; y: number }> = new Map();
  private lastDistance = 0;
  private lastCenter: { x: number; y: number } | null = null;
  private singleTapTimer: number | null = null;

  static getInstance(): ImageViewer {
    if (!ImageViewer.instance) {
      ImageViewer.instance = new ImageViewer();
    }
    return ImageViewer.instance;
  }

  /**
   * 启用/禁用图片预览（对宿主提供开关）
   */
  static setEnabled(flag: boolean) {
    ImageViewer.enabled = flag;
  }

  private constructor() {
    this.createStyles();
    this.bindGlobalEvents();
  }

  /**
   * 协议适配工具函数 - 只在必要时进行协议适配
   */
  private adaptUrlProtocol(url: string): string {
    if (!url || typeof url !== 'string') {
      return url;
    }
    
    // 如果是相对路径、数据URL或已经是HTTPS，直接返回
    if (url.startsWith('/') || url.startsWith('data:') || url.startsWith('https://')) {
      return url;
    }
    
    // 判断是否为开发环境：当前页面域名是localhost或127.0.0.1
    const isCurrentHostDev = window.location.hostname === 'localhost' || 
                            window.location.hostname === '127.0.0.1';
    
    // 判断目标URL是否为localhost开发服务器
    const isTargetLocalhost = url.includes('localhost:') || url.includes('127.0.0.1:');
    
    // 如果当前页面是HTTPS且URL是HTTP，需要转换
    if (window.location.protocol === 'https:' && url.startsWith('http://')) {
      // 对于localhost开发服务器，也需要转换为HTTPS以避免Mixed Content错误
      // 现代浏览器的安全策略会阻止HTTPS页面加载HTTP资源
      if (isTargetLocalhost) {
        const adaptedUrl = url.replace('http://localhost:', 'https://localhost:')
                             .replace('http://127.0.0.1:', 'https://127.0.0.1:');
        console.log('🖼️ ImageViewer适配localhost为HTTPS:', { 
          url, 
          adaptedUrl,
          currentProtocol: window.location.protocol,
          currentHost: window.location.hostname,
          reason: '避免Mixed Content错误，转换localhost为HTTPS'
        });
        return adaptedUrl;
      }
      
      // 生产环境HTTPS页面访问外部HTTP资源，需要转换
      const adaptedUrl = url.replace('http://', 'https://');
      console.log('🖼️ ImageViewer协议适配:', { 
        original: url, 
        adapted: adaptedUrl,
        reason: 'HTTPS页面访问外部HTTP图片',
        currentHost: window.location.hostname,
        isCurrentHostDev,
        isTargetLocalhost
      });
      return adaptedUrl;
    }
    
    // HTTP页面或无需转换
    console.log('🖼️ ImageViewer URL保持原样:', { 
      url, 
      currentProtocol: window.location.protocol,
      currentHost: window.location.hostname,
      reason: 'HTTP页面或无需转换'
    });
    return url;
  }

  /**
   * 显示图片预览
   */
  show(options: ImageViewerOptions): void {
    console.log('🖼️ ImageViewer.show 被调用', { enabled: ImageViewer.enabled, options });
    if (!ImageViewer.enabled) {
      console.warn('⚠️ ImageViewer 已被禁用');
      return;
    }
    this.createOverlay();
    this.loadImage(options);
  }

  /**
   * 关闭图片预览
   */
  close(): void {
    if (this.overlay) {
      // 直接移除，不用动画
      console.log('🖼️ 关闭 overlay');
      if (this.overlay && this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
      this.overlay = null;
      this.currentImage = null;
      this.unlockBodyScroll();
      this.resetTransformState();
    }
  }

  /**
   * 创建覆盖层
   */
  private createOverlay(): void {
    console.log('🖼️ 开始创建 overlay');
    this.overlay = document.createElement('div');
    this.overlay.className = `${this.namespace} ${this.cssPrefix}image-overlay`;
    console.log('🖼️ overlay 类名:', this.overlay.className);
    // 确保可交互
    (this.overlay.style as any).pointerEvents = 'auto';
    // 关键内联样式兜底（防宿主样式或 CSP 影响）
    this.overlay.style.setProperty('position', 'fixed', 'important');
    this.overlay.style.setProperty('top', '0', 'important');
    this.overlay.style.setProperty('left', '0', 'important');
    this.overlay.style.setProperty('width', '100vw', 'important');
    this.overlay.style.setProperty('height', '100vh', 'important');
    this.overlay.style.setProperty('z-index', '2147483000', 'important');
    this.overlay.style.setProperty('background', 'rgba(0,0,0,0.9)', 'important');
    this.overlay.style.setProperty('display', 'flex', 'important');
    this.overlay.style.setProperty('align-items', 'center', 'important');
    this.overlay.style.setProperty('justify-content', 'center', 'important');
    // 确保没有任何隐藏属性
    this.overlay.style.removeProperty('opacity');
    this.overlay.style.removeProperty('visibility');
    console.log('🖼️ overlay 内联样式已设置');
    // 禁止背景滚动穿透
    this.lockBodyScroll();
    
    // 创建关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.className = `${this.cssPrefix}image-close`;
    closeBtn.innerHTML = '✕';
    closeBtn.title = '关闭';
    closeBtn.addEventListener('click', () => this.close());

    // 创建图片容器 - 简化为相对定位的手势区域
    const imageContainer = document.createElement('div');
    imageContainer.className = `${this.cssPrefix}image-container`;
    // 只作为手势监听区域，不参与布局
    imageContainer.style.setProperty('position', 'absolute', 'important');
    imageContainer.style.setProperty('top', '0', 'important');
    imageContainer.style.setProperty('left', '0', 'important');
    imageContainer.style.setProperty('width', '100%', 'important');
    imageContainer.style.setProperty('height', '100%', 'important');
    imageContainer.style.setProperty('pointer-events', 'none', 'important'); // 让点击穿透到overlay
    imageContainer.style.touchAction = 'none';

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

    // 点击覆盖层空白区域关闭（避免点击容器误关）
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    document.body.appendChild(this.overlay);
    console.log('🖼️ overlay 已添加到 body', { 
      rect: this.overlay.getBoundingClientRect(),
      computedOpacity: getComputedStyle(this.overlay).opacity,
      computedZIndex: getComputedStyle(this.overlay).zIndex,
      computedPosition: getComputedStyle(this.overlay).position
    });

    // 直接显示，不用 opacity 过渡
    console.log('🖼️ 直接显示 overlay（跳过 opacity）');
    // 强制显示：移除任何可能隐藏的属性
    this.overlay.style.removeProperty('opacity');
    this.overlay.style.removeProperty('visibility');
    this.overlay.style.setProperty('display', 'flex', 'important');
    console.log('🖼️ overlay 应该已显示', {
      display: getComputedStyle(this.overlay).display,
      opacity: getComputedStyle(this.overlay).opacity,
      visibility: getComputedStyle(this.overlay).visibility
    });
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
    // 手势控制通过容器监听，图片设置基础样式
    img.style.setProperty('pointer-events', 'none', 'important');
    img.style.setProperty('user-select', 'none', 'important');
    img.style.setProperty('display', 'block', 'important');

    // 协议适配
    const adaptedSrc = this.adaptUrlProtocol(options.src);
    let fallbackAttempted = false;

    // 图片加载成功
    img.onload = () => {
      console.log('🖼️ ImageViewer图片加载成功:', img.src);
      if (loading) loading.style.display = 'none';
      if (downloadBtn) {
        downloadBtn.style.display = 'block';
        downloadBtn.onclick = () => this.downloadImage(adaptedSrc, options.title);
      }
      imageContainer.appendChild(img);
      this.currentImage = img;
      // 初始化位姿
      this.resetTransformState();
      this.applyTransform();
      // 绑定手势到图片本身
      this.bindGestureEvents(img);
      
      console.log('🖼️ 图片已添加到容器', {
        imgDisplay: getComputedStyle(img).display,
        imgPosition: getComputedStyle(img).position,
        imgOpacity: getComputedStyle(img).opacity,
        imgTransform: getComputedStyle(img).transform
      });
      
      // 直接显示图片，不用任何动画或延时
      img.style.setProperty('opacity', '1', 'important');
      img.style.setProperty('display', 'block', 'important');
      console.log('🖼️ 图片直接显示完成', {
        finalOpacity: getComputedStyle(img).opacity,
        finalDisplay: getComputedStyle(img).display
      });
    };

    // 图片加载失败 - 添加智能回退
    img.onerror = () => {
      console.log('🖼️ ImageViewer图片加载失败:', img.src);
      
      if (!fallbackAttempted) {
        fallbackAttempted = true;
        
        // 尝试回退策略
        let fallbackUrl = '';
        if (adaptedSrc.startsWith('https://localhost')) {
          // HTTPS localhost失败，回退到HTTP
          fallbackUrl = adaptedSrc.replace('https://', 'http://');
          console.log('🔄 ImageViewer回退到HTTP:', fallbackUrl);
        } else if (adaptedSrc.startsWith('http://localhost')) {
          // HTTP localhost失败，尝试HTTPS
          fallbackUrl = adaptedSrc.replace('http://', 'https://');
          console.log('🔄 ImageViewer回退到HTTPS:', fallbackUrl);
        } else {
          // 外部URL失败，尝试原始URL
          fallbackUrl = options.src;
          console.log('🔄 ImageViewer回退到原始URL:', fallbackUrl);
        }
        
        if (fallbackUrl && fallbackUrl !== img.src) {
          if (loading) {
            loading.innerHTML = '🔄 正在重试...';
            loading.style.color = '#ff9800';
          }
          img.src = fallbackUrl;
          return; // 让回退URL尝试加载
        }
      }
      
      // 所有尝试都失败
      if (loading) {
        loading.innerHTML = '❌ 图片加载失败<br><small>请检查网络连接或图片URL</small>';
        loading.style.color = '#ff6b6b';
        loading.style.fontSize = '14px';
        loading.style.lineHeight = '1.4';
      }
      console.error('🖼️ ImageViewer所有加载尝试都失败了');
    };

    console.log('🖼️ ImageViewer开始加载图片:', adaptedSrc);
    img.src = adaptedSrc; // 使用协议适配后的URL
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

  // =============== 手势与变换逻辑 ===============
  private bindGestureEvents(container: HTMLElement): void {
    // 清理旧监听避免重复
    this.unbindGestureEvents(container);

    const onPointerDown = (e: PointerEvent) => {
      container.setPointerCapture?.(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      // 双击缩放（同时兼容移动端快速双击）
      if (e.pointerType !== 'touch') {
        // 桌面可用 dblclick 事件，touch 用时间窗
      }
      e.preventDefault();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const pts = Array.from(this.pointers.values());
      if (pts.length === 2) {
        const [p1, p2] = pts;
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const distance = Math.hypot(dx, dy);
        const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

        if (this.lastDistance) {
          const delta = distance / this.lastDistance;
          this.zoomAt(center, delta);
        }
        this.lastDistance = distance;
        this.lastCenter = center;
        e.preventDefault();
        return;
      }

      if (pts.length === 1) {
        const [p] = pts;
        const prev = this.lastCenter || p;
        const dx = p.x - prev.x;
        const dy = p.y - prev.y;
        this.lastCenter = p;
        this.pan(dx, dy);
        e.preventDefault();
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) {
        this.lastDistance = 0;
        this.lastCenter = null;
      }
    };

    const onDblClick = (e: MouseEvent) => {
      // 桌面双击放大/还原
      const targetScale = this.scale < 2 ? 2 : this.scale < 3 ? 3 : 1;
      this.zoomAt({ x: e.clientX, y: e.clientY }, targetScale / this.scale, true);
    };

    // 移动端双击（快速双击）
    const onQuickTap = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      if (this.singleTapTimer) {
        window.clearTimeout(this.singleTapTimer);
        this.singleTapTimer = null;
        const targetScale = this.scale < 2 ? 2 : 1;
        this.zoomAt({ x: e.clientX, y: e.clientY }, targetScale / this.scale, true);
      } else {
        this.singleTapTimer = window.setTimeout(() => {
          this.singleTapTimer = null;
        }, 220);
      }
    };

    const onWheel = (e: WheelEvent) => {
      // 阻止页面滚动；支持滚轮缩放（桌面）
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.1 : 0.9;
      this.zoomAt({ x: e.clientX, y: e.clientY }, delta);
    };

    container.addEventListener('pointerdown', onPointerDown, { passive: false });
    window.addEventListener('pointermove', onPointerMove as any, { passive: false });
    window.addEventListener('pointerup', onPointerUp as any, { passive: false });
    window.addEventListener('pointercancel', onPointerUp as any, { passive: false });
    container.addEventListener('dblclick', onDblClick as any, { passive: false });
    container.addEventListener('pointerdown', onQuickTap as any, { passive: false });
    this.overlay?.addEventListener('wheel', onWheel, { passive: false });

    // 存在 overlay 变化时的清理引用
    (container as any).__qtHandlers = { onPointerDown, onPointerMove, onPointerUp, onDblClick, onQuickTap, onWheel };
  }

  private unbindGestureEvents(container: HTMLElement): void {
    const h = (container as any).__qtHandlers;
    if (!h) return;
    try {
      container.removeEventListener('pointerdown', h.onPointerDown);
      window.removeEventListener('pointermove', h.onPointerMove);
      window.removeEventListener('pointerup', h.onPointerUp);
      window.removeEventListener('pointercancel', h.onPointerUp);
      container.removeEventListener('dblclick', h.onDblClick);
      container.removeEventListener('pointerdown', h.onQuickTap);
      this.overlay?.removeEventListener('wheel', h.onWheel);
    } catch {}
    (container as any).__qtHandlers = null;
  }

  private zoomAt(center: { x: number; y: number }, deltaScale: number, absolute = false): void {
    if (!this.currentImage) return;
    const prevScale = this.scale;
    const newScale = absolute
      ? Math.min(this.maxScale, Math.max(this.minScale, deltaScale))
      : Math.min(this.maxScale, Math.max(this.minScale, this.scale * deltaScale));
    if (newScale === prevScale) return;

    const rect = this.currentImage.getBoundingClientRect();
    const imgCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const offsetX = center.x - imgCenter.x;
    const offsetY = center.y - imgCenter.y;

    const scaleRatio = newScale / prevScale;
    this.translate.x = (this.translate.x - offsetX) * scaleRatio + offsetX;
    this.translate.y = (this.translate.y - offsetY) * scaleRatio + offsetY;

    this.scale = newScale;
    this.applyTransform();
  }

  private pan(dx: number, dy: number): void {
    if (!this.currentImage) return;
    this.translate.x += dx;
    this.translate.y += dy;
    this.applyTransform();
  }

  private applyTransform(): void {
    if (!this.currentImage) return;
    // 图片绝对定位在overlay层中央，以原始尺寸显示
    this.currentImage.style.setProperty('position', 'absolute', 'important');
    this.currentImage.style.setProperty('left', '50%', 'important');
    this.currentImage.style.setProperty('top', '50%', 'important');
    this.currentImage.style.setProperty('transform-origin', 'center center', 'important');
    this.currentImage.style.setProperty('will-change', 'transform', 'important');
    // 使用transform既做居中又做缩放和位移
    this.currentImage.style.setProperty('transform', `translate(-50%, -50%) translate(${this.translate.x}px, ${this.translate.y}px) scale(${this.scale})`, 'important');
    this.currentImage.style.setProperty('pointer-events', 'auto', 'important'); // 让图片可以接收手势事件
    console.log('🖼️ Transform应用 (绝对居中+原始尺寸):', { scale: this.scale, translate: this.translate, transform: this.currentImage.style.transform });
  }

  private resetTransformState(): void {
    this.scale = 1;
    this.translate = { x: 0, y: 0 };
    this.pointers.clear();
    this.lastCenter = null;
    this.lastDistance = 0;
  }

  private lockBodyScroll(): void {
    const body = document.body as any;
    if (body.__qtScrollLocked) return;
    body.__qtScrollLocked = true;
    body.__qtScrollY = window.scrollY;
    body.style.top = `-${window.scrollY}px`;
    body.style.position = 'fixed';
    body.style.left = '0';
    body.style.right = '0';
  }

  private unlockBodyScroll(): void {
    const body = document.body as any;
    if (!body.__qtScrollLocked) return;
    const y = parseInt(body.__qtScrollY || '0', 10);
    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    window.scrollTo(0, y);
    body.__qtScrollLocked = false;
    body.__qtScrollY = 0;
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
.${this.cssPrefix}image-overlay { /* 允许不依赖命名空间也能生效 */
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  background: rgba(0, 0, 0, 0.9) !important;
  z-index: 2147483000 !important; /* 极大确保置顶 */
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  /* opacity 由 JS 动态控制，不在 CSS 中设置 */
  padding: 20px !important;
  box-sizing: border-box !important;
  touch-action: none !important; /* 统一接管手势 */
  pointer-events: auto !important; /* 保证可点击 */
}
.${this.namespace}.${this.cssPrefix}image-overlay, /* overlay 同时具备两类名时 */
.${this.namespace} .${this.cssPrefix}image-overlay { /* overlay 作为命名空间子节点时 */
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  background: rgba(0, 0, 0, 0.9) !important;
  z-index: 2147483000 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  /* opacity 由 JS 动态控制，不在 CSS 中设置 */
  padding: 20px !important;
  box-sizing: border-box !important;
  touch-action: none !important; /* 统一接管手势 */
  pointer-events: auto !important;
}

.${this.cssPrefix}image-container,
.${this.namespace} .${this.cssPrefix}image-container {
  position: relative !important;
  max-width: 90vw !important;
  max-height: 90vh !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  overflow: hidden !important;
}

.${this.cssPrefix}image-preview,
.${this.namespace} .${this.cssPrefix}image-preview {
  position: absolute !important;
  left: 50% !important;
  top: 50% !important;
  max-width: 100% !important;
  max-height: 100% !important;
  object-fit: contain !important;
  border-radius: 8px !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5) !important;
  cursor: grab !important;
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
  .${this.cssPrefix}image-overlay,
  .${this.namespace}.${this.cssPrefix}image-overlay,
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