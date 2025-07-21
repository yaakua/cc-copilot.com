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
    this.setupRoutes()
  }

  private setupRoutes() {
    // Initialize proxy agent based on current settings
    this.initializeProxyAgent()

    const proxyOptions: Options = {
      target: this.currentTarget,
      changeOrigin: true,
      
      // Use router to dynamically configure proxy for each request
      router: (req: http.IncomingMessage): string | Options => {
        const targetHost = req.headers.host || ''
        const proxyConfig = this.settingsManager.getProxyConfig()
        
        if (!proxyConfig?.enabled || !this.proxyAgent) {
          logger.debug(`Proxy disabled, direct routing for: ${targetHost}`, 'proxy')
          return this.currentTarget
        }

        logger.debug(`Using upstream proxy for: ${targetHost}`, 'proxy')
        return {
          target: this.currentTarget,
          agent: this.proxyAgent,
          changeOrigin: true
        } as Options
      },

      pathRewrite: {
        '^/': '/'
      },
      
      on: {
        proxyReq: (proxyReq, req, res) => {
          const proxyConfig = this.settingsManager.getProxyConfig()
          const usingProxy = proxyConfig?.enabled ? ' via proxy' : ''
          logger.debug(`Forwarding to: ${this.currentTarget}${req.url}${usingProxy}`, 'proxy')
        },
        proxyRes: (proxyRes, req, res) => {
          logger.debug(`Response from: ${this.currentTarget} - Status: ${proxyRes.statusCode}`, 'proxy')
        },
        error: (err, req, res) => {
          logger.error(`Proxy error: ${err.message}`, 'proxy', err as Error)
        }
      }
    }

    this.app.use('/', createProxyMiddleware(proxyOptions))
  }

  private initializeProxyAgent(): void {
    const proxyConfig = this.settingsManager.getProxyConfig()

    if (!proxyConfig?.enabled || !proxyConfig.host || !proxyConfig.port) {
      this.proxyAgent = null
      logger.info('未配置上游代理', 'proxy')
      return
    }

    try {
      // Construct proxy URL
      let proxyUrl = `http://`
      
      if (proxyConfig.auth?.username && proxyConfig.auth?.password) {
        proxyUrl += `${encodeURIComponent(proxyConfig.auth.username)}:${encodeURIComponent(proxyConfig.auth.password)}@`
      }
      
      proxyUrl += `${proxyConfig.host}:${proxyConfig.port}`

      // Create proxy agent
      this.proxyAgent = new HttpProxyAgent(proxyUrl)

      logger.info(`Upstream proxy agent initialized: ${proxyConfig.host}:${proxyConfig.port}`, 'proxy')
    } catch (error) {
      logger.error('初始化代理代理失败', 'proxy', error as Error)
      this.proxyAgent = null
    }
  }

  public updateProxySettings(): void {
    logger.info('更新代理设置', 'proxy')
    this.initializeProxyAgent()
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