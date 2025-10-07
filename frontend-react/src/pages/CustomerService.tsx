import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { conversationApi } from '@/services/api'
import ChatArea from '@/components/chat/ChatArea'
import ConversationList from '@/components/chat/ConversationList'
import Header from '@/components/common/Header'
import { Conversation } from '@/types'

const CustomerService: React.FC = () => {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  // Check for mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Fetch conversations
  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: conversationApi.getConversations,
    refetchInterval: 5000, // Refetch every 5 seconds
  })

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation)
  }

  const handleSendMessage = async (content: string, type: 'text' | 'image' = 'text') => {
    if (!selectedConversation) return
    
    try {
      await conversationApi.sendMessage({
        conversationId: selectedConversation.id,
        content,
        type,
      })
      // Optionally trigger a refetch of messages
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">加载中...</div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header title="QuickTalk 客服系统" />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Conversation List */}
        <div className={`w-full md:w-80 border-r border-gray-200 bg-white ${
          isMobile && selectedConversation ? 'hidden' : ''
        }`}>
          <ConversationList
            conversations={conversations || []}
            selectedConversationId={selectedConversation?.id}
            onSelectConversation={handleSelectConversation}
          />
        </div>

        {/* Chat Area */}
        <div className={`flex-1 ${
          isMobile && !selectedConversation ? 'hidden' : ''
        }`}>
          {selectedConversation ? (
            <ChatArea
              conversation={selectedConversation}
              onSendMessage={handleSendMessage}
              onBack={isMobile ? () => setSelectedConversation(null) : undefined}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <div className="text-lg mb-2">请选择一个对话</div>
                <div className="text-sm">从左侧列表中选择客户对话</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CustomerService