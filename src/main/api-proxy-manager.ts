import { DataStore, ApiProvider, UserAuth, ChannelStatus } from './store'
import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

export interface ApiRequest {
  url: string
  method: string
  headers: Record<string, string>
  body?: any
}

export interface ApiResponse {
  status: number
  headers: Record<string, string>
  body: any
}

export interface ApiAdapter {
  name: string
  transformRequest(request: ApiRequest, provider: ApiProvider): ApiRequest
  transformResponse(response: ApiResponse, provider: ApiProvider): ApiResponse
  authenticate(provider: ApiProvider, userAuth?: UserAuth): Promise<boolean>
}

export class AnthropicAdapter implements ApiAdapter {
  name = 'anthropic'

  transformRequest(request: ApiRequest, provider: ApiProvider): ApiRequest {
    const headers = { ...request.headers }
    
    if (provider.apiKey) {
      headers['x-api-key'] = provider.apiKey
    }
    headers['anthropic-version'] = '2023-06-01'
    
    return {
      ...request,
      url: request.url.replace('https://api.anthropic.com', provider.baseUrl),
      headers
    }
  }

  transformResponse(response: ApiResponse, provider: ApiProvider): ApiResponse {
    return response
  }

  async authenticate(provider: ApiProvider, userAuth?: UserAuth): Promise<boolean> {
    if (userAuth?.accessToken) {
      return this.validateOfficialAuth(userAuth)
    }
    return !!provider.apiKey
  }

  private async validateOfficialAuth(userAuth: UserAuth): Promise<boolean> {
    if (userAuth.expiresAt) {
      const expiryTime = new Date(userAuth.expiresAt)
      const now = new Date()
      return now < expiryTime
    }
    return true
  }
}

export class OpenAiAdapter implements ApiAdapter {
  name = 'openai'

  transformRequest(request: ApiRequest, provider: ApiProvider): ApiRequest {
    const headers = { ...request.headers }
    
    if (provider.apiKey) {
      headers['Authorization'] = `Bearer ${provider.apiKey}`
    }
    
    return {
      ...request,
      url: request.url.replace('https://api.anthropic.com', provider.baseUrl),
      headers
    }
  }

  transformResponse(response: ApiResponse, provider: ApiProvider): ApiResponse {
    return response
  }

  async authenticate(provider: ApiProvider, userAuth?: UserAuth): Promise<boolean> {
    return !!provider.apiKey
  }
}

export class GroqAdapter implements ApiAdapter {
  name = 'groq'

  transformRequest(request: ApiRequest, provider: ApiProvider): ApiRequest {
    const headers = { ...request.headers }
    
    if (provider.apiKey) {
      headers['Authorization'] = `Bearer ${provider.apiKey}`
    }
    
    return {
      ...request,
      url: request.url.replace('https://api.anthropic.com', provider.baseUrl),
      headers
    }
  }

  transformResponse(response: ApiResponse, provider: ApiProvider): ApiResponse {
    return response
  }

  async authenticate(provider: ApiProvider, userAuth?: UserAuth): Promise<boolean> {
    return !!provider.apiKey
  }
}

export class ApiProxyManager {
  private dataStore: DataStore
  private adapters: Map<string, ApiAdapter>
  private proxyProcess?: ChildProcess

  constructor(dataStore: DataStore) {
    this.dataStore = dataStore
    this.adapters = new Map()
    this.initializeAdapters()
  }

  private initializeAdapters(): void {
    this.adapters.set('anthropic', new AnthropicAdapter())
    this.adapters.set('openai', new OpenAiAdapter())
    this.adapters.set('groq', new GroqAdapter())
  }

