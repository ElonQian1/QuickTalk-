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

    // 基础字体大小计算 - 高分辨率友好的响应式算法
    let baseFontSize: number;
    
    // 计算设备的实际使用场景和分辨率
    const isRealMobile = width < 600 || isMobile;
    const isRealTablet = width >= 600 && width <= 1200 && height >= 800;
    const isRealDesktop = width > 1200 || (width > 1000 && height < 900);
    
    // 高分辨率检测
    const isHighRes = height > 1500 || (devicePixelRatio > 2 && height > 1200);
    
    if (isRealMobile) {
      // 移动端：特别照顾高分辨率设备
      if (isHighRes) {
        // 高分辨率移动端：基于高度的激进算法
        const heightFactor = Math.max(1.2, Math.min(3.0, height / 800));
        baseFontSize = Math.round(20 * heightFactor * Math.max(1, devicePixelRatio / 2));
        baseFontSize = Math.max(35, Math.min(60, baseFontSize));
      } else {
        // 普通移动端：温和的响应式
        const heightFactor = Math.max(1.0, Math.min(2.0, height / 800));
        baseFontSize = Math.round(18 * heightFactor);
        baseFontSize = Math.max(20, Math.min(35, baseFontSize));
      }
    } else if (isRealTablet) {
      // 平板：基于屏幕面积和分辨率
      const sizeFactor = Math.max(1.0, Math.min(2.0, Math.sqrt(width * height) / 1000));
      const dpiFactor = Math.max(1, Math.min(1.5, devicePixelRatio / 1.5));
      baseFontSize = Math.round(22 * sizeFactor * dpiFactor);
      baseFontSize = Math.max(26, Math.min(45, baseFontSize));
    } else {
      // 桌面端：相对保守但考虑高分辨率显示器
      const sizeFactor = Math.max(0.9, Math.min(1.8, Math.sqrt(width * height) / 1200));
      const dpiFactor = Math.max(1, Math.min(1.3, devicePixelRatio / 1.5));
      baseFontSize = Math.round(18 * sizeFactor * dpiFactor);
      baseFontSize = Math.max(18, Math.min(32, baseFontSize));
    }

    // 其他尺寸基于基础字体按比例计算
    const scale = baseFontSize / 16; // 以16px为基准的缩放比例

    const config: StyleConfig = {
      baseFontSize,
      baseLineHeight: 1.5,
      
      // FAB按钮尺寸 - 确保足够大以便点击，但不能过大
      fabSize: Math.max(56, Math.min(120, Math.round(baseFontSize * 3))), // 限制在56-120px之间
      
      // 面板尺寸 - 基于字体大小和真实设备类型智能计算
      panelWidth: (() => {
        if (isRealMobile) {
          // 移动端：考虑左右边距，基于字体大小
          const margin = Math.round(baseFontSize * 1.5) * 2;
          return Math.min(width - margin, width * 0.9);
        } else if (isRealTablet || (width >= 1000 && width <= 1200)) {
          // 平板或类平板设备：根据字体大小适配，更宽的窗口以容纳大字体
          const baseWidth = Math.max(450, baseFontSize * 14);
          return Math.min(baseWidth, width * 0.5);
        } else {
          // 桌面端：根据字体大小适配，但有合理上限
          const baseWidth = Math.max(400, baseFontSize * 12);
          return Math.min(baseWidth, Math.max(420, width * 0.35));
        }
      })(),
      panelHeight: (() => {
        if (isRealMobile) {
          // 移动端：基于字体大小和屏幕高度
          const minHeight = Math.max(400, baseFontSize * 12);
          return Math.min(height - 100, Math.max(minHeight, height * 0.8));
        } else if (isRealTablet || (width >= 1000 && width <= 1200)) {
          // 平板或类平板设备：根据组件需求计算最小高度，确保有足够空间
          const headerHeight = Math.round(baseFontSize * 1.25) + Math.round(baseFontSize * 1) * 2;
          const toolbarHeight = Math.round(baseFontSize * 0.55) * 4;
          const inputAreaHeight = Math.max(80, Math.round(baseFontSize * 0.55) * 3) + 40;
          const minMessagesHeight = Math.max(300, baseFontSize * 8);
          const calculatedHeight = headerHeight + toolbarHeight + inputAreaHeight + minMessagesHeight;
          
          const minTotalHeight = Math.max(calculatedHeight, baseFontSize * 18);
          return Math.min(minTotalHeight, height * 0.85);
        } else {
          // 桌面端：根据字体大小适配
          const minHeight = Math.max(500, baseFontSize * 16);
          return Math.min(minHeight, height * 0.75);
        }
      })(),
      
      // 字体尺寸 - 都基于基础字体按比例缩放
      titleSize: Math.round(baseFontSize * 1.25),   // 标题更大
      messageSize: Math.round(baseFontSize * 0.6),  // 消息字体更小，适合阅读
      inputSize: Math.round(baseFontSize * 0.65),   // 输入框字体
      buttonSize: Math.round(baseFontSize * 0.55),  // 按钮字体更小
      
      // 间距系统 - 基于字体大小等比缩放，但要有合理上限
      spacing: {
        xs: Math.max(4, Math.min(8, Math.round(baseFontSize * 0.25))),     // 4-8px
        sm: Math.max(8, Math.min(16, Math.round(baseFontSize * 0.5))),     // 8-16px
        md: Math.max(12, Math.min(24, Math.round(baseFontSize * 0.75))),   // 12-24px
        lg: Math.max(16, Math.min(32, Math.round(baseFontSize * 1))),      // 16-32px
        xl: Math.max(24, Math.min(48, Math.round(baseFontSize * 1.5))),    // 24-48px
      },
      
      borderRadius: Math.max(8, Math.min(16, Math.round(baseFontSize * 0.5))), // 8-16px
      zIndex: 999999 // 确保在最上层
    };

    console.log(`📱 响应式样式计算完成:`, {
      viewport: `${width}x${height}`,
      breakpoint,
      devicePixelRatio,
      baseFontSize: `${baseFontSize}px`,
      fabSize: `${config.fabSize}px`,
      panelSize: `${config.panelWidth}x${config.panelHeight}px`,
      spacingXL: `${config.spacing.xl}px`,
      inputArea: {
        buttonSize: `${config.buttonSize}px`,
        inputSize: `${config.inputSize}px`,
        buttonMinWidth: `${Math.max(60, Math.min(120, config.buttonSize * 4))}px`,
        inputMinHeight: `${Math.max(36, config.inputSize * 1.8)}px`,
        areaMinHeight: `${Math.max(60, config.buttonSize * 2.5)}px`
      },
      panelPosition: {
        right: `${config.spacing.xl}px`,
        maxWidth: `calc(100vw - ${config.spacing.xl * 2}px)`,
        wouldExceedLeft: (config.panelWidth + config.spacing.xl) > width
      },
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
  font-size: ${Math.round(config.fabSize * 0.4)}px !important;
  color: #ffffff !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  transform: scale(1) !important;
  outline: none !important;
  margin: 0 !important;
  padding: 0 !important;
}

/* FAB按钮中的SVG图标 */
.${this.namespace} .${p}fab svg {
  fill: currentColor !important;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
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
  font-size: ${config.messageSize}px !important;
  line-height: ${config.baseLineHeight} !important;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  /* 确保面板不会超出视口边界 */
  max-width: calc(100vw - ${config.spacing.xl * 2}px) !important;
  min-width: 300px !important;
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

/* 关闭按钮中的SVG图标 */
.${this.namespace} .${p}close-btn svg {
  fill: currentColor !important;
  transition: transform 0.2s ease !important;
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

/* 工具栏区域 */
.${this.namespace} .${p}toolbar {
  display: flex !important;
  gap: ${config.spacing.sm}px !important;
  padding: ${config.spacing.md}px ${config.spacing.lg}px !important;
  background: #f8f9fa !important;
  border-top: 1px solid #e5e5e5 !important;
  border-bottom: 1px solid #e5e5e5 !important;
  flex-shrink: 0 !important;
  margin: 0 !important;
  justify-content: flex-start !important;
  align-items: center !important;
  min-height: ${Math.max(60, Math.round(config.buttonSize * 3.5))}px !important;
  box-sizing: border-box !important;
}

/* 工具栏按钮 */
.${this.namespace} .${p}btn-toolbar {
  padding: ${config.spacing.sm}px ${config.spacing.md}px !important;
  font-size: ${Math.round(config.buttonSize * 1.4)}px !important;
  border: 1px solid #d0d7de !important;
  border-radius: ${config.borderRadius}px !important;
  cursor: pointer !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: all 0.2s ease !important;
  margin: 0 !important;
  outline: none !important;
  font-family: inherit !important;
  background: #ffffff !important;
  color: #656d76 !important;
  min-width: ${Math.max(40, Math.round(config.buttonSize * 2.5))}px !important;
  height: ${Math.max(40, Math.round(config.buttonSize * 2.5))}px !important;
  flex-shrink: 0 !important;
}

.${this.namespace} .${p}btn-toolbar:hover {
  background: #f3f4f6 !important;
  border-color: #b1bac4 !important;
  color: #24292f !important;
}

.${this.namespace} .${p}btn-toolbar:active {
  background: #e9ecef !important;
  transform: scale(0.95) !important;
}

/* 工具栏按钮中的SVG图标样式 */
.${this.namespace} .${p}btn-toolbar svg {
  display: block !important;
  transition: color 0.2s ease !important;
  fill: currentColor !important;
  flex-shrink: 0 !important;
}

.${this.namespace} .${p}btn-toolbar:hover svg {
  fill: currentColor !important;
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
  align-items: center !important;
  min-height: ${Math.max(60, config.buttonSize * 2.5)}px !important;
  box-sizing: border-box !important;
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
  min-height: ${Math.max(36, config.inputSize * 1.8)}px !important;
  box-sizing: border-box !important;
  max-width: none !important;
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
  min-width: ${Math.max(60, Math.min(120, config.buttonSize * 4))}px !important;
  white-space: nowrap !important;
  flex-shrink: 0 !important;
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
  
  /* 移动端工具栏适配 */
  .${this.namespace} .${p}toolbar {
    padding: ${config.spacing.sm}px ${config.spacing.md}px !important;
    gap: ${config.spacing.xs}px !important;
  }
  
  .${this.namespace} .${p}btn-toolbar {
    min-width: ${config.spacing.lg}px !important;
    height: ${config.spacing.lg}px !important;
    padding: ${config.spacing.xs}px !important;
    font-size: ${Math.max(config.buttonSize - 4, 12)}px !important;
  }
  
  .${this.namespace} .${p}input-area {
    padding: ${config.spacing.md}px !important;
    gap: ${config.spacing.xs}px !important;
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