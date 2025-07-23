const fs = require("fs");
const path = require("path");
const os = require("os");

/**
 * Claude CLI请求拦截器
 * 复用现有的配置管理逻辑，通过electron-store读取配置
 */
class ClaudeInterceptor {
    // 静态常量定义
    static PROVIDER_TYPE_CLAUDE_OFFICIAL = 'claude_official';
    static PROVIDER_TYPE_THIRD_PARTY = 'third_party';
    constructor() {
        this.getActiveAccountInfo = this.getActiveAccountInfo.bind(this);
        this.updateAuthorizationInConfig = this.updateAuthorizationInConfig.bind(this);
        this.setupUpstreamProxy = this.setupUpstreamProxy.bind(this);
        this.onConfigChanged = this.onConfigChanged.bind(this);

        // 初始化配置缓存
        this.accountInfo = null;
        this.proxyConfig = null;
        this.settingsWatcher = null;
        this.lastConfigHash = null;
        this.lastConfigCheck = 0; // 最后一次配置检查时间

        // 加载配置
        this.refreshConfig();

        // 设置配置文件监听
        this.setupConfigWatcher();
    }


    getActiveAccountInfo() {
        try {
            // 从electron-store配置文件读取（复用现有逻辑）
            const settingsData = this.loadSettingsFromStore();
            if (settingsData) {
                const activeResult = this.getCurrentActiveAccountFromSettings(settingsData);
                if (activeResult) {
                    const { provider, account } = activeResult;

                    if (provider.type === ClaudeInterceptor.PROVIDER_TYPE_CLAUDE_OFFICIAL) {
                        return {
                            type: ClaudeInterceptor.PROVIDER_TYPE_CLAUDE_OFFICIAL,
                            emailAddress: account.emailAddress,
                            authorization: account.authorization
                        };
                    } else {
                        return {
                            type: ClaudeInterceptor.PROVIDER_TYPE_THIRD_PARTY,
                            name: account.name,
                            apiKey: account.apiKey,
                            baseUrl: account.baseUrl
                        };
                    }
                }
            }
            console.log("未获取到任何可用的账号")
            return null;
        } catch (error) {
            console.warn('[SILENT] 无法获取账号配置:', error.message);
            return null;
        }
    }

    getProxyConfig() {
        try {
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
            return { enabled: false };
        } catch (error) {
            console.warn('[SILENT] 无法获取代理配置:', error.message);
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

            console.log('[SILENT] [Claude Interceptor] 上游代理已设置:', proxyUrl.replace(/\/\/.*@/, '//***@'));
        } catch (error) {
            console.error('[SILENT] [Claude Interceptor] 设置上游代理失败:', error.message);
        }
    }

    updateAuthorizationInConfig(authorization) {
        try {
            // 检查当前账号的authorization是否需要更新
            if (!this.accountInfo?.authorization || this.accountInfo.authorization !== authorization) {
                const settingsData = this.loadSettingsFromStore();
                if (settingsData && this.accountInfo?.emailAddress) {
                    // 检查这个authorization是否已被其他Claude账号使用
                    const existingAccount = this.findClaudeAccountByAuthorizationInSettings(settingsData, authorization);
                    if (existingAccount && existingAccount.emailAddress !== this.accountInfo.emailAddress) {
                        console.warn(`[SILENT] [Claude Interceptor] Authorization值已被其他账号 ${existingAccount.emailAddress} 使用，无法分配给当前账号 ${this.accountInfo.emailAddress}`);
                        console.warn('[SILENT] [Claude Interceptor] 建议检查账号配置或切换到正确的账号');
                        return;
                    }

                    console.log(`[SILENT] [Claude Interceptor] 检测到并准备保存Claude官方账号的authorization值: ${this.accountInfo.emailAddress}`);
                    this.updateClaudeAccountAuthorizationInSettings(settingsData, this.accountInfo.emailAddress, authorization);
                    this.saveSettingsToStore(settingsData);
                    // 更新本地缓存
                    this.accountInfo.authorization = authorization;
                    console.log('[SILENT] [Claude Interceptor] Authorization值已直接保存到配置文件');
                } else {
                    console.log('保存authorization失败', error.message);
                }
            }
        } catch (error) {
            console.error('[SILENT] [Claude Interceptor] 保存authorization失败:', error.message);
        }
    }

