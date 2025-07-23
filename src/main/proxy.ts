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

  private getProxyHeaders(): Record<string, string> | undefined {
    if (!this.currentProvider || !this.currentAccount) {
      logger.info('未选择账号信息，无法获取代理头部', 'proxy')
      return undefined
    }
    
    if (this.currentProvider.type === 'claude_official') {
      const claudeAccount = this.currentAccount as ClaudeAccount;
      if (claudeAccount.authorization) {
        logger.info(`当前选择的claude 账号 ${claudeAccount.emailAddress} authorization值:${claudeAccount.authorization.slice(-20)}...`)
        return {
          'authorization': claudeAccount.authorization
        }
      } 
      logger.info('当前选择的claude 账号无法获取到authorization', 'proxy')
    } else {
      const thirdPartyAccount = this.currentAccount as ThirdPartyAccount;
      return {
        'authorization': `Bearer ${thirdPartyAccount.apiKey}`
      }
    }
  }

  private detectAndSaveAuthorization(req: http.IncomingMessage) {
    // 仅检测并保存Claude官方账号的authorization
    if (this.currentProvider?.type !== 'claude_official' || !this.currentAccount || 
      (this.currentProvider.type === 'claude_official' && (this.currentAccount as ClaudeAccount).authorization)
    ) {

      return;
    }

    const currentClaudeAccount = this.currentAccount as ClaudeAccount;
    logger.info(`正在为账号 ${currentClaudeAccount.emailAddress} 检查authorization头`, 'proxy');

    const headers = { ...req.headers };
    const authHeaderKey = Object.keys(headers).find(key => key.toLowerCase() === 'authorization');
    
    if (authHeaderKey && headers[authHeaderKey]) {
      const authorization = headers[authHeaderKey] as string;
      logger.info(`找到authorization头: ${authHeaderKey} = ${authorization.substring(0, 20)}...`, 'proxy');

      // 检查当前账号的authorization是否需要更新
      if (!currentClaudeAccount.authorization || currentClaudeAccount.authorization !== authorization) {
        
        // 检查这个authorization是否已被其他Claude账号使用
        const existingAccount = this.settingsManager.findClaudeAccountByAuthorization(authorization);
        if (existingAccount && existingAccount.emailAddress !== currentClaudeAccount.emailAddress) {
          logger.warn(`Authorization值已被其他账号 ${existingAccount.emailAddress} 使用，无法分配给当前账号 ${currentClaudeAccount.emailAddress}`, 'proxy');
          logger.warn('建议检查账号配置或切换到正确的账号', 'proxy');
          return;
        }

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




  private setupRoutes() {
    this.initializeProxyAgent()
    this.createProxyMiddleware()
  }

  private createProxyMiddleware() {
    const proxyConfig = this.settingsManager.getProxyConfig()
    const currentHeaders = this.getProxyHeaders()
    logger.info(`创建代理中间件时的headers: ${JSON.stringify(currentHeaders)}`, 'proxy')

    const proxyOptions: Options = {
      changeOrigin: true,
      secure: true,
      followRedirects: false,
      xfwd: false,
      // 禁用 keep-alive 来避免 headers 已发送的问题
      headers: {
        'Connection': 'close'
      },
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
        return this.currentTarget+req.url;
      },
      agent: this.shouldUseProxy() && this.proxyAgent ? this.proxyAgent : undefined,
      on: {
        proxyReqWs:(proxyReqWs:http.ClientRequest, req:http.IncomingMessage)=>{
          logger.info("###开启了ws访问#####")
            const headers = { ...req.headers };
          logger.info(`  - Claude CLI WS 请求authorization: ${headers["authorization"]}`, 'proxy')
          
        },
        proxyReq: (proxyReq:http.ClientRequest, req:http.IncomingMessage) => {
          const usingUpstreamProxy = this.shouldUseProxy() && this.proxyAgent
          const accountInfo = this.getAccountDisplayName()
          const providerName = this.currentProvider?.name || 'Unknown'

          logger.info(`[代理请求] ${req.method} ${req.url}`, 'proxy')
          logger.info(`  - 通过: ${usingUpstreamProxy ? proxyConfig.url : 'direct'}`, 'proxy')
          logger.info(`  - 服务提供方: ${providerName}`, 'proxy')
          logger.info(`  - 账号: ${accountInfo}`, 'proxy')
          logger.info(`  - 目标: ${this.currentTarget}`, 'proxy')
          
          const headers = { ...req.headers };
          logger.info(`  - Claude CLI原始请求authorization: ${headers["authorization"]}`, 'proxy')
          
          // 检测并保存Claude CLI请求中的authorization（如果当前账号没有的话）
          this.detectAndSaveAuthorization(req);
          
          // 动态设置authorization header
          const dynamicHeaders = this.getProxyHeaders()
          if (dynamicHeaders?.authorization) {
            try {
              // 检查是否可以设置headers（headers还没有发送）
              if (!proxyReq.headersSent) {
                proxyReq.setHeader('authorization', dynamicHeaders.authorization)
                logger.info(`  - 成功设置当前活动账号authorization: ${dynamicHeaders.authorization.slice(0, 20)}...`, 'proxy')
              } else {
                logger.warn(`  - 警告: Headers已发送，无法修改authorization`, 'proxy')
              }
            } catch (error) {
              logger.error(`  - 设置authorization header失败: ${(error as Error).message}`, 'proxy')
            }
          } else {
            logger.warn(`  - 警告: 无法获取当前活动账号的authorization header`, 'proxy')
          }
        },
        proxyRes: (proxyRes, req, _res) => {
          logger.info(`[代理响应] ${proxyRes.statusCode} ${req.method} ${req.url}`, 'proxy')
        },
        error: (err, req, _res) => {
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