import express from 'express'
import { createProxyMiddleware, Options } from 'http-proxy-middleware'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { HttpProxyAgent } from 'http-proxy-agent'
import { SettingsManager, ClaudeAccount, ThirdPartyAccount, ServiceProvider } from './settings'
import { logger } from './logger'
import http from 'http'
import { spawn } from 'child_process'
import * as os from 'os'
import * as fs from 'fs'

export class ProxyServer {
  private app: express.Application
  private server: any
  private port: number = 31299
  private currentTarget: string = 'https://api.anthropic.com'
  private settingsManager: SettingsManager
  private proxyAgent: HttpsProxyAgent<any> | HttpProxyAgent<any> | null = null
  private currentProvider: ServiceProvider | null = null
  private currentAccount: ClaudeAccount | ThirdPartyAccount | null = null

  constructor(settingsManager: SettingsManager) {
    this.app = express()
    this.settingsManager = settingsManager
    this.initializeAccountInfo()
    this.setupEventListeners()
    this.setupRoutes()
  }

  private initializeAccountInfo() {
    const activeResult = this.settingsManager.getCurrentActiveAccount()
    if (activeResult) {
      this.currentProvider = activeResult.provider
      this.currentAccount = activeResult.account
      
      // 设置目标URL
      if (this.currentProvider.type === 'third_party' && this.currentAccount) {
        this.currentTarget = (this.currentAccount as ThirdPartyAccount).baseUrl
      } else {
        this.currentTarget = 'https://api.anthropic.com'
      }
      
      logger.info(`初始化账号信息: ${this.currentProvider.name} - ${this.getAccountDisplayName()}`, 'proxy')
    }
  }

  private getAccountDisplayName(): string {
    if (!this.currentAccount) return 'None'
    
    if (this.currentProvider?.type === 'claude_official') {
      return (this.currentAccount as ClaudeAccount).emailAddress
    } else {
      return (this.currentAccount as ThirdPartyAccount).name
    }
  }

  private interceptAndSaveAuthorization(headers: Record<string, any>): void {
    // 只处理Claude官方服务的请求
    if (!this.currentProvider || this.currentProvider.type !== 'claude_official' || !this.currentAccount) {
      return
    }

    // 查找authorization头（可能是大小写变化的）
    const authHeader = Object.keys(headers).find(key => key.toLowerCase() === 'authorization')
    if (!authHeader || !headers[authHeader]) {
      return
    }

    const authorization = headers[authHeader] as string
    const currentClaudeAccount = this.currentAccount as ClaudeAccount

    // 如果当前账号还没有保存authorization，或者authorization发生了变化
    if (!currentClaudeAccount.authorization || currentClaudeAccount.authorization !== authorization) {
      logger.info(`检测到Claude官方账号的authorization值: ${currentClaudeAccount.emailAddress}`, 'proxy')
      
      // 保存authorization值到设置中
      this.settingsManager.updateClaudeAccountAuthorization(currentClaudeAccount.emailAddress, authorization)
      
      // 更新当前账号的authorization字段（内存中的副本）
      currentClaudeAccount.authorization = authorization
      
      logger.info(`已保存Claude账号 ${currentClaudeAccount.emailAddress} 的authorization值`, 'proxy')
    }
  }

  private setupEventListeners() {
    // Listen for proxy config updates
    this.settingsManager.on('proxy:config-updated', () => {
      logger.info('接收到代理配置更新事件，重新初始化代理', 'proxy')
      this.updateProxySettings()
    })

    // Listen for general settings updates that might affect proxy
    this.settingsManager.on('settings:updated', (updatedSettings) => {
      if (updatedSettings.proxyConfig) {
        logger.info('接收到设置更新事件（包含代理配置），重新初始化代理', 'proxy')
        this.updateProxySettings()
      }
    })

    // Listen for service provider changes
    this.settingsManager.on('active-service-provider:changed', () => {
      logger.info('接收到服务提供方切换事件，更新账号信息', 'proxy')
      this.updateAccountInfo()
    })

    // Listen for active account changes
    this.settingsManager.on('active-account:changed', () => {
      logger.info('接收到账号切换事件，更新账号信息', 'proxy')
      this.updateAccountInfo()
    })

    // Listen for provider proxy setting changes
    this.settingsManager.on('provider-proxy:changed', () => {
      logger.info('接收到提供方代理设置变更事件，重新初始化代理', 'proxy')
      this.updateProxySettings()
    })
  }

