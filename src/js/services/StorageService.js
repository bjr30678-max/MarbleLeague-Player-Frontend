/**
 * 存儲服務
 * 安全地管理敏感資料，優先使用 sessionStorage
 */

import { safeJsonParse } from '../core/Utils.js';
import Logger from '../core/Logger.js';

class StorageService {
    constructor(config = {}) {
        this.logger = new Logger('StorageService', config);
        this.prefix = 'marble_league_';

        // 使用 sessionStorage 作為主要存儲（頁面關閉後自動清除）
        // localStorage 僅用於非敏感的持久化數據
        this.sessionStorage = window.sessionStorage;
        this.localStorage = window.localStorage;

        // 檢查存儲是否可用
        this.checkStorageAvailability();
    }

    /**
     * 檢查存儲是否可用
     */
    checkStorageAvailability() {
        try {
            const testKey = '__storage_test__';
            this.sessionStorage.setItem(testKey, 'test');
            this.sessionStorage.removeItem(testKey);
            this.logger.debug('SessionStorage 可用');
        } catch (error) {
            this.logger.error('SessionStorage 不可用', error);
        }

        try {
            const testKey = '__storage_test__';
            this.localStorage.setItem(testKey, 'test');
            this.localStorage.removeItem(testKey);
            this.logger.debug('LocalStorage 可用');
        } catch (error) {
            this.logger.error('LocalStorage 不可用', error);
        }
    }

    /**
     * 生成完整的 key
     */
    getKey(key) {
        return `${this.prefix}${key}`;
    }

    /**
     * 設置 sessionStorage 項目
     */
    setSession(key, value) {
        try {
            const fullKey = this.getKey(key);
            const serialized = JSON.stringify({
                value,
                timestamp: Date.now()
            });
            this.sessionStorage.setItem(fullKey, serialized);
            this.logger.debug(`SessionStorage 已設置: ${key}`);
            return true;
        } catch (error) {
            this.logger.error(`SessionStorage 設置失敗: ${key}`, error);
            return false;
        }
    }

    /**
     * 獲取 sessionStorage 項目
     */
    getSession(key, defaultValue = null) {
        try {
            const fullKey = this.getKey(key);
            const serialized = this.sessionStorage.getItem(fullKey);

            if (!serialized) {
                return defaultValue;
            }

            const data = safeJsonParse(serialized);
            return data ? data.value : defaultValue;
        } catch (error) {
            this.logger.error(`SessionStorage 讀取失敗: ${key}`, error);
            return defaultValue;
        }
    }

    /**
     * 刪除 sessionStorage 項目
     */
    removeSession(key) {
        try {
            const fullKey = this.getKey(key);
            this.sessionStorage.removeItem(fullKey);
            this.logger.debug(`SessionStorage 已刪除: ${key}`);
            return true;
        } catch (error) {
            this.logger.error(`SessionStorage 刪除失敗: ${key}`, error);
            return false;
        }
    }

    /**
     * 設置 localStorage 項目（僅用於非敏感數據）
     */
    setLocal(key, value, expiresIn = null) {
        try {
            const fullKey = this.getKey(key);
            const data = {
                value,
                timestamp: Date.now(),
                expires: expiresIn ? Date.now() + expiresIn : null
            };
            this.localStorage.setItem(fullKey, JSON.stringify(data));
            this.logger.debug(`LocalStorage 已設置: ${key}`);
            return true;
        } catch (error) {
            this.logger.error(`LocalStorage 設置失敗: ${key}`, error);
            return false;
        }
    }

    /**
     * 獲取 localStorage 項目
     */
    getLocal(key, defaultValue = null) {
        try {
            const fullKey = this.getKey(key);
            const serialized = this.localStorage.getItem(fullKey);

            if (!serialized) {
                return defaultValue;
            }

            const data = safeJsonParse(serialized);

            if (!data) {
                return defaultValue;
            }

            // 檢查是否過期
            if (data.expires && Date.now() > data.expires) {
                this.removeLocal(key);
                this.logger.debug(`LocalStorage 項目已過期: ${key}`);
                return defaultValue;
            }

            return data.value;
        } catch (error) {
            this.logger.error(`LocalStorage 讀取失敗: ${key}`, error);
            return defaultValue;
        }
    }

