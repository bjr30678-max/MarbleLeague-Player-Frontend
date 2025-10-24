/**
 * API 服務
 * 封裝所有 API 請求，統一錯誤處理
 */

import { retryWithBackoff } from '../core/Utils.js';
import Logger from '../core/Logger.js';
import eventBus, { Events } from '../core/EventBus.js';

class ApiService {
    constructor(config, storageService) {
        this.config = config;
        this.storage = storageService;
        this.logger = new Logger('ApiService', config);
        this.baseUrl = config.get('apiUrl');
    }

    /**
     * 獲取認證標頭
     */
    getAuthHeaders() {
        const token = this.storage.getAuthToken();
        const headers = {
            'Content-Type': 'application/json'
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        return headers;
    }

    /**
     * 發送 API 請求
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;

        const requestOptions = {
            headers: this.getAuthHeaders(),
            ...options
        };

        this.logger.debug(`API 請求: ${options.method || 'GET'} ${endpoint}`);

        try {
            const response = await fetch(url, requestOptions);

            // 處理認證失敗
            if (response.status === 401 || response.status === 403) {
                this.logger.warn('認證失敗，清除 Token');
                this.storage.removeAuthToken();
                this.storage.removeUserProfile();
                eventBus.emit(Events.AUTH_TOKEN_EXPIRED);
                throw new Error('認證已過期，請重新登入');
            }

            // 處理其他錯誤
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.message ||
                    errorData.error ||
                    `API 錯誤: ${response.status}`
                );
            }

            const data = await response.json();
            this.logger.debug(`API 回應: ${endpoint}`, { status: response.status });

            return data;
        } catch (error) {
            this.logger.error(`API 請求失敗: ${endpoint}`, error);

            // 發布錯誤事件
            eventBus.emit(Events.ERROR_API, { endpoint, error });

            throw error;
        }
    }

    /**
     * GET 請求
     */
    async get(endpoint) {
        return this.request(endpoint, {
            method: 'GET'
        });
    }

    /**
     * POST 請求
     */
    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * PUT 請求
     */
    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE 請求
     */
    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }

    /**
     * 帶重試的請求
     */
    async requestWithRetry(endpoint, options = {}, maxAttempts = 3) {
        return retryWithBackoff(
            () => this.request(endpoint, options),
            maxAttempts,
            1000,
            (attempt, max, delay, error) => {
                this.logger.warn(
                    `API 重試 ${attempt}/${max}，延遲 ${delay}ms`,
                    { endpoint, error: error.message }
                );
            }
        );
    }

    // ===== 認證 API =====

    /**
     * LINE LIFF 登入
     */
    async liffLogin(profileData) {
        this.logger.info('開始 LIFF 登入');

        const response = await this.post('/api/auth/liff-login', {
            userId: profileData.userId,
            displayName: profileData.displayName,
            pictureUrl: profileData.pictureUrl,
            accessToken: profileData.accessToken
        });

        if (response.token) {
            this.storage.setAuthToken(response.token);
            this.logger.info('登入成功，Token 已保存');
        }

        return response;
    }

    // ===== 用戶 API =====

    /**
     * 獲取用戶資料
     */
    async getUserProfile() {
        return this.get('/api/users/profile');
    }

    /**
     * 獲取用戶積分
     */
    async getUserBalance(userId) {
        return this.get(`/api/points/balance/${userId}`);
    }

    // ===== 遊戲 API =====

    /**
     * 獲取當前回合
     */
    async getCurrentRound() {
        return this.get('/api/game/current-round');
    }

    /**
     * 獲取投注選項和賠率
     */
    async getBetOptions() {
        return this.get('/api/game/bet-options');
    }

    /**
     * 獲取投注限額
     */
    async getBettingLimits() {
        return this.get('/api/game/betting-limits');
    }

    /**
     * 獲取用戶當期統計
     */
    async getUserPeriodStats(roundId) {
        return this.get(`/api/game/user-period-stats?roundId=${roundId}`);
    }

    /**
     * 獲取盤口限額狀態
     */
    async getMarketStatus(betType, betContent, position) {
        const params = new URLSearchParams({
            betContent: JSON.stringify(betContent)
        });

        if (position !== null && position !== undefined) {
            params.append('position', position);
        }

        return this.get(`/api/game/market-status/${betType}?${params}`);
    }

    /**
     * 批量提交投注
     */
    async submitBets(bets) {
        this.logger.info(`提交 ${bets.length} 筆投注`);

        return this.post('/api/game/batch-play', { bets });
    }

    /**
     * 獲取遊戲歷史
     */
    async getGameHistory(page = 1, limit = 20) {
        return this.get(`/api/game/history?page=${page}&limit=${limit}`);
    }

    /**
     * 獲取開獎結果
     */
    async getGameResults(page = 1, limit = 10) {
        return this.get(`/api/game/results?page=${page}&limit=${limit}`);
    }

    /**
     * 獲取用戶投注記錄
     */
    async getUserBets(roundId = null) {
        const url = roundId
            ? `/api/game/user-bets?roundId=${roundId}`
            : '/api/game/user-bets';

        return this.get(url);
    }

    // ===== 健康檢查 =====

    /**
     * 檢查 API 健康狀態
     */
    async healthCheck() {
        try {
            const response = await fetch(`${this.baseUrl}/health`, {
                method: 'GET',
                timeout: 5000
            });

            return response.ok;
        } catch (error) {
            this.logger.error('健康檢查失敗', error);
            return false;
        }
    }
}

export default ApiService;