  private setupRoutes() {
    // Initialize proxy agent based on current settings
    this.initializeProxyAgent()
    this.createProxyMiddleware()
  }

  private createProxyMiddleware() {
    const proxyConfig = this.settingsManager.getProxyConfig()
    
    const proxyOptions: Options = {
      target: this.currentTarget,
      changeOrigin: true,
      secure: true,
      followRedirects: true,
      xfwd: false, // Don't add X-Forwarded-* headers
      pathRewrite: {
        '^/': '/'
      },
      
      // Add proxy agent if upstream proxy is enabled and provider allows it
      ...(this.shouldUseProxy() && this.proxyAgent ? { 
        agent: this.proxyAgent
      } : {}),
      
      on: {
        proxyReq: (proxyReq, req, res) => {
          this.modifyRequestHeaders(proxyReq)
          // 1. Get an array of all header names using the public API.
          const actualRequest = (proxyReq as any)._currentRequest;

          // Add a safety check in case it's not there on some calls.
          if (!actualRequest) {
            logger.warn('Could not find the underlying _currentRequest object to read headers.', 'proxy');
            return;
          }
          
          // Now, we can use the standard, documented Node.js API on the *actual* request.
          // This will work regardless of Node.js version (as long as it's reasonably modern).
          const headerNames = actualRequest.getRawHeaderNames();
          
          const headersObject = headerNames.reduce((acc: Record<string, any>, name: string) => {
            acc[name] = actualRequest.getHeader(name);
            return acc;
          }, {});

          const headersString = JSON.stringify(headersObject, null, 2);

          logger.info(`####[REQUEST HEADERS]####\n${headersString}`, 'proxy');
          
          // 拦截并保存Claude官方账号的authorization值
          this.interceptAndSaveAuthorization(headersObject);
          
          const usingUpstreamProxy = this.shouldUseProxy() && this.proxyAgent
          const accountInfo = this.getAccountDisplayName()
          const providerName = this.currentProvider?.name || 'Unknown'
         
          logger.debug(`[REQUEST] ${req.method} ${req.url} via ${usingUpstreamProxy ? proxyConfig.url : 'direct'} | Provider: ${providerName} | Account: ${accountInfo}`, 'proxy')
        },
        proxyRes: (proxyRes, req, res) => {
          logger.debug(`[RESPONSE] ${proxyRes.statusCode} ${req.method} ${req.url}`, 'proxy')
        },
        error: (err, req, res) => {
          logger.error(`Proxy error: ${req.method} ${req.url} - ${err.message}`, 'proxy', err as Error)
        }
      }
    }

    this.app.use('/', createProxyMiddleware(proxyOptions))
  }

  private modifyRequestHeaders(proxyReq: http.ClientRequest) {
    if (!this.currentProvider || !this.currentAccount) {
      logger.warn('没有活动的服务提供方或账号，跳过请求头修改', 'proxy')
      return
    }

    // 清除可能存在的认证头
    proxyReq.removeHeader('authorization')
    proxyReq.removeHeader('x-api-key')

    if (this.currentProvider.type === 'claude_official') {
      // Claude官方账号的认证逻辑
      const claudeAccount = this.currentAccount as ClaudeAccount
      
      if (claudeAccount.authorization) {
        // 如果有保存的authorization值，直接使用
        proxyReq.setHeader('authorization', claudeAccount.authorization)
        logger.debug(`使用保存的authorization认证Claude账号: ${claudeAccount.emailAddress}`, 'proxy')
      } else {
        // 如果没有authorization值，使用原来的方式作为备用
        // 注意：这通常不会起作用，主要是为了向后兼容
        proxyReq.setHeader('x-claude-account-uuid', claudeAccount.accountUuid)
        proxyReq.setHeader('x-claude-organization-uuid', claudeAccount.organizationUuid)
        logger.warn(`Claude账号 ${claudeAccount.emailAddress} 缺少authorization值，使用UUID方式`, 'proxy')
      }
    } else {
      // 第三方账号使用API Key认证
      const thirdPartyAccount = this.currentAccount as ThirdPartyAccount
      proxyReq.setHeader('authorization', `Bearer ${thirdPartyAccount.apiKey}`)
      
      logger.debug(`设置第三方账号API Key认证: ${thirdPartyAccount.name}`, 'proxy')
    }

    // 更新目标URL（如果需要）
    if (this.currentProvider.type === 'third_party') {
      const thirdPartyAccount = this.currentAccount as ThirdPartyAccount
      if (this.currentTarget !== thirdPartyAccount.baseUrl) {
        this.currentTarget = thirdPartyAccount.baseUrl
        logger.info(`切换目标URL到: ${this.currentTarget}`, 'proxy')
        // 注意：这里改变target需要重新创建代理中间件
      }
    }
  }

