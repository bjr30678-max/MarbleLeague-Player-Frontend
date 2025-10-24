/**
 * 投注管理器
 * 處理所有投注相關邏輯
 */

import { formatNumber, calculateExpectedWin, formatBetContent, validateBetAmount } from '../core/Utils.js';
import Logger from '../core/Logger.js';
import eventBus, { Events } from '../core/EventBus.js';

class BettingManager {
    constructor(config, apiService, storageService, authService) {
        this.config = config;
        this.api = apiService;
        this.storage = storageService;
        this.auth = authService;
        this.logger = new Logger('BettingManager', config);

        // 狀態
        this.currentBets = [];
        this.currentCategory = 'position';
        this.currentBetAmount = config.get('defaultBetAmount', 100);
        this.bettingLimits = {};
        this.betOptions = null;
        this.userPeriodStats = null;
        this.currentRound = null;

        // 綁定方法
        this.init = this.init.bind(this);
    }

    /**
     * 初始化
     */
    async init() {
        this.logger.info('初始化投注管理器');

        try {
            // 載入配置和選項
            await Promise.all([
                this.loadBettingLimits(),
                this.loadBetOptions()
            ]);

            // 恢復草稿
            this.restoreDraft();

            // 監聽事件
            this.setupEventListeners();

            this.logger.info('投注管理器初始化完成');
        } catch (error) {
            this.logger.error('投注管理器初始化失敗', error);
            throw error;
        }
    }

    /**
     * 設置事件監聽器
     */
    setupEventListeners() {
        // 監聽回合變更
        eventBus.on(Events.GAME_ROUND_STARTED, (data) => {
            this.handleRoundStarted(data);
        });

        // 監聽投注封盤
        eventBus.on(Events.GAME_BETTING_CLOSED, () => {
            this.clearBets();
        });

        // 監聽用戶餘額更新
        eventBus.on(Events.USER_BALANCE_UPDATED, () => {
            this.updateBetSummary();
        });
    }

    /**
     * 處理新回合開始
     */
    async handleRoundStarted(data) {
        this.currentRound = data;
        this.logger.info('新回合開始', { roundId: data.roundId });

        // 清空上一期投注
        this.clearBets();

        // 重新載入限額和選項
        await Promise.all([
            this.loadUserPeriodStats(data.roundId),
            this.loadBetOptions()
        ]);
    }

    /**
     * 載入投注限額
     */
    async loadBettingLimits() {
        try {
            const data = await this.api.getBettingLimits();
            this.bettingLimits = data.limits;
            this.logger.debug('投注限額已載入', this.bettingLimits);
        } catch (error) {
            this.logger.error('載入投注限額失敗', error);
        }
    }

    /**
     * 載入投注選項和賠率
     */
    async loadBetOptions() {
        try {
            const data = await this.api.getBetOptions();
            this.betOptions = data;
            this.logger.debug('投注選項已載入');
        } catch (error) {
            this.logger.error('載入投注選項失敗', error);
        }
    }

    /**
     * 載入用戶當期統計
     */
    async loadUserPeriodStats(roundId) {
        try {
            const data = await this.api.getUserPeriodStats(roundId);
            this.userPeriodStats = data;
            this.logger.debug('用戶當期統計已載入', data);
        } catch (error) {
            this.logger.error('載入用戶當期統計失敗', error);
        }
    }

    /**
     * 添加投注
     */
    addBet(betType, betContent, position = null) {
        // 檢查用戶是否可以投注
        if (!this.auth.canBet()) {
            this.showError('您已被禁止投注');
            return false;
        }

        // 驗證投注金額
        const validation = validateBetAmount(this.currentBetAmount);
        if (!validation.valid) {
            this.showError(validation.error);
            return false;
        }

        // 檢查限額
        if (!this.checkBettingLimit(betType, this.currentBetAmount)) {
            return false;
        }

        // 檢查是否重複
        const existingIndex = this.findBetIndex(betType, betContent, position);
        if (existingIndex !== -1) {
            // 更新金額
            this.currentBets[existingIndex].betAmount = this.currentBetAmount;
            this.logger.debug('更新投注', { betType, betContent, position });
        } else {
            // 添加新投注
            const bet = {
                betType,
                betContent,
                position,
                betAmount: this.currentBetAmount,
                odds: this.getOdds(betType, betContent, position)
            };

            this.currentBets.push(bet);
            this.logger.debug('添加投注', bet);
        }

        // 保存草稿
        this.saveDraft();

        // 發布事件
        eventBus.emit(Events.BET_ADDED, { betType, betContent, position });

        // 更新顯示
        this.updateBetSummary();

        return true;
    }

