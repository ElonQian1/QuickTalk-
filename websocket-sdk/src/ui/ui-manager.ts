/**
 * UI组件管理器
 * 负责创建和管理聊天界面组件
 */

import { StyleSystem, ViewportInfo, StyleConfig } from './style-system';
import { ViewportManager } from './viewport-manager';
import { ImageViewer } from './image-viewer';
import { setFormattedTextContent } from '../utils/text-formatter';
import { createImageMessage, ImageMessageConfig } from './image-message';
import { ChatMessage } from '../core/websocket-client';

export interface UIComponents {
  container: HTMLElement;
  fab: HTMLButtonElement;
  panel: HTMLElement;
  header: HTMLElement;
  closeBtn: HTMLButtonElement;
  messagesContainer: HTMLElement;
  toolbarArea: HTMLElement;
  inputArea: HTMLElement;
  messageInput: HTMLInputElement;
  sendBtn: HTMLButtonElement;
  imageBtn: HTMLButtonElement;
  fileBtn: HTMLButtonElement;
  voiceBtn: HTMLButtonElement;
  emojiBtn: HTMLButtonElement;
  imageInput: HTMLInputElement;
  fileInput: HTMLInputElement;
}

export class UIManager {
  private static instance: UIManager;
  private styleSystem: StyleSystem;
  private viewportManager: ViewportManager;
  private imageViewer: ImageViewer; // 直接初始化，不为null
  private components: UIComponents | null = null;
  private isOpen = false;
  private currentConfig: StyleConfig | null = null;
  private statusMessageElement: HTMLElement | null = null; // 用于跟踪状态消息

  static getInstance(): UIManager {
    if (!UIManager.instance) {
      UIManager.instance = new UIManager();
    }
    return UIManager.instance;
  }

  constructor() {
    this.styleSystem = StyleSystem.getInstance();
    this.viewportManager = ViewportManager.getInstance();
    // 直接初始化ImageViewer，确保它在构造时就可用
    this.imageViewer = ImageViewer.getInstance();
    
    // 监听视口变化，动态调整UI
    this.viewportManager.onViewportChange(this.handleViewportChange.bind(this));
  }

  /**
   * 协议适配工具函数 - 与WebSocketClient保持一致的策略
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
        console.log('🔧 UIManager适配localhost为HTTPS:', { 
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
      console.log('🔧 UIManager协议适配:', { 
        original: url, 
        adapted: adaptedUrl,
        reason: 'HTTPS页面访问外部HTTP资源',
        currentHost: window.location.hostname,
        isCurrentHostDev,
        isTargetLocalhost
      });
      return adaptedUrl;
    }
    
    // HTTP页面或无需转换
    console.log('🔧 UIManager URL保持原样:', { 
      url, 
      currentProtocol: window.location.protocol,
      currentHost: window.location.hostname,
      reason: 'HTTP页面或无需转换'
    });
    return url;
  }

  /**
   * 获取ImageViewer实例
   */
  public getImageViewer(): ImageViewer {
    return this.imageViewer;
  }

  /**
   * 初始化UI组件
   */
  createUI(): UIComponents {
    // 如果已存在，直接返回
    if (this.components) {
      return this.components;
    }

    // 应用样式系统
    const viewport = this.viewportManager.getCurrentViewport();
    this.currentConfig = this.styleSystem.applyStyles(viewport);

    // 创建组件
    this.components = this.buildUIComponents();
    
    // 绑定事件
    this.bindEvents();
    
    console.log('🎨 UI组件已创建');
    return this.components;
  }

