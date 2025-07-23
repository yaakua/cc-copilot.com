const fs = require("fs");
const path = require("path");
const os = require("os");

/**
 * Claude CLI请求拦截器
 * 复用现有的配置管理逻辑，通过electron-store读取配置
 */
class ClaudeInterceptor {
    constructor() {
        this.isAnthropicAPI = this.isAnthropicAPI.bind(this);
        this.getActiveAccountInfo = this.getActiveAccountInfo.bind(this);
        this.updateAuthorizationInConfig = this.updateAuthorizationInConfig.bind(this);
        this.setupUpstreamProxy = this.setupUpstreamProxy.bind(this);
        this.onConfigChanged = this.onConfigChanged.bind(this);
        
        // 初始化配置缓存
        this.accountInfo = null;
        this.proxyConfig = null;
        this.settingsWatcher = null;
        this.lastConfigHash = null;
        
        // 加载配置
        this.refreshConfig();
        
        // 设置配置文件监听
        this.setupConfigWatcher();
    }

    isAnthropicAPI(url) {
        const urlString = typeof url === "string" ? url : url.toString();
        
        // 从环境变量读取自定义API端点，默认为api.anthropic.com
        const apiEndpoint = process.env.CLAUDE_TRACE_API_ENDPOINT || "api.anthropic.com";
        const messagesPath = process.env.CLAUDE_TRACE_MESSAGES_PATH || "/v1/messages";
        
        return urlString.includes(apiEndpoint) && urlString.includes(messagesPath);
    }

    getActiveAccountInfo() {
        try {
            // 尝试从环境变量获取（优先级最高，用于测试等场景）
            const configEnv = process.env.CC_COPILOT_ACCOUNT_CONFIG;
            if (configEnv) {
                return JSON.parse(configEnv);
            }
            
            // 从electron-store配置文件读取（复用现有逻辑）
            const settingsData = this.loadSettingsFromStore();
            if (settingsData) {
                const activeResult = this.getCurrentActiveAccountFromSettings(settingsData);
                if (activeResult) {
                    const { provider, account } = activeResult;
                    
                    if (provider.type === 'claude_official') {
                        return {
                            type: 'claude_official',
                            emailAddress: account.emailAddress,
                            authorization: account.authorization
                        };
                    } else {
                        return {
                            type: 'third_party',
                            name: account.name,
                            apiKey: account.apiKey,
                            baseUrl: account.baseUrl
                        };
                    }
                }
            }
            
            // 备用：从临时文件获取（向后兼容）
            const configPath = path.join(os.tmpdir(), 'cc-copilot-account.json');
            if (fs.existsSync(configPath)) {
                const data = fs.readFileSync(configPath, 'utf-8');
                return JSON.parse(data);
            }
            
            return null;
        } catch (error) {
            console.warn('无法获取账号配置:', error.message);
            return null;
        }
    }

    getProxyConfig() {
        try {
            const configEnv = process.env.CC_COPILOT_PROXY_CONFIG;
            if (configEnv) {
                return JSON.parse(configEnv);
            }
            
            // 从electron-store配置文件读取（复用现有逻辑）
            const settingsData = this.loadSettingsFromStore();
            if (settingsData) {
                const proxyConfig = settingsData.proxyConfig || { enabled: false };
                const shouldUseProxy = this.shouldUseProxyForCurrentProvider(settingsData);
                
                return {
                    enabled: proxyConfig.enabled && shouldUseProxy,
                    url: proxyConfig.url,
                    auth: proxyConfig.auth
                };
            }
            
            // 备用：从临时文件获取（向后兼容）
            const configPath = path.join(os.tmpdir(), 'cc-copilot-proxy.json');
            if (fs.existsSync(configPath)) {
                const data = fs.readFileSync(configPath, 'utf-8');
                return JSON.parse(data);
            }
            
            return { enabled: false };
        } catch (error) {
            console.warn('无法获取代理配置:', error.message);
            return { enabled: false };
        }
    }

