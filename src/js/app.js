/**
 * 主應用程式
 * 整合所有模組，啟動應用
 */

import appConfig from '../../config/app.config.js';
import Logger from './core/Logger.js';
import eventBus, { Events } from './core/EventBus.js';
import { isOnline } from './core/Utils.js';

// Services
import StorageService from './services/StorageService.js';
import ApiService from './services/ApiService.js';
import AuthService from './services/AuthService.js';
import SocketService from './services/SocketService.js';

// Modules
import BettingManager from './modules/BettingManager.js';
import GameManager from './modules/GameManager.js';
import LivePlayer from './modules/LivePlayer.js';
import UIManager from './modules/UIManager.js';

/**
 * 主應用類別
 */
class App {
    constructor() {
        this.logger = new Logger('App', appConfig.getAll());
        this.isInitialized = false;

        // Services
        this.storage = null;
        this.api = null;
        this.auth = null;
        this.socket = null;

        // Modules
        this.betting = null;
        this.game = null;
        this.livePlayer = null;
        this.ui = null;
    }

    /**
     * 初始化應用
     */
    async init() {
        try {
            this.logger.info('開始初始化應用程式');
            this.logger.info('環境資訊', {
                isDevelopment: appConfig.get('isDevelopment'),
                apiUrl: appConfig.get('apiUrl')
            });

            // 檢查網路連接
            if (!isOnline()) {
                throw new Error('無網路連接，請檢查您的網路設定');
            }

            // 初始化服務層
            await this.initServices();

            // 初始化業務模組
            await this.initModules();

            // 設置全域事件監聽
            this.setupGlobalEventListeners();

            // 設置全域錯誤處理
            this.setupErrorHandling();

            this.isInitialized = true;
            this.logger.info('應用程式初始化完成');

            // 發布應用就緒事件
            eventBus.emit('app:ready');
        } catch (error) {
            this.logger.error('應用程式初始化失敗', error);
            this.handleInitError(error);
            throw error;
        }
    }

    /**
     * 初始化服務層
     */
    async initServices() {
        this.logger.info('初始化服務層');

        // 儲存服務
        this.storage = new StorageService(appConfig.getAll());

        // API 服務
        this.api = new ApiService(appConfig, this.storage);

        // 認證服務
        this.auth = new AuthService(appConfig, this.storage, this.api);
        await this.auth.init();

        // WebSocket 服務
        this.socket = new SocketService(appConfig, this.storage);
        this.socket.connect();

        this.logger.info('服務層初始化完成');
    }

    /**
     * 初始化業務模組
     */
    async initModules() {
        this.logger.info('初始化業務模組');

        // UI 管理器（最先初始化）
        this.ui = new UIManager(appConfig);
        this.ui.init();

        // 更新用戶資料到 UI
        const userProfile = this.auth.getUserProfile();
        if (userProfile) {
            eventBus.emit(Events.USER_PROFILE_UPDATED, userProfile);
        }

        // 載入並更新用戶餘額
        await this.loadUserBalance();

        // 投注管理器
        this.betting = new BettingManager(appConfig, this.api, this.storage, this.auth);
        await this.betting.init();

        // 遊戲管理器
        this.game = new GameManager(appConfig, this.api, this.socket);
        await this.game.init();

        // 直播播放器（延遲初始化，等待用戶切換到直播頁面）
        eventBus.once(Events.UI_TAB_CHANGED, (tabName) => {
            if (tabName === 'live' && !this.livePlayer) {
                this.initLivePlayer();
            }
        });

        this.logger.info('業務模組初始化完成');
    }

    /**
     * 初始化直播播放器
     */
    initLivePlayer() {
        try {
            this.logger.info('初始化直播播放器');
            this.livePlayer = new LivePlayer(appConfig);
            this.livePlayer.init();
        } catch (error) {
            this.logger.error('直播播放器初始化失敗', error);
        }
    }

    /**
     * 載入用戶餘額
     */
    async loadUserBalance() {
        try {
            const userProfile = this.auth.getUserProfile();
            if (!userProfile) {
                return;
            }

            const balanceData = await this.api.getUserBalance(userProfile.userId);
            eventBus.emit(Events.USER_BALANCE_UPDATED, balanceData.balance);
        } catch (error) {
            this.logger.error('載入用戶餘額失敗', error);
        }
    }

    /**
     * 設置全域事件監聽
     */
    setupGlobalEventListeners() {
        // 認證相關
        eventBus.on(Events.AUTH_TOKEN_EXPIRED, () => {
            this.handleTokenExpired();
        });

        eventBus.on(Events.AUTH_LOGOUT, () => {
            this.handleLogout();
        });

        // 投注相關
        eventBus.on('betting:submit', async () => {
            await this.betting.submitBets();
        });

        eventBus.on(Events.BET_SUCCESS, async () => {
            // 投注成功後重新載入餘額
            await this.loadUserBalance();
        });

        // 網路狀態
        window.addEventListener('online', () => {
            this.logger.info('網路已恢復');
            eventBus.emit(Events.NETWORK_ONLINE);
            this.handleNetworkRestore();
        });

        window.addEventListener('offline', () => {
            this.logger.warn('網路已中斷');
            eventBus.emit(Events.NETWORK_OFFLINE);
            this.handleNetworkLoss();
        });
    }

