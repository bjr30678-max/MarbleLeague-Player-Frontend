/**
 * UI 管理器
 * 處理所有 UI 更新和用戶交互
 */

import { formatNumber, formatCountdown, formatDateTime, debounce } from '../core/Utils.js';
import Logger from '../core/Logger.js';
import eventBus, { Events } from '../core/EventBus.js';

class UIManager {
    constructor(config) {
        this.config = config;
        this.logger = new Logger('UIManager', config);

        this.currentTab = 'gaming';
        this.elements = {};
    }

    /**
     * 初始化
     */
    init() {
        this.logger.info('初始化 UI 管理器');

        // 快取 DOM 元素
        this.cacheElements();

        // 設置事件監聽器
        this.setupEventListeners();

        // 設置 UI 事件監聽器
        this.setupUIEventHandlers();

        this.logger.info('UI 管理器初始化完成');
    }

    /**
     * 快取 DOM 元素
     */
    cacheElements() {
        this.elements = {
            // Header
            userAvatar: document.getElementById('userAvatar'),
            userName: document.getElementById('userName'),
            userBalance: document.getElementById('userBalance'),

            // Tabs
            tabs: document.querySelectorAll('.nav-tab'),
            pages: document.querySelectorAll('.page'),

            // 遊戲頁面
            roundDisplay: document.getElementById('roundDisplay'),
            countdown: document.getElementById('countdown'),
            bettingArea: document.getElementById('bettingArea'),
            betSummary: document.getElementById('betSummary'),
            submitBtn: document.getElementById('submitBtn'),

            // 直播頁面
            liveStatus: document.getElementById('liveStatus'),
            livePlayer: document.getElementById('livePlayer'),

            // Modal
            modal: document.getElementById('modal'),
            modalContent: document.getElementById('modalContent'),

            // Toast
            toast: document.getElementById('toast')
        };
    }

    /**
     * 設置事件監聽器
     */
    setupEventListeners() {
        // 標籤切換
        this.elements.tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // 提交投注按鈕
        if (this.elements.submitBtn) {
            this.elements.submitBtn.addEventListener('click', () => {
                eventBus.emit('betting:submit');
            });
        }
    }

    /**
     * 設置 UI 事件處理器
     */
    setupUIEventHandlers() {
        // 用戶資料更新
        eventBus.on(Events.USER_PROFILE_UPDATED, (profile) => {
            this.updateUserProfile(profile);
        });

        // 餘額更新
        eventBus.on(Events.USER_BALANCE_UPDATED, (balance) => {
            this.updateBalance(balance);
        });

        // 遊戲狀態更新
        eventBus.on(Events.GAME_STATE_CHANGED, (state) => {
            this.updateGameState(state);
        });

        // 倒數計時
        eventBus.on('game:timer:tick', (data) => {
            this.updateCountdown(data.timeLeft);
        });

        // 投注摘要更新
        eventBus.on('betting:summary:updated', (summary) => {
            this.updateBetSummary(summary);
        });

        // 直播狀態更新
        eventBus.on(Events.LIVE_STATE_CHANGED, (status) => {
            this.updateLiveStatus(status);
        });

        // Toast 訊息
        eventBus.on('ui:toast:show', (data) => {
            this.showToast(data.message, data.type, data.duration);
        });

        // 確認對話框
        eventBus.on('ui:confirm:show', (data) => {
            this.showConfirmModal(data);
        });

        // Loading
        eventBus.on(Events.UI_LOADING_START, () => {
            this.showLoading();
        });

        eventBus.on(Events.UI_LOADING_END, () => {
            this.hideLoading();
        });

        // 禁投用戶
        eventBus.on(Events.USER_BETTING_DISABLED, () => {
            this.showBettingDisabledBanner();
        });
    }