    setupUpstreamProxy() {
        if (!this.proxyConfig.enabled || !this.proxyConfig.url) {
            return;
        }

        try {
            // 设置代理环境变量
            let proxyUrl = this.proxyConfig.url;
            if (this.proxyConfig.auth && this.proxyConfig.auth.username && this.proxyConfig.auth.password) {
                const url = new URL(this.proxyConfig.url);
                url.username = this.proxyConfig.auth.username;
                url.password = this.proxyConfig.auth.password;
                proxyUrl = url.toString();
            }
            
            process.env.HTTP_PROXY = proxyUrl;
            process.env.HTTPS_PROXY = proxyUrl;
            process.env.http_proxy = proxyUrl;
            process.env.https_proxy = proxyUrl;
            
            console.log('[Claude Interceptor] 上游代理已设置:', proxyUrl.replace(/\/\/.*@/, '//***@'));
        } catch (error) {
            console.error('[Claude Interceptor] 设置上游代理失败:', error.message);
        }
    }

    updateAuthorizationInConfig(authorization) {
        try {
            // 直接更新electron-store配置文件（复用现有逻辑）
            const settingsData = this.loadSettingsFromStore();
            if (settingsData && this.accountInfo?.emailAddress) {
                this.updateClaudeAccountAuthorizationInSettings(settingsData, this.accountInfo.emailAddress, authorization);
                this.saveSettingsToStore(settingsData);
                console.log('[Claude Interceptor] Authorization值已直接保存到配置文件');
            } else {
                // 备用：通知主进程保存authorization（向后兼容）
                const notificationPath = path.join(os.tmpdir(), 'cc-copilot-auth-update.json');
                const data = {
                    emailAddress: this.accountInfo?.emailAddress,
                    authorization,
                    timestamp: Date.now()
                };
                fs.writeFileSync(notificationPath, JSON.stringify(data));
                console.log('[Claude Interceptor] Authorization值已通知保存（备用机制）');
            }
        } catch (error) {
            console.error('[Claude Interceptor] 保存authorization失败:', error.message);
        }
    }

    getAuthorizationHeader() {
        // 每次获取header时检查配置是否需要更新
        this.checkAndRefreshConfig();
        
        if (!this.accountInfo) {
            return null;
        }

        if (this.accountInfo.type === 'claude_official') {
            return this.accountInfo.authorization;
        } else if (this.accountInfo.type === 'third_party') {
            return `Bearer ${this.accountInfo.apiKey}`;
        }
        
        return null;
    }

    instrumentFetch() {
        if (!global.fetch) {
            return;
        }

        // 检查是否已经被拦截
        if (global.fetch.__claudeIntercepted) {
            return;
        }

        const originalFetch = global.fetch;
        const interceptor = this;

        global.fetch = async function (input, init = {}) {
            const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

            // 只拦截Anthropic API调用
            if (!interceptor.isAnthropicAPI(url)) {
                return originalFetch(input, init);
            }

            console.log('[Claude Interceptor] 拦截到Claude API请求:', url);

            // 检测并保存原始authorization
            if (init.headers) {
                const headers = new Headers(init.headers);
                const authHeader = headers.get('authorization');
                if (authHeader && interceptor.accountInfo?.type === 'claude_official' && 
                    (!interceptor.accountInfo.authorization || interceptor.accountInfo.authorization !== authHeader)) {
                    console.log('[Claude Interceptor] 检测到新的authorization值，准备保存');
                    interceptor.updateAuthorizationInConfig(authHeader);
                }
            }

            // 动态修改authorization header
            const dynamicAuth = interceptor.getAuthorizationHeader();
            if (dynamicAuth) {
                if (!init.headers) {
                    init.headers = {};
                }
                
                if (init.headers instanceof Headers) {
                    init.headers.set('authorization', dynamicAuth);
                } else if (typeof init.headers === 'object') {
                    init.headers.authorization = dynamicAuth;
                }
                
                console.log('[Claude Interceptor] 已设置动态authorization:', dynamicAuth.substring(0, 20) + '...');
            }

            return originalFetch(input, init);
        };

        global.fetch.__claudeIntercepted = true;
        console.log('[Claude Interceptor] Fetch已被拦截');
    }

    instrumentNodeHTTP() {
        try {
            const http = require("http");
            const https = require("https");
            const interceptor = this;

            // 拦截http.request
            if (http.request && !http.request.__claudeIntercepted) {
                const originalHttpRequest = http.request;
                http.request = function (options, callback) {
                    return interceptor.interceptNodeRequest(originalHttpRequest, options, callback, false);
                };
                http.request.__claudeIntercepted = true;
            }

            // 拦截https.request
            if (https.request && !https.request.__claudeIntercepted) {
                const originalHttpsRequest = https.request;
                https.request = function (options, callback) {
                    return interceptor.interceptNodeRequest(originalHttpsRequest, options, callback, true);
                };
                https.request.__claudeIntercepted = true;
            }

            console.log('[Claude Interceptor] Node HTTP已被拦截');
        } catch (error) {
            console.error('[Claude Interceptor] 拦截Node HTTP失败:', error.message);
        }
    }

