/**
 * V2 Store 统一导出
 * 
 * 使用方法:
 * import { useShopsStoreV2, useCustomersStoreV2, useMessagesStoreV2, cacheManager } from '@/stores/v2';
 */

export { useShopsStoreV2 } from './shopsStore';
export { useCustomersStoreV2 } from './customersStore';
export { useMessagesStoreV2 } from './messagesStore';
export { cacheManager } from './cacheManager';

// 类型导出
export type { Shop } from './shopsStore';
export type { Customer } from './customersStore';
export type { Message } from './messagesStore';
