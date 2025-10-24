/**
 * 遊戲狀態管理器
 * 處理遊戲回合、倒數計時和結果顯示
 */

import { formatCountdown, formatDateTime } from '../core/Utils.js';
import Logger from '../core/Logger.js';
import eventBus, { Events } from '../core/EventBus.js';

class GameManager {
    constructor(config, apiService, socketService) {
        this.config = config;
        this.api = apiService;
        this.socket = socketService;
        this.logger = new Logger('GameManager', config);

        // 遊戲狀態
        this.gameState = {
            currentRound: null,
            roundStatus: 'waiting', // waiting, betting, closed, finished
            timeLeft: 0,
            canBet: false,
            lastResults: []
        };

        this.timerInterval = null;
    }

    /**
     * 初始化
     */
    async init() {
        this.logger.info('初始化遊戲管理器');

        try {
            // 載入當前回合
            await this.loadCurrentRound();

            // 載入最近結果
            await this.loadRecentResults();

            // 設置事件監聽器
            this.setupEventListeners();

            // 啟動計時器
            this.startTimer();

            this.logger.info('遊戲管理器初始化完成');
        } catch (error) {
            this.logger.error('遊戲管理器初始化失敗', error);
            throw error;
        }
    }

    /**
     * 設置事件監聽器
     */
    setupEventListeners() {
        // 回合開始
        eventBus.on(Events.GAME_ROUND_STARTED, (data) => {
            this.handleRoundStarted(data);
        });

        // 投注封盤
        eventBus.on(Events.GAME_BETTING_CLOSED, (data) => {
            this.handleBettingClosed(data);
        });

        // 開獎結果
        eventBus.on(Events.GAME_RESULT_CONFIRMED, (data) => {
            this.handleResultConfirmed(data);
        });
    }

    /**
     * 載入當前回合
     */
    async loadCurrentRound() {
        try {
            const data = await this.api.getCurrentRound();

            if (data.round) {
                this.gameState.currentRound = data.round;
                this.gameState.roundStatus = data.round.status;
                this.gameState.canBet = data.round.status === 'betting';

                // 計算剩餘時間
                if (data.round.bettingEndTime) {
                    const endTime = new Date(data.round.bettingEndTime).getTime();
                    const now = Date.now();
                    this.gameState.timeLeft = Math.max(0, Math.floor((endTime - now) / 1000));
                }

                this.logger.info('當前回合已載入', {
                    roundId: data.round.roundId,
                    roundNumber: data.round.roundNumber,
                    status: data.round.status
                });

                eventBus.emit(Events.GAME_STATE_CHANGED, this.gameState);
            }
        } catch (error) {
            this.logger.error('載入當前回合失敗', error);
        }
    }

    /**
     * 載入最近結果
     */
    async loadRecentResults(limit = 10) {
        try {
            const data = await this.api.getGameResults(1, limit);
            this.gameState.lastResults = data.results || [];

            this.logger.debug(`載入 ${this.gameState.lastResults.length} 筆歷史結果`);
        } catch (error) {
            this.logger.error('載入歷史結果失敗', error);
        }
    }

    /**
     * 處理回合開始
     */
    handleRoundStarted(data) {
        this.gameState.currentRound = data;
        this.gameState.roundStatus = 'betting';
        this.gameState.canBet = true;

        // 計算倒數時間
        if (data.bettingEndTime) {
            const endTime = new Date(data.bettingEndTime).getTime();
            const now = Date.now();
            this.gameState.timeLeft = Math.max(0, Math.floor((endTime - now) / 1000));
        }

        this.logger.info('處理回合開始', {
            roundId: data.roundId,
            roundNumber: data.roundNumber,
            timeLeft: this.gameState.timeLeft
        });

        eventBus.emit(Events.GAME_BETTING_OPENED, this.gameState);
        eventBus.emit(Events.GAME_STATE_CHANGED, this.gameState);
    }

    /**
     * 處理投注封盤
     */
    handleBettingClosed(data) {
        this.gameState.roundStatus = 'closed';
        this.gameState.canBet = false;
        this.gameState.timeLeft = 0;

        this.logger.info('投注已封盤', { roundId: data.roundId });

        eventBus.emit(Events.GAME_STATE_CHANGED, this.gameState);
    }

    /**
     * 處理開獎結果
     */
    async handleResultConfirmed(data) {
        this.gameState.roundStatus = 'finished';
        this.gameState.canBet = false;

        this.logger.info('開獎結果確認', {
            roundId: data.roundId,
            results: data.results
        });

        // 更新最近結果
        this.gameState.lastResults.unshift({
            roundId: data.roundId,
            roundNumber: data.roundNumber,
            results: data.results,
            timestamp: data.timestamp || new Date().toISOString()
        });

        // 保持最多 20 筆記錄
        if (this.gameState.lastResults.length > 20) {
            this.gameState.lastResults = this.gameState.lastResults.slice(0, 20);
        }

        eventBus.emit(Events.GAME_STATE_CHANGED, this.gameState);

        // 顯示結果
        this.showResultNotification(data);
    }

    /**
     * 啟動倒數計時器
     */
    startTimer() {
        if (this.timerInterval) {
            return;
        }

        this.timerInterval = setInterval(() => {
            if (this.gameState.timeLeft > 0) {
                this.gameState.timeLeft--;

                // 發布倒數更新
                eventBus.emit('game:timer:tick', {
                    timeLeft: this.gameState.timeLeft,
                    formatted: formatCountdown(this.gameState.timeLeft)
                });

                // 時間到，封盤
                if (this.gameState.timeLeft === 0) {
                    this.gameState.canBet = false;
                    this.gameState.roundStatus = 'closed';
                    eventBus.emit(Events.GAME_STATE_CHANGED, this.gameState);
                }
            }
        }, 1000);

        this.logger.debug('倒數計時器已啟動');
    }

    /**
     * 停止計時器
     */
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
            this.logger.debug('倒數計時器已停止');
        }
    }

    /**
     * 顯示結果通知
     */
    showResultNotification(data) {
        if (!data.results || data.results.length === 0) {
            return;
        }

        const resultText = `第 ${data.roundNumber} 期開獎結果：\n` +
            `${data.results.slice(0, 3).join(', ')}...`;

        eventBus.emit('ui:toast:show', {
            message: resultText,
            type: 'info',
            duration: 5000
        });
    }

    /**
     * 獲取遊戲狀態
     */
    getGameState() {
        return { ...this.gameState };
    }

    /**
     * 是否可以投注
     */
    canBet() {
        return this.gameState.canBet && this.gameState.timeLeft > 0;
    }

    /**
     * 獲取當前回合
     */
    getCurrentRound() {
        return this.gameState.currentRound;
    }

    /**
     * 獲取剩餘時間
     */
    getTimeLeft() {
        return this.gameState.timeLeft;
    }

    /**
     * 獲取最近結果
     */
    getRecentResults() {
        return [...this.gameState.lastResults];
    }

    /**
     * 清理資源
     */
    destroy() {
        this.stopTimer();
        this.logger.info('遊戲管理器已清理');
    }
}

export default GameManager;
