import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useParams } from 'react-router-dom';
import { FiSend, FiImage, FiPaperclip } from 'react-icons/fi';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import axios from 'axios';
import { Avatar, LoadingSpinner } from '../styles/globalStyles';
import { theme } from '../styles/globalStyles';
import toast from 'react-hot-toast';

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
  max-width: 70%;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  border-radius: 18px;
  background: ${props => props.isOwn ? theme.colors.primary : theme.colors.white};
  color: ${props => props.isOwn ? theme.colors.white : theme.colors.text.primary};
  word-wrap: break-word;
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

const MessageAvatar = styled.div<{ isOwn?: boolean }>`
  ${props => props.isOwn && 'order: 1;'}
  margin: ${props => props.isOwn ? '0 0 0 8px' : '0 8px 0 0'};
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

const ActionButton = styled.button`
  width: 40px;
  height: 40px;
  border-radius: ${theme.borderRadius.round};
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s ease;
  
  &:hover {
    background: ${theme.colors.background};
  }
  
  svg {
    width: 20px;
    height: 20px;
    color: ${theme.colors.text.secondary};
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

const EmptyState = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: ${theme.colors.text.secondary};
  padding: ${theme.spacing.xl};
`;

const TypingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  color: ${theme.colors.text.placeholder};
  font-size: ${theme.typography.small};
`;

const TypingDots = styled.div`
  display: flex;
  gap: 2px;
  
  span {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: ${theme.colors.text.placeholder};
    animation: typing 1.4s infinite ease-in-out;
    
    &:nth-child(1) { animation-delay: -0.32s; }
    &:nth-child(2) { animation-delay: -0.16s; }
    &:nth-child(3) { animation-delay: 0s; }
  }
  
  @keyframes typing {
    0%, 80%, 100% {
      opacity: 0.3;
      transform: scale(0.8);
    }
    40% {
      opacity: 1;
      transform: scale(1);
    }
  }
`;

interface Message {
  id: number;
  content: string;
  message_type: string;
  sender_type: 'customer' | 'staff';
  sender_id?: number;
  created_at: string;
}

const ChatPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (sessionId) {
      fetchMessages(parseInt(sessionId));
    }
  }, [sessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async (sessionId: number) => {
    try {
      const response = await axios.get(`/api/sessions/${sessionId}/messages`);
      setMessages(response.data);
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
      const response = await axios.post(`/api/sessions/${sessionId}/messages`, {
        content,
        message_type: 'text',
      });

      // 添加新消息到列表
      setMessages(prev => [...prev, response.data]);
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
          <EmptyState>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>💬</div>
            <h3>开始对话</h3>
            <p>发送消息开始与客户的对话</p>
          </EmptyState>
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
                    {message.content}
                  </MessageBubble>
                </MessageContent>
                <MessageTime isOwn={isOwn}>
                  {formatMessageTime(message.created_at)}
                </MessageTime>
              </MessageGroup>
            );
          })
        )}
        
        {isTyping && (
          <TypingIndicator>
            <Avatar size={24}>👤</Avatar>
            <span>正在输入</span>
            <TypingDots>
              <span></span>
              <span></span>
              <span></span>
            </TypingDots>
          </TypingIndicator>
        )}
        
        <div ref={messagesEndRef} />
      </MessagesContainer>

      <InputContainer>
        <InputRow>
          <ActionButton>
            <FiImage />
          </ActionButton>
          
          <ActionButton>
            <FiPaperclip />
          </ActionButton>
          
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
            disabled={!inputValue.trim() || sending}
          >
            <FiSend />
          </SendButton>
        </InputRow>
      </InputContainer>
    </Container>
  );
};

export default ChatPage;