    /**
     * 刪除 localStorage 項目
     */
    removeLocal(key) {
        try {
            const fullKey = this.getKey(key);
            this.localStorage.removeItem(fullKey);
            this.logger.debug(`LocalStorage 已刪除: ${key}`);
            return true;
        } catch (error) {
            this.logger.error(`LocalStorage 刪除失敗: ${key}`, error);
            return false;
        }
    }

    /**
     * 清除所有 session 數據
     */
    clearSession() {
        try {
            const keys = [];
            for (let i = 0; i < this.sessionStorage.length; i++) {
                const key = this.sessionStorage.key(i);
                if (key && key.startsWith(this.prefix)) {
                    keys.push(key);
                }
            }

            keys.forEach(key => this.sessionStorage.removeItem(key));
            this.logger.info(`已清除 ${keys.length} 個 SessionStorage 項目`);
            return true;
        } catch (error) {
            this.logger.error('SessionStorage 清除失敗', error);
            return false;
        }
    }

    /**
     * 清除所有 local 數據
     */
    clearLocal() {
        try {
            const keys = [];
            for (let i = 0; i < this.localStorage.length; i++) {
                const key = this.localStorage.key(i);
                if (key && key.startsWith(this.prefix)) {
                    keys.push(key);
                }
            }

            keys.forEach(key => this.localStorage.removeItem(key));
            this.logger.info(`已清除 ${keys.length} 個 LocalStorage 項目`);
            return true;
        } catch (error) {
            this.logger.error('LocalStorage 清除失敗', error);
            return false;
        }
    }

    /**
     * 清除所有數據
     */
    clearAll() {
        this.clearSession();
        this.clearLocal();
    }

    // === 便捷方法 ===

    /**
     * 保存認證 Token（使用 sessionStorage）
     */
    setAuthToken(token) {
        return this.setSession('auth_token', token);
    }

    /**
     * 獲取認證 Token
     */
    getAuthToken() {
        return this.getSession('auth_token');
    }

    /**
     * 刪除認證 Token
     */
    removeAuthToken() {
        return this.removeSession('auth_token');
    }

    /**
     * 保存用戶資料（使用 sessionStorage）
     */
    setUserProfile(profile) {
        return this.setSession('user_profile', profile);
    }

    /**
     * 獲取用戶資料
     */
    getUserProfile() {
        return this.getSession('user_profile');
    }

    /**
     * 刪除用戶資料
     */
    removeUserProfile() {
        return this.removeSession('user_profile');
    }

    /**
     * 保存用戶偏好設定（使用 localStorage，7天過期）
     */
    setUserPreferences(preferences) {
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        return this.setLocal('user_preferences', preferences, sevenDays);
    }

    /**
     * 獲取用戶偏好設定
     */
    getUserPreferences() {
        return this.getLocal('user_preferences', {});
    }

    /**
     * 保存投注草稿（使用 sessionStorage）
     */
    setBetDraft(bets) {
        return this.setSession('bet_draft', bets);
    }

    /**
     * 獲取投注草稿
     */
    getBetDraft() {
        return this.getSession('bet_draft', []);
    }

    /**
     * 清除投注草稿
     */
    clearBetDraft() {
        return this.removeSession('bet_draft');
    }

    /**
     * 保存最後查看的標籤
     */
    setLastTab(tab) {
        return this.setSession('last_tab', tab);
    }

    /**
     * 獲取最後查看的標籤
     */
    getLastTab() {
        return this.getSession('last_tab', 'gaming');
    }
}

export default StorageService;
