import Store from 'electron-store'
import { app } from 'electron'
import { EventEmitter } from 'events'

export interface AppSettings {
  proxyConfig: {
    enabled: boolean
    url: string
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
    url: 'http://127.0.0.1:1087'
  },
  apiProviders: [],
  activeProviderId: '',
  terminal: {
    fontSize: 14,
    fontFamily: 'Monaco, Consolas, monospace',
    theme: 'dark'
  }
}

export class SettingsManager extends EventEmitter {
  private store: Store<AppSettings>

  constructor() {
    super()
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
    this.emit('settings:updated', settings)
  }

  getProxyConfig() {
    return this.store.get('proxyConfig')
  }

  updateProxyConfig(config: Partial<AppSettings['proxyConfig']>): void {
    const current = this.store.get('proxyConfig')
    const updated = { ...current, ...config }
    this.store.set('proxyConfig', updated)
    this.emit('proxy:config-updated', updated)
  }

  getActiveProvider() {
    const providerId = this.store.get('activeProviderId')
    const providers = this.store.get('apiProviders')
    return providers.find(p => p.id === providerId)
  }

  setActiveProvider(providerId: string): void {
    this.store.set('activeProviderId', providerId)
    this.emit('provider:changed', providerId)
  }
}