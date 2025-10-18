/**
 * 统一缓存管理器
 * 提供 TTL 缓存、过期检测、性能监控
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  hitRate: number;
}

class CacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private stats: CacheStats = { hits: 0, misses: 0, sets: 0, hitRate: 0 };
  
  /**
   * 获取缓存数据
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }
    
    const now = Date.now();
    const age = now - entry.timestamp;
    
    // 检查是否过期
    if (age > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }
    
    this.stats.hits++;
    this.updateHitRate();
    return entry.data;
  }
  
  /**
   * 设置缓存数据
   */
  set<T>(key: string, data: T, ttl: number = 30000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
    this.stats.sets++;
  }
  
  /**
   * 检查缓存是否存在且未过期
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }
  
  /**
   * 删除缓存
   */
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
    console.log('🗑️ 缓存已清空');
  }
  
  /**
   * 清空匹配前缀的缓存
   */
  clearPrefix(prefix: string): void {
    const keys = Array.from(this.cache.keys());
    keys.forEach(key => {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    });
    console.log(`🗑️ 已清空前缀为 "${prefix}" 的缓存`);
  }
  
  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }
  
  /**
   * 打印缓存信息（调试用）
   */
  debug(): void {
    console.group('📊 缓存统计');
    console.log('缓存条目数:', this.cache.size);
    console.log('命中次数:', this.stats.hits);
    console.log('未命中次数:', this.stats.misses);
    console.log('命中率:', (this.stats.hitRate * 100).toFixed(2) + '%');
    console.log('设置次数:', this.stats.sets);
    
    console.group('📦 缓存详情');
    this.cache.forEach((entry, key) => {
      const age = Date.now() - entry.timestamp;
      const remaining = entry.ttl - age;
      console.log(`${key}:`, {
        age: `${(age / 1000).toFixed(1)}s`,
        remaining: `${(remaining / 1000).toFixed(1)}s`,
        expired: remaining < 0
      });
    });
    console.groupEnd();
    console.groupEnd();
  }
  
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

// 单例模式
export const cacheManager = new CacheManager();

// 开发工具
if (process.env.NODE_ENV === 'development') {
  (window as any).cache = cacheManager;
  console.log('💡 缓存调试工具：window.cache.debug()');
}
