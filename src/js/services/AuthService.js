/**
 * 認證服務
 * 處理 LINE LIFF 認證和 Token 管理
 */

import { isTokenExpired } from '../core/Utils.js';
import Logger from '../core/Logger.js';
import eventBus, { Events } from '../core/EventBus.js';

class AuthService {
    constructor(config, storageService, apiService) {
        this.config = config;
        this.storage = storageService;
        this.api = apiService;
        this.logger = new Logger('AuthService', config);

        this.userProfile = null;
        this.isAuthenticated = false;
        this.tokenCheckInterval = null;

        // 綁定 LIFF 相關方法
        this.liff = window.liff;
    }

    /**
     * 初始化認證服務
     */
    async init() {
        this.logger.info('初始化認證服務');

        // 檢查儲存的認證
        const stored = await this.checkStoredAuth();
        if (stored) {
            this.logger.info('使用儲存的認證');
            return true;
        }

        // 初始化 LIFF
        return await this.initLiff();
    }

    /**
     * 檢查儲存的認證
     */
    async checkStoredAuth() {
        try {
            const token = this.storage.getAuthToken();
            const profile = this.storage.getUserProfile();

            if (!token || !profile) {
                this.logger.debug('無儲存的認證資料');
                return false;
            }

            // 檢查 Token 是否過期
            if (isTokenExpired(token)) {
                this.logger.warn('儲存的 Token 已過期');
                this.clearAuth();
                return false;
            }

            // 驗證 Token 有效性
            const isValid = await this.validateToken();
            if (!isValid) {
                this.logger.warn('儲存的 Token 無效');
                this.clearAuth();
                return false;
            }

            // 恢復認證狀態
            this.userProfile = profile;
            this.isAuthenticated = true;

            this.logger.info('儲存的認證有效', {
                userId: profile.userId,
                displayName: profile.displayName
            });

            // 啟動 Token 檢查
            this.startTokenCheck();

            // 發布登入成功事件
            eventBus.emit(Events.AUTH_LOGIN_SUCCESS, profile);

            return true;
        } catch (error) {
            this.logger.error('檢查儲存認證失敗', error);
            return false;
        }
    }

    /**
     * 驗證 Token 有效性
     */
    async validateToken() {
        try {
            const profile = await this.api.getUserProfile();
            return !!profile;
        } catch (error) {
            return false;
        }
    }

    /**
     * 初始化 LIFF SDK
     */
    async initLiff() {
        try {
            const liffId = this.config.get('liffId');

            if (!liffId) {
                throw new Error('LIFF ID 未配置');
            }

            this.logger.info('初始化 LIFF SDK', { liffId });

            // 開發模式模擬登入
            if (this.config.get('isDevelopment')) {
                return await this.devModeLogin();
            }

            // 初始化 LIFF
            await this.liff.init({ liffId });

            // 檢查登入狀態
            if (!this.liff.isLoggedIn()) {
                this.logger.info('用戶未登入，導向 LINE 登入');
                this.liff.login();
                return false;
            }

            // 獲取用戶資料
            const profile = await this.liff.getProfile();
            const accessToken = this.liff.getAccessToken();

            // 登入後端
            return await this.loginToBackend({
                userId: profile.userId,
                displayName: profile.displayName,
                pictureUrl: profile.pictureUrl,
                accessToken: accessToken
            });
        } catch (error) {
            this.logger.error('LIFF 初始化失敗', error);
            eventBus.emit(Events.AUTH_LOGIN_FAILED, error);
            throw error;
        }
    }

    /**
     * 登入後端
     */
    async loginToBackend(profileData) {
        try {
            this.logger.info('登入後端', {
                userId: profileData.userId,
                displayName: profileData.displayName
            });

            // 調用後端登入 API
            const response = await this.api.liffLogin(profileData);

            if (!response.success) {
                throw new Error(response.message || '登入失敗');
            }

            // 保存用戶資料
            this.userProfile = {
                userId: response.user.userId,
                displayName: response.user.displayName,
                pictureUrl: response.user.pictureUrl,
                bettingStatus: response.user.bettingStatus
            };

            this.storage.setUserProfile(this.userProfile);
            this.isAuthenticated = true;

            this.logger.info('登入成功', {
                userId: this.userProfile.userId,
                bettingStatus: this.userProfile.bettingStatus
            });

            // 檢查投注狀態
            if (this.userProfile.bettingStatus === 'disabled') {
                this.logger.warn('用戶被禁止投注');
                eventBus.emit(Events.USER_BETTING_DISABLED, this.userProfile);
            }

            // 啟動 Token 檢查
            this.startTokenCheck();

            // 發布登入成功事件
            eventBus.emit(Events.AUTH_LOGIN_SUCCESS, this.userProfile);

            return true;
        } catch (error) {
            this.logger.error('後端登入失敗', error);
            eventBus.emit(Events.AUTH_LOGIN_FAILED, error);
            throw error;
        }
    }

