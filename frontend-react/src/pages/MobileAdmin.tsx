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
  const queryClient = useQueryClient()
  
  // State management
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isMobile] = useState(() => window.innerWidth < 768)
  const [showChat, setShowChat] = useState(false)
  const [isAuthChecking, setIsAuthChecking] = useState(true)
  
  const currentUser = authApi.getCurrentUser()
  
  // WebSocket connection - must be called before conditional returns
  const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`
  const { isConnected, lastMessage } = useWebSocket(wsUrl)
  
  // Data fetching - must be called before conditional returns
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => conversationApi.getConversations(),
    refetchInterval: 20000,
    enabled: !isAuthChecking && authApi.isAuthenticated(),
  })
  
  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', selectedConversation?.id],
    queryFn: () => selectedConversation ? conversationApi.getMessages(selectedConversation.id.toString()) : Promise.resolve([]),
    enabled: !!selectedConversation && !isAuthChecking && authApi.isAuthenticated(),
  })
  
  // Send message mutation - must be called before conditional returns
  const sendMutation = useMutation({
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
  
  // Authentication check
  useEffect(() => {
    const checkAuth = async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
      
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
  
  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage && selectedConversation && lastMessage.conversation_id === selectedConversation.id) {
      setMessages(prev => {
        const exists = prev.some(msg => msg.id === lastMessage.id)
        if (exists) return prev
        return [...prev, lastMessage]
      })
    }
  }, [lastMessage, selectedConversation])
  
  // Sync messages data
  useEffect(() => {
    if (messagesData) {
      setMessages(messagesData)
    }
  }, [messagesData])
  
  // Show loading if checking auth or not authenticated
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
  
  // Event handlers
  const handleLogout = async () => {
    await authApi.logout()
    navigate('/mobile/login', { replace: true })
  }
  
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
    await sendMutation.mutateAsync(content)
  }
  
  // Mobile: show chat view
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
  
  // Mobile: show conversation list or desktop layout
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">Q</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">QuickTalk</h1>
              <p className="text-sm text-gray-500">移动端管理</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Connection status */}
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            
            {/* User info */}
            {currentUser && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">{currentUser.username}</span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  退出
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop layout */}
        {!isMobile ? (
          <>
            {/* Conversation list */}
            <div className="w-1/3 border-r border-gray-200 bg-white">
              <ConversationList
                conversations={conversations}
                selectedConversation={selectedConversation}
                onSelectConversation={handleSelectConversation}
                isLoading={conversationsLoading}
              />
            </div>
            
            {/* Chat area */}
            <div className="flex-1">
              {selectedConversation ? (
                <ChatArea
                  conversation={selectedConversation}
                  onSendMessage={handleSendMessage}
                  messages={messages}
                  isLoading={messagesLoading}
                  isConnected={isConnected}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl">💬</span>
                    </div>
                    <p>选择一个对话开始聊天</p>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Mobile layout - conversation list only */
          <div className="flex-1">
            <ConversationList
              conversations={conversations}
              selectedConversationId={selectedConversation?.id}
              onSelectConversation={handleSelectConversation}
              isLoading={conversationsLoading}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default MobileAdmin