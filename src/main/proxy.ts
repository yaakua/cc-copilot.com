import express from 'express'
import { createProxyMiddleware, Options } from 'http-proxy-middleware'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { HttpProxyAgent } from 'http-proxy-agent'
import { SettingsManager } from './settings'
import { logger } from './logger'
import http from 'http'

export class ProxyServer {
  private app: express.Application
  private server: any
  private port: number = 31299
  private currentTarget: string = 'https://api.anthropic.com'
  private settingsManager: SettingsManager
  private proxyAgent: HttpsProxyAgent<any> | HttpProxyAgent<any> | null = null

  constructor(settingsManager: SettingsManager) {
    this.app = express()
    this.settingsManager = settingsManager
    this.setupEventListeners()
    this.setupRoutes()
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
      
      // Add proxy agent if upstream proxy is enabled
      ...(proxyConfig?.enabled && this.proxyAgent ? { 
        agent: this.proxyAgent
      } : {}),
      
      on: {
        proxyReq: (proxyReq, req, res) => {
          const proxyConfig = this.settingsManager.getProxyConfig()
          const usingUpstreamProxy = proxyConfig?.enabled && this.proxyAgent
          
          logger.debug(`[REQUEST] ${req.method} ${req.url} via ${usingUpstreamProxy ? proxyConfig.url : 'direct'}`, 'proxy')
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

  private initializeProxyAgent(): void {
    const proxyConfig = this.settingsManager.getProxyConfig()

    if (!proxyConfig?.enabled || !proxyConfig.url) {
      this.proxyAgent = null
      logger.info('未配置上游代理', 'proxy')
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
    logger.info('更新代理设置', 'proxy')
    
    // Clear existing middleware
    this.app._router = null
    
    // Reinitialize proxy agent and middleware
    this.initializeProxyAgent()
    this.createProxyMiddleware()
    
    logger.info('代理设置更新成功', 'proxy')
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
}