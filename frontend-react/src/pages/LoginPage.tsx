import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Shield, UserCheck, Lock, Mail, User } from 'lucide-react'
import { authApi, LoginCredentials } from '@/services/auth'

interface LoginPageProps {
  onLogin?: (credentials: LoginCredentials) => void
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // 清除对应字段的错误
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {}
    
    if (!formData.username.trim()) {
      newErrors.username = '请输入用户名或邮箱'
    }
    
    if (!formData.password) {
      newErrors.password = '请输入密码'
    } else if (formData.password.length < 6) {
      newErrors.password = '密码长度至少6位'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return
    
    setIsLoading(true)
    setErrors({}) // 清除之前的错误
    
    try {
      console.log('开始登录，发送数据:', formData)
      const response = await authApi.login(formData)
      console.log('登录响应:', response)
      
      if (response.success) {
        console.log('登录成功，准备跳转')
        if (onLogin) {
          onLogin(formData)
        } else {
          // 确保状态已保存，然后跳转
          console.log('等待状态保存完成...')
          setTimeout(() => {
            console.log('跳转到移动端管理页面')
            navigate('/mobile/admin', { replace: true })
          }, 100) // 短暂延迟确保localStorage操作完成
        }
      } else {
        console.log('登录失败:', response.message)
        setErrors({ submit: response.message || '登录失败，请检查用户名和密码' })
      }
    } catch (error) {
      console.error('Login error:', error)
      setErrors({ submit: '登录失败，请检查网络连接' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-indigo-400/20 to-pink-400/20 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md relative">
        {/* 登录卡片 */}
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 p-8">
          {/* Logo 和标题 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mb-4 shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">QuickTalk 客服</h1>
            <p className="text-gray-600">登录到管理后台</p>
          </div>

          {/* 测试账号提示 */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-blue-900 mb-1">
                  🧪 测试账号 (支持离线登录)
                </h3>
                <div className="text-sm text-blue-700 space-y-1">
                  <div className="flex justify-between">
                    <span>管理员:</span>
                    <span className="font-mono bg-blue-100 px-2 py-0.5 rounded">admin</span>
                  </div>
                  <div className="flex justify-between">
                    <span>密码:</span>
                    <span className="font-mono bg-blue-100 px-2 py-0.5 rounded">admin123</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ username: 'admin', password: 'admin123' })}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium underline"
                >
                  🖱️ 点击填充测试账号
                </button>
                <p className="text-xs text-blue-600 mt-1">
                  ℹ️ 测试账号即使后端API不可用也能正常登录
                </p>
              </div>
            </div>
          </div>

          {/* 登录表单 */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 用户名输入 */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                用户名或邮箱
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={formData.username}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                    errors.username 
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                  placeholder="输入您的用户名或邮箱"
                />
              </div>
              {errors.username && (
                <p className="mt-1 text-sm text-red-600">{errors.username}</p>
              )}
            </div>

            {/* 密码输入 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                密码
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                    errors.password 
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                  placeholder="输入您的密码"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>

            {/* 记住我 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember"
                  name="remember"
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="remember" className="ml-2 block text-sm text-gray-900">
                  记住我
                </label>
              </div>
              <div className="text-sm">
                <a href="#" className="font-medium text-blue-600 hover:text-blue-500 transition-colors">
                  忘记密码？
                </a>
              </div>
            </div>

            {/* 提交错误 */}
            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-red-600">{errors.submit}</p>
                    <p className="text-xs text-red-500 mt-1">请检查浏览器控制台获取详细错误信息</p>
                  </div>
                </div>
              </div>
            )}

            {/* 登录按钮 */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                  登录中...
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4 mr-2" />
                  登录
                </>
              )}
            </button>
          </form>

          {/* 底部链接 */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              还没有账户？{' '}
              <a href="#" className="font-medium text-blue-600 hover:text-blue-500 transition-colors">
                联系管理员注册
              </a>
            </p>
          </div>
        </div>

        {/* 底部信息 */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            © 2025 QuickTalk. 安全可靠的客服系统
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage