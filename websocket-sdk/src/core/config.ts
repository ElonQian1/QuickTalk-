/**
 * 核心配置管理模块
 * 负责服务器检测、配置缓存、版本管理
 */

export interface ServerConfig {
  version: string;
  serverUrl: string;
  wsUrl: string;
  endpoints?: {
    websocket?: {
      customer: string;
    };
    upload?: string;
  };
}

export interface SDKConfig {
  shopId: string;
  serverUrl?: string; // 可选，支持自动检测
  customerId?: string;
  customerName?: string;
  autoDetectServer?: boolean;
  debugMode?: boolean;
}

export class ConfigManager {
  private static instance: ConfigManager;
  private serverConfigCache: ServerConfig | null = null;
  private configCacheTime = 10 * 60 * 1000; // 10分钟缓存
  private lastConfigFetch = 0;
  private readonly clientVersion = '2.0.0';

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * 智能服务器地址检测
   * 优先检测当前域名的标准端口，然后尝试备选方案
   */
  private detectServerCandidates(): string[] {
    const currentUrl = window.location;
    const candidates = [
      // 优先尝试当前域名的HTTPS标准端口（生产环境）
      `${currentUrl.protocol}//${currentUrl.hostname}:8443`,
      // 尝试相同协议和端口
      `${currentUrl.protocol}//${currentUrl.host}`,
      // 开发环境备选项 - HTTP/WS 8080端口
      `${currentUrl.protocol}//${currentUrl.hostname}:8080`,
      'https://localhost:8080',
      'http://localhost:8080',
      'https://127.0.0.1:8080',
      'http://127.0.0.1:8080'
    ];

    // 去重处理
    return Array.from(new Set(candidates));
  }

  /**
   * 异步检测可用的服务器地址
   */
  async findAvailableServer(): Promise<ServerConfig> {
    // 检查缓存
    if (this.serverConfigCache && 
        (Date.now() - this.lastConfigFetch) < this.configCacheTime) {
      return this.serverConfigCache;
    }

    const candidates = this.detectServerCandidates();
    const errors: string[] = [];

    for (const url of candidates) {
      try {
        const config = await this.testServerConnection(url);
        // 成功获取配置，缓存结果
        this.serverConfigCache = config;
        this.lastConfigFetch = Date.now();
        console.log(`✅ 服务器连接成功: ${url}`);
        return config;
      } catch (error) {
        errors.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
        console.warn(`❌ 服务器连接失败: ${url}`);
      }
    }

    throw new Error(`所有服务器候选地址都无法连接: ${errors.join(', ')}`);
  }

  /**
   * 测试单个服务器连接
   */
  private async testServerConnection(url: string): Promise<ServerConfig> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${url}/api/config`, {
        method: 'GET',
        mode: 'cors',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const config = await response.json();
      return {
        version: config.version || 'unknown',
        serverUrl: url,
        wsUrl: config.wsUrl || url.replace(/^https?/, url.startsWith('https') ? 'wss' : 'ws'),
        endpoints: config.endpoints
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * 版本检测和更新提醒
   */
  async checkForUpdates(serverUrl: string): Promise<void> {
    try {
      const response = await fetch(`${serverUrl}/api/sdk/version`);
      const data = await response.json();
      
      if (data.version && data.version !== this.clientVersion) {
        console.log(`🔄 检测到新版本: ${data.version} (当前版本: ${this.clientVersion})`);
        // 可以在这里添加更新通知逻辑
      }
    } catch (error) {
      // 忽略版本检查错误
      console.debug('版本检查失败:', error);
    }
  }

  /**
   * 获取客户端版本
   */
  getClientVersion(): string {
    return this.clientVersion;
  }

  /**
   * 清除配置缓存（用于重连等场景）
   */
  clearCache(): void {
    this.serverConfigCache = null;
    this.lastConfigFetch = 0;
  }

  /**
   * 生成随机客户ID
   */
  generateCustomerId(): string {
    return 'guest-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}