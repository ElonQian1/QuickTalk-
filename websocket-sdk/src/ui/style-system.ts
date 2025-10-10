/**
 * 响应式样式系统
 * 解决独立站样式覆盖问题，确保字体和窗口按比例缩放
 */

export interface ViewportInfo {
  width: number;
  height: number;
  breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  devicePixelRatio: number;
  orientation: 'portrait' | 'landscape';
}

export interface StyleConfig {
  // 基础尺寸
  baseFontSize: number;
  baseLineHeight: number;
  
  // 组件尺寸
  fabSize: number;
  panelWidth: number;
  panelHeight: number;
  
  // 字体尺寸
  titleSize: number;
  messageSize: number;
  inputSize: number;
  buttonSize: number;
  
  // 间距
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  
  // 其他
  borderRadius: number;
  zIndex: number;
}

export class StyleSystem {
  private static instance: StyleSystem;
  private styleElement: HTMLStyleElement | null = null;
  private readonly cssPrefix = 'qt-sdk-'; // CSS类名前缀，避免冲突
  private readonly namespace = 'quicktalk-embed'; // 命名空间

  static getInstance(): StyleSystem {
    if (!StyleSystem.instance) {
      StyleSystem.instance = new StyleSystem();
    }
    return StyleSystem.instance;
  }

