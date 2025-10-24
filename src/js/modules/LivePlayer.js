/**
 * 直播播放器管理器
 * 處理 OvenPlayer 直播播放
 */

import Logger from '../core/Logger.js';
import eventBus, { Events } from '../core/EventBus.js';

class LivePlayer {
    constructor(config) {
        this.config = config;
        this.logger = new Logger('LivePlayer', config);

        this.player = null;
        this.playerId = 'livePlayer';
        this.currentState = 'idle';
        this.webrtcUpgraded = false;
    }

    /**
     * 初始化播放器
     */
    init() {
        this.logger.info('初始化直播播放器');

        try {
            // 檢查 OvenPlayer 是否已載入
            if (typeof OvenPlayer === 'undefined') {
                throw new Error('OvenPlayer 未載入');
            }

            const streamUrl = this.config.getStreamUrl('wss');

            this.logger.info('直播源 URL', { streamUrl });

            // 創建播放器
            this.player = OvenPlayer.create(this.playerId, {
                autoStart: true,
                autoFallback: true,
                mute: true,
                volume: 50,
                controls: false,
                showBigPlayButton: false,
                disableSeekUI: true,
                playsinline: true,
                aspectRatio: '16:9',
                sources: [
                    {
                        type: 'webrtc',
                        file: streamUrl
                    }
                ]
            });

            // 設置事件監聽器
            this.setupEventListeners();

            // 嘗試 WebRTC 升級
            this.attemptWebRTCUpgrade();

            this.logger.info('直播播放器初始化完成');
        } catch (error) {
            this.logger.error('直播播放器初始化失敗', error);
            throw error;
        }
    }

    /**
     * 設置事件監聽器
     */
    setupEventListeners() {
        if (!this.player) return;

        // 狀態變更
        this.player.on('stateChanged', (state) => {
            this.currentState = state.newstate;
            this.logger.debug('播放器狀態變更', { state: state.newstate });
            this.updateLiveStatus(state.newstate);
        });

        // 錯誤
        this.player.on('error', (error) => {
            this.logger.error('播放器錯誤', error);
            this.updateLiveStatus('error');
            eventBus.emit(Events.LIVE_STREAM_ERROR, error);
        });

        // 頁面可見性變更
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.logger.debug('頁面隱藏，靜音播放器');
                this.mute();
            }
        });
    }

    /**
     * 嘗試 WebRTC 升級
     */
    attemptWebRTCUpgrade() {
        if (this.webrtcUpgraded) {
            return;
        }

        setTimeout(() => {
            try {
                const sources = this.player.getSources();
                const webrtcSource = sources.find(s => s.type === 'webrtc');

                if (webrtcSource) {
                    this.logger.info('嘗試升級到 WebRTC');
                    this.player.setCurrentSource(sources.indexOf(webrtcSource));
                    this.webrtcUpgraded = true;

                    // 2 秒後檢查是否成功
                    setTimeout(() => {
                        if (this.currentState === 'error' || this.currentState === 'idle') {
                            this.logger.warn('WebRTC 升級失敗，回退到 HLS');
                            this.player.setCurrentSource(0);
                        }
                    }, 2000);
                }
            } catch (error) {
                this.logger.error('WebRTC 升級失敗', error);
            }
        }, 1500);
    }

    /**
     * 更新直播狀態
     */
    updateLiveStatus(state) {
        const statusMap = {
            'playing': { text: '直播中', class: 'live' },
            'paused': { text: '已暫停', class: 'paused' },
            'loading': { text: '連接中...', class: 'loading' },
            'idle': { text: '離線', class: 'offline' },
            'complete': { text: '離線', class: 'offline' },
            'error': { text: '連接失敗', class: 'error' }
        };

        const status = statusMap[state] || statusMap['idle'];

        eventBus.emit(Events.LIVE_STATE_CHANGED, {
            state,
            ...status
        });
    }

    /**
     * 播放
     */
    play() {
        if (this.player) {
            this.logger.debug('播放直播');
            this.player.play();
        }
    }

    /**
     * 暫停
     */
    pause() {
        if (this.player) {
            this.logger.debug('暫停直播');
            this.player.pause();
        }
    }

    /**
     * 切換播放/暫停
     */
    togglePlay() {
        if (!this.player) return;

        if (this.currentState === 'playing') {
            this.pause();
        } else {
            this.play();
        }
    }

    /**
     * 靜音
     */
    mute() {
        if (this.player) {
            this.player.setMute(true);
            this.logger.debug('已靜音');
        }
    }

    /**
     * 取消靜音
     */
    unmute() {
        if (this.player) {
            this.player.setMute(false);
            this.logger.debug('已取消靜音');
        }
    }

    /**
     * 切換靜音
     */
    toggleMute() {
        if (!this.player) return;

        const isMuted = this.player.getMute();
        this.player.setMute(!isMuted);
        this.logger.debug(isMuted ? '已取消靜音' : '已靜音');
    }

    /**
     * 設置音量
     */
    setVolume(volume) {
        if (this.player) {
            const vol = Math.max(0, Math.min(100, volume));
            this.player.setVolume(vol);
            this.logger.debug('設置音量', { volume: vol });
        }
    }

    /**
     * 全螢幕
     */
    toggleFullscreen() {
        const container = document.getElementById(this.playerId);
        if (!container) return;

        if (!document.fullscreenElement) {
            container.requestFullscreen().catch((err) => {
                this.logger.error('全螢幕失敗', err);
            });
        } else {
            document.exitFullscreen();
        }
    }

    /**
     * 重新整理直播
     */
    refreshStream() {
        if (!this.player) return;

        this.logger.info('重新整理直播');

        try {
            this.player.stop();
            setTimeout(() => {
                this.player.play();
            }, 500);
        } catch (error) {
            this.logger.error('重新整理直播失敗', error);
        }
    }

    /**
     * 獲取當前狀態
     */
    getState() {
        return this.currentState;
    }

    /**
     * 是否正在播放
     */
    isPlaying() {
        return this.currentState === 'playing';
    }

    /**
     * 清理資源
     */
    destroy() {
        if (this.player) {
            this.logger.info('銷毀直播播放器');
            try {
                this.player.remove();
            } catch (error) {
                this.logger.error('銷毀播放器失敗', error);
            }
            this.player = null;
        }
    }
}

export default LivePlayer;