    /**
     * 開發模式模擬登入
     */
    async devModeLogin() {
        this.logger.warn('開發模式：使用模擬登入');

        const mockProfile = {
            userId: 'dev_user_123',
            displayName: '測試用戶',
            pictureUrl: 'https://via.placeholder.com/150',
            accessToken: 'dev_mock_token'
        };

        return await this.loginToBackend(mockProfile);
    }

    /**
     * 啟動 Token 定期檢查
     */
    startTokenCheck() {
        if (this.tokenCheckInterval) {
            return;
        }

        const interval = this.config.get('tokenExpireCheckInterval', 5 * 60 * 1000);

        this.tokenCheckInterval = setInterval(async () => {
            const token = this.storage.getAuthToken();

            if (!token || isTokenExpired(token)) {
                this.logger.warn('Token 已過期');
                this.handleTokenExpired();
            }
        }, interval);

        this.logger.debug(`Token 檢查已啟動，間隔: ${interval}ms`);
    }

    /**
     * 停止 Token 檢查
     */
    stopTokenCheck() {
        if (this.tokenCheckInterval) {
            clearInterval(this.tokenCheckInterval);
            this.tokenCheckInterval = null;
            this.logger.debug('Token 檢查已停止');
        }
    }

    /**
     * 處理 Token 過期
     */
    handleTokenExpired() {
        this.logger.warn('處理 Token 過期');

        this.clearAuth();
        eventBus.emit(Events.AUTH_TOKEN_EXPIRED);

        // 顯示提示並重新登入
        alert('登入已過期，請重新登入');
        this.reLogin();
    }

    /**
     * 重新登入
     */
    async reLogin() {
        this.clearAuth();

        if (this.config.get('isDevelopment')) {
            window.location.reload();
        } else if (this.liff && this.liff.isInClient()) {
            this.liff.login();
        } else {
            window.location.reload();
        }
    }

    /**
     * 登出
     */
    logout() {
        this.logger.info('用戶登出');

        this.clearAuth();
        eventBus.emit(Events.AUTH_LOGOUT);

        // LIFF 登出
        if (this.liff && !this.config.get('isDevelopment')) {
            this.liff.logout();
        }

        window.location.reload();
    }

    /**
     * 清除認證資料
     */
    clearAuth() {
        this.storage.removeAuthToken();
        this.storage.removeUserProfile();
        this.userProfile = null;
        this.isAuthenticated = false;
        this.stopTokenCheck();
        this.logger.debug('認證資料已清除');
    }

    /**
     * 獲取當前用戶資料
     */
    getUserProfile() {
        return this.userProfile;
    }

    /**
     * 檢查是否已認證
     */
    isAuth() {
        return this.isAuthenticated;
    }

    /**
     * 檢查用戶是否可以投注
     */
    canBet() {
        if (!this.userProfile) {
            return false;
        }

        return this.userProfile.bettingStatus !== 'disabled';
    }

    /**
     * 發送 LINE 訊息（投注成功後）
     */
    async sendLineMessage(message) {
        try {
            if (!this.config.get('features.sendLineMessages')) {
                this.logger.debug('LINE 訊息發送已禁用');
                return false;
            }

            if (!this.liff || !this.liff.isInClient()) {
                this.logger.debug('不在 LINE 客戶端中，無法發送訊息');
                return false;
            }

            if (this.config.get('isDevelopment')) {
                this.logger.debug('開發模式：跳過發送 LINE 訊息', { message });
                return true;
            }

            await this.liff.sendMessages([{
                type: 'text',
                text: message
            }]);

            this.logger.info('LINE 訊息已發送');
            return true;
        } catch (error) {
            this.logger.error('發送 LINE 訊息失敗', error);
            return false;
        }
    }

    /**
     * 關閉 LIFF 視窗
     */
    closeLiff() {
        if (this.liff && this.liff.isInClient()) {
            this.liff.closeWindow();
        }
    }

    /**
     * 清理資源
     */
    destroy() {
        this.stopTokenCheck();
        this.logger.info('認證服務已清理');
    }
}

export default AuthService;