    getAuthorizationHeader() {
        // 智能配置检查：只在特定条件下检查配置
        this.smartConfigCheck();

        if (!this.accountInfo) {
            return null;
        }

        if (this.accountInfo.type === ClaudeInterceptor.PROVIDER_TYPE_CLAUDE_OFFICIAL) {
            return this.accountInfo.authorization;
        } else if (this.accountInfo.type === ClaudeInterceptor.PROVIDER_TYPE_THIRD_PARTY) {
            return `Bearer ${this.accountInfo.apiKey}`;
        }

        return null;
    }

    /**
     * 智能配置检查：只在必要时检查配置变化
     */
    smartConfigCheck() {
        const now = Date.now();
        const CHECK_INTERVAL = 30000; // 30秒检查间隔

        // 只在以下情况检查配置：
        // 1. 超过检查间隔时间
        // 2. 没有监听器且配置可能已变化
        if (now - this.lastConfigCheck > CHECK_INTERVAL ||
            (!this.settingsWatcher && !this.accountInfo)) {
            this.lastConfigCheck = now;
            this.checkAndRefreshConfig();

            // 如果监听器不存在，尝试重新设置
            if (!this.settingsWatcher) {
                this.setupConfigWatcher();
            }
        }
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

            // 只对当前配置的API端点进行特殊处理
            if (interceptor.isAnthropicAPI(url)) {
                // 检测并保存原始authorization
                if (init.headers) {
                    const headers = new Headers(init.headers);
                    const authHeader = headers.get('authorization');
                    if (authHeader && interceptor.accountInfo?.type === ClaudeInterceptor.PROVIDER_TYPE_CLAUDE_OFFICIAL &&
                        (!interceptor.accountInfo.authorization || interceptor.accountInfo.authorization !== authHeader)) {
                        console.log('[SILENT] [Claude Interceptor] 检测到新的authorization值，准备保存');
                        interceptor.updateAuthorizationInConfig(authHeader);
                    }
                }

                // 动态修改authorization header
                const dynamicAuth = interceptor.getAuthorizationHeader();
                if (dynamicAuth) {
                    // 检查当前请求的authorization是否与目标authorization一致
                    let currentAuth = null;
                    if (init.headers instanceof Headers) {
                        currentAuth = init.headers.get('authorization');
                    } else if (typeof init.headers === 'object' && init.headers) {
                        currentAuth = init.headers.authorization;
                    }

                    // 如果当前token与目标token一致，无需修改
                    if (currentAuth !== dynamicAuth) {
                         if (!init.headers) {
                            init.headers = {};
                        }

                        if (init.headers instanceof Headers) {
                            init.headers.set('authorization', dynamicAuth);
                        } else if (typeof init.headers === 'object') {
                            init.headers.authorization = dynamicAuth;
                        }

                        console.log('[SILENT] [Claude Interceptor] 已设置动态authorization:', '...' + dynamicAuth.slice(-20));
                    }
                }
            }

            return originalFetch(input, init);
        };

        global.fetch.__claudeIntercepted = true;
        console.log('[SILENT] [Claude Interceptor] Fetch已被拦截');
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

