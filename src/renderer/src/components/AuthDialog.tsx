import React from 'react'
import { useTranslation } from 'react-i18next'

interface AuthDialogProps {
  isOpen: boolean
  onClose: () => void
  error: string
  loginInstructions: string
  onOpenSettings?: () => void
}

const AuthDialog: React.FC<AuthDialogProps> = ({
  isOpen,
  onClose,
  error,
  loginInstructions,
  onOpenSettings
}) => {
  const { t } = useTranslation()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div 
        className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden"
        style={{ 
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--border-primary)',
          border: '1px solid'
        }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <h2 
            className="text-lg font-semibold flex items-center gap-2"
            style={{ color: 'var(--text-primary)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-amber-500">
              <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
            </svg>
            {t('auth.dialog.title', '认证失败')}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            style={{ color: 'var(--text-secondary)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto">
          {/* Error message */}
          <div 
            className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
          >
            <p 
              className="text-sm font-medium text-red-800 dark:text-red-200"
            >
              {error}
            </p>
          </div>

          {/* Instructions */}
          <div 
            className="mb-4"
          >
            <h3 
              className="text-sm font-semibold mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('auth.dialog.instructions', '解决方法：')}
            </h3>
            <div 
              className="text-sm whitespace-pre-line p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border"
              style={{ 
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border-primary)'
              }}
            >
              {loginInstructions}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div 
          className="flex justify-end gap-2 p-4 border-t"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          {onOpenSettings && (
            <button
              onClick={() => {
                onOpenSettings()
                onClose()
              }}
              className="px-4 py-2 text-sm font-medium rounded-lg border transition-colors"
              style={{ 
                color: 'var(--text-primary)',
                borderColor: 'var(--border-primary)',
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--hover-bg)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              {t('auth.dialog.openSettings', '打开设置')}
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            style={{ 
              color: '#ffffff',
              backgroundColor: '#3b82f6'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#2563eb'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#3b82f6'
            }}
          >
            {t('common.close', '关闭')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AuthDialog