    interceptNodeRequest(originalRequest, options, callback, isHttps) {
        const url = this.parseNodeRequestURL(options, isHttps);

        if (!this.isAnthropicAPI(url)) {
            return originalRequest.call(this, options, callback);
        }

        console.log('[Claude Interceptor] 拦截到Node HTTP Claude API请求:', url);

        // 检测并保存原始authorization
        if (options.headers && options.headers.authorization) {
            const authHeader = options.headers.authorization;
            if (this.accountInfo?.type === 'claude_official' && 
                (!this.accountInfo.authorization || this.accountInfo.authorization !== authHeader)) {
                console.log('[Claude Interceptor] 检测到新的authorization值，准备保存');
                this.updateAuthorizationInConfig(authHeader);
            }
        }

        // 动态修改authorization header
        const dynamicAuth = this.getAuthorizationHeader();
        if (dynamicAuth) {
            if (!options.headers) {
                options.headers = {};
            }
            options.headers.authorization = dynamicAuth;
            console.log('[Claude Interceptor] 已设置动态authorization:', dynamicAuth.substring(0, 20) + '...');
        }

        return originalRequest.call(this, options, callback);
    }

    parseNodeRequestURL(options, isHttps) {
        if (typeof options === "string") {
            return options;
        }

        const protocol = isHttps ? "https:" : "http:";
        const hostname = options.hostname || options.host || "localhost";
        const port = options.port ? `:${options.port}` : "";
        const path = options.path || "/";

        return `${protocol}//${hostname}${port}${path}`;
    }

    initialize() {
        console.log('[Claude Interceptor] 初始化拦截器...');
        
        if (this.accountInfo) {
            console.log('[Claude Interceptor] 当前账号:', 
                this.accountInfo.type === 'claude_official' 
                    ? this.accountInfo.emailAddress 
                    : this.accountInfo.name
            );
        } else {
            console.warn('[Claude Interceptor] 警告: 未找到账号配置');
        }

        this.instrumentFetch();
        this.instrumentNodeHTTP();
        
        console.log('[Claude Interceptor] 拦截器初始化完成');
        console.log('[Claude Interceptor] 配置文件监听已启用，支持热更新');
    }

    /**
     * 刷新配置
     */
    refreshConfig() {
        try {
            // 重新读取配置
            this.accountInfo = this.getActiveAccountInfo();
            this.proxyConfig = this.getProxyConfig();
            
            // 更新上游代理设置
            this.setupUpstreamProxy();
            
            // 计算配置哈希值用于变更检测
            const configData = JSON.stringify({ 
                account: this.accountInfo, 
                proxy: this.proxyConfig 
            });
            this.lastConfigHash = this.simpleHash(configData);
            
            console.log('[Claude Interceptor] 配置已刷新');
        } catch (error) {
            console.error('[Claude Interceptor] 刷新配置失败:', error.message);
        }
    }

    /**
     * 检查并刷新配置（轻量级检查）
     */
    checkAndRefreshConfig() {
        try {
            // 读取当前配置并计算哈希
            const currentAccountInfo = this.getActiveAccountInfo();
            const currentProxyConfig = this.getProxyConfig();
            const configData = JSON.stringify({ 
                account: currentAccountInfo, 
                proxy: currentProxyConfig 
            });
            const currentHash = this.simpleHash(configData);
            
            // 如果配置发生变化，则更新
            if (currentHash !== this.lastConfigHash) {
                console.log('[Claude Interceptor] 检测到配置变化，正在更新...');
                this.refreshConfig();
                return true;
            }
            return false;
        } catch (error) {
            console.warn('[Claude Interceptor] 检查配置变化失败:', error.message);
            return false;
        }
    }

