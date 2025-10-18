/**
 * 特性开关配置
 * 用于在新旧架构之间切换，确保安全迁移
 */

interface FeatureFlags {
  // 是否使用新的缓存架构
  USE_NEW_CACHE: boolean;
  
  // 各模块独立开关
  USE_NEW_SHOPS_STORE: boolean;
  USE_NEW_CUSTOMERS_STORE: boolean;
  USE_NEW_MESSAGES_STORE: boolean;
  
  // 调试模式
  DEBUG_CACHE: boolean;
  DEBUG_PERFORMANCE: boolean;
}

// 🔧 开发环境：默认关闭新功能，逐个测试
// 🚀 生产环境：确认稳定后再开启
const featureFlags: FeatureFlags = {
  USE_NEW_CACHE: false,
  
  // 分模块控制，便于逐个迁移
  USE_NEW_SHOPS_STORE: false,
  USE_NEW_CUSTOMERS_STORE: false,
  USE_NEW_MESSAGES_STORE: false,
  
  DEBUG_CACHE: process.env.NODE_ENV === 'development',
  DEBUG_PERFORMANCE: process.env.NODE_ENV === 'development',
};

// 从 localStorage 读取覆盖（便于测试）
if (typeof window !== 'undefined') {
  const localFlags = localStorage.getItem('featureFlags');
  if (localFlags) {
    try {
      Object.assign(featureFlags, JSON.parse(localFlags));
    } catch (e) {
      console.warn('解析 featureFlags 失败:', e);
    }
  }
}

export { featureFlags };

// 运行时切换功能（仅开发环境）
if (process.env.NODE_ENV === 'development') {
  (window as any).toggleFeature = (key: keyof FeatureFlags) => {
    featureFlags[key] = !featureFlags[key];
    localStorage.setItem('featureFlags', JSON.stringify(featureFlags));
    console.log(`🔧 ${key} = ${featureFlags[key]}`);
    console.log('刷新页面生效');
  };
  
  console.log('💡 开发工具已就绪：');
  console.log('  window.toggleFeature("USE_NEW_SHOPS_STORE")');
  console.log('  window.toggleFeature("USE_NEW_CUSTOMERS_STORE")');
}
