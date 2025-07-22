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
  private lastProxyUrl: string | null = null

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

  private processRequestHeaders(proxyReq: http.ClientRequest) {
    // 1. 安全地获取所有请求头用于日志记录和处理
    // CORRECTED: 使用 proxyReq.headers 属性，它是一个对象。
    // 使用扩展运算符创建一个浅拷贝，这是一个好习惯，可以避免意外修改原始对象。
    const headers = { ...proxyReq.headers };
    logger.info(`[REQUEST HEADERS]\n${JSON.stringify(headers, null, 2)}`, 'proxy');
    
    // 2. 拦截并保存 Authorization
    if (this.currentProvider?.type === 'claude_official' && this.currentAccount) {
      const currentClaudeAccount = this.currentAccount as ClaudeAccount;
      logger.info(`正在为账号 ${currentClaudeAccount.emailAddress} 检查authorization头`, 'proxy');

      const authHeaderKey = Object.keys(headers).find(key => key.toLowerCase() === 'authorization');
      if (authHeaderKey && headers[authHeaderKey]) {
        const authorization = headers[authHeaderKey] as string;
        logger.info(`找到authorization头: ${authHeaderKey} = ${authorization.substring(0, 20)}...`, 'proxy');

        if (!currentClaudeAccount.authorization || currentClaudeAccount.authorization !== authorization) {
          logger.info(`检测到并准备保存Claude官方账号的authorization值: ${currentClaudeAccount.emailAddress}`, 'proxy');
          this.settingsManager.updateClaudeAccountAuthorization(currentClaudeAccount.emailAddress, authorization);
          currentClaudeAccount.authorization = authorization;
        } else {
          logger.info('Authorization值未发生变化，跳过保存', 'proxy');
        }
      } else {
        logger.info(`未在请求头中找到authorization`, 'proxy');
      }
    }

    // 3. 修改请求头
    if (!this.currentProvider || !this.currentAccount) {
      logger.warn('没有活动的服务提供方或账号，跳过请求头修改', 'proxy');
      return;
    }
    
    if (this.currentProvider.type === 'claude_official') {
      const claudeAccount = this.currentAccount as ClaudeAccount;
      if (claudeAccount.authorization) {
        proxyReq.setHeader('authorization', claudeAccount.authorization);
        logger.debug(`使用保存的authorization认证Claude账号: ${claudeAccount.emailAddress}`, 'proxy');
      } else {
        proxyReq.setHeader('x-claude-account-uuid', claudeAccount.accountUuid);
        proxyReq.setHeader('x-claude-organization-uuid', claudeAccount.organizationUuid);
        logger.warn(`Claude账号 ${claudeAccount.emailAddress} 缺少authorization值，使用UUID方式`, 'proxy');
      }
    } else {
      const thirdPartyAccount = this.currentAccount as ThirdPartyAccount;
      proxyReq.setHeader('authorization', `Bearer ${thirdPartyAccount.apiKey}`);
      logger.debug(`设置第三方账号API Key认证: ${thirdPartyAccount.name}`, 'proxy');
    }
  }


  private setupEventListeners() {
    this.settingsManager.on('proxy:config-updated', () => {
      logger.info('接收到代理配置更新事件，重新初始化代理', 'proxy')
      this.updateProxySettings()
    })
    this.settingsManager.on('settings:updated', (updatedSettings) => {
      if (updatedSettings.proxyConfig) {
        logger.info('接收到设置更新事件（包含代理配置），重新初始化代理', 'proxy')
        this.updateProxySettings()
      }
    })
    this.settingsManager.on('active-service-provider:changed', () => {
      logger.info('接收到服务提供方切换事件，更新账号信息', 'proxy')
      this.updateAccountInfo()
    })
    this.settingsManager.on('active-account:changed', () => {
      logger.info('接收到账号切换事件，更新账号信息', 'proxy')
      this.updateAccountInfo()
    })
    this.settingsManager.on('provider-proxy:changed', () => {
      logger.info('接收到提供方代理设置变更事件，重新初始化代理', 'proxy')
      this.updateProxySettings()
    })
  }

  private setupRoutes() {
    this.initializeProxyAgent()
    this.createProxyMiddleware()
    const proxyConfig = this.settingsManager.getProxyConfig()
    this.lastProxyUrl = this.shouldUseProxy() ? proxyConfig.url : null
  }

  private createProxyMiddleware() {
    const proxyConfig = this.settingsManager.getProxyConfig()

    const proxyOptions: Options = {
      changeOrigin: true,
      secure: true,
      followRedirects: false,
      xfwd: false,
      pathRewrite: {
        '^/': '/'
      },
      router: (req) => {
        if (this.currentProvider?.type === 'third_party' && this.currentAccount) {
          const thirdPartyAccount = this.currentAccount as ThirdPartyAccount
          this.currentTarget = thirdPartyAccount.baseUrl
        } else {
          this.currentTarget = 'https://api.anthropic.com'
        }
        logger.info(`[Router] 动态路由到: ${this.currentTarget} for ${req.method} ${req.url}`, 'proxy');
        return this.currentTarget;
      },
      agent: this.shouldUseProxy() && this.proxyAgent ? this.proxyAgent : undefined,
      on: {
        proxyReq: (proxyReq, req, res) => {
          const usingUpstreamProxy = this.shouldUseProxy() && this.proxyAgent
          const accountInfo = this.getAccountDisplayName()
          const providerName = this.currentProvider?.name || 'Unknown'

          logger.info(`[代理请求] ${req.method} ${req.url}`, 'proxy')
          logger.info(`  - 通过: ${usingUpstreamProxy ? proxyConfig.url : 'direct'}`, 'proxy')
          logger.info(`  - 服务提供方: ${providerName}`, 'proxy')
          logger.info(`  - 账号: ${accountInfo}`, 'proxy')
          logger.info(`  - 目标: ${this.currentTarget}`, 'proxy')
          
          this.processRequestHeaders(proxyReq);
        },
        proxyRes: (proxyRes, req, res) => {
          logger.info(`[代理响应] ${proxyRes.statusCode} ${req.method} ${req.url}`, 'proxy')
        },
        error: (err, req, res) => {
          logger.error(`[代理错误] ${req.method} ${req.url}`, 'proxy', err as Error)
          logger.error(`  - 错误消息: ${err.message}`, 'proxy')
          logger.error(`  - 错误代码: ${(err as any).code || 'unknown'}`, 'proxy')
          const errorCode = (err as any).code
          if (errorCode === 'ECONNREFUSED') {
            logger.error(`  - 提示: 目标服务器拒绝连接，可能是网络问题或目标服务不可用`, 'proxy')
          } else if (errorCode === 'ENOTFOUND') {
            logger.error(`  - 提示: DNS解析失败，检查网络连接和域名`, 'proxy')
          } else if (errorCode === 'ETIMEDOUT') {
            logger.error(`  - 提示: 连接超时，可能是网络延迟或上游代理问题`, 'proxy')
          }
        }
      }
    }

    this.app.use('/', createProxyMiddleware(proxyOptions))
  }

  // --- UNCHANGED CODE BELOW THIS LINE ---

  private updateAccountInfo() {
    this.initializeAccountInfo()
    logger.info('账号信息已更新，代理中间件将使用新的路由配置', 'proxy')
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
      if (proxyConfig.auth?.username && proxyConfig.auth?.password) {
        const url = new URL(proxyConfig.url)
        url.username = proxyConfig.auth.username
        url.password = proxyConfig.auth.password
        proxyUrl = url.toString()
      }
      const targetUrl = new URL(this.currentTarget)
      if (targetUrl.protocol === 'https:') {
        this.proxyAgent = new HttpsProxyAgent(proxyUrl)
        logger.info(`上游代理已初始化: ${proxyUrl}`, 'proxy')
      } else {
        this.proxyAgent = new HttpProxyAgent(proxyUrl)
        logger.info(`上游代理已初始化: ${proxyUrl}`, 'proxy')
      }
    } catch (error) {
      logger.error('初始化上游代理失败', 'proxy', error as Error)
      this.proxyAgent = null
    }
  }

  public updateProxySettings(): void {
    try {
      const proxyConfig = this.settingsManager.getProxyConfig()
      const currentProxyUrl = proxyConfig.url as string
      ;(this.app as any)._router = null
      this.initializeProxyAgent()
      this.createProxyMiddleware()
      this.lastProxyUrl = currentProxyUrl
      logger.info('代理设置更新成功（已重建中间件）' + (currentProxyUrl || '直连'), 'proxy')
    } catch (error) {
      logger.error('代理设置更新失败', 'proxy', error as Error)
      throw error
    }
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, '127.0.0.1', () => {
        const proxyConfig = this.settingsManager.getProxyConfig()
        const usingUpstreamProxy = this.shouldUseProxy()
        logger.info(`代理服务器已启动: http://127.0.0.1:${this.port}`, 'proxy')
        logger.info(`当前服务提供方: ${this.currentProvider?.name || 'None'}`, 'proxy')
        logger.info(`当前活动账号: ${this.getAccountDisplayName()}`, 'proxy')
        logger.info(`目标URL: ${this.currentTarget}`, 'proxy')
        logger.info(`上游代理: ${usingUpstreamProxy ? `启用 - ${proxyConfig.url}` : '禁用'}`, 'proxy')
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