/**
 * 應用配置管理系統
 * 安全地處理配置，避免硬編碼敏感資訊
 */

class AppConfig {
    constructor() {
        this.config = {
            // 預設配置 - 生產環境應從伺服器獲取
            liffId: this.getConfigValue('LIFF_ID', '2008123093-KR57QjDP'),
            apiUrl: this.getConfigValue('API_URL', 'https://api.bjr8888.com'),
            streamHost: this.getConfigValue('STREAM_HOST', 'stream.bjr8888.com'),
            streamApp: this.getConfigValue('STREAM_APP', 'app'),
            streamName: this.getConfigValue('STREAM_NAME', 'tapo1'),

            // 環境設定
            isDevelopment: this.isDevelopmentMode(),
            enableDebugLog: this.getConfigValue('DEBUG_LOG', 'false') === 'true',

            // 安全設定
            tokenExpireCheckInterval: 5 * 60 * 1000, // 5分鐘檢查一次
            maxRetryAttempts: 3,
            retryDelay: 1000,

            // UI 設定
            defaultBetAmount: 100,
            betAmountOptions: [10, 50, 100, 500, 1000],

            // 功能開關
            features: {
                sendLineMessages: true,
                autoRefreshStream: true,
                showDebugInfo: this.isDevelopmentMode()
            }
        };

        // 從 URL 參數覆蓋配置（僅開發模式）
        if (this.config.isDevelopment) {
            this.loadUrlOverrides();
        }
    }

    /**
     * 檢測是否為開發模式
     */
    isDevelopmentMode() {
        return window.location.hostname === 'localhost' ||
               window.location.hostname === '127.0.0.1' ||
               window.location.hostname.includes('192.168.') ||
               window.location.protocol === 'file:';
    }

    /**
     * 安全地獲取配置值
     * 優先級: URL參數 > 環境變數 > SessionStorage > 預設值
     */
    getConfigValue(key, defaultValue) {
        // 從 URL 參數讀取（僅開發模式）
        if (this.isDevelopmentMode()) {
            const urlParams = new URLSearchParams(window.location.search);
            const urlValue = urlParams.get(key.toLowerCase());
            if (urlValue) {
                return urlValue;
            }
        }

        // 從 window.ENV 讀取（由伺服器注入）
        if (window.ENV && window.ENV[key]) {
            return window.ENV[key];
        }

        // 從 sessionStorage 讀取（臨時覆蓋）
        try {
            const sessionValue = sessionStorage.getItem(`config_${key}`);
            if (sessionValue) {
                return sessionValue;
            }
        } catch (error) {
            console.warn(`無法從 sessionStorage 讀取配置: ${key}`, error);
        }

        return defaultValue;
    }

    /**
     * 從 URL 參數載入配置覆蓋（僅開發模式）
     */
    loadUrlOverrides() {
        const urlParams = new URLSearchParams(window.location.search);

        // LIFF ID 覆蓋
        const liffId = urlParams.get('liffid') || urlParams.get('liff_id');
        if (liffId) {
            this.config.liffId = liffId;
            console.info('[開發模式] LIFF ID 已從 URL 覆蓋:', liffId);
        }

        // API URL 覆蓋
        const apiUrl = urlParams.get('apiurl') || urlParams.get('api_url');
        if (apiUrl) {
            this.config.apiUrl = apiUrl;
            console.info('[開發模式] API URL 已從 URL 覆蓋:', apiUrl);
        }

        // 直播配置覆蓋
        const streamHost = urlParams.get('host');
        const streamApp = urlParams.get('app');
        const streamName = urlParams.get('cam') || urlParams.get('stream');

        if (streamHost) this.config.streamHost = streamHost;
        if (streamApp) this.config.streamApp = streamApp;
        if (streamName) this.config.streamName = streamName;
    }

    /**
     * 獲取配置值
     */
    get(key, defaultValue = null) {
        const keys = key.split('.');
        let value = this.config;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return defaultValue;
            }
        }

        return value;
    }

    /**
     * 設定配置值（臨時）
     */
    set(key, value) {
        const keys = key.split('.');
        let target = this.config;

        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!(k in target) || typeof target[k] !== 'object') {
                target[k] = {};
            }
            target = target[k];
        }

        target[keys[keys.length - 1]] = value;
    }

    /**
     * 驗證必要配置
     */
    validate() {
        const required = ['liffId', 'apiUrl'];
        const missing = required.filter(key => !this.config[key]);

        if (missing.length > 0) {
            throw new Error(`缺少必要配置: ${missing.join(', ')}`);
        }

        // 驗證 URL 格式
        try {
            new URL(this.config.apiUrl);
        } catch (error) {
            throw new Error('API URL 格式無效');
        }

        return true;
    }

    /**
     * 獲取直播源 URL
     */
    getStreamUrl(protocol = 'wss') {
        const { streamHost, streamApp, streamName } = this.config;
        return `${protocol}://${streamHost}/${streamApp}/${streamName}?direction=play`;
    }

    /**
     * 強制使用 HTTPS（生產環境）
     */
    enforceHttps() {
        if (!this.config.isDevelopment &&
            window.location.protocol === 'http:') {
            console.warn('重新導向到 HTTPS');
            window.location.protocol = 'https:';
            return false;
        }
        return true;
    }

    /**
     * 獲取所有配置（用於除錯）
     */
    getAll() {
        if (this.config.isDevelopment) {
            return { ...this.config };
        }
        // 生產環境隱藏敏感資訊
        return {
            isDevelopment: this.config.isDevelopment,
            features: this.config.features
        };
    }
}

// 單例模式
const appConfig = new AppConfig();

// 驗證配置
try {
    appConfig.validate();
    appConfig.enforceHttps();
} catch (error) {
    console.error('配置驗證失敗:', error);
}

// 匯出配置實例
export default appConfig;