  /**
   * 构建UI组件结构
   */
  private buildUIComponents(): UIComponents {
    const namespace = this.styleSystem.getNamespace();
    const prefix = this.styleSystem.getCSSPrefix();
    
    // 获取响应式配置用于图标尺寸计算
    const viewport = this.styleSystem.detectViewport();
    const styleConfig = this.styleSystem.calculateStyleConfig(viewport);
    
    // 基于响应式配置计算各种图标尺寸
    const toolbarIconSize = Math.round(styleConfig.buttonSize * 1.2); // 工具栏图标大小
    const fabIconSize = Math.round(styleConfig.fabSize * 0.45); // FAB图标大小  
    const closeIconSize = Math.round(styleConfig.buttonSize * 0.9); // 关闭按钮图标大小
    
    console.log('🎨 响应式图标尺寸计算:', {
      viewport: `${viewport.width}x${viewport.height}`,
      baseFontSize: `${styleConfig.baseFontSize}px`,
      buttonSize: `${styleConfig.buttonSize}px`,
      fabSize: `${styleConfig.fabSize}px`,
      iconSizes: {
        toolbar: `${toolbarIconSize}px`,
        fab: `${fabIconSize}px`, 
        close: `${closeIconSize}px`
      }
    });

    // 创建根容器
    const container = document.createElement('div');
    container.className = namespace;
    container.style.cssText = 'position: fixed; top: 0; left: 0; pointer-events: none; z-index: 999999;';

    // 创建FAB按钮
    const fab = document.createElement('button');
    fab.className = `${prefix}fab`;
    // 使用更好看的emoji图标
    fab.innerHTML = '💬';
    fab.title = '打开客服';
    fab.style.pointerEvents = 'auto';

    // 创建聊天面板
    const panel = document.createElement('div');
    panel.className = `${prefix}panel`;
    panel.style.pointerEvents = 'auto';

    // 创建面板头部
    const header = document.createElement('div');
    header.className = `${prefix}header`;

    const headerTitle = document.createElement('div');
    headerTitle.className = `${prefix}header-title`;
    headerTitle.textContent = '在线客服';

    const closeBtn = document.createElement('button');
    closeBtn.className = `${prefix}close-btn`;
    // 使用清晰的关闭符号
    closeBtn.innerHTML = '✖️';
    closeBtn.title = '关闭';

    header.appendChild(headerTitle);
    header.appendChild(closeBtn);

    // 创建消息区域
    const messagesContainer = document.createElement('div');
    messagesContainer.className = `${prefix}messages`;

    // 创建工具栏区域（图片、文件、语音、表情按钮）
    const toolbarArea = document.createElement('div');
    toolbarArea.className = `${prefix}toolbar`;

    // 创建图片按钮
    const imageBtn = document.createElement('button');
    imageBtn.className = `${prefix}btn ${prefix}btn-toolbar`;
    // 使用更好看的图片emoji
    imageBtn.innerHTML = '🖼️';
    imageBtn.title = '发送图片';

    const fileBtn = document.createElement('button');
    fileBtn.className = `${prefix}btn ${prefix}btn-toolbar`;
    // 使用更好看的文件emoji
    fileBtn.innerHTML = '📎';
    fileBtn.title = '发送文件';

    const voiceBtn = document.createElement('button');
    voiceBtn.className = `${prefix}btn ${prefix}btn-toolbar`;
    // 使用更好看的语音emoji
    voiceBtn.innerHTML = '🎙️';
    voiceBtn.title = '发送语音';

    const emojiBtn = document.createElement('button');
    emojiBtn.className = `${prefix}btn ${prefix}btn-toolbar`;
    // 使用更好看的表情emoji
    emojiBtn.innerHTML = '😄';
    emojiBtn.title = '发送表情';

    // 组装工具栏
    toolbarArea.appendChild(imageBtn);
    toolbarArea.appendChild(fileBtn);
    toolbarArea.appendChild(voiceBtn);
    toolbarArea.appendChild(emojiBtn);

    // 创建输入区域
    const inputArea = document.createElement('div');
    inputArea.className = `${prefix}input-area`;

    // 创建消息输入框
    const messageInput = document.createElement('input');
    messageInput.type = 'text';
    messageInput.className = `${prefix}input`;
    messageInput.placeholder = '输入消息...';

    // 创建发送按钮
    const sendBtn = document.createElement('button');
    sendBtn.className = `${prefix}btn ${prefix}btn-primary`;
    sendBtn.textContent = '发送';

    // 创建隐藏的文件输入
    const imageInput = document.createElement('input');
    imageInput.type = 'file';
    imageInput.accept = 'image/*';
    imageInput.className = `${prefix}file-input`;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.className = `${prefix}file-input`;

    // 组装输入区域
    inputArea.appendChild(messageInput);
    inputArea.appendChild(sendBtn);
    inputArea.appendChild(imageInput);
    inputArea.appendChild(fileInput);

    // 组装面板
    panel.appendChild(header);
    panel.appendChild(messagesContainer);
    panel.appendChild(toolbarArea);
    panel.appendChild(inputArea);

    // 组装根容器
    container.appendChild(fab);
    container.appendChild(panel);

    // 添加到页面
    document.body.appendChild(container);

    // 添加欢迎消息
    this.addWelcomeMessage(messagesContainer);

    return {
      container,
      fab,
      panel,
      header,
      closeBtn,
      messagesContainer,
      toolbarArea,
      inputArea,
      messageInput,
      sendBtn,
      imageBtn,
      fileBtn,
      voiceBtn,
      emojiBtn,
      imageInput,
      fileInput
    };
  }

