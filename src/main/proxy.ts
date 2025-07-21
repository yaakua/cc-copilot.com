import express from 'express'
import { createProxyMiddleware, Options } from 'http-proxy-middleware'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { HttpProxyAgent } from 'http-proxy-agent'
import { SettingsManager, ClaudeAccount, ThirdPartyAccount, ServiceProvider } from './settings'
import { logger } from './logger'
import http from 'http'

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
          this.modifyRequestHeaders(proxyReq, req)
          
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

  private modifyRequestHeaders(proxyReq: http.ClientRequest, req: express.Request) {
    if (!this.currentProvider || !this.currentAccount) {
      logger.warn('没有活动的服务提供方或账号，跳过请求头修改', 'proxy')
      return
    }

    // 清除可能存在的认证头
    proxyReq.removeHeader('authorization')
    proxyReq.removeHeader('x-api-key')

    if (this.currentProvider.type === 'claude_official') {
      // Claude官方账号的认证逻辑
      // 这里需要根据Claude CLI的实际认证方式进行调整
      // 目前先添加账号UUID作为自定义头，后续根据实际分析结果调整
      const claudeAccount = this.currentAccount as ClaudeAccount
      proxyReq.setHeader('x-claude-account-uuid', claudeAccount.accountUuid)
      proxyReq.setHeader('x-claude-organization-uuid', claudeAccount.organizationUuid)
      
      logger.debug(`设置Claude官方账号认证头: ${claudeAccount.emailAddress}`, 'proxy')
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
      logger.info('更新代理设置', 'proxy')
      
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
}