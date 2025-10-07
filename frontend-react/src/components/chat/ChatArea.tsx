import React, { useState, useEffect, useRef } from 'react'
import { Send, ArrowLeft } from 'lucide-react'
import { Message, Conversation } from '@/types'

interface ChatAreaProps {
  conversation: Conversation | null
  onSendMessage: (content: string) => Promise<void>
  onBack?: () => void
  messages: Message[]
  isLoading: boolean
  isConnected: boolean
}

const ChatArea: React.FC<ChatAreaProps> = ({
  conversation,
  onSendMessage,
  onBack,
  messages,
  isLoading,
  isConnected
}) => {
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    const content = inputValue.trim()
    if (!content || isSending || !conversation) return

    setIsSending(true)
    try {
      await onSendMessage(content)
      setInputValue('')
    } catch (error) {
      console.error('发送消息失败:', error)
      // TODO: 显示错误提示
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const getSenderDisplayName = (message: Message) => {
    return message.sender_type === 'customer' ? '客户' : '客服'
  }

  if (!conversation) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <div className="text-lg mb-2">请选择一个对话</div>
          <div className="text-sm">从列表中选择要查看的对话</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* 聊天头部 */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1 hover:bg-gray-100 rounded-md md:hidden"
              aria-label="返回对话列表"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <div className="font-medium text-gray-900">
              {conversation.customer?.name || `对话 #${conversation.id.toString().slice(0, 8)}`}
            </div>
            <div className="text-sm text-gray-500 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              {isConnected ? '在线' : '离线'}
            </div>
          </div>
        </div>
        
        <div className="text-sm text-gray-500">
          {conversation.status === 'open' ? '进行中' : '已关闭'}
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="text-gray-500">加载消息中...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex justify-center py-8">
            <div className="text-gray-500">暂无消息</div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender_type === 'customer' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg break-words ${
                  message.sender_type === 'customer'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <div className="font-medium text-xs mb-1 opacity-75">
                  {getSenderDisplayName(message)}
                </div>
                <div className="text-sm">{message.content}</div>
                <div className="text-xs mt-1 opacity-75">
                  {formatTime(message.created_at)}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 消息输入框 */}
      <div className="border-t p-4 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入消息..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isSending || !isConnected}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isSending || !isConnected}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send size={16} />
            {isSending ? '发送中' : '发送'}
          </button>
        </div>
        
        {!isConnected && (
          <div className="mt-2 text-sm text-red-500 text-center">
            连接已断开，正在重连...
          </div>
        )}
      </div>
    </div>
  )
}

export default ChatArea