  private updateAccountInfo() {
    this.initializeAccountInfo()
    this.updateProxySettings()
  }

  private shouldUseProxy(): boolean {
    const proxyConfig = this.settingsManager.getProxyConfig()
    const providerUseProxy = this.settingsManager.shouldUseProxyForCurrentProvider()
    
    return proxyConfig?.enabled && providerUseProxy && !!proxyConfig.url
  }

  private initializeProxyAgent(): void {
    const proxyConfig = this.settingsManager.getProxyConfig()

    if (!this.shouldUseProxy()) {
      this.proxyAgent = null
      logger.info('代理已禁用或当前服务提供方不使用代理', 'proxy')
      return
    }

    try {
      let proxyUrl = proxyConfig.url
      
      // Add authentication if provided
      if (proxyConfig.auth?.username && proxyConfig.auth?.password) {
        const url = new URL(proxyConfig.url)
        url.username = proxyConfig.auth.username
        url.password = proxyConfig.auth.password
        proxyUrl = url.toString()
      }

      // For HTTPS targets, use HttpsProxyAgent but keep original proxy protocol
      // This allows HTTP proxies to handle HTTPS CONNECT requests properly
      const targetUrl = new URL(this.currentTarget)
      if (targetUrl.protocol === 'https:') {
        this.proxyAgent = new HttpsProxyAgent(proxyUrl)
        logger.info(`代理已初始化: ${proxyUrl}`, 'proxy')
      } else {
        this.proxyAgent = new HttpProxyAgent(proxyUrl)  
        logger.info(`代理已初始化: ${proxyUrl}`, 'proxy')
      }

    } catch (error) {
      logger.error('初始化代理失败', 'proxy', error as Error)
      this.proxyAgent = null
    }
  }

  public updateProxySettings(): void {
    try {
      // Clear existing middleware
      (this.app as any)._router = null
      
      // Reinitialize proxy agent and middleware
      this.initializeProxyAgent()
      this.createProxyMiddleware()
      
      logger.info('代理设置更新成功', 'proxy')
    } catch (error) {
      logger.error('代理设置更新失败', 'proxy', error as Error)
      throw error
    }
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, '127.0.0.1', () => {
        logger.info(`Server started on http://127.0.0.1:${this.port}`, 'proxy')
        resolve()
      })
      
