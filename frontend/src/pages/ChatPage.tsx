import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { useParams } from 'react-router-dom';
import { FiSend, FiImage, FiPaperclip, FiFile, FiMic } from 'react-icons/fi';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { api } from '../config/api';
import { Avatar, LoadingSpinner } from '../styles/globalStyles';
import { theme } from '../styles/globalStyles';
import toast from 'react-hot-toast';
import VoiceRecorder from '../components/VoiceRecorder';
import VoiceMessage from '../components/VoiceMessage';
import EmojiButton from '../components/EmojiButton';
import { MessageText } from '../utils/textFormatter';
import { useWSStore } from '../stores/wsStore';
import { listStaffShops } from '../services/shops';
import { useNotificationsStore } from '../stores/notificationsStore';
import { EmptyState as UIEmptyState, EmptyIcon, EmptyTitle, EmptyDescription } from '../components/UI/EmptyState';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: ${theme.colors.white};
`;

const ChatHeader = styled.div`
  padding: ${theme.spacing.md};
  border-bottom: 1px solid ${theme.colors.border};
  background: ${theme.colors.white};
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};
`;

const CustomerInfo = styled.div`
  flex: 1;
`;

const CustomerName = styled.div`
  font-size: ${theme.typography.body};
  font-weight: 600;
  color: ${theme.colors.text.primary};
  margin-bottom: 2px;
`;

const CustomerStatus = styled.div<{ online?: boolean }>`
  font-size: ${theme.typography.small};
  color: ${props => props.online ? theme.colors.online : theme.colors.text.secondary};
  display: flex;
  align-items: center;
  gap: 4px;
  
  &::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${props => props.online ? theme.colors.online : theme.colors.offline};
  }
`;

const MessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${theme.spacing.md};
  background: #f8f9fa;
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.md};
`;

