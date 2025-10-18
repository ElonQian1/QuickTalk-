/**
 * 消息数据 Store (V2 - 缓存优化版)
 * 
 * 优化点:
 * - 按会话ID分组缓存（60秒TTL）
 * - WebSocket实时追加消息
 * - 乐观更新（发送消息立即显示）
 */

import { create } from 'zustand';
import axios from 'axios';
import { cacheManager } from './cacheManager';
import { featureFlags } from '../config/featureFlags';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';
const CACHE_TTL = 60000; // 60秒

export interface Message {
  id: number;
  session_id: number;
  sender_type: 'customer' | 'staff';
  sender_id: string;
  message: string;
  created_at: string;
  
  // UI状态（仅前端）
  sending?: boolean;
  failed?: boolean;
}

interface MessagesState {
  messagesBySession: Record<number, Message[]>;
  loading: boolean;
  error: string | null;
  
  // 操作
  fetchMessages: (sessionId: number, useCache?: boolean) => Promise<void>;
  addMessage: (sessionId: number, message: Message) => void;
  sendMessage: (sessionId: number, content: string, senderId: string) => Promise<void>;
  invalidateCache: (sessionId: number) => void;
}

export const useMessagesStoreV2 = create<MessagesState>((set, get) => ({
  messagesBySession: {},
  loading: false,
  error: null,
  
  fetchMessages: async (sessionId: number, useCache = true) => {
    const cacheKey = `messages:session:${sessionId}`;
    
    // 检查缓存
    if (useCache && featureFlags.USE_NEW_CACHE) {
      const cached = cacheManager.get<Message[]>(cacheKey);
      if (cached) {
        console.log(`✅ 从缓存加载会话${sessionId}的消息`);
        set(state => ({
          messagesBySession: {
            ...state.messagesBySession,
            [sessionId]: cached
          },
          loading: false,
          error: null
        }));
        return;
      }
    }
    
    set({ loading: true, error: null });
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(
        `${API_BASE}/api/sessions/${sessionId}/messages`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      const messages: Message[] = response.data;
      
      // 更新缓存
      if (featureFlags.USE_NEW_CACHE) {
        cacheManager.set(cacheKey, messages, CACHE_TTL);
        console.log(`💾 会话${sessionId}消息已缓存`);
      }
      
      set(state => ({
        messagesBySession: {
          ...state.messagesBySession,
          [sessionId]: messages
        },
        loading: false
      }));
    } catch (error: any) {
      console.error('❌ 加载消息失败:', error);
      set({ 
        error: error.response?.data?.error || '加载消息失败',
        loading: false 
      });
    }
  },
  
  /**
   * 添加单条消息（WebSocket实时推送使用）
   */
  addMessage: (sessionId: number, message: Message) => {
    set(state => {
      const messages = state.messagesBySession[sessionId] || [];
      
      // 检查是否已存在（避免重复）
      const exists = messages.some(m => m.id === message.id);
      if (exists) {
        console.log('⚠️ 消息已存在，跳过添加');
        return state;
      }
      
      const updatedMessages = [...messages, message];
      
      // 更新缓存
      if (featureFlags.USE_NEW_CACHE) {
        const cacheKey = `messages:session:${sessionId}`;
        cacheManager.set(cacheKey, updatedMessages, CACHE_TTL);
      }
      
      return {
        messagesBySession: {
          ...state.messagesBySession,
          [sessionId]: updatedMessages
        }
      };
    });
  },
  
  /**
   * 发送消息（乐观更新）
   */
  sendMessage: async (sessionId: number, content: string, senderId: string) => {
    // 1. 乐观更新：立即显示消息（临时ID）
    const tempMessage: Message = {
      id: -Date.now(), // 临时负数ID
      session_id: sessionId,
      sender_type: 'staff',
      sender_id: senderId,
      message: content,
      created_at: new Date().toISOString(),
      sending: true
    };
    
    set(state => {
      const messages = state.messagesBySession[sessionId] || [];
      return {
        messagesBySession: {
          ...state.messagesBySession,
          [sessionId]: [...messages, tempMessage]
        }
      };
    });
    
    // 2. 发送到服务器
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.post(
        `${API_BASE}/api/sessions/${sessionId}/messages`,
        { message: content },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      const realMessage: Message = response.data;
      
      // 3. 替换临时消息为真实消息
      set(state => {
        const messages = state.messagesBySession[sessionId] || [];
        const updatedMessages = messages.map(m => 
          m.id === tempMessage.id ? realMessage : m
        );
        
        // 更新缓存
        if (featureFlags.USE_NEW_CACHE) {
          const cacheKey = `messages:session:${sessionId}`;
          cacheManager.set(cacheKey, updatedMessages, CACHE_TTL);
        }
        
        return {
          messagesBySession: {
            ...state.messagesBySession,
            [sessionId]: updatedMessages
          }
        };
      });
    } catch (error: any) {
      console.error('❌ 发送消息失败:', error);
      
      // 4. 标记消息发送失败
      set(state => {
        const messages = state.messagesBySession[sessionId] || [];
        const updatedMessages = messages.map(m => 
          m.id === tempMessage.id ? { ...m, sending: false, failed: true } : m
        );
        
        return {
          messagesBySession: {
            ...state.messagesBySession,
            [sessionId]: updatedMessages
          },
          error: error.response?.data?.error || '发送消息失败'
        };
      });
      
      throw error;
    }
  },
  
  invalidateCache: (sessionId: number) => {
    const cacheKey = `messages:session:${sessionId}`;
    cacheManager.delete(cacheKey);
    console.log(`🗑️ 会话${sessionId}消息缓存已失效`);
  }
}));
