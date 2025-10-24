/**
 * 事件總線
 * 實現發布-訂閱模式，用於模組間通訊
 */

class EventBus {
    constructor() {
        this.events = new Map();
    }

    /**
     * 訂閱事件
     */
    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }

        this.events.get(event).push(callback);

        // 返回取消訂閱函數
        return () => this.off(event, callback);
    }

    /**
     * 訂閱一次性事件
     */
    once(event, callback) {
        const wrapper = (...args) => {
            callback(...args);
            this.off(event, wrapper);
        };

        this.on(event, wrapper);
    }

    /**
     * 取消訂閱
     */
    off(event, callback) {
        if (!this.events.has(event)) {
            return;
        }

        const callbacks = this.events.get(event);
        const index = callbacks.indexOf(callback);

        if (index !== -1) {
            callbacks.splice(index, 1);
        }

        if (callbacks.length === 0) {
            this.events.delete(event);
        }
    }

    /**
     * 發布事件
     */
    emit(event, ...args) {
        if (!this.events.has(event)) {
            return;
        }

        const callbacks = this.events.get(event);

        for (const callback of callbacks) {
            try {
                callback(...args);
            } catch (error) {
                console.error(`事件處理器錯誤 [${event}]:`, error);
            }
        }
    }

    /**
     * 清除所有事件監聽器
     */
    clear() {
        this.events.clear();
    }

    /**
     * 清除特定事件的所有監聽器
     */
    clearEvent(event) {
        this.events.delete(event);
    }

    /**
     * 獲取事件監聽器數量
     */
    listenerCount(event) {
        return this.events.has(event) ? this.events.get(event).length : 0;
    }
}

// 事件名稱常量
export const Events = {
    // 認證相關
    AUTH_LOGIN_SUCCESS: 'auth:login:success',
    AUTH_LOGIN_FAILED: 'auth:login:failed',
    AUTH_LOGOUT: 'auth:logout',
    AUTH_TOKEN_EXPIRED: 'auth:token:expired',

    // 用戶相關
    USER_PROFILE_UPDATED: 'user:profile:updated',
    USER_BALANCE_UPDATED: 'user:balance:updated',
    USER_BETTING_DISABLED: 'user:betting:disabled',

    // 遊戲狀態
    GAME_ROUND_STARTED: 'game:round:started',
    GAME_BETTING_OPENED: 'game:betting:opened',
    GAME_BETTING_CLOSED: 'game:betting:closed',
    GAME_RESULT_CONFIRMED: 'game:result:confirmed',
    GAME_STATE_CHANGED: 'game:state:changed',

    // 投注相關
    BET_ADDED: 'bet:added',
    BET_REMOVED: 'bet:removed',
    BET_CLEARED: 'bet:cleared',
    BET_SUBMITTED: 'bet:submitted',
    BET_SUCCESS: 'bet:success',
    BET_FAILED: 'bet:failed',

    // 直播相關
    LIVE_STATE_CHANGED: 'live:state:changed',
    LIVE_STREAM_ERROR: 'live:stream:error',

    // UI 相關
    UI_TAB_CHANGED: 'ui:tab:changed',
    UI_MODAL_OPENED: 'ui:modal:opened',
    UI_MODAL_CLOSED: 'ui:modal:closed',
    UI_LOADING_START: 'ui:loading:start',
    UI_LOADING_END: 'ui:loading:end',

    // 網路相關
    NETWORK_ONLINE: 'network:online',
    NETWORK_OFFLINE: 'network:offline',

    // 錯誤相關
    ERROR_OCCURRED: 'error:occurred',
    ERROR_API: 'error:api',
    ERROR_NETWORK: 'error:network'
};

// 創建單例
const eventBus = new EventBus();

export default eventBus;