      this.server.on('error', (err: any) => {
        logger.error('服务器错误', 'proxy', err)
        reject(err)
      })
    })
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      // Remove event listeners to prevent memory leaks
      this.settingsManager.removeAllListeners('proxy:config-updated')
      this.settingsManager.removeAllListeners('settings:updated')
      this.settingsManager.removeAllListeners('active-service-provider:changed')
      this.settingsManager.removeAllListeners('active-account:changed')
      this.settingsManager.removeAllListeners('provider-proxy:changed')
      
      if (this.server) {
        this.server.close(() => {
          logger.info('服务器已停止', 'proxy')
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  public setTarget(target: string) {
    this.currentTarget = target
    logger.info(`Target changed to: ${target}`, 'proxy')
  }

  public getPort(): number {
    return this.port
  }

  public getCurrentProvider(): ServiceProvider | null {
    return this.currentProvider
  }

  public getCurrentAccount(): ClaudeAccount | ThirdPartyAccount | null {
    return this.currentAccount
  }

  public getCurrentStatus(): {
    provider: string
    account: string
    target: string
    proxyEnabled: boolean
    proxyUrl: string
  } {
    const proxyConfig = this.settingsManager.getProxyConfig()
    
    return {
      provider: this.currentProvider?.name || 'None',
      account: this.getAccountDisplayName(),
      target: this.currentTarget,
      proxyEnabled: this.shouldUseProxy(),
      proxyUrl: this.shouldUseProxy() ? proxyConfig.url : 'Disabled'
    }
  }

  // 检测Claude官方账号的authorization值
  public async detectClaudeAuthorization(): Promise<{ success: boolean, error?: string }> {
    if (!this.currentProvider || this.currentProvider.type !== 'claude_official' || !this.currentAccount) {
      return { success: false, error: '当前未选择Claude官方账号' }
    }

    const currentClaudeAccount = this.currentAccount as ClaudeAccount
    
    try {
      logger.info(`开始检测Claude账号 ${currentClaudeAccount.emailAddress} 的authorization值`, 'proxy')
      
      // 创建临时目录
      const tempDir = fs.mkdtempSync(os.tmpdir() + '/claude-auth-detect-')
      
      return new Promise((resolve) => {
        const env = {
          ...process.env,
          ANTHROPIC_BASE_URL: `http://127.0.0.1:${this.port}`, // 通过我们的代理
        }

        // 执行claude命令来触发认证
        const childProcess = spawn('claude', ['-p', 'hello'], {
          cwd: tempDir,
          env,
          stdio: 'pipe'
        })

        let output = ''
        let hasCompleted = false

        const timeout = setTimeout(() => {
          if (!hasCompleted) {
            hasCompleted = true
            childProcess.kill()
            
            // 清理临时目录
            try {
              fs.rmSync(tempDir, { recursive: true, force: true })
            } catch (error) {
              logger.warn('清理临时目录失败', 'proxy', error as Error)
            }
            
            // 检查是否已经获取到authorization
            const updatedAccount = this.settingsManager.getServiceProviders()
              .find(p => p.type === 'claude_official')?.accounts
              .find((acc) => (acc as ClaudeAccount).emailAddress === currentClaudeAccount.emailAddress) as ClaudeAccount
            
            if (updatedAccount?.authorization) {
              resolve({ success: true })
            } else {
              resolve({ success: false, error: '检测超时，未能获取到authorization值' })
            }
          }
        }, 10000) // 10秒超时

        childProcess.stdout.on('data', (data) => {
          output += data.toString()
        })

        childProcess.stderr.on('data', (data) => {
          output += data.toString()
        })

        childProcess.on('close', (code) => {
          if (!hasCompleted) {
            hasCompleted = true
            clearTimeout(timeout)
            
            // 清理临时目录
            try {
              fs.rmSync(tempDir, { recursive: true, force: true })
            } catch (error) {
              logger.warn('清理临时目录失败', 'proxy', error as Error)
            }

            // 检查是否已经获取到authorization
            const updatedAccount = this.settingsManager.getServiceProviders()
              .find(p => p.type === 'claude_official')?.accounts
              .find((acc) => (acc as ClaudeAccount).emailAddress === currentClaudeAccount.emailAddress) as ClaudeAccount

            if (updatedAccount?.authorization) {
              logger.info(`成功检测到Claude账号 ${currentClaudeAccount.emailAddress} 的authorization值`, 'proxy')
              resolve({ success: true })
            } else {
              logger.warn(`检测完成但未获取到authorization值，命令退出码: ${code}`, 'proxy')
              resolve({ success: false, error: `检测失败，命令退出码: ${code}，输出: ${output}` })
            }
          }
        })

        childProcess.on('error', (error) => {
          if (!hasCompleted) {
            hasCompleted = true
            clearTimeout(timeout)
            
            // 清理临时目录
            try {
              fs.rmSync(tempDir, { recursive: true, force: true })
            } catch (cleanupError) {
              logger.warn('清理临时目录失败', 'proxy', cleanupError as Error)
            }

            logger.error('执行claude命令时出错', 'proxy', error)
            resolve({ success: false, error: `执行claude命令失败: ${error.message}` })
          }
        })
      })
    } catch (error) {
      logger.error('检测authorization过程中出错', 'proxy', error as Error)
      return { success: false, error: `检测过程中出错: ${(error as Error).message}` }
    }
  }
}