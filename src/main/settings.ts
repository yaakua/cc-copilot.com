import Store from 'electron-store'
import { app } from 'electron'
import { join } from 'path'

export interface AppSettings {
  proxyConfig: {
    enabled: boolean
    host: string
    port: number
    auth?: {
      username: string
      password: string
    }
  }
  apiProviders: Array<{
    id: string
    name: string
    baseUrl: string
    apiKey: string
  }>
  activeProviderId: string
  terminal: {
    fontSize: number
    fontFamily: string
    theme: 'dark' | 'light'
  }
}

const defaultSettings: AppSettings = {
  proxyConfig: {
    enabled: false,
    host: '127.0.0.1',
    port: 8080
  },
  apiProviders: [],
  activeProviderId: '',
  terminal: {
    fontSize: 14,
    fontFamily: 'Monaco, Consolas, monospace',
    theme: 'dark'
  }
}

export class SettingsManager {
  private store: Store<AppSettings>

  constructor() {
    this.store = new Store<AppSettings>({
      defaults: defaultSettings,
      cwd: app.getPath('userData'),
      name: 'settings'
    })
  }

  getSettings(): AppSettings {
    return this.store.store
  }

  updateSettings(settings: Partial<AppSettings>): void {
    this.store.set(settings as any)
  }

  getProxyConfig() {
    return this.store.get('proxyConfig')
  }

  updateProxyConfig(config: Partial<AppSettings['proxyConfig']>): void {
    const current = this.store.get('proxyConfig')
    this.store.set('proxyConfig', { ...current, ...config })
  }

  getActiveProvider() {
    const providerId = this.store.get('activeProviderId')
    const providers = this.store.get('apiProviders')
    return providers.find(p => p.id === providerId)
  }

  setActiveProvider(providerId: string): void {
    this.store.set('activeProviderId', providerId)
  }
}