    /**
     * 設置錯誤處理
     */
    setupErrorHandling() {
        // 全域錯誤捕捉
        window.addEventListener('error', (event) => {
            this.logger.error('全域錯誤', {
                message: event.message,
                filename: event.filename,
                line: event.lineno,
                column: event.colno
            });

            eventBus.emit(Events.ERROR_OCCURRED, {
                type: 'global',
                error: event.error
            });
        });

        // Promise 未捕捉錯誤
        window.addEventListener('unhandledrejection', (event) => {
            this.logger.error('未捕捉的 Promise 錯誤', event.reason);

            eventBus.emit(Events.ERROR_OCCURRED, {
                type: 'promise',
                error: event.reason
            });
        });
    }

    /**
     * 處理初始化錯誤
     */
    handleInitError(error) {
        const errorMessage = `應用程式啟動失敗：${error.message}`;

        // 顯示錯誤訊息
        const errorEl = document.createElement('div');
        errorEl.className = 'init-error';
        errorEl.innerHTML = `
            <div class="error-content">
                <h2>❌ 啟動失敗</h2>
                <p>${errorMessage}</p>
                <button onclick="window.location.reload()">重新載入</button>
            </div>
        `;
        document.body.appendChild(errorEl);
    }

    /**
     * 處理 Token 過期
     */
    handleTokenExpired() {
        this.logger.warn('Token 已過期，準備重新登入');
        eventBus.emit('ui:toast:show', {
            message: '登入已過期，請重新登入',
            type: 'warning'
        });

        setTimeout(() => {
            this.auth.reLogin();
        }, 2000);
    }

    /**
     * 處理登出
     */
    handleLogout() {
        this.logger.info('用戶登出');
        this.cleanup();
    }

    /**
     * 處理網路恢復
     */
    handleNetworkRestore() {
        eventBus.emit('ui:toast:show', {
            message: '網路已恢復',
            type: 'success'
        });

        // 重新連接 WebSocket
        if (this.socket) {
            this.socket.reconnect();
        }

        // 重新載入數據
        this.loadUserBalance();
    }

    /**
     * 處理網路中斷
     */
    handleNetworkLoss() {
        eventBus.emit('ui:toast:show', {
            message: '網路已中斷，請檢查您的連接',
            type: 'error',
            duration: 5000
        });
    }

    /**
     * 清理資源
     */
    cleanup() {
        this.logger.info('清理應用程式資源');

        if (this.socket) {
            this.socket.destroy();
        }

        if (this.auth) {
            this.auth.destroy();
        }

        if (this.betting) {
            this.betting.destroy();
        }

        if (this.game) {
            this.game.destroy();
        }

        if (this.livePlayer) {
            this.livePlayer.destroy();
        }

        if (this.ui) {
            this.ui.destroy();
        }

        this.isInitialized = false;
    }
}

// ===== 全域暴露的函數（向下兼容舊的 HTML 事件處理器）=====

let appInstance = null;

window.removeBet = function(index) {
    if (appInstance && appInstance.betting) {
        appInstance.betting.removeBet(index);
    }
};

window.clearAllBets = function() {
    if (appInstance && appInstance.betting) {
        appInstance.betting.clearBets();
    }
};

window.setBetAmount = function(amount) {
    if (appInstance && appInstance.betting) {
        appInstance.betting.setBetAmount(amount);
    }
};

window.togglePlay = function() {
    if (appInstance && appInstance.livePlayer) {
        appInstance.livePlayer.togglePlay();
    }
};

window.toggleMute = function() {
    if (appInstance && appInstance.livePlayer) {
        appInstance.livePlayer.toggleMute();
    }
};

window.toggleFullscreen = function() {
    if (appInstance && appInstance.livePlayer) {
        appInstance.livePlayer.toggleFullscreen();
    }
};

window.refreshStream = function() {
    if (appInstance && appInstance.livePlayer) {
        appInstance.livePlayer.refreshStream();
    }
};

// ===== 啟動應用 =====

(async function bootstrap() {
    try {
        console.log('%c彈珠聯賽 LINE LIFF 應用', 'color: #00B900; font-size: 20px; font-weight: bold;');
        console.log('%c版本: 2.0 (重構優化版)', 'color: #666; font-size: 12px;');

        // 創建應用實例
        appInstance = new App();

        // 將應用實例暴露到全域（僅開發模式）
        if (appConfig.get('isDevelopment')) {
            window.app = appInstance;
        }

        // 等待 DOM 載入完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', async () => {
                await appInstance.init();
            });
        } else {
            await appInstance.init();
        }
    } catch (error) {
        console.error('應用程式啟動失敗:', error);
    }
})();

export default App;