    /**
     * 切換標籤
     */
    switchTab(tabName) {
        this.currentTab = tabName;

        // 更新標籤樣式
        this.elements.tabs.forEach(tab => {
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // 顯示對應頁面
        this.elements.pages.forEach(page => {
            if (page.id === tabName) {
                page.classList.add('active');
            } else {
                page.classList.remove('active');
            }
        });

        this.logger.debug('切換標籤', { tabName });
        eventBus.emit(Events.UI_TAB_CHANGED, tabName);
    }

    /**
     * 更新用戶資料
     */
    updateUserProfile(profile) {
        if (this.elements.userAvatar) {
            this.elements.userAvatar.src = profile.pictureUrl || 'https://via.placeholder.com/40';
        }

        if (this.elements.userName) {
            this.elements.userName.textContent = profile.displayName || '用戶';
        }

        this.logger.debug('用戶資料已更新');
    }

    /**
     * 更新餘額
     */
    updateBalance(balance) {
        if (this.elements.userBalance) {
            this.elements.userBalance.textContent = formatNumber(balance);
        }
    }

    /**
     * 更新遊戲狀態
     */
    updateGameState(state) {
        // 更新回合顯示
        if (this.elements.roundDisplay && state.currentRound) {
            this.elements.roundDisplay.textContent = `第 ${state.currentRound.roundNumber} 期`;
        }

        // 更新投注按鈕狀態
        if (this.elements.submitBtn) {
            this.elements.submitBtn.disabled = !state.canBet;
        }
    }

    /**
     * 更新倒數計時
     */
    updateCountdown(timeLeft) {
        if (this.elements.countdown) {
            this.elements.countdown.textContent = formatCountdown(timeLeft);

            // 時間不足 10 秒時變紅
            if (timeLeft <= 10 && timeLeft > 0) {
                this.elements.countdown.classList.add('urgent');
            } else {
                this.elements.countdown.classList.remove('urgent');
            }
        }
    }

    /**
     * 更新投注摘要
     */
    updateBetSummary(summary) {
        if (!this.elements.betSummary) return;

        if (summary.count === 0) {
            this.elements.betSummary.innerHTML = '<p class="no-bets">尚未選擇投注項目</p>';
            return;
        }

        let html = `
            <div class="summary-header">
                <span>已選擇 ${summary.count} 筆</span>
                <span>總金額: ${formatNumber(summary.totalAmount)} 積分</span>
            </div>
            <div class="summary-list">
        `;

        summary.bets.forEach((bet) => {
            html += `
                <div class="summary-item">
                    <div class="bet-desc">${bet.description}</div>
                    <div class="bet-info">
                        <span>${formatNumber(bet.betAmount)} 積分</span>
                        <span class="odds">賠率 1:${bet.odds}</span>
                        <button onclick="removeBet(${bet.index})" class="remove-btn">✕</button>
                    </div>
                </div>
            `;
        });

        html += `
            </div>
            <div class="summary-footer">
                <button onclick="clearAllBets()" class="clear-btn">清空全部</button>
            </div>
        `;

        this.elements.betSummary.innerHTML = html;
    }

    /**
     * 更新直播狀態
     */
    updateLiveStatus(status) {
        if (!this.elements.liveStatus) return;

        this.elements.liveStatus.textContent = status.text;
        this.elements.liveStatus.className = `live-status ${status.class}`;
    }

    /**
     * 顯示 Toast 訊息
     */
    showToast(message, type = 'info', duration = 3000) {
        if (!this.elements.toast) {
            // 創建 toast 元素
            const toast = document.createElement('div');
            toast.id = 'toast';
            toast.className = 'toast';
            document.body.appendChild(toast);
            this.elements.toast = toast;
        }

        this.elements.toast.textContent = message;
        this.elements.toast.className = `toast ${type} show`;

        setTimeout(() => {
            this.elements.toast.classList.remove('show');
        }, duration);
    }

    /**
     * 顯示確認對話框
     */
    showConfirmModal(data) {
        const html = `
            <div class="modal-header">
                <h3>${data.title || '確認'}</h3>
            </div>
            <div class="modal-body">
                <p>${data.message.replace(/\n/g, '<br>')}</p>
            </div>
            <div class="modal-footer">
                <button id="confirmCancel" class="btn-secondary">取消</button>
                <button id="confirmOk" class="btn-primary">確定</button>
            </div>
        `;

        this.showModal(html);

        // 綁定按鈕事件
        document.getElementById('confirmOk').addEventListener('click', () => {
            this.hideModal();
            if (data.onConfirm) data.onConfirm();
        });

        document.getElementById('confirmCancel').addEventListener('click', () => {
            this.hideModal();
            if (data.onCancel) data.onCancel();
        });
    }

    /**
     * 顯示 Modal
     */
    showModal(content) {
        if (!this.elements.modal) return;

        if (this.elements.modalContent) {
            this.elements.modalContent.innerHTML = content;
        }

        this.elements.modal.classList.add('show');
        eventBus.emit(Events.UI_MODAL_OPENED);
    }

    /**
     * 隱藏 Modal
     */
    hideModal() {
        if (!this.elements.modal) return;

        this.elements.modal.classList.remove('show');
        eventBus.emit(Events.UI_MODAL_CLOSED);
    }

    /**
     * 顯示 Loading
     */
    showLoading() {
        let loadingEl = document.getElementById('loading');

        if (!loadingEl) {
            loadingEl = document.createElement('div');
            loadingEl.id = 'loading';
            loadingEl.className = 'loading-overlay';
            loadingEl.innerHTML = '<div class="spinner"></div>';
            document.body.appendChild(loadingEl);
        }

        loadingEl.classList.add('show');
    }

    /**
     * 隱藏 Loading
     */
    hideLoading() {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.classList.remove('show');
        }
    }

    /**
     * 顯示禁投橫幅
     */
    showBettingDisabledBanner() {
        const banner = document.createElement('div');
        banner.className = 'betting-disabled-banner';
        banner.innerHTML = `
            <div class="banner-content">
                <span class="banner-icon">⚠️</span>
                <span class="banner-text">您的帳號已被限制投注，如有疑問請聯繫客服</span>
            </div>
        `;

        const header = document.querySelector('.header');
        if (header) {
            header.after(banner);
        }
    }

    /**
     * 清理資源
     */
    destroy() {
        this.logger.info('UI 管理器已清理');
    }
}

export default UIManager;
