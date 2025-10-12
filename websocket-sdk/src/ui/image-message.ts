/**
 * 图片消息组件模块
 * 处理图片消息的显示、下载和预览功能
 */

export interface ImageMessageConfig {
  fileUrl: string;
  fileName?: string;
  content?: string;
  showDownloadButton?: boolean;
  enablePreview?: boolean;
}

export class ImageMessageComponent {
  private element: HTMLElement;
  private config: ImageMessageConfig;
  private prefix: string;

  constructor(config: ImageMessageConfig, cssPrefix: string = 'qt-') {
    this.config = config;
    this.prefix = cssPrefix;
    this.element = this.createElement();
  }

  private createElement(): HTMLElement {
    const container = document.createElement('div');
    container.className = `${this.prefix}image-message-container`;
    
    // 设置容器样式
    container.style.cssText = `
      position: relative;
      display: inline-block;
      max-width: 250px;
      border-radius: 12px;
      overflow: hidden;
      background: #f5f5f5;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;

    // 创建图片元素
    const imageWrapper = this.createImageWrapper();
    container.appendChild(imageWrapper);

    // 创建操作栏
    if (this.config.showDownloadButton || this.config.content) {
      const actionBar = this.createActionBar();
      container.appendChild(actionBar);
    }

    return container;
  }

  private createImageWrapper(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = `${this.prefix}image-wrapper`;
    wrapper.style.cssText = `
      position: relative;
      background: #f0f0f0;
      min-height: 100px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const img = document.createElement('img');
    img.src = this.config.fileUrl;
    img.alt = this.config.fileName || '图片';
    img.style.cssText = `
      max-width: 100%;
      height: auto;
      display: block;
      cursor: ${this.config.enablePreview ? 'pointer' : 'default'};
    `;

    // 添加加载状态
    const loadingElement = this.createLoadingElement();
    wrapper.appendChild(loadingElement);

    // 图片加载完成后隐藏加载状态
    img.onload = () => {
      loadingElement.style.display = 'none';
    };

    // 图片加载失败处理
    img.onerror = () => {
      this.showError(wrapper, '图片加载失败');
    };

    // 添加预览功能
    if (this.config.enablePreview) {
      img.addEventListener('click', () => {
        this.showImagePreview();
      });

      // 添加预览提示
      const previewHint = this.createPreviewHint();
      wrapper.appendChild(previewHint);

      // 悬停效果
      wrapper.addEventListener('mouseenter', () => {
        previewHint.style.opacity = '1';
        img.style.transform = 'scale(1.02)';
        img.style.transition = 'transform 0.2s ease';
      });

      wrapper.addEventListener('mouseleave', () => {
        previewHint.style.opacity = '0';
        img.style.transform = 'scale(1)';
      });
    }

    wrapper.appendChild(img);
    return wrapper;
  }

  private createLoadingElement(): HTMLElement {
    const loading = document.createElement('div');
    loading.className = `${this.prefix}image-loading`;
    loading.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255,255,255,0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      color: #666;
    `;
    loading.textContent = '📷 加载中...';
    return loading;
  }

  private createPreviewHint(): HTMLElement {
    const hint = document.createElement('div');
    hint.className = `${this.prefix}image-preview-hint`;
    hint.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(0,0,0,0.7);
      color: white;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 10px;
      opacity: 0;
      transition: opacity 0.2s ease;
      pointer-events: none;
    `;
    hint.textContent = '点击查看';
    return hint;
  }

  private createActionBar(): HTMLElement {
    const actionBar = document.createElement('div');
    actionBar.className = `${this.prefix}image-action-bar`;
    actionBar.style.cssText = `
      padding: 8px 12px;
      background: rgba(255,255,255,0.95);
      border-top: 1px solid #e5e5e5;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    `;

    // 文件名或描述
    if (this.config.content || this.config.fileName) {
      const textElement = document.createElement('div');
      textElement.className = `${this.prefix}image-text`;
      textElement.style.cssText = `
        flex: 1;
        font-size: 12px;
        color: #666;
        word-break: break-all;
        line-height: 1.3;
      `;
      textElement.textContent = this.config.content || this.config.fileName || '';
      actionBar.appendChild(textElement);
    }

    // 下载按钮
    if (this.config.showDownloadButton) {
      const downloadButton = this.createDownloadButton();
      actionBar.appendChild(downloadButton);
    }

    return actionBar;
  }

  private createDownloadButton(): HTMLElement {
    const button = document.createElement('button');
    button.className = `${this.prefix}image-download-btn`;
    button.style.cssText = `
      background: #007bff;
      color: white;
      border: none;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 11px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: background 0.2s ease;
      flex-shrink: 0;
    `;
    button.innerHTML = '📥 下载';

    button.addEventListener('mouseenter', () => {
      button.style.background = '#0056b3';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = '#007bff';
    });

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.downloadImage();
    });

    return button;
  }

  private showError(container: HTMLElement, message: string): void {
    container.innerHTML = `
      <div style="
        padding: 20px;
        text-align: center;
        color: #666;
        font-size: 12px;
      ">
        ❌ ${message}
      </div>
    `;
  }

  private showImagePreview(): void {
    // 触发预览事件，由外部处理（如使用ImageViewer）
    const event = new CustomEvent('image-preview', {
      detail: {
        src: this.config.fileUrl,
        alt: this.config.fileName || '图片',
        title: this.config.fileName || 'image'
      }
    });
    this.element.dispatchEvent(event);
  }

  private downloadImage(): void {
    try {
      const link = document.createElement('a');
      link.href = this.config.fileUrl;
      link.download = this.config.fileName || 'image';
      link.target = '_blank';
      
      // 触发下载
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 触发下载事件
      const event = new CustomEvent('image-download', {
        detail: {
          fileUrl: this.config.fileUrl,
          fileName: this.config.fileName
        }
      });
      this.element.dispatchEvent(event);
    } catch (error) {
      console.error('图片下载失败:', error);
    }
  }

  // 公共方法
  public getElement(): HTMLElement {
    return this.element;
  }

  public updateConfig(newConfig: Partial<ImageMessageConfig>): void {
    this.config = { ...this.config, ...newConfig };
    // 重新创建元素
    const newElement = this.createElement();
    this.element.parentNode?.replaceChild(newElement, this.element);
    this.element = newElement;
  }

  public destroy(): void {
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

/**
 * 创建图片消息的便捷函数
 */
export function createImageMessage(
  config: ImageMessageConfig, 
  cssPrefix: string = 'qt-'
): HTMLElement {
  const component = new ImageMessageComponent(config, cssPrefix);
  return component.getElement();
}