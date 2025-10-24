/**
 * 工具函數集合
 */

/**
 * 防抖函數
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 節流函數
 */
export function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * 格式化數字（千分位）
 */
export function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return Number(num).toLocaleString('zh-TW');
}

/**
 * 格式化日期時間
 */
export function formatDateTime(date) {
    if (!date) return '';

    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 格式化倒數時間
 */
export function formatCountdown(seconds) {
    if (seconds <= 0) return '00:00';

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * 深度複製物件
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }

    if (obj instanceof Array) {
        return obj.map(item => deepClone(item));
    }

    if (obj instanceof Object) {
        const clonedObj = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = deepClone(obj[key]);
            }
        }
        return clonedObj;
    }
}

/**
 * 驗證 JWT Token 是否過期
 */
export function isTokenExpired(token) {
    if (!token) return true;

    try {
        const parts = token.split('.');
        if (parts.length !== 3) return true;

        const payload = JSON.parse(atob(parts[1]));

        if (!payload.exp) return false;

        // 提前 5 分鐘判定過期（緩衝時間）
        const expiryTime = payload.exp * 1000;
        const currentTime = Date.now();
        const bufferTime = 5 * 60 * 1000; // 5 分鐘

        return currentTime >= (expiryTime - bufferTime);
    } catch (error) {
        console.error('Token 驗證失敗:', error);
        return true;
    }
}

/**
 * 取得 Token 過期時間
 */
export function getTokenExpiry(token) {
    if (!token) return null;

    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const payload = JSON.parse(atob(parts[1]));
        return payload.exp ? new Date(payload.exp * 1000) : null;
    } catch (error) {
        return null;
    }
}

/**
 * 安全地解析 JSON
 */
export function safeJsonParse(str, defaultValue = null) {
    try {
        return JSON.parse(str);
    } catch (error) {
        return defaultValue;
    }
}

/**
 * 生成唯一 ID
 */
export function generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 延遲函數（Promise 版本）
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 重試函數（帶指數退避）
 */
export async function retryWithBackoff(
    fn,
    maxAttempts = 3,
    baseDelay = 1000,
    onRetry = null
) {
    let lastError;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt < maxAttempts - 1) {
                const delay = baseDelay * Math.pow(2, attempt);

                if (onRetry) {
                    onRetry(attempt + 1, maxAttempts, delay, error);
                }

                await sleep(delay);
            }
        }
    }

    throw lastError;
}

/**
 * 檢查是否為有效的 URL
 */
export function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * 安全地取得物件屬性
 */
export function safeGet(obj, path, defaultValue = undefined) {
    const keys = Array.isArray(path) ? path : path.split('.');
    let result = obj;

    for (const key of keys) {
        if (result === null || result === undefined || !(key in result)) {
            return defaultValue;
        }
        result = result[key];
    }

    return result;
}

/**
 * 手機震動反饋（如果支持）
 */
export function vibrate(pattern = 50) {
    if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
    }
}

/**
 * 顯示通知（如果支持）
 */
export async function showNotification(title, options = {}) {
    if (!('Notification' in window)) {
        return false;
    }

    if (Notification.permission === 'granted') {
        new Notification(title, options);
        return true;
    }

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            new Notification(title, options);
            return true;
        }
    }

    return false;
}

/**
 * 檢測網路狀態
 */
export function isOnline() {
    return navigator.onLine;
}

/**
 * 複製文字到剪貼簿
 */
export async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                return true;
            } finally {
                document.body.removeChild(textArea);
            }
        }
    } catch (error) {
        console.error('複製失敗:', error);
        return false;
    }
}

/**
 * 格式化投注內容為顯示文字
 */
export function formatBetContent(betType, betContent, position = null) {
    switch (betType) {
        case 'position':
            return `第${position}名 - 號碼${betContent.join(', ')}`;

        case 'sum_value':
            return `冠亞和值 - ${betContent.join(', ')}`;

        case 'sum_big':
        case 'sum_small':
        case 'sum_odd':
        case 'sum_even':
            const sumTypeMap = {
                'sum_big': '冠亞和大',
                'sum_small': '冠亞和小',
                'sum_odd': '冠亞和單',
                'sum_even': '冠亞和雙'
            };
            return sumTypeMap[betType] || betType;

        case 'big':
        case 'small':
        case 'odd':
        case 'even':
            const posTypeMap = {
                'big': '大',
                'small': '小',
                'odd': '單',
                'even': '雙'
            };
            return `第${position}名 - ${posTypeMap[betType]}`;

        case 'dragon':
        case 'tiger':
            const dragonTigerMap = {
                'dragon': '龍',
                'tiger': '虎'
            };
            return `第${position}vs${position + 5}名 - ${dragonTigerMap[betType]}`;

        default:
            return `${betType} - ${betContent}`;
    }
}

/**
 * 計算預期贏得金額
 */
export function calculateExpectedWin(betAmount, odds) {
    if (!betAmount || !odds) return 0;
    return Math.floor(betAmount * odds);
}

/**
 * 驗證投注金額
 */
export function validateBetAmount(amount, min = 10, max = 100000) {
    const num = Number(amount);

    if (isNaN(num) || num < min) {
        return { valid: false, error: `最小投注金額為 ${min}` };
    }

    if (num > max) {
        return { valid: false, error: `最大投注金額為 ${max}` };
    }

    return { valid: true };
}

export default {
    debounce,
    throttle,
    formatNumber,
    formatDateTime,
    formatCountdown,
    deepClone,
    isTokenExpired,
    getTokenExpiry,
    safeJsonParse,
    generateId,
    sleep,
    retryWithBackoff,
    isValidUrl,
    safeGet,
    vibrate,
    showNotification,
    isOnline,
    copyToClipboard,
    formatBetContent,
    calculateExpectedWin,
    validateBetAmount
};
