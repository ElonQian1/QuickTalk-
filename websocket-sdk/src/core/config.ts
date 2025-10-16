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
   * 1. 优先使用手动指定的服务器地址
   * 2. 尝试从SDK脚本来源动态获取
   * 3. 回退到生产环境默认服务器
   * 4. 最后尝试本地开发环境
   */
  private detectServerCandidates(manualServerUrl?: string): string[] {
    const candidates: string[] = [];
    
    // 1. 手动指定的服务器地址优先级最高
    if (manualServerUrl) {
      console.log(`🎯 使用手动指定的服务器: ${manualServerUrl}`);
      candidates.push(manualServerUrl);
    }
    
    // 2. 您的生产服务器（提高优先级，确保总是被尝试）
    console.log(`🏭 添加生产服务器: https://43.139.82.12:8443`);
    candidates.push('https://43.139.82.12:8443');
    
    // 3. 尝试从SDK脚本来源动态获取
    const scriptSource = this.getSDKScriptSource();
    if (scriptSource) {
      console.log(`🔍 检测到SDK脚本来源: ${scriptSource}`);
      candidates.push(scriptSource);
    }
    
    // 4. 尝试当前页面域名的标准端口
    const currentUrl = window.location;
    if (currentUrl.hostname !== 'localhost' && currentUrl.hostname !== '127.0.0.1') {
      const domainWithPort = `${currentUrl.protocol}//${currentUrl.hostname}:8443`;
      const domainDefault = `${currentUrl.protocol}//${currentUrl.host}`;
      console.log(`🌐 添加当前域名候选: ${domainWithPort}, ${domainDefault}`);
      candidates.push(domainWithPort, domainDefault);
    }
    
    // 5. 本地开发环境备选项
    console.log(`🏠 添加本地开发环境候选`);
    candidates.push(
      'https://localhost:8443',
      'http://localhost:8080',
      'https://127.0.0.1:8443',
      'http://127.0.0.1:8080'
    );

    // 去重处理
    const uniqueCandidates = Array.from(new Set(candidates));
    console.log(`📋 最终服务器候选列表 (${uniqueCandidates.length}个):`, uniqueCandidates);
    return uniqueCandidates;
  }

  /**
   * 获取SDK脚本的来源地址
   */
  private getSDKScriptSource(): string | null {
    try {
      // 查找当前SDK脚本标签
      const scripts = document.querySelectorAll('script[src*="service-standalone"], script[src*="quicktalk"], script[src*="customer-service"]');
      
      for (let i = 0; i < scripts.length; i++) {
        const script = scripts[i] as HTMLScriptElement;
        const src = script.src;
        if (src) {
          const url = new URL(src);
          const baseUrl = `${url.protocol}//${url.host}`;
          console.log(`🔍 检测到SDK脚本来源: ${baseUrl}`);
          return baseUrl;
        }
      }
      
      // 备选：查找包含SDK关键词的脚本
      const allScripts = document.querySelectorAll('script[src]');
      for (let i = 0; i < allScripts.length; i++) {
        const script = allScripts[i] as HTMLScriptElement;
        const src = script.src;
        if (src && (src.includes('8443') || src.includes('customer') || src.includes('chat'))) {
          const url = new URL(src);
          const baseUrl = `${url.protocol}//${url.host}`;
          console.log(`🔍 通过关键词检测到可能的服务器: ${baseUrl}`);
          return baseUrl;
        }
      }
    } catch (error) {
      console.warn('🔍 无法检测SDK脚本来源:', error);
    }
    
    return null;
  }

  /**
   * 异步检测可用的服务器地址
   */
  async findAvailableServer(manualServerUrl?: string): Promise<ServerConfig> {
    // 检查缓存（只有在没有手动指定服务器时才使用缓存）
    if (!manualServerUrl && this.serverConfigCache && 
        (Date.now() - this.lastConfigFetch) < this.configCacheTime) {
      return this.serverConfigCache;
    }

    const candidates = this.detectServerCandidates(manualServerUrl);
    const errors: string[] = [];

    console.log(`🔍 开始测试服务器候选地址 (${candidates.length}个):`, candidates);

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
        // 🔒 正确的协议转换：https: -> wss:, http: -> ws:
        wsUrl: config.wsUrl || url.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:'),
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