import React, { Component, ErrorInfo, ReactNode } from 'react'
import { logger } from '../utils/logger'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.setComponent('ErrorBoundary')
    logger.error('Error caught by boundary', error, { errorInfo })
    this.setState({ error, errorInfo })
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="h-full flex items-center justify-center bg-gray-900 text-white p-8">
          <div className="text-center max-w-md">
            <div className="mb-6">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-16 w-16 mx-auto text-red-500 mb-4" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="1" 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" 
                />
              </svg>
              <h2 className="text-xl font-bold text-red-400 mb-2">Something went wrong</h2>
              <p className="text-gray-400 text-sm mb-4">
                An unexpected error occurred in this component.
              </p>
            </div>

            <details className="text-left mb-6 p-4 bg-gray-800 rounded-lg">
              <summary className="cursor-pointer text-sm font-medium text-gray-300 hover:text-white">
                Error Details
              </summary>
              <div className="mt-3 text-xs text-gray-400 font-mono">
                <div className="mb-2">
                  <strong>Error:</strong> {this.state.error?.message}
                </div>
                {this.state.error?.stack && (
                  <div>
                    <strong>Stack:</strong>
                    <pre className="mt-1 whitespace-pre-wrap text-xs">{this.state.error.stack}</pre>
                  </div>
                )}
              </div>
            </details>

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-md transition-colors"
              >
                Reload App
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary