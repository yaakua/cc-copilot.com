import Store from 'electron-store'
import { app } from 'electron'
import { EventEmitter } from 'events'

// Claude官方账号信息
export interface ClaudeAccount {
  accountUuid: string
  emailAddress: string
  organizationUuid: string
  organizationRole: string
  workspaceRole: string | null
  organizationName: string
}

// 第三方服务账号信息  
export interface ThirdPartyAccount {
  id: string
  name: string
  apiKey: string
  baseUrl: string
  description?: string
}

// 服务提供方类型
export type ProviderType = 'claude_official' | 'third_party'

// 服务提供方配置
export interface ServiceProvider {
  id: string
  type: ProviderType
  name: string
  accounts: ClaudeAccount[] | ThirdPartyAccount[]
  activeAccountId: string // 当前激活的账号ID
  useProxy: boolean // 是否使用代理，默认true使用全局代理配置
}

export interface AppSettings {
  proxyConfig: {
    enabled: boolean
    url: string
    auth?: {
      username: string
      password: string
    }
  }
  // 废弃的字段，保持兼容性
  apiProviders: Array<{
    id: string
    name: string
    baseUrl: string
    apiKey: string
  }>
  activeProviderId: string
  
  // 新的服务提供方架构
  serviceProviders: ServiceProvider[]
  activeServiceProviderId: string // 当前激活的服务提供方ID
  
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
  // 保持兼容性的废弃字段
  apiProviders: [],
  activeProviderId: '',
  // 新的服务提供方架构
  serviceProviders: [],
  activeServiceProviderId: '',
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

  // 新的服务提供方管理方法
  getServiceProviders(): ServiceProvider[] {
    return this.store.get('serviceProviders', [])
  }

  addServiceProvider(provider: ServiceProvider): void {
    const providers = this.getServiceProviders()
    const existingIndex = providers.findIndex(p => p.id === provider.id)
    
    if (existingIndex >= 0) {
      providers[existingIndex] = provider
    } else {
      providers.push(provider)
    }
    
    this.store.set('serviceProviders', providers)
    this.emit('service-providers:updated', providers)
  }

  removeServiceProvider(providerId: string): void {
    const providers = this.getServiceProviders().filter(p => p.id !== providerId)
    this.store.set('serviceProviders', providers)
    
    // 如果删除的是当前活动的提供方，清空活动ID
    if (this.store.get('activeServiceProviderId') === providerId) {
      this.store.set('activeServiceProviderId', '')
    }
    
    this.emit('service-providers:updated', providers)
  }

  getActiveServiceProvider(): ServiceProvider | undefined {
    const providerId = this.store.get('activeServiceProviderId')
    const providers = this.getServiceProviders()
    return providers.find(p => p.id === providerId)
  }

  setActiveServiceProvider(providerId: string): void {
    this.store.set('activeServiceProviderId', providerId)
    this.emit('active-service-provider:changed', providerId)
  }

  // Claude官方账号管理
  updateClaudeAccounts(accounts: ClaudeAccount[]): void {
    const providers = this.getServiceProviders()
    let claudeProvider = providers.find(p => p.type === 'claude_official')
    
    if (!claudeProvider) {
      claudeProvider = {
        id: 'claude_official',
        type: 'claude_official',
        name: 'Claude Official',
        accounts: [],
        activeAccountId: '',
        useProxy: true // 默认使用代理
      }
    }
    
    claudeProvider.accounts = accounts
    
    // 如果当前活动账号不存在了，清空或设置为第一个
    if (!accounts.find(acc => acc.emailAddress === claudeProvider.activeAccountId)) {
      claudeProvider.activeAccountId = accounts.length > 0 ? accounts[0].emailAddress : ''
    }
    
    this.addServiceProvider(claudeProvider)
  }

  // 第三方账号管理
  addThirdPartyAccount(providerId: string, account: ThirdPartyAccount): void {
    const providers = this.getServiceProviders()
    let provider = providers.find(p => p.id === providerId)
    
    if (!provider) {
      provider = {
        id: providerId,
        type: 'third_party',
        name: account.name,
        accounts: [],
        activeAccountId: '',
        useProxy: true // 默认使用代理
      }
    }
    
    const accounts = provider.accounts as ThirdPartyAccount[]
    const existingIndex = accounts.findIndex(acc => acc.id === account.id)
    
    if (existingIndex >= 0) {
      accounts[existingIndex] = account
    } else {
      accounts.push(account)
    }
    
    if (!provider.activeAccountId && accounts.length > 0) {
      provider.activeAccountId = accounts[0].id
    }
    
    this.addServiceProvider(provider)
  }

  removeThirdPartyAccount(providerId: string, accountId: string): void {
    const providers = this.getServiceProviders()
    const provider = providers.find(p => p.id === providerId)
    
    if (!provider) return
    
    const accounts = provider.accounts as ThirdPartyAccount[]
    provider.accounts = accounts.filter(acc => acc.id !== accountId)
    
    // 如果删除的是当前活动账号，设置为第一个或清空
    if (provider.activeAccountId === accountId) {
      provider.activeAccountId = provider.accounts.length > 0 ? (provider.accounts[0] as ThirdPartyAccount).id : ''
    }
    
    this.addServiceProvider(provider)
  }

  setActiveAccount(providerId: string, accountId: string): void {
    const providers = this.getServiceProviders()
    const provider = providers.find(p => p.id === providerId)
    
    if (provider) {
      provider.activeAccountId = accountId
      this.addServiceProvider(provider)
      this.emit('active-account:changed', { providerId, accountId })
    }
  }

  getCurrentActiveAccount(): { provider: ServiceProvider, account: ClaudeAccount | ThirdPartyAccount } | null {
    const activeProvider = this.getActiveServiceProvider()
    if (!activeProvider || !activeProvider.activeAccountId) {
      return null
    }

    const account = activeProvider.accounts.find(acc => {
      if (activeProvider.type === 'claude_official') {
        return (acc as ClaudeAccount).emailAddress === activeProvider.activeAccountId
      } else {
        return (acc as ThirdPartyAccount).id === activeProvider.activeAccountId
      }
    })

    if (!account) return null

    return { provider: activeProvider, account }
  }

  // 设置服务提供方的代理使用状态
  setProviderProxyUsage(providerId: string, useProxy: boolean): void {
    const providers = this.getServiceProviders()
    const provider = providers.find(p => p.id === providerId)
    
    if (provider) {
      provider.useProxy = useProxy
      this.addServiceProvider(provider)
      this.emit('provider-proxy:changed', { providerId, useProxy })
    }
  }

  // 获取当前活动服务提供方的代理使用状态
  shouldUseProxyForCurrentProvider(): boolean {
    const activeProvider = this.getActiveServiceProvider()
    if (!activeProvider) {
      return true // 默认使用代理
    }
    return activeProvider.useProxy
  }

  // 刷新Claude账号（重新读取.claude.json文件）
  async refreshClaudeAccounts(): Promise<ClaudeAccount[]> {
    const accounts = await this.readClaudeAccountsFromConfig()
    this.updateClaudeAccounts(accounts)
    return accounts
  }

  // 读取Claude配置文件
  private async readClaudeAccountsFromConfig(): Promise<ClaudeAccount[]> {
    const os = require('os')
    const fs = require('fs').promises
    const path = require('path')
    
    try {
      const claudeConfigPath = path.join(os.homedir(), '.claude.json')
      const configData = await fs.readFile(claudeConfigPath, 'utf-8')
      const config = JSON.parse(configData)
      
      if (config.oauthAccount) {
        return [config.oauthAccount as ClaudeAccount]
      }
      
      return []
    } catch (error) {
      console.warn('无法读取Claude配置文件:', error)
      return []
    }
  }
}