  async startProxy(port: number = 31299): Promise<void> {
    if (this.proxyProcess) {
      await this.stopProxy()
    }

    const proxyScript = this.createProxyScript(port)
    const scriptPath = path.join(os.tmpdir(), 'cc-copilot-proxy.js')
    
    fs.writeFileSync(scriptPath, proxyScript)

    this.proxyProcess = spawn('node', [scriptPath], {
      stdio: 'pipe',
      env: { ...process.env }
    })

    this.proxyProcess.on('error', (error) => {
      console.error('Proxy process error:', error)
    })

    this.proxyProcess.on('exit', (code) => {
      console.log(`Proxy process exited with code ${code}`)
    })

    await new Promise((resolve) => {
      setTimeout(resolve, 1000)
    })
  }

  async stopProxy(): Promise<void> {
    if (this.proxyProcess) {
      this.proxyProcess.kill()
      this.proxyProcess = undefined
    }
  }

  private createProxyScript(port: number): string {
    return `
const http = require('http');
const https = require('https');
const url = require('url');

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, anthropic-version');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const result = await handleRequest(req, body);
      res.writeHead(result.status, result.headers);
      res.end(result.body);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  });
});

async function handleRequest(req, body) {
  // Get current channel status from electron main process
  const channelStatus = await getCurrentChannelStatus();
  const provider = await getProviderById(channelStatus.currentProviderId);
  
  if (!provider) {
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'No active provider configured' })
    };
  }

  const adapter = getAdapter(provider.adapter);
  if (!adapter) {
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unknown adapter: ' + provider.adapter })
    };
  }

  const request = {
    url: req.url,
    method: req.method,
    headers: req.headers,
    body: body ? JSON.parse(body) : undefined
  };

  const transformedRequest = adapter.transformRequest(request, provider);
  const response = await makeHttpRequest(transformedRequest);
  const transformedResponse = adapter.transformResponse(response, provider);

  return transformedResponse;
}

async function makeHttpRequest(request) {
  return new Promise((resolve, reject) => {
    const parsedUrl = url.parse(request.url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.path,
      method: request.method,
      headers: request.headers
    };

    const httpModule = parsedUrl.protocol === 'https:' ? https : http;
    const req = httpModule.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    
    if (request.body) {
      req.write(JSON.stringify(request.body));
    }
    
    req.end();
  });
}

function getAdapter(adapterName) {
  const adapters = {
    anthropic: {
      transformRequest: (request, provider) => {
        const headers = { ...request.headers };
        if (provider.apiKey) {
          headers['x-api-key'] = provider.apiKey;
        }
        headers['anthropic-version'] = '2023-06-01';
        return {
          ...request,
          url: request.url.replace('https://api.anthropic.com', provider.baseUrl),
          headers
        };
      },
      transformResponse: (response, provider) => response
    },
    openai: {
      transformRequest: (request, provider) => {
        const headers = { ...request.headers };
        if (provider.apiKey) {
          headers['Authorization'] = \`Bearer \${provider.apiKey}\`;
        }
        return {
          ...request,
          url: request.url.replace('https://api.anthropic.com', provider.baseUrl),
          headers
        };
      },
      transformResponse: (response, provider) => response
    },
    groq: {
      transformRequest: (request, provider) => {
        const headers = { ...request.headers };
        if (provider.apiKey) {
          headers['Authorization'] = \`Bearer \${provider.apiKey}\`;
        }
        return {
          ...request,
          url: request.url.replace('https://api.anthropic.com', provider.baseUrl),
          headers
        };
      },
      transformResponse: (response, provider) => response
    }
  };
  
  return adapters[adapterName];
}

async function getCurrentChannelStatus() {
  // This would communicate with electron main process to get current status
  // For now, return a default
  return {
    currentProviderId: 'anthropic',
    currentProviderName: 'Anthropic Claude',
    isOfficial: true,
    connectionStatus: 'connected'
  };
}

async function getProviderById(id) {
  // This would communicate with electron main process to get provider config
  // For now, return a default anthropic provider
  return {
    id: 'anthropic',
    name: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com',
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    adapter: 'anthropic',
    isOfficial: true,
    authType: 'api_key'
  };
}

server.listen(${port}, '127.0.0.1', () => {
  console.log(\`API Proxy server running on http://127.0.0.1:${port}\`);
});
`;
  }