    /**
     * 移除投注
     */
    removeBet(index) {
        if (index < 0 || index >= this.currentBets.length) {
            return false;
        }

        const bet = this.currentBets[index];
        this.currentBets.splice(index, 1);

        this.logger.debug('移除投注', bet);

        // 保存草稿
        this.saveDraft();

        // 發布事件
        eventBus.emit(Events.BET_REMOVED, bet);

        // 更新顯示
        this.updateBetSummary();

        return true;
    }

    /**
     * 清空所有投注
     */
    clearBets() {
        this.currentBets = [];
        this.storage.clearBetDraft();

        this.logger.debug('清空所有投注');

        eventBus.emit(Events.BET_CLEARED);
        this.updateBetSummary();
    }

    /**
     * 提交所有投注
     */
    async submitBets() {
        if (this.currentBets.length === 0) {
            this.showError('請先選擇投注項目');
            return false;
        }

        // 檢查用戶是否可以投注
        if (!this.auth.canBet()) {
            this.showError('您已被禁止投注');
            return false;
        }

        // 檢查回合狀態
        if (!this.currentRound) {
            this.showError('無法獲取當前回合資訊');
            return false;
        }

        try {
            // 顯示確認對話框
            const confirmed = await this.showConfirmModal();
            if (!confirmed) {
                return false;
            }

            this.logger.info(`提交 ${this.currentBets.length} 筆投注`);

            eventBus.emit(Events.UI_LOADING_START);

            // 格式化投注數據
            const bets = this.currentBets.map(bet => ({
                betType: bet.betType,
                betContent: bet.betContent,
                position: bet.position,
                betAmount: bet.betAmount
            }));

            // 提交到後端
            const response = await this.api.submitBets(bets);

            if (response.success) {
                this.logger.info('投注成功', {
                    betCount: response.betCount,
                    totalAmount: response.totalAmount
                });

                // 清空投注
                this.clearBets();

                // 發布成功事件
                eventBus.emit(Events.BET_SUCCESS, response);

                // 顯示成功訊息
                this.showSuccess(
                    `投注成功！\n` +
                    `數量: ${response.betCount} 筆\n` +
                    `金額: ${formatNumber(response.totalAmount)} 積分\n` +
                    `剩餘積分: ${formatNumber(response.balance)}`
                );

                // 發送 LINE 訊息
                if (this.config.get('features.sendLineMessages')) {
                    await this.auth.sendLineMessage(
                        `投注成功！\n` +
                        `期數: ${this.currentRound.roundNumber}\n` +
                        `數量: ${response.betCount} 筆\n` +
                        `金額: ${formatNumber(response.totalAmount)} 積分`
                    );
                }

                // 更新用戶餘額
                eventBus.emit(Events.USER_BALANCE_UPDATED, response.balance);

                return true;
            } else {
                throw new Error(response.message || '投注失敗');
            }
        } catch (error) {
            this.logger.error('提交投注失敗', error);
            eventBus.emit(Events.BET_FAILED, error);
            this.showError(`投注失敗: ${error.message}`);
            return false;
        } finally {
            eventBus.emit(Events.UI_LOADING_END);
        }
    }

    /**
     * 檢查投注限額
     */
    checkBettingLimit(betType, betAmount) {
        const limit = this.bettingLimits[betType];

        if (!limit) {
            this.logger.warn('找不到投注限額設定', { betType });
            return true; // 如果沒有限額，允許投注
        }

        // 檢查最小/最大金額
        if (betAmount < limit.minAmount) {
            this.showError(`最小投注金額為 ${formatNumber(limit.minAmount)}`);
            return false;
        }

        if (betAmount > limit.maxAmount) {
            this.showError(`最大投注金額為 ${formatNumber(limit.maxAmount)}`);
            return false;
        }

        // 檢查單期限額
        let currentTypeTotal = 0;
        this.currentBets.forEach(bet => {
            if (bet.betType === betType) {
                currentTypeTotal += bet.betAmount;
            }
        });

        let periodUsed = 0;
        if (this.userPeriodStats?.limits?.[betType]) {
            periodUsed = this.userPeriodStats.limits[betType].used || 0;
        }

        const totalWouldUse = periodUsed + currentTypeTotal + betAmount;

        if (limit.maxPerPeriod && totalWouldUse > limit.maxPerPeriod) {
            const remaining = limit.maxPerPeriod - periodUsed - currentTypeTotal;
            this.showError(
                remaining <= 0
                    ? `已達單期限額 ${formatNumber(limit.maxPerPeriod)} 積分`
                    : `單期限額剩餘 ${formatNumber(remaining)} 積分`
            );
            return false;
        }

        return true;
    }

