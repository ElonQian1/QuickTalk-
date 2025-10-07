import React from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Conversation, ConversationListProps } from '@/types'
import { Badge } from '@/components/ui/Badge'

const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedConversationId,
  onSelectConversation,
  isLoading = false
}) => {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3"></div>
        <div className="text-lg font-medium mb-2">加载中...</div>
        <div className="text-sm text-gray-400">正在获取对话列表</div>
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <div className="text-lg font-medium mb-2">暂无对话</div>
        <div className="text-sm text-gray-400">等待客户发起对话</div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-white">
      {/* 顶部搜索栏 */}
      <div className="p-4 border-b border-gray-100 bg-gray-50">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            type="text" 
            placeholder="搜索对话..." 
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
      
      {/* 对话统计 */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">对话列表</h2>
            <div className="text-sm text-gray-600 mt-1 flex items-center space-x-4">
              <span className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                {conversations.length} 个活跃对话
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">{conversations.length}</div>
            <div className="text-xs text-gray-500">总对话</div>
          </div>
        </div>
      </div>
      
      {/* 对话列表 */}
      <div className="divide-y divide-gray-50">
        {conversations.map((conversation) => (
          <ConversationItem
            key={conversation.id}
            conversation={conversation}
            isSelected={conversation.id === selectedConversationId}
            onClick={() => onSelectConversation(conversation)}
          />
        ))}
      </div>
    </div>
  )
}

interface ConversationItemProps {
  conversation: Conversation
  isSelected: boolean
  onClick: () => void
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isSelected,
  onClick,
}) => {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return format(date, 'MM-dd HH:mm', { locale: zhCN })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge variant="success">进行中</Badge>
      case 'closed':
        return <Badge variant="secondary">已关闭</Badge>
      case 'pending':
        return <Badge variant="warning">等待中</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div
      className={`p-4 cursor-pointer transition-all duration-200 border-l-4 ${
        isSelected 
          ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-500 shadow-sm' 
          : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-200'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start space-x-3">
        {/* 用户头像 */}
        <div className="flex-shrink-0">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
            isSelected ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-gray-400 to-gray-600'
          }`}>
            {(conversation.customer?.name || `客户 #${conversation.customer_id}`).charAt(0).toUpperCase()}
          </div>
        </div>
        
        {/* 对话内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-1">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 truncate">
                {conversation.customer?.name || `客户 #${conversation.customer_id}`}
              </h3>
              <p className="text-sm text-gray-500 truncate">
                📍 {conversation.shop?.name || `商店 #${conversation.shop_id}`}
              </p>
            </div>
            
            {/* 状态和时间 */}
            <div className="flex flex-col items-end space-y-1">
              <div className="text-xs text-gray-400">
                {formatTime(conversation.updated_at)}
              </div>
              <div className="flex items-center space-x-2">
                {getStatusBadge(conversation.status)}
                {(conversation as any).unread_count && (conversation as any).unread_count > 0 && (
                  <span className="inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full">
                    {(conversation as any).unread_count}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* 最后一条消息 */}
          {conversation.last_message && (
            <div className="text-sm text-gray-600 line-clamp-2 bg-gray-50 rounded-lg p-2 mt-2">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mr-2 ${
                conversation.last_message.sender_type === 'customer' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-green-100 text-green-800'
              }`}>
                {conversation.last_message.sender_type === 'customer' ? '👤 客户' : '🎧 客服'}
              </span>
              {conversation.last_message.content}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ConversationList