/**
 * 视口管理模块
 * 负责检测设备变化、监听窗口大小变化、提供响应式适配
 */

import { ViewportInfo } from './style-system';

export type ViewportChangeCallback = (viewport: ViewportInfo) => void;

export class ViewportManager {
  private static instance: ViewportManager;
  private listeners: ViewportChangeCallback[] = [];
  private currentViewport: ViewportInfo | null = null;
  private resizeTimer: number | null = null;
  private readonly debounceDelay = 300; // 防抖延迟

  static getInstance(): ViewportManager {
    if (!ViewportManager.instance) {
      ViewportManager.instance = new ViewportManager();
    }
    return ViewportManager.instance;
  }

  constructor() {
    this.init();
  }

  private init(): void {
    // 初始检测
    this.updateViewport();

    // 监听窗口大小变化
    window.addEventListener('resize', this.handleResize.bind(this));
    
    // 监听屏幕方向变化
    window.addEventListener('orientationchange', this.handleOrientationChange.bind(this));
    
    // 监听页面可见性变化
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

    console.log('📱 视口管理器已初始化');
  }

  /**
   * 检测当前视口信息
   */
  private detectViewport(): ViewportInfo {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    
    // 断点判断
    let breakpoint: ViewportInfo['breakpoint'];
    if (width < 480) breakpoint = 'xs';
    else if (width < 768) breakpoint = 'sm';
    else if (width < 1024) breakpoint = 'md';
    else if (width < 1440) breakpoint = 'lg';
    else breakpoint = 'xl';

    // 设备类型判断
    const userAgent = navigator.userAgent;
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    const isMobile = width < 768 || (isMobileUA && width < 1024);
    const isTablet = !isMobile && width >= 768 && width < 1024 && (hasTouch || isMobileUA);
    const isDesktop = !isMobile && !isTablet;
    
    const orientation = width > height ? 'landscape' : 'portrait';

    return {
      width,
      height,
      breakpoint,
      isMobile,
      isTablet,
      isDesktop,
      devicePixelRatio: dpr,
      orientation
    };
  }

  /**
   * 更新视口信息并通知监听器
   */
  private updateViewport(): void {
    const newViewport = this.detectViewport();
    const hasChanged = this.hasViewportChanged(newViewport);

    if (hasChanged) {
      this.currentViewport = newViewport;
      this.notifyListeners(newViewport);
      
      console.log(`📱 视口变化:`, {
        size: `${newViewport.width}x${newViewport.height}`,
        breakpoint: newViewport.breakpoint,
        device: newViewport.isMobile ? '移动端' : newViewport.isTablet ? '平板' : '桌面端',
        orientation: newViewport.orientation,
        dpr: newViewport.devicePixelRatio
      });
    }
  }

  /**
   * 检查视口是否发生显著变化
   */
  private hasViewportChanged(newViewport: ViewportInfo): boolean {
    if (!this.currentViewport) return true;

    const current = this.currentViewport;
    
    // 检查关键属性是否变化
    return (
      current.breakpoint !== newViewport.breakpoint ||
      current.orientation !== newViewport.orientation ||
      Math.abs(current.width - newViewport.width) > 50 ||
      Math.abs(current.height - newViewport.height) > 50
    );
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(viewport: ViewportInfo): void {
    this.listeners.forEach(callback => {
      try {
        callback(viewport);
      } catch (error) {
        console.error('视口变化监听器执行错误:', error);
      }
    });
  }

  /**
   * 处理窗口大小变化（防抖）
   */
  private handleResize(): void {
    if (this.resizeTimer) {
      clearTimeout(this.resizeTimer);
    }

    this.resizeTimer = window.setTimeout(() => {
      this.updateViewport();
      this.resizeTimer = null;
    }, this.debounceDelay);
  }

  /**
   * 处理屏幕方向变化
   */
  private handleOrientationChange(): void {
    // 方向变化后稍微延迟检测，因为某些浏览器需要时间更新尺寸
    setTimeout(() => {
      this.updateViewport();
    }, 500);
  }

  /**
   * 处理页面可见性变化
   */
  private handleVisibilityChange(): void {
    if (!document.hidden) {
      // 页面重新可见时重新检测
      setTimeout(() => {
        this.updateViewport();
      }, 100);
    }
  }

  /**
   * 获取当前视口信息
   */
  getCurrentViewport(): ViewportInfo {
    if (!this.currentViewport) {
      this.currentViewport = this.detectViewport();
    }
    return this.currentViewport;
  }

  /**
   * 添加视口变化监听器
   */
  onViewportChange(callback: ViewportChangeCallback): void {
    this.listeners.push(callback);
  }

  /**
   * 移除视口变化监听器
   */
  removeViewportListener(callback: ViewportChangeCallback): void {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 清理所有监听器
   */
  cleanup(): void {
    this.listeners = [];
    
    if (this.resizeTimer) {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = null;
    }
  }

  /**
   * 获取设备信息摘要
   */
  getDeviceSummary(): string {
    const viewport = this.getCurrentViewport();
    const deviceType = viewport.isMobile ? '移动端' : viewport.isTablet ? '平板' : '桌面端';
    return `${deviceType} ${viewport.width}x${viewport.height} (${viewport.breakpoint})`;
  }

  /**
   * 检查是否为移动设备
   */
  isMobile(): boolean {
    return this.getCurrentViewport().isMobile;
  }

  /**
   * 检查是否为平板设备
   */
  isTablet(): boolean {
    return this.getCurrentViewport().isTablet;
  }

  /**
   * 检查是否为桌面设备
   */
  isDesktop(): boolean {
    return this.getCurrentViewport().isDesktop;
  }

  /**
   * 获取当前断点
   */
  getCurrentBreakpoint(): ViewportInfo['breakpoint'] {
    return this.getCurrentViewport().breakpoint;
  }
}