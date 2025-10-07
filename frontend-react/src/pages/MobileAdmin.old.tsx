import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { conversationApi } from '@/services/api'
import { authApi } from '@/services/auth'
import { useWebSocket } from '@/hooks/useWebSocket'
import ConversationList from '@/components/chat/ConversationList'
import ChatArea from '@/components/chat/ChatArea'
import { Conversation, Message } from '@/types'

const MobileAdmin: React.FC = () => {
  const navigate = useNavigate()
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isMobile] = useState(() => window.innerWidth < 768)
  const [showChat, setShowChat] = useState(false)
  const [isAuthChecking, setIsAuthChecking] = useState(true)
  
  const queryClient = useQueryClient()
  const currentUser = authApi.getCurrentUser()

  // WebSocket 连接 - 必须在条件返回之前调用
  const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`
  const { isConnected, lastMessage } = useWebSocket(wsUrl)

  // 获取对话列表 - 必须在条件返回之前调用
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => conversationApi.getConversations(),
    refetchInterval: 20000, // 每20秒刷新
    enabled: !isAuthChecking && authApi.isAuthenticated(), // 只在认证通过后启用
  })

  // 获取消息列表 - 必须在条件返回之前调用
  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', selectedConversation?.id],
    queryFn: () => selectedConversation ? conversationApi.getMessages(selectedConversation.id.toString()) : Promise.resolve([]),
    enabled: !!selectedConversation && !isAuthChecking && authApi.isAuthenticated(),
  })

  // 发送消息 - 必须在条件返回之前调用
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedConversation) throw new Error('没有选中的对话')
      
      await conversationApi.sendMessage({
        conversationId: selectedConversation.id.toString(),
        content,
        type: 'text'
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation?.id] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })

  // 检查身份验证状态
  useEffect(() => {
    // 延迟检查，给localStorage时间完成保存
    const checkAuth = async () => {
      await new Promise(resolve => setTimeout(resolve, 50)) // 50ms延迟
      
      const isAuthenticated = authApi.isAuthenticated()
      const user = authApi.getCurrentUser()
      
      console.log('身份验证检查:', { isAuthenticated, user })
      
      if (!isAuthenticated || !user) {
        console.log('用户未登录，重定向到登录页面')
        navigate('/mobile/login', { replace: true })
        return
      }
      
      console.log('用户已登录:', user)
      setIsAuthChecking(false)
    }
    
    checkAuth()
  }, [navigate])

  // 如果正在检查身份验证或没有登录，显示加载中
  if (isAuthChecking || !authApi.isAuthenticated() || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">正在验证身份...</p>
        </div>
      </div>
    )
  }

  const handleLogout = async () => {
    await authApi.logout()
    navigate('/mobile/login', { replace: true })
  }

  // 处理WebSocket新消息
  useEffect(() => {
    if (lastMessage && selectedConversation && lastMessage.conversation_id === selectedConversation.id) {
      setMessages(prev => {
        // 检查是否已存在相同消息，避免重复
        const exists = prev.some(msg => msg.id === lastMessage.id)
        if (exists) return prev
        return [...prev, lastMessage]
      })
    }
  }, [lastMessage, selectedConversation])

  // 同步消息数据
  useEffect(() => {
    if (messagesData) {
      setMessages(messagesData)
    }
  }, [messagesData])

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation)
    if (isMobile) {
      setShowChat(true)
    }
  }

  const handleBackToList = () => {
    setShowChat(false)
    setSelectedConversation(null)
  }

  const handleSendMessage = async (content: string) => {
    await sendMessageMutation.mutateAsync(content)
  }

  // 移动端：显示聊天界面时隐藏对话列表
  if (isMobile && showChat) {
    return (
      <div className="h-screen">
        <ChatArea
          conversation={selectedConversation}
          onSendMessage={handleSendMessage}
          onBack={handleBackToList}
          messages={messages}
          isLoading={messagesLoading}
          isConnected={isConnected}
        />
      </div>
    )
  }

  // 移动端：显示对话列表
  if (isMobile) {
    return (
      <div className="h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* 现代化头部 */}
        <header className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                💬
              </div>
              <div>
                <h1 className="text-lg font-bold">QuickTalk 客服</h1>
                <p className="text-xs text-blue-100">
                  {currentUser ? `欢迎，${currentUser.username}` : '移动端管理界面'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                <span className="text-sm font-medium">
                  {isConnected ? '在线' : '离线'}
                </span>
              </div>
              {currentUser && (
                <button
                  onClick={handleLogout}
                  className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition-colors"
                >
                  退出
                </button>
              )}
            </div>
          </div>
          
          {/* 统计卡片 */}
          <div className="mt-4 flex space-x-3">
            <div className="flex-1 bg-white/10 rounded-lg px-3 py-2">
              <div className="text-lg font-bold">{conversations.length}</div>
              <div className="text-xs text-blue-100">活跃对话</div>
            </div>
            <div className="flex-1 bg-white/10 rounded-lg px-3 py-2">
              <div className="text-lg font-bold">
                {conversations.filter((c: Conversation) => (c as any).unread_count > 0).length}
              </div>
              <div className="text-xs text-blue-100">未读对话</div>
            </div>
            <div className="flex-1 bg-white/10 rounded-lg px-3 py-2">
              <div className="text-lg font-bold">
                {conversations.reduce((sum: number, c: Conversation) => sum + ((c as any).unread_count || 0), 0)}
              </div>
              <div className="text-xs text-blue-100">未读消息</div>
            </div>
          </div>
        </header>
        
        {/* 对话列表容器 */}
        <div className="flex-1 overflow-hidden">
          <ConversationList
            conversations={conversations}
            selectedConversationId={selectedConversation?.id}
            onSelectConversation={handleSelectConversation}
            isLoading={conversationsLoading}
          />
        </div>

        {/* 底部操作栏 */}
        <div className="bg-white border-t border-gray-200 px-4 py-3 flex justify-between items-center">
          <button 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['conversations'] })}
            className="flex items-center space-x-2 text-blue-600 font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>刷新</span>
          </button>
          
          <div className="text-sm text-gray-500">
            {new Date().toLocaleTimeString('zh-CN', { hour12: false })}
          </div>
          
          <button className="flex items-center space-x-2 text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>设置</span>
          </button>
        </div>
      </div>
    )
  }

  // 桌面端：双栏布局
  return (
    <div className="h-screen flex bg-gray-50">
      {/* 对话列表 */}
      <div className="w-80 border-r border-gray-200 bg-white">
        <div className="p-4 border-b bg-blue-600 text-white">
          <h1 className="text-lg font-semibold">客服对话</h1>
          <div className="text-sm mt-1">
            <span className={`inline-block w-2 h-2 rounded-full mr-1 ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
            {isConnected ? '在线' : '离线'}
          </div>
        </div>
        
        <ConversationList
          conversations={conversations}
          selectedConversationId={selectedConversation?.id}
          onSelectConversation={handleSelectConversation}
          isLoading={conversationsLoading}
        />
      </div>

      {/* 聊天区域 */}
      <div className="flex-1">
        <ChatArea
          conversation={selectedConversation}
          onSendMessage={handleSendMessage}
          messages={messages}
          isLoading={messagesLoading}
          isConnected={isConnected}
        />
      </div>
    </div>
  )
}

export default MobileAdmin