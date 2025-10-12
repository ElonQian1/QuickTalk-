/**
 * 统计数据相关的工具函数
 */

// 数字格式化
export const formatNumber = (num: number): string => {
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}万`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`;
  }
  return num.toLocaleString();
};

// 百分比计算
export const calculatePercentage = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};

// 变化趋势
export const getTrend = (current: number, previous: number): 'up' | 'down' | 'neutral' => {
  const diff = current - previous;
  if (diff > 0) return 'up';
  if (diff < 0) return 'down';
  return 'neutral';
};

// 时间格式化
export const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

// 获取时间段描述
export const getTimePeriodDesc = (period: 'today' | 'week' | 'month'): string => {
  switch (period) {
    case 'today': return '今日';
    case 'week': return '本周';
    case 'month': return '本月';
    default: return '';
  }
};

// 统计数据验证
export const validateStatValue = (value: unknown): number => {
  if (typeof value === 'number' && !isNaN(value) && value >= 0) {
    return Math.floor(value);
  }
  return 0;
};

// 增长率颜色
export const getGrowthColor = (growth: number): string => {
  if (growth > 0) return '#00d4aa';  // 绿色 - 增长
  if (growth < 0) return '#ff6b6b';  // 红色 - 下降
  return '#666';                     // 灰色 - 持平
};

// 生成模拟数据（仅开发调试使用）
export const generateMockStats = () => ({
  totalMessages: Math.floor(Math.random() * 1000) + 100,
  activeCustomers: Math.floor(Math.random() * 100) + 20,
  totalShops: Math.floor(Math.random() * 10) + 1,
  pendingChats: Math.floor(Math.random() * 50) + 5,
  todayMessages: Math.floor(Math.random() * 200) + 50,
  weekMessages: Math.floor(Math.random() * 1000) + 200,
  monthMessages: Math.floor(Math.random() * 3000) + 500,
  todayCustomers: Math.floor(Math.random() * 50) + 10,
});