    /**
     * 獲取賠率
     */
    getOdds(betType, betContent, position) {
        if (!this.betOptions) {
            return 1;
        }

        try {
            switch (betType) {
                case 'position':
                    return this.betOptions.positions?.[position - 1]?.odds || 1;

                case 'sum_value':
                    const sumValue = this.betOptions.sumValues?.find(
                        v => v.value === betContent[0]
                    );
                    return sumValue?.odds || 1;

                case 'sum_big':
                case 'sum_small':
                case 'sum_odd':
                case 'sum_even':
                    const sumOption = this.betOptions.sumOptions?.find(
                        opt => opt.type === betType
                    );
                    return sumOption?.odds || 1;

                case 'big':
                case 'small':
                case 'odd':
                case 'even':
                    const posOption = this.betOptions.positionOptions?.[position - 1];
                    return posOption?.[betType]?.odds || 1;

                case 'dragon':
                case 'tiger':
                    return this.betOptions.dragonTiger?.[position - 1]?.odds || 1;

                default:
                    return 1;
            }
        } catch (error) {
            this.logger.error('獲取賠率失敗', error);
            return 1;
        }
    }

    /**
     * 查找投注索引
     */
    findBetIndex(betType, betContent, position) {
        return this.currentBets.findIndex(bet =>
            bet.betType === betType &&
            JSON.stringify(bet.betContent) === JSON.stringify(betContent) &&
            bet.position === position
        );
    }

    /**
     * 更新投注摘要顯示
     */
    updateBetSummary() {
        const summary = this.getBetSummary();
        eventBus.emit('betting:summary:updated', summary);
    }

    /**
     * 獲取投注摘要
     */
    getBetSummary() {
        const totalAmount = this.currentBets.reduce(
            (sum, bet) => sum + bet.betAmount,
            0
        );

        const totalExpectedWin = this.currentBets.reduce(
            (sum, bet) => sum + calculateExpectedWin(bet.betAmount, bet.odds),
            0
        );

        return {
            count: this.currentBets.length,
            totalAmount,
            totalExpectedWin,
            bets: this.currentBets.map((bet, index) => ({
                index,
                description: formatBetContent(bet.betType, bet.betContent, bet.position),
                betAmount: bet.betAmount,
                odds: bet.odds,
                expectedWin: calculateExpectedWin(bet.betAmount, bet.odds)
            }))
        };
    }

    /**
     * 保存草稿
     */
    saveDraft() {
        this.storage.setBetDraft(this.currentBets);
    }

    /**
     * 恢復草稿
     */
    restoreDraft() {
        const draft = this.storage.getBetDraft();
        if (draft && Array.isArray(draft) && draft.length > 0) {
            this.currentBets = draft;
            this.logger.info(`恢復 ${draft.length} 筆投注草稿`);
            this.updateBetSummary();
        }
    }

    /**
     * 設定投注金額
     */
    setBetAmount(amount) {
        const validation = validateBetAmount(amount);
        if (!validation.valid) {
            this.showError(validation.error);
            return false;
        }

        this.currentBetAmount = amount;
        this.logger.debug('設定投注金額', { amount });
        return true;
    }

    /**
     * 獲取當前投注金額
     */
    getBetAmount() {
        return this.currentBetAmount;
    }

    /**
     * 獲取當前投注列表
     */
    getCurrentBets() {
        return [...this.currentBets];
    }

    /**
     * 顯示確認對話框
     */
    async showConfirmModal() {
        const summary = this.getBetSummary();

        return new Promise((resolve) => {
            eventBus.emit('ui:confirm:show', {
                title: '確認投注',
                message: `確定要提交 ${summary.count} 筆投注嗎？\n` +
                    `總金額: ${formatNumber(summary.totalAmount)} 積分\n` +
                    `預期贏得: ${formatNumber(summary.totalExpectedWin)} 積分`,
                onConfirm: () => resolve(true),
                onCancel: () => resolve(false)
            });
        });
    }

    /**
     * 顯示錯誤訊息
     */
    showError(message) {
        eventBus.emit('ui:toast:show', { message, type: 'error' });
    }

    /**
     * 顯示成功訊息
     */
    showSuccess(message) {
        eventBus.emit('ui:toast:show', { message, type: 'success' });
    }

    /**
     * 清理資源
     */
    destroy() {
        this.clearBets();
        this.logger.info('投注管理器已清理');
    }
}

export default BettingManager;