  async switchChannel(providerId: string): Promise<boolean> {
    const success = this.dataStore.switchChannel(providerId)
    if (success) {
      const provider = this.dataStore.getSettings().apiProviders.find(p => p.id === providerId)
      if (provider) {
        const adapter = this.adapters.get(provider.adapter)
        if (adapter) {
          const userAuth = provider.isOfficial ? this.dataStore.getActiveUserAuth() : undefined
          const authenticated = await adapter.authenticate(provider, userAuth)
          
          this.dataStore.updateChannelStatus({
            connectionStatus: authenticated ? 'connected' : 'error'
          })
          
          return authenticated
        }
      }
    }
    return false
  }

  getCurrentChannel(): ChannelStatus {
    return this.dataStore.getChannelStatus()
  }

  getAvailableProviders(): ApiProvider[] {
    return this.dataStore.getSettings().apiProviders
  }

  async testConnection(providerId: string): Promise<boolean> {
    const provider = this.dataStore.getSettings().apiProviders.find(p => p.id === providerId)
    if (!provider) return false

    const adapter = this.adapters.get(provider.adapter)
    if (!adapter) return false

    const userAuth = provider.isOfficial ? this.dataStore.getActiveUserAuth() : undefined
    return await adapter.authenticate(provider, userAuth)
  }

  setupClaudeOfficialAuth(): void {
    const claudeConfigPaths = this.getClaudeConfigPaths()
    
    for (const configPath of claudeConfigPaths) {
      console.log(`[Auth] Checking Claude config at: ${configPath}`)
      
      if (fs.existsSync(configPath)) {
        try {
          const configData = fs.readFileSync(configPath, 'utf8')
          const config = JSON.parse(configData)
          
          if (config.auth) {
            console.log(`[Auth] Found Claude official auth in: ${configPath}`)
            this.dataStore.saveClaudeOfficialAuth({
              username: config.auth.username,
              email: config.auth.email,
              accessToken: config.auth.accessToken,
              sessionCookie: config.auth.sessionCookie,
              expiresAt: config.auth.expiresAt
            })
            return // Use the first valid config found
          }
        } catch (error) {
          console.error(`[Auth] Failed to read Claude config from ${configPath}:`, error)
        }
      }
    }
    
    console.log('[Auth] No Claude official authentication found in any location')
  }

  private getClaudeConfigPaths(): string[] {
    const paths: string[] = []
    
    // 0. Environment variable override
    if (process.env.CLAUDE_CONFIG_PATH) {
      paths.push(process.env.CLAUDE_CONFIG_PATH)
    }
    
    // 1. Default user home directory (global installation)
    if (os.platform() === 'win32') {
      // Windows paths
      paths.push(path.join(os.homedir(), '.claude', 'settings.json'))
      paths.push(path.join(process.env.APPDATA || os.homedir(), '.claude', 'settings.json'))
      paths.push(path.join(process.env.LOCALAPPDATA || os.homedir(), '.claude', 'settings.json'))
      paths.push(path.join(process.env.USERPROFILE || os.homedir(), '.claude', 'settings.json'))
    } else {
      // macOS/Linux paths
      paths.push(path.join(os.homedir(), '.claude', 'settings.json'))
      paths.push(path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'claude', 'settings.json'))
    }
    
    // 2. Current application directory (local installation)
    const appDir = process.cwd()
    paths.push(path.join(appDir, '.claude', 'settings.json'))
    paths.push(path.join(appDir, 'claude', 'settings.json'))
    paths.push(path.join(appDir, 'config', 'claude', 'settings.json'))
    
    // 3. Parent directory (if claude-code is installed alongside)
    const parentDir = path.dirname(appDir)
    paths.push(path.join(parentDir, '.claude', 'settings.json'))
    paths.push(path.join(parentDir, 'claude', 'settings.json'))
    
    // 4. Node modules directory (if claude-code is installed as dependency)
    paths.push(path.join(appDir, 'node_modules', '@anthropic-ai', 'claude-code', '.claude', 'settings.json'))
    paths.push(path.join(appDir, 'node_modules', '.claude', 'settings.json'))
    