  /**
   * 检测当前视口信息
   */
  detectViewport(): ViewportInfo {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    
    // 断点定义 - 基于常见设备尺寸
    let breakpoint: ViewportInfo['breakpoint'];
    if (width < 480) breakpoint = 'xs';      // 小屏手机
    else if (width < 768) breakpoint = 'sm';  // 大屏手机
    else if (width < 1024) breakpoint = 'md'; // 平板
    else if (width < 1440) breakpoint = 'lg'; // 小屏桌面
    else breakpoint = 'xl';                   // 大屏桌面

    // 设备类型判断
    const isMobile = width < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isTablet = width >= 768 && width < 1024;
    const isDesktop = width >= 1024;
    
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
   * 基于视口计算响应式样式配置
   * 重点解决字体过小问题，确保字体和窗口按比例缩放
   */
  calculateStyleConfig(viewport: ViewportInfo): StyleConfig {
    const { width, height, breakpoint, isMobile, devicePixelRatio } = viewport;

    // 基础字体大小计算 - 确保在高分辨率设备上足够大
    // 对于1920px高度的手机，基础字体应该达到50px左右
    let baseFontSize: number;
    
    if (isMobile) {
      // 移动端：基于视口宽度和高度综合计算
      // 对于高分辨率设备（如iPhone Pro Max 1290x2796），需要更大的字体
      const viewportScore = Math.sqrt(width * height) / 100; // 视口面积分数
      baseFontSize = Math.max(
        20, // 最小字体
        Math.min(
          60, // 最大字体
          viewportScore * devicePixelRatio * 1.2 // 考虑设备像素比
        )
      );
      
      // 针对高分辨率设备进一步调整
      if (height > 1500) {
        baseFontSize = Math.max(baseFontSize, 45); // 高分辨率设备最小45px
      }
    } else {
      // 桌面端：基于宽度计算，相对保守
      baseFontSize = Math.max(16, Math.min(24, width / 80));
    }

    // 确保字体大小是整数，避免模糊
    baseFontSize = Math.round(baseFontSize);

    // 其他尺寸基于基础字体按比例计算
    const scale = baseFontSize / 16; // 以16px为基准的缩放比例

    const config: StyleConfig = {
      baseFontSize,
      baseLineHeight: 1.5,
      
      // FAB按钮尺寸 - 确保足够大以便点击
      fabSize: Math.round(baseFontSize * 3.5), // 约56-210px
      
      // 面板尺寸
      panelWidth: isMobile ? 
        Math.min(width - 32, width * 0.95) : // 移动端占满屏幕减去边距
        Math.max(360, Math.min(420, width * 0.3)), // 桌面端固定范围
      panelHeight: isMobile ?
        Math.min(height - 100, height * 0.8) : // 移动端高度适配
        Math.max(500, Math.min(700, height * 0.75)), // 桌面端固定范围
      
      // 字体尺寸 - 都基于基础字体按比例缩放
      titleSize: Math.round(baseFontSize * 1.25),   // 标题更大
      messageSize: Math.round(baseFontSize * 0.9),  // 消息稍小
      inputSize: Math.round(baseFontSize * 0.95),   // 输入框合适
      buttonSize: Math.round(baseFontSize * 0.85),  // 按钮稍小
      
      // 间距系统 - 基于字体大小等比缩放
      spacing: {
        xs: Math.round(baseFontSize * 0.25),   // 4-15px
        sm: Math.round(baseFontSize * 0.5),    // 8-30px
        md: Math.round(baseFontSize * 0.75),   // 12-45px
        lg: Math.round(baseFontSize * 1),      // 16-60px
        xl: Math.round(baseFontSize * 1.5),    // 24-90px
      },
      
      borderRadius: Math.round(baseFontSize * 0.5), // 8-30px
      zIndex: 999999 // 确保在最上层
    };

    console.log(`📱 响应式样式计算完成:`, {
      viewport: `${width}x${height}`,
      breakpoint,
      devicePixelRatio,
      baseFontSize: `${baseFontSize}px`,
      fabSize: `${config.fabSize}px`,
      panelSize: `${config.panelWidth}x${config.panelHeight}px`,
      isMobile
    });

    return config;
  }

  /**
   * 生成隔离的CSS样式
   * 使用高优先级选择器和!important确保不被覆盖
   */
  generateIsolatedCSS(config: StyleConfig): string {
    const p = this.cssPrefix; // 简化前缀
    
    return `
/* QuickTalk SDK 样式隔离 - 防止被宿主页面覆盖 */
.${this.namespace} * {
  box-sizing: border-box !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif !important;
}

/* FAB按钮 - 客服入口 */
.${this.namespace} .${p}fab {
  position: fixed !important;
  bottom: ${config.spacing.xl}px !important;
  right: ${config.spacing.xl}px !important;
  width: ${config.fabSize}px !important;
  height: ${config.fabSize}px !important;
  border-radius: 50% !important;
  background: linear-gradient(135deg, #07C160 0%, #06A94D 100%) !important;
  border: none !important;
  cursor: pointer !important;
  z-index: ${config.zIndex} !important;
  box-shadow: 0 8px 32px rgba(7, 193, 96, 0.3) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: ${config.buttonSize}px !important;
  color: #ffffff !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  transform: scale(1) !important;
  outline: none !important;
  margin: 0 !important;
  padding: 0 !important;
}

.${this.namespace} .${p}fab:hover {
  transform: scale(1.05) !important;
  box-shadow: 0 12px 40px rgba(7, 193, 96, 0.4) !important;
}

.${this.namespace} .${p}fab:active {
  transform: scale(0.95) !important;
}

/* 聊天面板 */
.${this.namespace} .${p}panel {
  position: fixed !important;
  bottom: ${config.spacing.xl + config.fabSize + config.spacing.md}px !important;
  right: ${config.spacing.xl}px !important;
  width: ${config.panelWidth}px !important;
  height: ${config.panelHeight}px !important;
  background: #ffffff !important;
  border-radius: ${config.borderRadius}px !important;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.15) !important;
  z-index: ${config.zIndex - 1} !important;
  display: none !important;
  flex-direction: column !important;
  overflow: hidden !important;
  font-size: ${config.baseFontSize}px !important;
  line-height: ${config.baseLineHeight} !important;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
}

.${this.namespace} .${p}panel.${p}open {
  display: flex !important;
  animation: ${p}slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

/* 面板头部 */
.${this.namespace} .${p}header {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  padding: ${config.spacing.lg}px ${config.spacing.xl}px !important;
  background: linear-gradient(135deg, #07C160 0%, #06A94D 100%) !important;
  color: #ffffff !important;
  font-size: ${config.titleSize}px !important;
  font-weight: 600 !important;
  border-radius: ${config.borderRadius}px ${config.borderRadius}px 0 0 !important;
  flex-shrink: 0 !important;
  margin: 0 !important;
  border: none !important;
}

.${this.namespace} .${p}header-title {
  font-size: ${config.titleSize}px !important;
  font-weight: 600 !important;
  color: #ffffff !important;
  margin: 0 !important;
  padding: 0 !important;
}

.${this.namespace} .${p}close-btn {
  background: rgba(255, 255, 255, 0.2) !important;
  color: #ffffff !important;
  border: none !important;
  border-radius: 50% !important;
  width: ${config.spacing.xl * 1.5}px !important;
  height: ${config.spacing.xl * 1.5}px !important;
  font-size: ${config.buttonSize}px !important;
  cursor: pointer !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: background 0.2s ease !important;
  margin: 0 !important;
  padding: 0 !important;
  outline: none !important;
}

.${this.namespace} .${p}close-btn:hover {
  background: rgba(255, 255, 255, 0.3) !important;
}

/* 消息区域 */
.${this.namespace} .${p}messages {
  flex: 1 !important;
  padding: ${config.spacing.lg}px !important;
  overflow-y: auto !important;
  -webkit-overflow-scrolling: touch !important;
  font-size: ${config.messageSize}px !important;
  line-height: ${config.baseLineHeight} !important;
  background: #f8f9fa !important;
  margin: 0 !important;
  border: none !important;
}

/* 消息项 */
.${this.namespace} .${p}message {
  margin-bottom: ${config.spacing.md}px !important;
  padding: ${config.spacing.md}px ${config.spacing.lg}px !important;
  border-radius: ${config.borderRadius}px !important;
  font-size: ${config.messageSize}px !important;
  line-height: ${config.baseLineHeight} !important;
  max-width: 85% !important;
  word-wrap: break-word !important;
  border: none !important;
}

.${this.namespace} .${p}message.${p}customer {
  background: #07C160 !important;
  color: #ffffff !important;
  margin-left: auto !important;
  margin-right: 0 !important;
}

.${this.namespace} .${p}message.${p}staff {
  background: #ffffff !important;
  color: #333333 !important;
  border: 1px solid #e5e5e5 !important;
  margin-left: 0 !important;
  margin-right: auto !important;
}

/* 输入区域 */
.${this.namespace} .${p}input-area {
  display: flex !important;
  gap: ${config.spacing.sm}px !important;
  padding: ${config.spacing.lg}px !important;
  background: #ffffff !important;
  border-top: 1px solid #e5e5e5 !important;
  border-radius: 0 0 ${config.borderRadius}px ${config.borderRadius}px !important;
  flex-shrink: 0 !important;
  margin: 0 !important;
}

.${this.namespace} .${p}input {
  flex: 1 !important;
  padding: ${config.spacing.md}px ${config.spacing.lg}px !important;
  font-size: ${config.inputSize}px !important;
  border: 1px solid #e5e5e5 !important;
  border-radius: ${config.borderRadius}px !important;
  background: #ffffff !important;
  color: #333333 !important;
  outline: none !important;
  margin: 0 !important;
  font-family: inherit !important;
}

.${this.namespace} .${p}input:focus {
  border-color: #07C160 !important;
  box-shadow: 0 0 0 2px rgba(7, 193, 96, 0.1) !important;
}

.${this.namespace} .${p}input::placeholder {
  color: #999999 !important;
}

/* 按钮样式 */
.${this.namespace} .${p}btn {
  padding: ${config.spacing.md}px ${config.spacing.lg}px !important;
  font-size: ${config.buttonSize}px !important;
  border: none !important;
  border-radius: ${config.borderRadius}px !important;
  cursor: pointer !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: all 0.2s ease !important;
  margin: 0 !important;
  outline: none !important;
  font-family: inherit !important;
  min-width: ${config.spacing.xl * 2}px !important;
}

.${this.namespace} .${p}btn-primary {
  background: #07C160 !important;
  color: #ffffff !important;
}

.${this.namespace} .${p}btn-primary:hover {
  background: #06A94D !important;
}

.${this.namespace} .${p}btn-secondary {
  background: #f8f9fa !important;
  color: #666666 !important;
  border: 1px solid #e5e5e5 !important;
}

.${this.namespace} .${p}btn-secondary:hover {
  background: #e9ecef !important;
}

/* 隐藏文件输入 */
.${this.namespace} .${p}file-input {
  display: none !important;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .${this.namespace} .${p}panel {
    left: ${config.spacing.md}px !important;
    right: ${config.spacing.md}px !important;
    bottom: ${config.spacing.md}px !important;
    width: auto !important;
    height: ${Math.min(config.panelHeight, window.innerHeight - config.spacing.md * 2)}px !important;
  }
  
  .${this.namespace} .${p}fab {
    right: ${config.spacing.lg}px !important;
    bottom: ${config.spacing.lg}px !important;
  }
}

/* 动画定义 */
@keyframes ${p}slideUp {
  from { 
    transform: translateY(100%) scale(0.9) !important; 
    opacity: 0 !important; 
  }
  to { 
    transform: translateY(0) scale(1) !important; 
    opacity: 1 !important; 
  }
}

@keyframes ${p}fadeIn {
  from { opacity: 0 !important; }
  to { opacity: 1 !important; }
}

/* 滚动条样式 */
.${this.namespace} .${p}messages::-webkit-scrollbar {
  width: 4px !important;
}

.${this.namespace} .${p}messages::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2) !important;
  border-radius: 2px !important;
}

.${this.namespace} .${p}messages::-webkit-scrollbar-track {
  background: transparent !important;
}
`;
  }

  /**
   * 应用样式到页面
   */
  applyStyles(viewport: ViewportInfo): StyleConfig {
    const config = this.calculateStyleConfig(viewport);
    const css = this.generateIsolatedCSS(config);

    // 移除旧样式
    if (this.styleElement) {
      this.styleElement.remove();
    }

    // 创建新样式元素
    this.styleElement = document.createElement('style');
    this.styleElement.id = `${this.namespace}-styles`;
    this.styleElement.textContent = css;
    
    // 插入到head标签
    document.head.appendChild(this.styleElement);

    console.log(`✅ 响应式样式已应用 - 基础字体: ${config.baseFontSize}px, FAB: ${config.fabSize}px`);
    
    return config;
  }

  /**
   * 获取CSS命名空间
   */
  getNamespace(): string {
    return this.namespace;
  }

  /**
   * 获取CSS类前缀
   */
  getCSSPrefix(): string {
    return this.cssPrefix;
  }

  /**
   * 清理样式
   */
  cleanup(): void {
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }
  }
}