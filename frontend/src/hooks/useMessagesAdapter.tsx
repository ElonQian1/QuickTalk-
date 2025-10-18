/**
 * 消息/聊天页适配器
 * 根据 Feature Flag 选择使用新Store或旧逻辑
 */

import { useState, useEffect } from 'react';
import { featureFlags } from '../stores/config/featureFlags';
import { useMessagesStoreV2, type Message as MessageV2 } from '../stores/v2';
import { api } from '../config/api';

export interface MessageWithMeta {
  id: number;
  session_id: number;
  sender_type: 'customer' | 'staff';
  sender_id: string;
  message: string;
  created_at: string;
  
  // UI状态
  sending?: boolean;
  failed?: boolean;
}

/**
 * 消息数据加载 Hook
 */
export function useMessagesData(sessionId: number | null) {
  const [messages, setMessages] = useState<MessageWithMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // V2 Store（新架构）
  const messagesBySession = useMessagesStoreV2(state => state.messagesBySession);
  const loadingV2 = useMessagesStoreV2(state => state.loading);
  const errorV2 = useMessagesStoreV2(state => state.error);
  const fetchMessagesV2 = useMessagesStoreV2(state => state.fetchMessages);
  const addMessageV2 = useMessagesStoreV2(state => state.addMessage);
  const sendMessageV2 = useMessagesStoreV2(state => state.sendMessage);

  useEffect(() => {
    if (sessionId) {
      loadMessages(sessionId);
    }
  }, [sessionId]);

  const loadMessages = async (targetSessionId: number) => {
    // 使用新Store
    if (featureFlags.USE_NEW_MESSAGES_STORE) {
      console.log(`🆕 使用新消息Store加载会话${targetSessionId}`);
      await fetchMessagesV2(targetSessionId);
      return;
    }

    // 使用旧逻辑
    console.log(`🔙 使用旧消息逻辑加载会话${targetSessionId}`);
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('auth_token');
      const response = await api.get(`/api/sessions/${targetSessionId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const messagesData: MessageWithMeta[] = response.data;
      setMessages(messagesData);
      setLoading(false);
    } catch (err: any) {
      console.error('❌ 加载消息失败:', err);
      setError(err.response?.data?.error || '加载消息失败');
      setLoading(false);
    }
  };

  // 转换新Store数据为统一格式
  const transformedMessages = featureFlags.USE_NEW_MESSAGES_STORE && sessionId
    ? (messagesBySession[sessionId] || [])
    : messages;

  return {
    messages: transformedMessages,
    loading: featureFlags.USE_NEW_MESSAGES_STORE ? loadingV2 : loading,
    error: featureFlags.USE_NEW_MESSAGES_STORE ? errorV2 : error,
    reload: () => sessionId && loadMessages(sessionId),
    
    /**
     * 发送消息（乐观更新）
     */
    sendMessage: async (content: string, senderId: string) => {
      if (!sessionId) {
        throw new Error('未选择会话');
      }

      if (featureFlags.USE_NEW_MESSAGES_STORE) {
        console.log('🆕 使用新Store发送消息');
        await sendMessageV2(sessionId, content, senderId);
      } else {
        console.log('🔙 使用旧逻辑发送消息');
        // 旧逻辑：乐观更新
        const tempMessage: MessageWithMeta = {
          id: -Date.now(),
          session_id: sessionId,
          sender_type: 'staff',
          sender_id: senderId,
          message: content,
          created_at: new Date().toISOString(),
          sending: true
        };

        setMessages(prev => [...prev, tempMessage]);

        try {
          const token = localStorage.getItem('auth_token');
          const response = await api.post(
            `/api/sessions/${sessionId}/messages`,
            { message: content },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          const realMessage: MessageWithMeta = response.data;
          
          // 替换临时消息
          setMessages(prev => 
            prev.map(m => m.id === tempMessage.id ? realMessage : m)
          );
        } catch (err: any) {
          console.error('❌ 发送消息失败:', err);
          
          // 标记失败
          setMessages(prev => 
            prev.map(m => 
              m.id === tempMessage.id 
                ? { ...m, sending: false, failed: true } 
                : m
            )
          );
          
          throw err;
        }
      }
    },
    
    /**
     * 添加消息（WebSocket实时推送使用）
     */
    addMessage: (message: MessageV2) => {
      if (!sessionId) return;

      if (featureFlags.USE_NEW_MESSAGES_STORE) {
        addMessageV2(sessionId, message);
      } else {
        // 旧逻辑：直接追加
        setMessages(prev => {
          const exists = prev.some(m => m.id === message.id);
          if (exists) return prev;
          return [...prev, message];
        });
      }
    }
  };
}

/**
 * WebSocket实时接收消息
 */
export function useMessageWebSocketUpdates(
  sessionId: number | null,
  addMessage: (message: MessageV2) => void
) {
  useEffect(() => {
    if (!sessionId) return;

    // 监听WebSocket消息
    const handleWSMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const messageType = data?.messageType || data?.message_type;
        
        if (messageType === 'new_message') {
          const metadata = data?.metadata || {};
          const msgSessionId = metadata.sessionId || metadata.session_id;
          
          if (msgSessionId === sessionId) {
            const newMessage: MessageV2 = {
              id: data.id || Date.now(),
              session_id: sessionId,
              sender_type: data.sender_type || data.senderType || 'customer',
              sender_id: data.sender_id || data.senderId || '',
              message: data.content || data.message || '',
              created_at: data.timestamp || data.created_at || new Date().toISOString()
            };
            
            addMessage(newMessage);
          }
        }
      } catch (err) {
        console.debug('WebSocket消息解析失败:', err);
      }
    };

    // TODO: 接入实际的WebSocket连接
    // wsStore.addListener(handleWSMessage);
    // return () => wsStore.removeListener(handleWSMessage);

    console.log('📡 消息WebSocket监听已启用（待接入实际连接）');
  }, [sessionId, addMessage]);
}