    // 5. Try to detect claude-code installation path
    const claudeCodePaths = this.detectClaudeCodeInstallation()
    claudeCodePaths.forEach(claudePath => {
      paths.push(path.join(claudePath, '.claude', 'settings.json'))
      paths.push(path.join(claudePath, 'config', 'settings.json'))
    })
    
    // 6. Common installation directories
    if (os.platform() === 'win32') {
      paths.push(path.join('C:', 'Program Files', 'Claude', '.claude', 'settings.json'))
      paths.push(path.join('C:', 'Program Files (x86)', 'Claude', '.claude', 'settings.json'))
      paths.push(path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Claude', '.claude', 'settings.json'))
      paths.push(path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Claude', '.claude', 'settings.json'))
    } else if (os.platform() === 'darwin') {
      paths.push(path.join('/Applications', 'Claude.app', 'Contents', 'Resources', '.claude', 'settings.json'))
      paths.push(path.join('/usr/local/lib', 'claude', '.claude', 'settings.json'))
      paths.push(path.join('/usr/local/bin', 'claude', '.claude', 'settings.json'))
    } else {
      paths.push(path.join('/usr/local/lib', 'claude', '.claude', 'settings.json'))
      paths.push(path.join('/opt/claude', '.claude', 'settings.json'))
      paths.push(path.join('/usr/local/bin', 'claude', '.claude', 'settings.json'))
    }
    
    // Remove duplicates and return
    return [...new Set(paths)]
  }

  private detectClaudeCodeInstallation(): string[] {
    const paths: string[] = []
    
    try {
      // Try to find claude-code executable in PATH
      const { execSync } = require('child_process')
      
      if (os.platform() === 'win32') {
        try {
          const result = execSync('where claude-code', { encoding: 'utf8', timeout: 5000 })
          const execPath = result.trim().split('\n')[0]
          if (execPath) {
            paths.push(path.dirname(execPath))
          }
        } catch (error) {
          // Ignore error, try other methods
        }
      } else {
        try {
          const result = execSync('which claude-code', { encoding: 'utf8', timeout: 5000 })
          const execPath = result.trim()
          if (execPath) {
            paths.push(path.dirname(execPath))
            // Also try parent directory
            paths.push(path.dirname(path.dirname(execPath)))
          }
        } catch (error) {
          // Ignore error, try other methods
        }
      }
    } catch (error) {
      // Ignore error
    }
    
    return paths
  }

  async initializeWithClaudeAuth(): Promise<void> {
    if (this.dataStore.getAutoLoginSetting()) {
      this.setupClaudeOfficialAuth()
      
      if (this.dataStore.isClaudeOfficialAuthValid()) {
        await this.switchChannel('anthropic')
      }
    }
  }

  getClaudeConfigSearchPaths(): string[] {
    return this.getClaudeConfigPaths()
  }

  getClaudeConfigStatus(): {
    searchedPaths: string[]
    foundPaths: string[]
    validConfigs: Array<{
      path: string
      hasAuth: boolean
      authType: string
      username?: string
      email?: string
    }>
  } {
    const searchedPaths = this.getClaudeConfigPaths()
    const foundPaths: string[] = []
    const validConfigs: Array<{
      path: string
      hasAuth: boolean
      authType: string
      username?: string
      email?: string
    }> = []

    for (const configPath of searchedPaths) {
      if (fs.existsSync(configPath)) {
        foundPaths.push(configPath)
        
        try {
          const configData = fs.readFileSync(configPath, 'utf8')
          const config = JSON.parse(configData)
          
          validConfigs.push({
            path: configPath,
            hasAuth: !!config.auth,
            authType: config.auth ? 'session' : 'none',
            username: config.auth?.username,
            email: config.auth?.email
          })
        } catch (error) {
          // Invalid JSON, skip
        }
      }
    }

    return {
      searchedPaths,
      foundPaths,
      validConfigs
    }
  }
}