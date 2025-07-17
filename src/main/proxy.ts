import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'

export class ProxyServer {
  private app: express.Application
  private server: any
  private port: number = 31299
  private currentTarget: string = 'https://api.anthropic.com'

  constructor() {
    this.app = express()
    this.setupRoutes()
  }

  private setupRoutes() {
    // Basic logging middleware
    this.app.use((req, res, next) => {
      console.log(`[Proxy] ${req.method} ${req.url}`)
      next()
    })

    // Proxy all requests to the current target
    this.app.use('/', createProxyMiddleware({
      target: this.currentTarget,
      changeOrigin: true,
      pathRewrite: {
        '^/': '/'
      },
      onProxyReq: (proxyReq, req, res) => {
        console.log(`[Proxy] Forwarding to: ${this.currentTarget}${req.url}`)
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log(`[Proxy] Response from: ${this.currentTarget} - Status: ${proxyRes.statusCode}`)
      },
      onError: (err, req, res) => {
        console.error(`[Proxy] Error:`, err.message)
      }
    }))
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, '127.0.0.1', () => {
        console.log(`[Proxy] Server started on http://127.0.0.1:${this.port}`)
        resolve()
      })
      
      this.server.on('error', (err: any) => {
        console.error('[Proxy] Server error:', err)
        reject(err)
      })
    })
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('[Proxy] Server stopped')
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  public setTarget(target: string) {
    this.currentTarget = target
    console.log(`[Proxy] Target changed to: ${target}`)
  }

  public getPort(): number {
    return this.port
  }
}