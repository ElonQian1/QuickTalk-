import React from 'react'
import { authApi } from '@/services/auth'
import LoginPage from '@/pages/LoginPage'

interface AuthGuardProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children, fallback }) => {
  const isAuthenticated = authApi.isAuthenticated()
  
  if (!isAuthenticated) {
    return fallback || <LoginPage />
  }
  
  return <>{children}</>
}

export default AuthGuard