    /**
     * 设置配置文件监听器
     */
    setupConfigWatcher() {
        try {
            const settingsPath = this.getSettingsPath();
            if (!settingsPath || !fs.existsSync(settingsPath)) {
                console.warn('[Claude Interceptor] 配置文件不存在，跳过监听设置');
                return;
            }

            // 监听配置文件变化
            this.settingsWatcher = fs.watchFile(settingsPath, (curr, prev) => {
                if (curr.mtime > prev.mtime) {
                    console.log('[Claude Interceptor] 配置文件已更新，重新加载配置');
                    this.onConfigChanged();
                }
            });

            console.log('[Claude Interceptor] 配置文件监听已启动:', settingsPath);
        } catch (error) {
            console.warn('[Claude Interceptor] 设置配置文件监听失败:', error.message);
        }
    }

    /**
     * 配置变更回调
     */
    onConfigChanged() {
        try {
            const oldAccountInfo = this.accountInfo;
            this.refreshConfig();
            
            // 通知配置变更
            if (oldAccountInfo?.emailAddress !== this.accountInfo?.emailAddress ||
                oldAccountInfo?.type !== this.accountInfo?.type) {
                console.log('[Claude Interceptor] 账号配置已变更:', 
                    this.accountInfo 
                        ? `${this.accountInfo.type} - ${this.accountInfo.emailAddress || this.accountInfo.name}`
                        : 'None'
                );
            }
        } catch (error) {
            console.error('[Claude Interceptor] 处理配置变更失败:', error.message);
        }
    }

    /**
     * 获取配置文件路径
     */
    getSettingsPath() {
        try {
            let userDataPath;
            const platform = process.platform;
            
            if (process.env.NODE_ENV === 'test' || process.env.CC_COPILOT_TEST_MODE) {
                if (platform === 'darwin') {
                    userDataPath = path.join(os.homedir(), 'Library', 'Application Support', 'cc-copilot-test');
                } else if (platform === 'win32') {
                    userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'cc-copilot-test');
                } else {
                    userDataPath = path.join(os.homedir(), '.config', 'cc-copilot-test');
                }
            } else {
                if (platform === 'darwin') {
                    userDataPath = path.join(os.homedir(), 'Library', 'Application Support', 'cc-copilot');
                } else if (platform === 'win32') {
                    userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'cc-copilot');
                } else {
                    userDataPath = path.join(os.homedir(), '.config', 'cc-copilot');
                }
            }
            
