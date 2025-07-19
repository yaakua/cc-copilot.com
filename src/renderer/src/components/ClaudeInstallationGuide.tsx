import React, { useState } from 'react'

interface ClaudeInstallationGuideProps {
  onClose: () => void
  onRecheck: () => void
}

export const ClaudeInstallationGuide: React.FC<ClaudeInstallationGuideProps> = ({ onClose, onRecheck }) => {
  const [selectedMethod, setSelectedMethod] = useState<'npm' | 'binary'>('npm')
  const [isRechecking, setIsRechecking] = useState(false)

  const handleRecheck = async () => {
    setIsRechecking(true)
    await onRecheck()
    setIsRechecking(false)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Claude CLI Installation Required</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="mb-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center mr-3">
                  <span className="text-white font-bold">!</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-yellow-800">Claude CLI Not Detected</h3>
                  <p className="text-yellow-700">
                    CC Copilot requires Claude CLI to be installed and configured on your system. Please install it manually using one of the methods below.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex border-b">
              <button
                onClick={() => setSelectedMethod('npm')}
                className={`px-4 py-2 border-b-2 font-medium ${
                  selectedMethod === 'npm'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                NPM Installation (Recommended)
              </button>
              <button
                onClick={() => setSelectedMethod('binary')}
                className={`px-4 py-2 border-b-2 font-medium ${
                  selectedMethod === 'binary'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Binary Installation
              </button>
            </div>
          </div>

          {selectedMethod === 'npm' && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3">Method 1: NPM Installation</h3>
                <p className="text-gray-600 mb-4">
                  This is the easiest and most common way to install Claude CLI. Make sure you have Node.js installed first.
                </p>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Step 1: Install Node.js (if not already installed)</h4>
                    <p className="text-sm text-gray-600 mb-2">
                      Visit <a href="https://nodejs.org/" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">nodejs.org</a> and download the LTS version.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Step 2: Install Claude CLI globally</h4>
                    <div className="bg-gray-800 text-white p-3 rounded font-mono text-sm">
                      npm install -g @anthropic-ai/claude-code
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      This will install Claude CLI globally on your system and make the <code>claude</code> command available.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Alternative: Use without global installation</h4>
                    <div className="bg-gray-800 text-white p-3 rounded font-mono text-sm">
                      npx @anthropic-ai/claude-code
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      This will download and run Claude CLI without installing it globally.
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-800 mb-2">💡 Pro Tip</h4>
                    <p className="text-sm text-blue-700">
                      If you're using npx, CC Copilot will automatically detect it and use it to run Claude CLI.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedMethod === 'binary' && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3">Method 2: Binary Installation</h3>
                <p className="text-gray-600 mb-4">
                  Download and install Claude CLI as a standalone binary application.
                </p>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">macOS</h4>
                    <div className="bg-gray-800 text-white p-3 rounded font-mono text-sm mb-2">
                      brew install claude-code
                    </div>
                    <p className="text-sm text-gray-600">
                      Or download from the official Anthropic website.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Windows</h4>
                    <div className="bg-gray-800 text-white p-3 rounded font-mono text-sm mb-2">
                      winget install Anthropic.ClaudeCode
                    </div>
                    <p className="text-sm text-gray-600">
                      Or download the installer from the official Anthropic website.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Linux</h4>
                    <div className="bg-gray-800 text-white p-3 rounded font-mono text-sm mb-2">
                      curl -sSL https://install.anthropic.com/claude-code | bash
                    </div>
                    <p className="text-sm text-gray-600">
                      Or download the appropriate package for your distribution.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-4 mt-6">
            <h3 className="text-lg font-semibold mb-3">Verification</h3>
            <p className="text-gray-600 mb-3">
              After installation, you can verify that Claude CLI is working by running:
            </p>
            <div className="bg-gray-800 text-white p-3 rounded font-mono text-sm">
              claude --version
            </div>
            <p className="text-sm text-gray-600 mt-2">
              or if using npx:
            </p>
            <div className="bg-gray-800 text-white p-3 rounded font-mono text-sm">
              npx @anthropic-ai/claude-code --version
            </div>
            <p className="text-sm text-gray-600 mt-2">
              After successful installation, CC Copilot will automatically detect the <code>.claude</code> directory in your home folder.
            </p>
          </div>

          <div className="mt-8 flex justify-between items-center">
            <div className="text-sm text-gray-500">
              <p>
                Need help? Visit the{' '}
                <a 
                  href="https://docs.anthropic.com/claude/docs/claude-code" 
                  className="text-blue-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  official documentation
                </a>
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRecheck}
                disabled={isRechecking}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isRechecking ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Checking...
                  </>
                ) : (
                  'Recheck Installation'
                )}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}