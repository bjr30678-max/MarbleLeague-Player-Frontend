/**
 * 日誌系統
 * 提供統一的日誌管理，支持不同級別和環境控制
 */

class Logger {
    static LOG_LEVELS = {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3,
        NONE: 4
    };

    constructor(context = 'App', config = {}) {
        this.context = context;
        this.isDevelopment = config.isDevelopment || false;
        this.enableDebugLog = config.enableDebugLog || false;
        this.currentLevel = this.isDevelopment
            ? Logger.LOG_LEVELS.DEBUG
            : Logger.LOG_LEVELS.INFO;

        // 敏感關鍵字列表（避免記錄敏感資訊）
        this.sensitiveKeys = [
            'password', 'token', 'accessToken', 'authToken',
            'secret', 'apiKey', 'credentials', 'authorization'
        ];
    }

    /**
     * 格式化日誌消息
     */
    formatMessage(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level}] [${this.context}]`;

        if (data !== null && data !== undefined) {
            return `${prefix} ${message}`;
        }

        return `${prefix} ${message}`;
    }

    /**
     * 過濾敏感資訊
     */
    sanitizeData(data) {
        if (!data || typeof data !== 'object') {
            return data;
        }

        if (Array.isArray(data)) {
            return data.map(item => this.sanitizeData(item));
        }

        const sanitized = {};
        for (const [key, value] of Object.entries(data)) {
            const lowerKey = key.toLowerCase();
            const isSensitive = this.sensitiveKeys.some(sk =>
                lowerKey.includes(sk.toLowerCase())
            );

            if (isSensitive) {
                sanitized[key] = '***REDACTED***';
            } else if (value && typeof value === 'object') {
                sanitized[key] = this.sanitizeData(value);
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    /**
     * 記錄日誌
     */
    log(level, message, data = null) {
        if (level < this.currentLevel) {
            return;
        }

        const formattedMessage = this.formatMessage(
            Object.keys(Logger.LOG_LEVELS)[level],
            message,
            data
        );

        // 過濾敏感資訊
        const sanitizedData = data ? this.sanitizeData(data) : null;

        switch (level) {
            case Logger.LOG_LEVELS.DEBUG:
                if (this.enableDebugLog) {
                    console.debug(formattedMessage, sanitizedData || '');
                }
                break;

            case Logger.LOG_LEVELS.INFO:
                console.info(formattedMessage, sanitizedData || '');
                break;

            case Logger.LOG_LEVELS.WARN:
                console.warn(formattedMessage, sanitizedData || '');
                break;

            case Logger.LOG_LEVELS.ERROR:
                console.error(formattedMessage, sanitizedData || '');
                break;
        }
    }

    debug(message, data = null) {
        this.log(Logger.LOG_LEVELS.DEBUG, message, data);
    }

    info(message, data = null) {
        this.log(Logger.LOG_LEVELS.INFO, message, data);
    }

    warn(message, data = null) {
        this.log(Logger.LOG_LEVELS.WARN, message, data);
    }

    error(message, data = null) {
        this.log(Logger.LOG_LEVELS.ERROR, message, data);
    }

    /**
     * 設置日誌級別
     */
    setLevel(level) {
        if (level in Logger.LOG_LEVELS) {
            this.currentLevel = Logger.LOG_LEVELS[level];
        }
    }

    /**
     * 創建子日誌器
     */
    child(subContext) {
        return new Logger(`${this.context}:${subContext}`, {
            isDevelopment: this.isDevelopment,
            enableDebugLog: this.enableDebugLog
        });
    }
}

export default Logger;
