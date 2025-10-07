import { useState, useEffect, useRef, useCallback } from 'react'
import { Message } from '@/types'

interface WebSocketMessage {
  type: string
  data: {
    message?: {
      conversation_id: number
      sender_type: 'customer' | 'agent'
      content: string
      id: number
      created_at: string
    }
  }
}

interface UseWebSocketReturn {
  isConnected: boolean
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  lastMessage: Message | null
  sendMessage: (message: any) => void
}

export const useWebSocket = (url: string): UseWebSocketReturn => {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  const [lastMessage, setLastMessage] = useState<Message | null>(null)
  
  const ws = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      return
    }

    setConnectionStatus('connecting')
    
    try {
      ws.current = new WebSocket(url)

      ws.current.onopen = () => {
        console.log('WebSocket connected')
        setIsConnected(true)
        setConnectionStatus('connected')
        reconnectAttempts.current = 0
      }

      ws.current.onmessage = (event) => {
        try {
          const wsMessage: WebSocketMessage = JSON.parse(event.data)
          
          // 处理消息事件
          if (wsMessage.type && wsMessage.type.startsWith('domain.event.message_')) {
            const messageData = wsMessage.data.message
            if (messageData) {
              const message: Message = {
                id: messageData.id,
                conversation_id: messageData.conversation_id,
                sender_type: messageData.sender_type,
                sender_id: 1, // 从 WebSocket 消息中可能无法获取，使用默认值
                content: messageData.content,
                message_type: 'text',
                created_at: messageData.created_at,
                updated_at: messageData.created_at
              }
              setLastMessage(message)
            }
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.reason)
        setIsConnected(false)
        setConnectionStatus('disconnected')
        
        // 自动重连
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const timeout = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current += 1
            connect()
          }, timeout)
        }
      }

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error)
        setConnectionStatus('error')
      }

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      setConnectionStatus('error')
    }
  }, [url])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    if (ws.current) {
      ws.current.close()
      ws.current = null
    }
    
    setIsConnected(false)
    setConnectionStatus('disconnected')
  }, [])

  const sendMessage = useCallback((message: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket is not connected')
    }
  }, [])

  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  // 清理定时器
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [])

  return {
    isConnected,
    connectionStatus,
    lastMessage,
    sendMessage
  }
}