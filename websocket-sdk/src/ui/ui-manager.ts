/**
 * UI组件管理器
 * 负责创建和管理聊天界面组件
 */

import { StyleSystem, ViewportInfo, StyleConfig } from './style-system';
import { ViewportManager } from './viewport-manager';
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
  private components: UIComponents | null = null;
  private isOpen = false;
  private currentConfig: StyleConfig | null = null;

  static getInstance(): UIManager {
    if (!UIManager.instance) {
      UIManager.instance = new UIManager();
    }
    return UIManager.instance;
  }

  constructor() {
    this.styleSystem = StyleSystem.getInstance();
    this.viewportManager = ViewportManager.getInstance();
    
    // 监听视口变化，动态调整UI
    this.viewportManager.onViewportChange(this.handleViewportChange.bind(this));
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

    // 创建根容器
    const container = document.createElement('div');
    container.className = namespace;
    container.style.cssText = 'position: fixed; top: 0; left: 0; pointer-events: none; z-index: 999999;';

    // 创建FAB按钮
    const fab = document.createElement('button');
    fab.className = `${prefix}fab`;
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
    closeBtn.innerHTML = '✕';
    closeBtn.title = '关闭';

    header.appendChild(headerTitle);
    header.appendChild(closeBtn);

    // 创建消息区域
    const messagesContainer = document.createElement('div');
    messagesContainer.className = `${prefix}messages`;

    // 创建工具栏区域（图片、文件、语音、表情按钮）
    const toolbarArea = document.createElement('div');
    toolbarArea.className = `${prefix}toolbar`;

    // 创建工具按钮
    const imageBtn = document.createElement('button');
    imageBtn.className = `${prefix}btn ${prefix}btn-toolbar`;
    imageBtn.innerHTML = '📷';
    imageBtn.title = '发送图片';

    const fileBtn = document.createElement('button');
    fileBtn.className = `${prefix}btn ${prefix}btn-toolbar`;
    fileBtn.innerHTML = '�';
    fileBtn.title = '发送文件';

    const voiceBtn = document.createElement('button');
    voiceBtn.className = `${prefix}btn ${prefix}btn-toolbar`;
    voiceBtn.innerHTML = '🎤';
    voiceBtn.title = '发送语音';

    const emojiBtn = document.createElement('button');
    emojiBtn.className = `${prefix}btn ${prefix}btn-toolbar`;
    emojiBtn.innerHTML = '😊';
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
      const img = document.createElement('img');
      img.src = message.fileUrl;
      img.alt = '图片';
      img.style.cssText = 'max-width: 100%; height: auto; border-radius: 8px;';
      messageElement.appendChild(img);
    } else if (message.messageType === 'file' && message.fileUrl) {
      const link = document.createElement('a');
      link.href = message.fileUrl;
      link.textContent = message.fileName || '下载文件';
      link.target = '_blank';
      link.style.cssText = 'color: inherit; text-decoration: underline;';
      messageElement.appendChild(link);
    } else {
      messageElement.textContent = message.content;
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
    // 常用表情列表
    const emojis = ['😊', '😂', '😍', '🤔', '😢', '😎', '👍', '❤️', '🎉', '👋'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    
    // 发送表情消息
    const event = new CustomEvent('qt-send-message', {
      detail: { content: randomEmoji, messageType: 'text' }
    });
    document.dispatchEvent(event);
    
    console.log(`📱 发送表情: ${randomEmoji}`);
  }

  /**
   * 显示上传状态
   */
  showUploadStatus(message: string): void {
    const statusMessage: ChatMessage = {
      content: message,
      messageType: 'system',
      senderType: 'customer',
      timestamp: new Date()
    };
    
    this.addMessage(statusMessage);
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