/**
 * SDK自动更新器
 * 实现真正的自动升级机制
 */

export interface SDKVersion {
  version: string;
  releaseDate: string;
  downloadUrl: string;
  features: string[];
  breaking?: boolean;
}

export class SDKAutoUpdater {
  private currentVersion: string;
  private serverUrl: string;
  private checkInterval: number = 6 * 60 * 60 * 1000; // 6小时检查一次
  private intervalId?: number;

  constructor(currentVersion: string, serverUrl: string) {
    this.currentVersion = currentVersion;
    this.serverUrl = serverUrl;
  }

  /**
   * 启动自动更新检查
   */
  start(): void {
    // 立即检查一次
    this.checkForUpdates();
    
    // 定期检查
    this.intervalId = window.setInterval(() => {
      this.checkForUpdates();
    }, this.checkInterval);

    console.log(`🔄 SDK自动更新器已启动，当前版本: ${this.currentVersion}`);
  }

  /**
   * 停止自动更新检查
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      console.log('🛑 SDK自动更新器已停止');
    }
  }

  /**
   * 检查是否有新版本
   */
  private async checkForUpdates(): Promise<void> {
    try {
      const response = await fetch(`${this.serverUrl}/api/sdk/version`);
      if (!response.ok) return;

      const versionInfo: SDKVersion = await response.json();
      
      if (this.isNewerVersion(versionInfo.version, this.currentVersion)) {
        console.log(`🆕 发现新版本: ${versionInfo.version} (当前: ${this.currentVersion})`);
        await this.handleUpdate(versionInfo);
      }
    } catch (error) {
      console.debug('版本检查失败:', error);
    }
  }

  /**
   * 处理更新
   */
  private async handleUpdate(versionInfo: SDKVersion): Promise<void> {
    // 非破坏性更新：静默更新
    if (!versionInfo.breaking) {
      await this.performSilentUpdate(versionInfo);
      return;
    }

    // 破坏性更新：通知用户
    this.notifyBreakingUpdate(versionInfo);
  }

  /**
   * 执行静默更新
   */
  private async performSilentUpdate(versionInfo: SDKVersion): Promise<void> {
    try {
      // 动态加载新版本
      const script = document.createElement('script');
      script.src = `${versionInfo.downloadUrl}?v=${Date.now()}`;
      script.async = true;
      
      script.onload = () => {
        console.log(`✅ SDK已自动更新到版本 ${versionInfo.version}`);
        this.currentVersion = versionInfo.version;
        
        // 可选：通知应用
        window.dispatchEvent(new CustomEvent('sdk-updated', {
          detail: versionInfo
        }));
      };

      document.head.appendChild(script);
    } catch (error) {
      console.error('自动更新失败:', error);
    }
  }

  /**
   * 通知破坏性更新
   */
  private notifyBreakingUpdate(versionInfo: SDKVersion): void {
    console.warn(`⚠️ 重要更新可用: ${versionInfo.version}`);
    console.warn('此更新包含破坏性变更，建议手动更新嵌入代码');
    
    // 可以在这里显示用户通知
    this.showUpdateNotification(versionInfo);
  }

  /**
   * 显示更新通知
   */
  private showUpdateNotification(versionInfo: SDKVersion): void {
    // 创建更新提示
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #007cba;
      color: white;
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 350px;
      font-family: Arial, sans-serif;
      font-size: 14px;
    `;

    notification.innerHTML = `
      <div style="margin-bottom: 10px;">
        <strong>🆕 SDK更新可用</strong>
      </div>
      <div style="margin-bottom: 10px;">
        版本 ${versionInfo.version} 现已可用
      </div>
      <div style="margin-bottom: 15px;">
        新功能: ${versionInfo.features.join(', ')}
      </div>
      <button onclick="this.parentElement.remove()" 
              style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
        知道了
      </button>
    `;

    document.body.appendChild(notification);

    // 10秒后自动消失
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 10000);
  }

  /**
   * 版本比较
   */
  private isNewerVersion(newVersion: string, currentVersion: string): boolean {
    const parseVersion = (v: string) => v.split('.').map(Number);
    const newParts = parseVersion(newVersion);
    const currentParts = parseVersion(currentVersion);

    for (let i = 0; i < Math.max(newParts.length, currentParts.length); i++) {
      const newPart = newParts[i] || 0;
      const currentPart = currentParts[i] || 0;
      
      if (newPart > currentPart) return true;
      if (newPart < currentPart) return false;
    }
    
    return false;
  }
}