            console.log('[SILENT] [Claude Interceptor] Node HTTP已被拦截');
        } catch (error) {
            console.error('[TERMINAL] [Claude Interceptor] 拦截Node HTTP失败:', error.message);
        }
    }

    interceptNodeRequest(originalRequest, options, callback, isHttps) {
        const url = this.parseNodeRequestURL(options, isHttps);

        // 只对当前配置的API端点进行特殊处理
        if (this.isAnthropicAPI(url)) {
            console.log('[TERMINAL] [Claude Interceptor] 拦截到Node HTTP API请求:', url);

            // 检测并保存原始authorization
            if (options.headers && options.headers.authorization) {
                const authHeader = options.headers.authorization;
                if (this.accountInfo?.type === ClaudeInterceptor.PROVIDER_TYPE_CLAUDE_OFFICIAL &&
                    (!this.accountInfo.authorization || this.accountInfo.authorization !== authHeader)) {
                    console.log('[SILENT] [Claude Interceptor] 检测到新的authorization值，准备保存');
                    this.updateAuthorizationInConfig(authHeader);
                }
            }

            // 动态修改authorization header
            const dynamicAuth = this.getAuthorizationHeader();
            if (dynamicAuth) {
                // 检查当前请求的authorization是否与目标authorization一致
                const currentAuth = options.headers?.authorization;

                // 如果当前token与目标token一致，无需修改
                if (currentAuth !== dynamicAuth) {
                    if (!options.headers) {
                        options.headers = {};
                    }
                    options.headers.authorization = dynamicAuth;
                    console.log('[SILENT] [Claude Interceptor] 已设置动态authorization:', '...' + dynamicAuth.slice(-20));
                }
            }
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

    /**
     * 判断URL是否为Anthropic API端点
     */
    isAnthropicAPI(url) {
        if (!url) return false;
        
        try {
            // 检查当前账号配置
            return url.includes('api.anthropic.com');
        } catch (error) {
            console.warn('[SILENT] [Claude Interceptor] 检查API端点失败:', error.message);
            return false;
        }
    }

    initialize() {
        console.log('[TERMINAL] [Claude Interceptor] 初始化拦截器...');

        if (this.accountInfo) {
            console.log('[TERMINAL] [Claude Interceptor] 当前账号:',
                this.accountInfo.type === ClaudeInterceptor.PROVIDER_TYPE_CLAUDE_OFFICIAL
                    ? this.accountInfo.emailAddress
                    : this.accountInfo.name
            );
        } else {
            console.warn('[TERMINAL] [Claude Interceptor] 警告: 未找到账号配置');
        }

        this.instrumentFetch();
        this.instrumentNodeHTTP();

        console.log('[TERMINAL] [Claude Interceptor] 拦截器初始化完成');
        console.log('[SILENT] [Claude Interceptor] 配置文件监听已启用，支持热更新');
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

            console.log('[TERMINAL] [Claude Interceptor] 配置已刷新');
        } catch (error) {
            console.error('[SILENT] [Claude Interceptor] 刷新配置失败:', error.message);
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
                console.log('[TERMINAL] [Claude Interceptor] 检测到配置变化，正在更新...');
                this.refreshConfig();
                return true;
            }
            return false;
        } catch (error) {
            console.warn('[SILENT] [Claude Interceptor] 检查配置变化失败:', error.message);
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
                console.warn('[SILENT] [Claude Interceptor] 配置文件不存在，跳过监听设置');
                return;
            }

            // 监听配置文件变化
            this.settingsWatcher = fs.watchFile(settingsPath, (curr, prev) => {
                if (curr.mtime > prev.mtime) {
                    console.log('[SILENT] [Claude Interceptor] 配置文件已更新，重新加载配置');
                    this.onConfigChanged();
                }
            });

            console.log('[SILENT] [Claude Interceptor] 配置文件监听已启动:', settingsPath);
        } catch (error) {
            console.warn('[SILENT] [Claude Interceptor] 设置配置文件监听失败:', error.message);
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
                console.log('[TERMINAL] [Claude Interceptor] 账号配置已变更:',
                    this.accountInfo
                        ? `${this.accountInfo.type} - ${this.accountInfo.emailAddress || this.accountInfo.name}`
                        : 'None'
                );
            }
        } catch (error) {
            console.error('[SILENT] [Claude Interceptor] 处理配置变更失败:', error.message);
        }
    }

    /**
     * 获取配置文件路径
     */
    getSettingsPath() {
        try {
            let userDataPath;
            const platform = process.platform;

            if (platform === 'darwin') {
                userDataPath = path.join(os.homedir(), 'Library', 'Application Support', 'CC Copilot');
            } else if (platform === 'win32') {
                userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'CC Copilot');
            } else {
                userDataPath = path.join(os.homedir(), '.config', 'CC Copilot');
            }

            return path.join(userDataPath, 'settings.json');
        } catch (error) {
            console.warn('[SILENT] [Claude Interceptor] 获取配置路径失败:', error.message);
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
                console.log('[SILENT] [Claude Interceptor] 配置文件监听已停止');
            }
        } catch (error) {
            console.warn('[SILENT] [Claude Interceptor] 清理监听器失败:', error.message);
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
            if (platform === 'darwin') {
                userDataPath = path.join(os.homedir(), 'Library', 'Application Support', 'CC Copilot');
            } else if (platform === 'win32') {
                userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'CC Copilot');
            } else {
                userDataPath = path.join(os.homedir(), '.config', 'CC Copilot');
            }

            if (!userDataPath) {
                console.warn('[SILENT] [Claude Interceptor] 无法确定用户数据目录');
                return null;
            }

            const settingsPath = path.join(userDataPath, 'settings.json');
            if (fs.existsSync(settingsPath)) {
                const data = fs.readFileSync(settingsPath, 'utf-8');
                return JSON.parse(data);
            }

            return null;
        } catch (error) {
            console.warn('[SILENT] [Claude Interceptor] 加载设置文件失败:', error.message);
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
                    userDataPath = path.join(os.homedir(), 'Library', 'Application Support', 'CC Copilot');
                } else if (platform === 'win32') {
                    userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'CC Copilot');
                } else {
                    userDataPath = path.join(os.homedir(), '.config', 'CC Copilot');
                }
            }

            if (!userDataPath) {
                console.warn('[SILENT] [Claude Interceptor] 无法确定用户数据目录');
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
            console.error('[SILENT] [Claude Interceptor] 保存设置文件失败:', error.message);
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
                if (activeProvider.type === ClaudeInterceptor.PROVIDER_TYPE_CLAUDE_OFFICIAL) {
                    return acc.emailAddress === activeProvider.activeAccountId;
                } else {
                    return acc.id === activeProvider.activeAccountId;
                }
            });

            if (!account) return null;

            return { provider: activeProvider, account };
        } catch (error) {
            console.warn('[SILENT] [Claude Interceptor] 获取活动账号失败:', error.message);
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
     * 根据authorization值查找Claude账号
     */
    findClaudeAccountByAuthorizationInSettings(settingsData, authorization) {
        try {
            const serviceProviders = settingsData.serviceProviders || [];
            const claudeProvider = serviceProviders.find(p => p.type === ClaudeInterceptor.PROVIDER_TYPE_CLAUDE_OFFICIAL);

            if (!claudeProvider) return null;

            return claudeProvider.accounts.find(acc => acc.authorization === authorization) || null;
        } catch (error) {
            console.warn('[SILENT] [Claude Interceptor] 查找账号失败:', error.message);
            return null;
        }
    }

    /**
     * 更新Claude账号的authorization值（复用SettingsManager逻辑）
     */
    updateClaudeAccountAuthorizationInSettings(settingsData, emailAddress, authorization) {
        try {
            const serviceProviders = settingsData.serviceProviders || [];
            const claudeProvider = serviceProviders.find(p => p.type === ClaudeInterceptor.PROVIDER_TYPE_CLAUDE_OFFICIAL);

            if (!claudeProvider) return false;

            const account = claudeProvider.accounts.find(acc => acc.emailAddress === emailAddress);
            if (account) {
                account.authorization = authorization;
                return true;
            }

            return false;
        } catch (error) {
            console.error('[SILENT] [Claude Interceptor] 更新authorization失败:', error.message);
            return false;
        }
    }
}

// 全局拦截器实例
let globalInterceptor = null;

function initializeClaudeInterceptor() {
    if (globalInterceptor) {
        console.warn('[SILENT] [Claude Interceptor] 拦截器已初始化');
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