const MessageGroup = styled.div<{ isOwn?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: ${props => props.isOwn ? 'flex-end' : 'flex-start'};
  gap: 4px;
`;

const MessageBubble = styled.div<{ isOwn?: boolean }>`
  max-width: 85%;
  min-width: fit-content;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  border-radius: 18px;
  background: ${props => props.isOwn ? theme.colors.primary : theme.colors.white};
  color: ${props => props.isOwn ? theme.colors.white : theme.colors.text.primary};
  word-wrap: break-word;
  word-break: break-word;
  white-space: pre-wrap;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  
  ${props => props.isOwn && `
    border-bottom-right-radius: 6px;
  `}
  
  ${props => !props.isOwn && `
    border-bottom-left-radius: 6px;
  `}
`;

const MessageTime = styled.div<{ isOwn?: boolean }>`
  font-size: ${theme.typography.caption};
  color: ${theme.colors.text.placeholder};
  margin: 0 ${theme.spacing.sm};
  align-self: ${props => props.isOwn ? 'flex-end' : 'flex-start'};
`;


const MessageContent = styled.div<{ isOwn?: boolean }>`
  display: flex;
  align-items: flex-end;
  gap: ${theme.spacing.sm};
  ${props => props.isOwn && 'flex-direction: row-reverse;'}
`;

const InputContainer = styled.div`
  padding: ${theme.spacing.md};
  border-top: 1px solid ${theme.colors.border};
  background: ${theme.colors.white};
`;

const InputRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: ${theme.spacing.sm};
`;

const InputWrapper = styled.div`
  flex: 1;
  display: flex;
  align-items: flex-end;
  background: ${theme.colors.background};
  border-radius: 20px;
  padding: 8px 16px;
  max-height: 120px;
`;

const MessageInput = styled.textarea`
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  resize: none;
  font-size: ${theme.typography.body};
  line-height: 1.5;
  max-height: 80px;
  min-height: 24px;
  
  &::placeholder {
    color: ${theme.colors.text.placeholder};
  }
`;

const ActionButton = styled.button<{ disabled?: boolean; $isActive?: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: ${theme.borderRadius.round};
  border: none;
  background: ${props => props.$isActive ? theme.colors.primary : 'transparent'};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: background-color 0.2s ease;
  opacity: ${props => props.disabled ? 0.5 : 1};
  
  &:hover:not(:disabled) {
    background: ${props => props.$isActive ? theme.colors.primary : theme.colors.background};
  }
  
  svg {
    width: 20px;
    height: 20px;
    color: ${props => props.$isActive ? 'white' : theme.colors.text.secondary};
  }
`;

const SendButton = styled.button<{ disabled?: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: ${theme.borderRadius.round};
  border: none;
  background: ${props => props.disabled ? theme.colors.border : theme.colors.primary};
  color: ${theme.colors.white};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s ease;
  
  &:hover:not(:disabled) {
    background: #06A94D;
    transform: scale(1.05);
  }
  
  svg {
    width: 18px;
    height: 18px;
  }
`;

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
`;

// 使用共享的 UI EmptyState 组件，移除本地定义

const MessageImage = styled.img`
  max-width: 200px;
  max-height: 200px;
  border-radius: 8px;
  margin-bottom: 4px;
  cursor: pointer;
`;

const FileAttachment = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  margin-bottom: 4px;
  cursor: pointer;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  
  svg {
    width: 16px;
    height: 16px;
  }
`;

const FileName = styled.span`
  font-size: ${theme.typography.small};
  text-decoration: underline;
`;

// 移除EmojiMessage样式，使用textFormatter中的组件

// TypingIndicator / TypingDots 组件暂未使用，已移除以保持零未使用变量警告。

interface Message {
  id: number;
  session_id?: number;
  content: string;
  message_type: string;
  sender_type: 'customer' | 'staff';
  sender_id?: number;
  created_at: string;
  file_url?: string;
  file_name?: string;
  status?: string;
}

// 规范化媒体 URL：
// - 若是绝对 http/https 链接，则重写为当前站点同源路径（仅保留 pathname+search），避免 https/端口不匹配导致的加载失败
// - 若是相对路径或空值，原样返回
const normalizeMediaUrl = (url?: string) => {
  if (!url) return undefined;
  try {
    if (/^https?:\/\//i.test(url)) {
      const u = new URL(url);
      return `${window.location.origin}${u.pathname}${u.search}`;
    }
    return url;
  } catch {
    return url;
  }
};

const ChatPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { socket, connect, addMessageListener, removeMessageListener } = useWSStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userShopId, setUserShopId] = useState<string | null>(null);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const resetSessionUnread = useNotificationsStore(state => state.resetSessionUnread);
  // const [isTyping, setIsTyping] = useState(false); // 未来可接入实时输入指示
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 稳定 WS 监听器：用 ref 持有最新处理逻辑，避免因依赖变更频繁移除/添加
  const wsHandlerRef = useRef<(data: any) => void>(() => {});
  useEffect(() => {
    wsHandlerRef.current = (data: any) => {
      try {
        console.log('📨 收到WebSocket消息:', data);

        if (data.messageType === 'new_message') {
          const messageSessionId = data.session_id || data.sessionId;
          console.log('🔍 检查消息会话ID:', { messageSessionId, currentSessionId: sessionId });

          if (messageSessionId && messageSessionId.toString() === sessionId) {
            const newMessage: Message = {
              id: Date.now(),
              session_id: messageSessionId,
              sender_type: data.sender_type || data.senderType || 'customer',
              sender_id: data.sender_id || data.senderId,
              content: data.content || '',
              message_type: data.metadata?.messageType || 'text',
              file_url: normalizeMediaUrl(data.file_url || data.fileUrl),
              file_name: data.file_name || data.fileName,
              status: 'sent',
              created_at: data.timestamp || new Date().toISOString(),
            };

            console.log('✅ 添加新消息到界面:', newMessage);

            setMessages(prev => {
              const exists = prev.some(msg =>
                msg.content === newMessage.content &&
                msg.sender_type === newMessage.sender_type &&
                Math.abs(new Date(msg.created_at).getTime() - new Date(newMessage.created_at).getTime()) < 5000
              );

              if (exists) {
                console.log('⚠️ 消息已存在，跳过');
                return prev;
              }

              return [...prev, newMessage];
            });
          } else {
            console.log('⏭️ 消息不属于当前会话，忽略');
          }
        } else {
          console.log('📝 非新消息事件，类型:', data.messageType);
        }
      } catch (error) {
        console.error('❌ 解析WebSocket消息失败:', error);
      }
    };
  }, [sessionId]);

  // 向 wsStore 注册一个稳定引用的监听函数，内部转发到 wsHandlerRef
  const stableWsListener = useCallback((data: any) => {
    wsHandlerRef.current?.(data);
  }, []);

  useEffect(() => {
    if (sessionId) {
      fetchMessages(parseInt(sessionId));
    }
  }, [sessionId]);

  useEffect(() => {
    // 获取用户的店铺信息
    const fetchUserShop = async () => {
      try {
        console.log('🧾 根据当前会话获取其所属店铺以建立WS...');
        let pickedShopId: number | undefined;
        if (sessionId) {
          try {
            const sessionRes = await api.get(`/api/sessions/${sessionId}`);
            pickedShopId = sessionRes.data?.shop_id;
            console.log('🧾 当前会话所属店铺:', pickedShopId);
          } catch (e) {
            console.warn('⚠️ 获取会话信息失败，回退到店铺列表策略:', e);
          }
        }

        if (!pickedShopId) {
          const response = await api.get('/api/shops');
          console.log('🏪 用户店铺列表(拥有者):', response.data);
          if (response.data && response.data.length > 0) {
            pickedShopId = response.data[0].shop.id;
          } else {
            // 作为员工的店铺兜底
            try {
              const staffShops = await listStaffShops();
              console.log('👥 用户员工店铺列表:', staffShops);
              if (Array.isArray(staffShops) && staffShops.length > 0) {
                pickedShopId = staffShops[0].id;
              } else {
                console.warn('⚠️ 用户没有任何店铺（既非店主也未加入为员工）');
              }
            } catch (e) {
              console.warn('⚠️ 获取员工店铺失败:', e);
            }
          }
        }

        if (pickedShopId) {
          setUserShopId(String(pickedShopId));
          connect(pickedShopId);
          console.log('🔌 WebSocket连接已建立，shopId:', pickedShopId);
        }
      } catch (error: any) {
        console.error('❌ 获取用户店铺失败:', error);
        if (error?.response?.status === 401) {
          toast.error('登录已过期，请重新登录');
        }
      }
    };

    fetchUserShop();
  }, [connect]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 检查WebSocket连接状态
  useEffect(() => {
    console.log('🔌 WebSocket状态检查:', {
      socket: !!socket,
      readyState: socket?.readyState,
      sessionId,
      userShopId
    });
  }, [socket, sessionId, userShopId]);

  // 监听WebSocket消息，实时更新聊天界面
  useEffect(() => {
    if (!sessionId) {
      console.log('⚠️ WebSocket监听未启动: sessionId 不存在');
      return;
    }

    console.log('🔌 开始监听WebSocket消息，sessionId:', sessionId);

    // 添加消息监听器
    addMessageListener(stableWsListener);
    console.log('👂 WebSocket消息监听器已添加');

    // 清理事件监听器
    return () => {
      removeMessageListener(stableWsListener);
      console.log('🧹 WebSocket消息监听器已移除');
    };
  }, [sessionId, addMessageListener, removeMessageListener, stableWsListener]);

  const fetchMessages = async (sessionId: number) => {
    try {
  const response = await api.get(`/api/sessions/${sessionId}/messages`);
      console.log('🔍 API返回的原始历史消息:', response.data);
      
      // 检查每条消息的内容
      response.data.forEach((msg: any, index: number) => {
        console.log(`📨 历史消息 ${index}:`, {
          id: msg.id,
          content: msg.content,
          content_type: typeof msg.content,
          content_length: msg.content?.length,
          message_type: msg.message_type,
          sender_type: msg.sender_type
        });
      });
      
      setMessages(response.data);

      // 获取会话元信息以执行已读同步（需要 shop_id 和 customer_id）
      try {
        const meta = await api.get(`/api/sessions/${sessionId}`);
        const shopId = meta.data?.shop_id as number | undefined;
        const customerId = meta.data?.customer_id as number | undefined;
        if (shopId && customerId) {
          // 调用后端清除该客户在该店铺的未读
          api.post(`/api/shops/${shopId}/customers/${customerId}/read`).finally(() => {
            try { resetSessionUnread(sessionId, shopId); } catch {}
          });
        }
      } catch (e) {
        console.warn('获取会话元信息失败，跳过前端未读同步', e);
      }
    } catch (error) {
      toast.error('获取消息失败');
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    
    // 自动调整高度
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = async () => {
    const content = inputValue.trim();
    if (!content || sending) return;

    setSending(true);
    
    try {
      await api.post(`/api/sessions/${sessionId}/messages`, {
        content,
        message_type: 'text',
      });

      // 乐观回显：但先做一次去重，防止 WS 比 POST 返回更快导致重复
      setMessages(prev => {
        const now = Date.now();
        const exists = prev.some(msg =>
          msg.sender_type === 'staff' &&
          msg.content === content &&
          Math.abs(new Date(msg.created_at).getTime() - now) < 5000
        );
        if (exists) return prev;
        return [
          ...prev,
          {
            id: Date.now(),
            session_id: Number(sessionId),
            sender_type: 'staff',
            sender_id: undefined,
            content,
            message_type: 'text',
            file_url: undefined,
            file_name: undefined,
            status: 'sent',
            created_at: new Date().toISOString(),
          },
        ];
      });

      setInputValue('');
      
      // 重置输入框高度
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
      
    } catch (error) {
      toast.error('发送消息失败');
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleEmojiSelect = async (emoji: string) => {
    if (!sessionId || sending) return;

    setSending(true);

    try {
      await api.post(`/api/sessions/${sessionId}/messages`, {
        content: emoji,
        message_type: 'text',
      });

      console.log('😊 发送表情:', emoji);
      // 乐观回显表情（带去重）
      setMessages(prev => {
        const now = Date.now();
        const exists = prev.some(msg =>
          msg.sender_type === 'staff' &&
          msg.content === emoji &&
          Math.abs(new Date(msg.created_at).getTime() - now) < 5000
        );
        if (exists) return prev;
        return [
          ...prev,
          {
            id: Date.now(),
            session_id: Number(sessionId),
            sender_type: 'staff',
            sender_id: undefined,
            content: emoji,
            message_type: 'text',
            file_url: undefined,
            file_name: undefined,
            status: 'sent',
            created_at: new Date().toISOString(),
          },
        ];
      });
      
    } catch (error) {
      toast.error('发送表情失败');
      console.error('Error sending emoji:', error);
    } finally {
      setSending(false);
    }
  };

  const handleImageUpload = () => {
    if (uploading) return;
    imageInputRef.current?.click();
  };

  const handleFileUpload = () => {
    if (uploading) return;
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>, messageType: 'image' | 'file') => {
    const file = event.target.files?.[0];
    if (!file || !sessionId) return;

    if (!userShopId) {
      toast.error('无法获取店铺信息，请刷新页面重试');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('shopId', userShopId);
      formData.append('messageType', messageType);
      
      console.log('📤 上传文件，使用shopId:', userShopId, ', 文件:', file.name);
      
      const uploadResponse = await api.post('/api/upload', formData);

      // 发送包含文件信息的消息
      await api.post(`/api/sessions/${sessionId}/messages`, {
        content: uploadResponse.data.original_name,
        message_type: messageType,
        file_url: uploadResponse.data.url,
        file_name: uploadResponse.data.file_name,
      });

      // 消息会通过WebSocket推送更新，不需要手动添加
      
      toast.success('文件上传成功');
    } catch (error: any) {
      console.error('Error uploading file:', error);
      
      // 更友好的错误处理
      if (error?.response?.status === 401) {
        toast.error('权限不足，无法上传文件');
      } else if (error?.response?.status === 400) {
        const errorMessage = error?.response?.data?.message || '文件格式不支持或文件过大';
        toast.error(`上传失败: ${errorMessage}`);
      } else {
        toast.error('文件上传失败，请稍后重试');
      }
    } finally {
      setUploading(false);
      // 清空文件输入
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleSendVoice = async (audioBlob: Blob) => {
    if (!userShopId || !sessionId) {
      toast.error('无法发送语音消息');
      return;
    }

    setUploading(true);
    setShowVoiceRecorder(false);

    try {
      // 创建语音文件名
      const fileName = `voice_${Date.now()}.webm`;
      const file = new File([audioBlob], fileName, { type: 'audio/webm' });
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('shopId', userShopId);
      formData.append('messageType', 'voice');
      
      console.log('📤 上传语音，使用shopId:', userShopId, ', 文件大小:', file.size);
      
      const uploadResponse = await api.post('/api/upload', formData);

      // 发送包含语音信息的消息
      const messageResponse = await api.post(`/api/sessions/${sessionId}/messages`, {
        content: '语音消息',
        message_type: 'voice',
        file_url: uploadResponse.data.url,
        file_name: uploadResponse.data.file_name,
      });

      // 添加新消息到列表
      setMessages(prev => [...prev, messageResponse.data]);
      
      toast.success('语音发送成功');
    } catch (error: any) {
      console.error('Error sending voice:', error);
      
      if (error?.response?.status === 401) {
        toast.error('权限不足，无法发送语音');
      } else if (error?.response?.status === 400) {
        const errorMessage = error?.response?.data?.message || '语音格式不支持或文件过大';
        toast.error(`语音发送失败: ${errorMessage}`);
      } else {
        toast.error('语音发送失败，请稍后重试');
      }
    } finally {
      setUploading(false);
    }
  };

  const formatMessageTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      
      if (isToday) {
        return format(date, 'HH:mm', { locale: zhCN });
      } else {
        return format(date, 'MM/dd HH:mm', { locale: zhCN });
      }
    } catch (error) {
      return '';
    }
  };

  const renderMessageContent = (message: Message) => {
    console.log('🔍 renderMessageContent 收到消息:', {
      id: message.id,
      message_type: message.message_type,
      content: message.content,
      content_length: message.content?.length,
      sender_type: message.sender_type
    });
    
    switch (message.message_type) {
      case 'image':
        return (
          <div>
            {message.file_url && (
              <MessageImage
                src={normalizeMediaUrl(message.file_url)}
                alt={message.file_name || message.content}
                onClick={() => {
                  const u = normalizeMediaUrl(message.file_url);
                  if (u) window.open(u, '_blank');
                }}
              />
            )}
            {/* 图片类型不显示文件名，仅展示图片 */}
          </div>
        );
      case 'file':
        return (
          <FileAttachment onClick={() => {
            const u = normalizeMediaUrl(message.file_url);
            if (u) window.open(u, '_blank');
          }}>
            <FiFile />
            <FileName>{message.file_name || message.content}</FileName>
          </FileAttachment>
        );
      case 'voice':
        return message.file_url ? (
          <VoiceMessage
            fileUrl={normalizeMediaUrl(message.file_url) || message.file_url}
            fileName={message.content}
            timestamp={message.created_at}
            senderType={message.sender_type as 'staff' | 'customer'}
            isOwn={message.sender_type === 'staff'}
          />
        ) : (
          <div>语音消息加载失败</div>
        );
      default:
        console.log('🎯 渲染文本消息，内容:', message.content);
        // 使用统一的文本格式化组件
        return <MessageText content={message.content} />;
    }
  };

  const groupMessagesByTime = (messages: Message[]) => {
    const grouped: (Message | { type: 'time'; time: string })[] = [];
    let lastDate = '';

    messages.forEach((message, index) => {
      const messageDate = new Date(message.created_at).toDateString();
      
      if (messageDate !== lastDate) {
        grouped.push({
          type: 'time',
          time: messageDate,
        });
        lastDate = messageDate;
      }
      
      grouped.push(message);
    });

    return grouped;
  };

  if (loading) {
    return (
      <Container>
        <LoadingContainer>
          <LoadingSpinner />
        </LoadingContainer>
      </Container>
    );
  }

  return (
    <Container>
      <ChatHeader>
        <Avatar size={40}>👤</Avatar>
        <CustomerInfo>
          <CustomerName>客户</CustomerName>
          <CustomerStatus online={true}>在线</CustomerStatus>
        </CustomerInfo>
      </ChatHeader>

      <MessagesContainer>
        {messages.length === 0 ? (
          <UIEmptyState>
            <EmptyIcon>💬</EmptyIcon>
            <EmptyTitle>开始对话</EmptyTitle>
            <EmptyDescription>发送消息开始与客户的对话</EmptyDescription>
          </UIEmptyState>
        ) : (
          groupMessagesByTime(messages).map((item, index) => {
            if ('type' in item && item.type === 'time') {
              return (
                <div key={`time-${index}`} style={{ 
                  textAlign: 'center', 
                  fontSize: theme.typography.caption,
                  color: theme.colors.text.placeholder,
                  margin: `${theme.spacing.md} 0`
                }}>
                  {format(new Date(item.time), 'yyyy年MM月dd日', { locale: zhCN })}
                </div>
              );
            }

            const message = item as Message;
            const isOwn = message.sender_type === 'staff';
            
            return (
              <MessageGroup key={message.id} isOwn={isOwn}>
                <MessageContent isOwn={isOwn}>
                  <MessageBubble isOwn={isOwn}>
                    {renderMessageContent(message)}
                  </MessageBubble>
                </MessageContent>
                <MessageTime isOwn={isOwn}>
                  {formatMessageTime(message.created_at)}
                </MessageTime>
              </MessageGroup>
            );
          })
        )}
        
        {/* 正在输入指示器暂未启用 */}
        
        <div ref={messagesEndRef} />
      </MessagesContainer>

      <InputContainer>
        {showVoiceRecorder && (
          <VoiceRecorder 
            onSendVoice={handleSendVoice}
            onCancel={() => setShowVoiceRecorder(false)}
            disabled={uploading}
          />
        )}
        
        <InputRow>
          <ActionButton onClick={handleImageUpload} disabled={uploading}>
            <FiImage />
          </ActionButton>
          
          <ActionButton onClick={handleFileUpload} disabled={uploading}>
            <FiPaperclip />
          </ActionButton>
          
          <ActionButton 
            onClick={() => setShowVoiceRecorder(!showVoiceRecorder)} 
            disabled={uploading}
            $isActive={showVoiceRecorder}
          >
            <FiMic />
          </ActionButton>
          
          <EmojiButton 
            onEmojiSelect={handleEmojiSelect}
            disabled={sending || uploading}
          />
          
          <InputWrapper>
            <MessageInput
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="输入消息..."
              rows={1}
            />
          </InputWrapper>
          
          <SendButton
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || sending || uploading}
          >
            <FiSend />
          </SendButton>
        </InputRow>

        {/* 隐藏的文件输入框 */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => handleFileSelect(e, 'image')}
        />
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={(e) => handleFileSelect(e, 'file')}
        />
      </InputContainer>
    </Container>
  );
};

export default ChatPage;