  /**
   * 添加欢迎消息
   */
  private addWelcomeMessage(messagesContainer: HTMLElement): void {
    const welcomeMessage: ChatMessage = {
      content: '您好！欢迎使用在线客服，有什么可以帮助您的吗？',
      messageType: 'text',
      senderType: 'staff',
      timestamp: new Date()
    };
    
    this.addMessage(welcomeMessage);
  }

  /**
   * 绑定事件
   */
  private bindEvents(): void {
    if (!this.components) return;

    const { fab, closeBtn, messageInput, sendBtn, imageBtn, fileBtn, voiceBtn, emojiBtn, imageInput, fileInput } = this.components;

    // FAB按钮点击
    fab.addEventListener('click', () => this.toggle());
    
    // 关闭按钮点击
    closeBtn.addEventListener('click', () => this.close());
    
    // 发送按钮点击
    sendBtn.addEventListener('click', () => this.handleSendMessage());
    
    // 回车发送
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });

    // 工具栏按钮点击
    imageBtn.addEventListener('click', () => imageInput.click());
    fileBtn.addEventListener('click', () => fileInput.click());
    
    // 语音按钮（暂时禁用）
    voiceBtn.addEventListener('click', () => {
      console.log('语音功能暂未实现');
    });

    // 表情按钮点击
    emojiBtn.addEventListener('click', () => this.handleEmojiClick());

    // 文件选择
    imageInput.addEventListener('change', (e) => this.handleFileSelect(e, 'image'));
    fileInput.addEventListener('change', (e) => this.handleFileSelect(e, 'file'));

    // 添加触摸反馈
    this.addTouchFeedback(fab);
    this.addTouchFeedback(closeBtn);
    this.addTouchFeedback(sendBtn);
    this.addTouchFeedback(imageBtn);
    this.addTouchFeedback(fileBtn);
    this.addTouchFeedback(voiceBtn);
    this.addTouchFeedback(emojiBtn);
  }

  /**
   * 添加触摸反馈效果
   */
  private addTouchFeedback(element: HTMLElement): void {
    if (!('ontouchstart' in window)) return;

    element.addEventListener('touchstart', () => {
      element.style.transform = 'scale(0.95)';
      element.style.transition = 'transform 0.1s ease';
    });

    element.addEventListener('touchend', () => {
      setTimeout(() => {
        element.style.transform = 'scale(1)';
      }, 100);
    });

    element.addEventListener('touchcancel', () => {
      element.style.transform = 'scale(1)';
    });
  }

  /**
   * 处理视口变化
   */
  private handleViewportChange(viewport: ViewportInfo): void {
    if (!this.components) return;

    // 重新应用样式
    this.currentConfig = this.styleSystem.applyStyles(viewport);
    
    console.log(`🔄 UI已适配新视口: ${viewport.width}x${viewport.height} (${viewport.breakpoint})`);
  }

  /**
   * 切换面板显示状态
   */
  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * 打开面板
   */
  open(): void {
    if (!this.components || this.isOpen) return;

    const { panel, messageInput } = this.components;
    const prefix = this.styleSystem.getCSSPrefix();
    
    panel.classList.add(`${prefix}open`);
    this.isOpen = true;
    
    // 聚焦输入框
    setTimeout(() => {
      messageInput.focus();
    }, 300);
    
    console.log('📱 客服面板已打开');
  }

  /**
   * 关闭面板
   */
  close(): void {
    if (!this.components || !this.isOpen) return;

    const { panel } = this.components;
    const prefix = this.styleSystem.getCSSPrefix();
    
    panel.classList.remove(`${prefix}open`);
    this.isOpen = false;
    
    console.log('📱 客服面板已关闭');
  }

  /**
   * 添加消息到界面
   */
  addMessage(message: ChatMessage): void {
    if (!this.components) return;

    const { messagesContainer } = this.components;
    const prefix = this.styleSystem.getCSSPrefix();
    
    const messageElement = document.createElement('div');
    messageElement.className = `${prefix}message ${prefix}${message.senderType}`;
    
    if (message.messageType === 'image' && message.fileUrl) {
      // 协议适配
      const adaptedFileUrl = this.adaptUrlProtocol(message.fileUrl);
      
      // 创建图片消息组件
      const imageConfig: ImageMessageConfig = {
        fileUrl: adaptedFileUrl,
        fileName: message.fileName || message.content,
        content: message.content !== message.fileName ? message.content : undefined,
        showDownloadButton: true,
        enablePreview: true
      };
      
      const imageElement = createImageMessage(imageConfig, this.styleSystem.getCSSPrefix());
      
      // 监听预览事件
      imageElement.addEventListener('image-preview', (e: any) => {
        this.getImageViewer().show(e.detail);
      });
      
      // 监听下载事件
      imageElement.addEventListener('image-download', (e: any) => {
        console.log('📥 图片下载:', e.detail);
      });
      
      messageElement.appendChild(imageElement);
    } else if (message.messageType === 'file' && message.fileUrl) {
      const link = document.createElement('a');
      link.href = message.fileUrl;
      
      // 构建显示文本：图标 + 下载文件 + 文件名
      const fileName = message.fileName || message.content || '未知文件';
      link.innerHTML = `📎 下载文件：${fileName}`;
      
      link.target = '_blank';
      link.style.cssText = 'color: inherit; text-decoration: underline; display: inline-block; word-break: break-all;';
      messageElement.appendChild(link);
    } else {
      // 使用文本格式化工具设置内容，支持换行和表情优化显示
      setFormattedTextContent(messageElement, message.content);
    }
    
    messagesContainer.appendChild(messageElement);
    
    // 滚动到底部
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // 添加进入动画
    messageElement.style.opacity = '0';
    messageElement.style.transform = 'translateY(10px)';
    setTimeout(() => {
      messageElement.style.transition = 'all 0.3s ease';
      messageElement.style.opacity = '1';
      messageElement.style.transform = 'translateY(0)';
    }, 10);
  }

  /**
   * 处理发送消息
   */
  private handleSendMessage(): void {
    if (!this.components) return;

    const { messageInput } = this.components;
    const content = messageInput.value.trim();
    
    if (!content) return;

    // 触发自定义事件
    const event = new CustomEvent('qt-send-message', {
      detail: { content, messageType: 'text' }
    });
    document.dispatchEvent(event);

    // 清空输入框
    messageInput.value = '';
    
    // 移动端发送后失焦，避免键盘遮挡
    if (this.viewportManager.isMobile()) {
      messageInput.blur();
    }
  }

  /**
   * 处理文件选择
   */
  private handleFileSelect(event: Event, type: 'image' | 'file'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) return;

    // 触发自定义事件
    const customEvent = new CustomEvent('qt-upload-file', {
      detail: { file, messageType: type }
    });
    document.dispatchEvent(customEvent);

    // 清空输入
    input.value = '';
  }

  /**
   * 处理表情按钮点击
   */
  private handleEmojiClick(): void {
    // 创建表情选择器
    this.showEmojiPicker();
  }

  /**
   * 显示表情选择器
   */
  private showEmojiPicker(): void {
    if (!this.components) return;

    const { panel } = this.components;
    const prefix = this.styleSystem.getCSSPrefix();

    // 检查是否已存在表情选择器
    const existingPicker = document.querySelector(`.${prefix}emoji-picker`);
    if (existingPicker) {
      existingPicker.remove();
      return;
    }

    // 常用表情分类
    const emojiCategories = {
      '😊': ['😊', '😂', '😁', '😍', '🤔', '😎', '😢', '😮', '😴', '😵'],
      '👋': ['�', '👍', '👎', '👌', '✌️', '🤝', '👏', '🙏', '💪', '🤞'],
      '❤️': ['❤️', '💙', '💚', '💛', '🧡', '💜', '🖤', '🤍', '🤎', '💖'],
      '🎉': ['🎉', '🎊', '🎈', '🎁', '🎂', '⭐', '✨', '�', '💫', '🌟']
    };

    // 创建表情选择器容器
    const emojiPicker = document.createElement('div');
    emojiPicker.className = `${prefix}emoji-picker`;
    
    // 计算面板位置，确保表情选择器完全在视口内
    const panelRect = panel.getBoundingClientRect();
    
    // 获取当前响应式样式配置
    const viewport = this.styleSystem.detectViewport();
    const styleConfig = this.styleSystem.calculateStyleConfig(viewport);
    
    // 基于响应式配置计算表情选择器尺寸
    const emojiSize = Math.round(styleConfig.baseFontSize * 1.5); // 调整表情大小比例
    const buttonSize = Math.round(emojiSize * 1.3); // 按钮大小基于表情大小
    const categoryFontSize = Math.round(styleConfig.baseFontSize * 0.9); // 分类标题字体
    const margin = styleConfig.spacing.md; // 使用响应式边距
    
    // 动态计算网格列数，确保能显示完整的表情
    let gridColumns: number;
    if (viewport.isMobile) {
      // 移动端：基于按钮大小计算能放几列
      const availableWidth = Math.min(viewport.width * 0.9, 400); // 最大可用宽度
      const spacingBetween = styleConfig.spacing.sm; // 间距
      const totalPadding = styleConfig.spacing.md * 2; // 左右内边距
      const maxButtonsPerRow = Math.floor((availableWidth - totalPadding + spacingBetween) / (buttonSize + spacingBetween));
      gridColumns = Math.max(3, Math.min(5, maxButtonsPerRow)); // 3-5列之间
    } else {
      gridColumns = 5; // 桌面端固定5列
    }
    
    // 重新计算容器尺寸，基于网格布局
    const contentWidth = gridColumns * buttonSize + (gridColumns - 1) * styleConfig.spacing.sm + styleConfig.spacing.md * 2;
    const pickerWidth = Math.max(contentWidth, 250); // 确保最小宽度
    
    // 计算需要的高度：4个分类 × (标题 + 2行表情 + 间距)
    const rowsPerCategory = Math.ceil(10 / gridColumns); // 每个分类的行数
    const categoryTitleHeight = categoryFontSize + styleConfig.spacing.sm + styleConfig.spacing.xs;
    const categoryContentHeight = rowsPerCategory * buttonSize + (rowsPerCategory - 1) * styleConfig.spacing.sm + styleConfig.spacing.md;
    const totalContentHeight = 4 * (categoryTitleHeight + categoryContentHeight) + styleConfig.spacing.md * 2;
    const pickerHeight = Math.min(totalContentHeight, viewport.height * 0.7); // 限制最大高度
    
    // 可用视口区域
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let pickerTop: number;
    let pickerLeft: number;
    
    // 水平位置计算 - 确保完全在视口内
    pickerLeft = panelRect.left;
    if (pickerLeft + pickerWidth + margin > viewportWidth) {
      // 右边超出，从右边对齐
      pickerLeft = viewportWidth - pickerWidth - margin;
    }
    if (pickerLeft < margin) {
      // 左边超出，从左边对齐
      pickerLeft = margin;
    }
    
    // 垂直位置计算 - 优先显示在面板上方
    pickerTop = panelRect.top - pickerHeight - margin;
    if (pickerTop < margin) {
      // 上方空间不够，尝试下方
      pickerTop = panelRect.bottom + margin;
      if (pickerTop + pickerHeight + margin > viewportHeight) {
        // 下方也不够，强制在视口内最佳位置
        pickerTop = Math.max(margin, viewportHeight - pickerHeight - margin);
      }
    }
    
    console.log('🎭 表情选择器响应式计算:', {
      viewport: { width: viewport.width, height: viewport.height, isMobile: viewport.isMobile },
      styleConfig: { 
        baseFontSize: styleConfig.baseFontSize,
        spacing: styleConfig.spacing.md
      },
      picker: { 
        width: pickerWidth, 
        height: pickerHeight, 
        emojiSize, 
        buttonSize,
        gridColumns,
        categoryFontSize 
      },
      position: { top: pickerTop, left: pickerLeft },
      bounds: {
        wouldExceedRight: (pickerLeft + pickerWidth) > viewportWidth,
        wouldExceedBottom: (pickerTop + pickerHeight) > viewportHeight,
        wouldExceedLeft: pickerLeft < 0,
        wouldExceedTop: pickerTop < 0
      }
    });
    
    emojiPicker.style.cssText = `
      position: fixed !important;
      top: ${pickerTop}px !important;
      left: ${pickerLeft}px !important;
      width: ${pickerWidth}px !important;
      height: ${pickerHeight}px !important;
      background: white !important;
      border: 1px solid #e5e5e5 !important;
      border-radius: ${styleConfig.borderRadius}px !important;
      padding: ${styleConfig.spacing.md}px !important;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15) !important;
      z-index: ${styleConfig.zIndex} !important;
      overflow-y: auto !important;
      font-size: ${emojiSize}px !important;
      pointer-events: auto !important;
      transform: translateZ(0) !important;
      box-sizing: border-box !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif !important;
    `;

    // 创建表情网格
    Object.entries(emojiCategories).forEach(([categoryIcon, emojis]) => {
      // 分类标题
      const categoryTitle = document.createElement('div');
      categoryTitle.textContent = categoryIcon;
      categoryTitle.style.cssText = `
        font-size: ${categoryFontSize}px !important;
        margin: ${styleConfig.spacing.sm}px 0 ${styleConfig.spacing.xs}px 0 !important;
        color: #666 !important;
        border-bottom: 1px solid #f0f0f0 !important;
        padding-bottom: ${styleConfig.spacing.xs}px !important;
        font-family: inherit !important;
      `;
      emojiPicker.appendChild(categoryTitle);

      // 表情网格
      const emojiGrid = document.createElement('div');
      emojiGrid.style.cssText = `
        display: grid !important;
        grid-template-columns: repeat(${gridColumns}, 1fr) !important;
        gap: ${styleConfig.spacing.sm}px !important;
        margin-bottom: ${styleConfig.spacing.md}px !important;
        justify-items: center !important;
      `;

      emojis.forEach(emoji => {
        const emojiBtn = document.createElement('button');
        emojiBtn.textContent = emoji;
        emojiBtn.className = `${prefix}emoji-btn`;
        
        emojiBtn.style.cssText = `
          border: none !important;
          background: transparent !important;
          font-size: ${emojiSize}px !important;
          cursor: pointer !important;
          padding: ${Math.round(styleConfig.spacing.xs / 2)}px !important;
          border-radius: ${Math.round(styleConfig.borderRadius * 0.5)}px !important;
          transition: background 0.2s ease !important;
          width: ${buttonSize}px !important;
          height: ${buttonSize}px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          font-family: inherit !important;
          flex-shrink: 0 !important;
        `;

        emojiBtn.addEventListener('mouseenter', () => {
          emojiBtn.style.background = '#f0f0f0';
        });

        emojiBtn.addEventListener('mouseleave', () => {
          emojiBtn.style.background = 'transparent';
        });

        emojiBtn.addEventListener('click', () => {
          // 发送表情消息
          const event = new CustomEvent('qt-send-message', {
            detail: { content: emoji, messageType: 'text' }
          });
          document.dispatchEvent(event);
          
          console.log(`📱 发送表情: ${emoji}`);
          
          // 关闭表情选择器
          emojiPicker.remove();
        });

        emojiGrid.appendChild(emojiBtn);
      });

      emojiPicker.appendChild(emojiGrid);
    });

    // 添加关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    const closeBtnSize = Math.round(styleConfig.baseFontSize * 1.5);
    closeBtn.style.cssText = `
      position: absolute !important;
      top: ${styleConfig.spacing.sm}px !important;
      right: ${styleConfig.spacing.sm}px !important;
      border: none !important;
      background: transparent !important;
      font-size: ${Math.round(styleConfig.baseFontSize * 1.1)}px !important;
      cursor: pointer !important;
      color: #999 !important;
      width: ${closeBtnSize}px !important;
      height: ${closeBtnSize}px !important;
      border-radius: 50% !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-family: inherit !important;
    `;

    closeBtn.addEventListener('click', () => {
      emojiPicker.remove();
    });

    emojiPicker.appendChild(closeBtn);

    // 阻止滚动事件冒泡，防止宿主页面滚动干扰
    emojiPicker.addEventListener('wheel', (e) => {
      e.stopPropagation();
    });
    
    emojiPicker.addEventListener('touchmove', (e) => {
      e.stopPropagation();
    });

    // 添加到body（确保正确显示）
    document.body.appendChild(emojiPicker);

    // 点击外部关闭
    const handleOutsideClick = (event: Event) => {
      if (!emojiPicker.contains(event.target as Node)) {
        emojiPicker.remove();
        document.removeEventListener('click', handleOutsideClick);
      }
    };

    setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 100);
  }

  /**
   * 显示上传状态
   */
  showUploadStatus(message: string): void {
    if (!this.components) return;

    const { messagesContainer } = this.components;
    const prefix = this.styleSystem.getCSSPrefix();
    
    // 如果有之前的状态消息，先移除
    if (this.statusMessageElement) {
      this.statusMessageElement.remove();
      this.statusMessageElement = null;
    }
    
    // 创建新的状态消息
    this.statusMessageElement = document.createElement('div');
    this.statusMessageElement.className = `${prefix}message ${prefix}customer ${prefix}status`;
    this.statusMessageElement.textContent = message;
    this.statusMessageElement.style.opacity = '0.7';
    this.statusMessageElement.style.fontStyle = 'italic';
    
    messagesContainer.appendChild(this.statusMessageElement);
    
    // 滚动到底部
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  /**
   * 清除上传状态
   */
  clearUploadStatus(): void {
    if (this.statusMessageElement) {
      this.statusMessageElement.remove();
      this.statusMessageElement = null;
    }
  }

  /**
   * 获取面板打开状态
   */
  isOpened(): boolean {
    return this.isOpen;
  }

  /**
   * 清理UI组件
   */
  cleanup(): void {
    if (this.components) {
      this.components.container.remove();
      this.components = null;
    }
    
    this.styleSystem.cleanup();
    this.isOpen = false;
  }

  /**
   * 获取当前UI组件
   */
  getComponents(): UIComponents | null {
    return this.components;
  }
}