            return path.join(userDataPath, 'settings.json');
        } catch (error) {
            console.warn('[Claude Interceptor] 获取配置路径失败:', error.message);
            return null;
        }
    }

    /**
     * 简单哈希函数
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return hash;
    }

    /**
     * 清理资源
     */
    cleanup() {
        try {
            if (this.settingsWatcher) {
                fs.unwatchFile(this.getSettingsPath());
                this.settingsWatcher = null;
                console.log('[Claude Interceptor] 配置文件监听已停止');
            }
        } catch (error) {
            console.warn('[Claude Interceptor] 清理监听器失败:', error.message);
        }
    }

    /**
     * 从electron-store配置文件加载设置（复用SettingsManager逻辑）
     */
    loadSettingsFromStore() {
        try {
            let userDataPath;
            
            // 由于在Claude CLI子进程中运行，无法直接访问electron模块
            // 使用平台特定的默认路径
            const platform = process.platform;
            
            // 支持测试模式（从环境变量读取测试路径）
            if (process.env.NODE_ENV === 'test' || process.env.CC_COPILOT_TEST_MODE) {
                if (platform === 'darwin') {
                    userDataPath = path.join(os.homedir(), 'Library', 'Application Support', 'cc-copilot-test');
                } else if (platform === 'win32') {
                    userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'cc-copilot-test');
                } else {
                    userDataPath = path.join(os.homedir(), '.config', 'cc-copilot-test');
                }
            } else {
                if (platform === 'darwin') {
                    userDataPath = path.join(os.homedir(), 'Library', 'Application Support', 'cc-copilot');
                } else if (platform === 'win32') {
                    userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'cc-copilot');
                } else {
                    userDataPath = path.join(os.homedir(), '.config', 'cc-copilot');
                }
            }
            
            if (!userDataPath) {
                console.warn('[Claude Interceptor] 无法确定用户数据目录');
                return null;
            }

            const settingsPath = path.join(userDataPath, 'settings.json');
            if (fs.existsSync(settingsPath)) {
                const data = fs.readFileSync(settingsPath, 'utf-8');
                return JSON.parse(data);
            }
            
            return null;
        } catch (error) {
            console.warn('[Claude Interceptor] 加载设置文件失败:', error.message);
            return null;
        }
    }

    /**
     * 保存设置到electron-store配置文件
     */
    saveSettingsToStore(settingsData) {
        try {
            let userDataPath;
            
            // 使用平台特定的默认路径
            const platform = process.platform;
            
            // 支持测试模式
            if (process.env.NODE_ENV === 'test' || process.env.CC_COPILOT_TEST_MODE) {
                if (platform === 'darwin') {
                    userDataPath = path.join(os.homedir(), 'Library', 'Application Support', 'cc-copilot-test');
                } else if (platform === 'win32') {
                    userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'cc-copilot-test');
                } else {
                    userDataPath = path.join(os.homedir(), '.config', 'cc-copilot-test');
                }
            } else {
                if (platform === 'darwin') {
                    userDataPath = path.join(os.homedir(), 'Library', 'Application Support', 'cc-copilot');
                } else if (platform === 'win32') {
                    userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'cc-copilot');
                } else {
                    userDataPath = path.join(os.homedir(), '.config', 'cc-copilot');
                }
            }
            
            if (!userDataPath) {
                console.warn('[Claude Interceptor] 无法确定用户数据目录');
                return false;
            }

            // 确保目录存在
            if (!fs.existsSync(userDataPath)) {
                fs.mkdirSync(userDataPath, { recursive: true });
            }

            const settingsPath = path.join(userDataPath, 'settings.json');
            fs.writeFileSync(settingsPath, JSON.stringify(settingsData, null, 2));
            return true;
        } catch (error) {
            console.error('[Claude Interceptor] 保存设置文件失败:', error.message);
            return false;
        }
    }

    /**
     * 从设置中获取当前活动账号（复用SettingsManager逻辑）
     */
    getCurrentActiveAccountFromSettings(settingsData) {
        try {
            const activeServiceProviderId = settingsData.activeServiceProviderId;
            const serviceProviders = settingsData.serviceProviders || [];
            
            const activeProvider = serviceProviders.find(p => p.id === activeServiceProviderId);
            if (!activeProvider || !activeProvider.activeAccountId) {
                return null;
            }

            const account = activeProvider.accounts.find(acc => {
                if (activeProvider.type === 'claude_official') {
                    return acc.emailAddress === activeProvider.activeAccountId;
                } else {
                    return acc.id === activeProvider.activeAccountId;
                }
            });

            if (!account) return null;

            return { provider: activeProvider, account };
        } catch (error) {
            console.warn('[Claude Interceptor] 获取活动账号失败:', error.message);
            return null;
        }
    }

    /**
     * 判断当前服务提供方是否应该使用代理（复用SettingsManager逻辑）
     */
    shouldUseProxyForCurrentProvider(settingsData) {
        try {
            const activeResult = this.getCurrentActiveAccountFromSettings(settingsData);
            if (!activeResult) {
                return true; // 默认使用代理
            }
            return activeResult.provider.useProxy !== false; // 默认true
        } catch (error) {
            return true; // 默认使用代理
        }
    }

    /**
     * 更新Claude账号的authorization值（复用SettingsManager逻辑）
     */
    updateClaudeAccountAuthorizationInSettings(settingsData, emailAddress, authorization) {
        try {
            const serviceProviders = settingsData.serviceProviders || [];
            const claudeProvider = serviceProviders.find(p => p.type === 'claude_official');
            
            if (!claudeProvider) return false;
            
            const account = claudeProvider.accounts.find(acc => acc.emailAddress === emailAddress);
            if (account) {
                account.authorization = authorization;
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('[Claude Interceptor] 更新authorization失败:', error.message);
            return false;
        }
    }
}

// 全局拦截器实例
let globalInterceptor = null;

function initializeClaudeInterceptor() {
    if (globalInterceptor) {
        console.warn('[Claude Interceptor] 拦截器已初始化');
        return globalInterceptor;
    }

    globalInterceptor = new ClaudeInterceptor();
    globalInterceptor.initialize();
    
    return globalInterceptor;
}

// 立即初始化
initializeClaudeInterceptor();

// 进程退出时清理资源
process.on('exit', () => {
    if (globalInterceptor) {
        globalInterceptor.cleanup();
    }
});

process.on('SIGINT', () => {
    if (globalInterceptor) {
        globalInterceptor.cleanup();
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    if (globalInterceptor) {
        globalInterceptor.cleanup();
    }
    process.exit(0);
});

module.exports = { ClaudeInterceptor, initializeClaudeInterceptor };