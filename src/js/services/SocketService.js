/**
 * WebSocket 服務
 * 處理實時遊戲狀態更新
 */

import Logger from '../core/Logger.js';
import eventBus, { Events } from '../core/EventBus.js';

class SocketService {
    constructor(config, storageService) {
        this.config = config;
        this.storage = storageService;
        this.logger = new Logger('SocketService', config);

        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
        this.reconnectTimer = null;
    }

    /**
     * 連接 WebSocket
     */
    connect() {
        if (this.socket && this.isConnected) {
            this.logger.warn('WebSocket 已連接');
            return;
        }

        const apiUrl = this.config.get('apiUrl');
        const token = this.storage.getAuthToken();

        if (!token) {
            this.logger.error('無認證 Token，無法連接 WebSocket');
            return;
        }

        this.logger.info('連接 WebSocket', { apiUrl });

        try {
            // 使用 Socket.IO 連接
            this.socket = io(apiUrl, {
                auth: { token },
                transports: ['websocket', 'polling'],
                reconnection: false // 我們自己處理重連
            });

            this.setupEventHandlers();
        } catch (error) {
            this.logger.error('WebSocket 連接失敗', error);
            this.scheduleReconnect();
        }
    }

    /**
     * 設置事件處理器
     */
    setupEventHandlers() {
        // 連接成功
        this.socket.on('connect', () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.logger.info('WebSocket 已連接', {
                socketId: this.socket.id
            });
        });

        // 連接錯誤
        this.socket.on('connect_error', (error) => {
            this.logger.error('WebSocket 連接錯誤', error);
            this.isConnected = false;
            this.scheduleReconnect();
        });

        // 斷開連接
        this.socket.on('disconnect', (reason) => {
            this.isConnected = false;
            this.logger.warn('WebSocket 已斷開', { reason });

            // 如果不是主動斷開，嘗試重連
            if (reason !== 'io client disconnect') {
                this.scheduleReconnect();
            }
        });

        // 遊戲事件
        this.setupGameEventHandlers();
    }

    /**
     * 設置遊戲事件處理器
     */
    setupGameEventHandlers() {
        // 回合開始
        this.socket.on('round-started', (data) => {
            this.logger.info('回合開始', {
                roundId: data.roundId,
                roundNumber: data.roundNumber
            });

            eventBus.emit(Events.GAME_ROUND_STARTED, data);
        });

        // 投注開放
        this.socket.on('betting-opened', (data) => {
            this.logger.info('投注開放', { roundId: data.roundId });
            eventBus.emit(Events.GAME_BETTING_OPENED, data);
        });

        // 投注封盤
        this.socket.on('betting-closed', (data) => {
            this.logger.info('投注封盤', { roundId: data.roundId });
            eventBus.emit(Events.GAME_BETTING_CLOSED, data);
        });

        // 開獎結果
        this.socket.on('result-confirmed', (data) => {
            this.logger.info('開獎結果確認', {
                roundId: data.roundId,
                results: data.results
            });

            eventBus.emit(Events.GAME_RESULT_CONFIRMED, data);
        });

        // 新投注通知（可選）
        this.socket.on('new-bet', (data) => {
            this.logger.debug('新投注通知', {
                roundId: data.roundId,
                betType: data.betType
            });
        });

        // 直播狀態更新
        this.socket.on('live-status-changed', (data) => {
            this.logger.info('直播狀態變更', { status: data.status });
            eventBus.emit(Events.LIVE_STATE_CHANGED, data);
        });
    }

    /**
     * 安排重新連接
     */
    scheduleReconnect() {
        if (this.reconnectTimer) {
            return;
        }

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logger.error('已達最大重連次數，停止重連');
            eventBus.emit(Events.ERROR_NETWORK, {
                message: 'WebSocket 連接失敗，請重新整理頁面'
            });
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

        this.logger.info(
            `安排重連 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
            { delay }
        );

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, delay);
    }

    /**
     * 發送事件到伺服器
     */
    emit(event, data) {
        if (!this.socket || !this.isConnected) {
            this.logger.warn('WebSocket 未連接，無法發送事件', { event });
            return false;
        }

        this.logger.debug('發送事件', { event, data });
        this.socket.emit(event, data);
        return true;
    }

    /**
     * 監聽自訂事件
     */
    on(event, callback) {
        if (!this.socket) {
            this.logger.warn('WebSocket 未初始化');
            return;
        }

        this.socket.on(event, callback);
    }

    /**
     * 取消監聽事件
     */
    off(event, callback) {
        if (!this.socket) {
            return;
        }

        if (callback) {
            this.socket.off(event, callback);
        } else {
            this.socket.off(event);
        }
    }

    /**
     * 斷開連接
     */
    disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.socket) {
            this.logger.info('主動斷開 WebSocket');
            this.socket.disconnect();
            this.socket = null;
        }

        this.isConnected = false;
        this.reconnectAttempts = 0;
    }

    /**
     * 檢查連接狀態
     */
    isSocketConnected() {
        return this.isConnected && this.socket && this.socket.connected;
    }

    /**
     * 重新連接
     */
    reconnect() {
        this.logger.info('手動重新連接');
        this.disconnect();
        this.reconnectAttempts = 0;
        this.connect();
    }

    /**
     * 清理資源
     */
    destroy() {
        this.disconnect();
        this.logger.info('WebSocket 服務已清理');
    }
}

export default SocketService;
