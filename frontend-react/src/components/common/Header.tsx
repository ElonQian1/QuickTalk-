import React from 'react'
import { ArrowLeft } from 'lucide-react'

interface HeaderProps {
  title: string
  showBack?: boolean
  onBack?: () => void
  actions?: React.ReactNode
}

const Header: React.FC<HeaderProps> = ({ 
  title, 
  showBack = false, 
  onBack, 
  actions 
}) => {
  return (
    <header className="bg-primary-600 text-white px-4 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        {showBack && onBack && (
          <button
            onClick={onBack}
            className="p-1 hover:bg-primary-700 rounded-md transition-colors"
            aria-label="返回"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>
      
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  )
}

export default Header