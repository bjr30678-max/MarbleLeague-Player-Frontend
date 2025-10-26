# AWS-IVS 前端整合開發指南

## 📋 目錄
- [概述](#概述)
- [快速開始](#快速開始)
- [核心功能整合](#核心功能整合)
  - [1. 觀眾加入直播](#1-觀眾加入直播)
  - [2. 主播開始直播](#2-主播開始直播)
  - [3. 心跳機制](#3-心跳機制)
  - [4. 即時統計](#4-即時統計)
- [完整實作範例](#完整實作範例)
- [錯誤處理](#錯誤處理)
- [最佳實踐](#最佳實踐)
- [API 端點總覽](#api-端點總覽)

---

## 概述

AWS-IVS 直播系統是基於 Amazon IVS (Interactive Video Service) 的大規模即時串流解決方案。前端需要整合以下關鍵功能：

### 系統架構簡介
- **API Server**: `http://localhost:3000` (開發) / `https://api.your-domain.com` (生產)
- **WebSocket**: `ws://localhost:3000/ws` (即時統計更新)
- **認證方式**: API Key (Header: `x-api-key`)
- **數據格式**: JSON
- **Token 有效期**: 觀眾 1 小時，主播 4 小時

### 技術棧建議
- **IVS Web SDK**: `amazon-ivs-web-broadcast` v1.28.0
- **HTTP Client**: Axios 或 Fetch API
- **WebSocket**: 原生 WebSocket 或 Socket.IO Client
- **狀態管理**: Redux/Zustand/Pinia (依框架而定)

---

## 快速開始

### 1. 環境設置

```javascript
// config.js - 配置文件
const config = {
  development: {
    API_URL: 'http://localhost:3000',
    WS_URL: 'ws://localhost:3000/ws',
    API_KEY: 'your-development-api-key'
  },
  production: {
    API_URL: 'https://api.your-domain.com',
    WS_URL: 'wss://api.your-domain.com/ws',
    API_KEY: 'your-production-api-key'
  }
};

export default config[process.env.NODE_ENV || 'development'];
```

### 2. API 客戶端封裝

```javascript
// apiClient.js - API 客戶端基礎封裝
import axios from 'axios';
import config from './config';

const apiClient = axios.create({
  baseURL: config.API_URL,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': config.API_KEY
  },
  timeout: 30000
});

// 請求攔截器
apiClient.interceptors.request.use(
  (request) => {
    console.log('API Request:', request.method.toUpperCase(), request.url);
    return request;
  },
  (error) => Promise.reject(error)
);

// 響應攔截器
apiClient.interceptors.response.use(
  (response) => {
    // 統一檢查 success 欄位
    if (!response.data.success) {
      throw new Error(response.data.error?.message || '請求失敗');
    }
    return response.data.data; // 直接返回 data 部分
  },
  (error) => {
    if (error.response?.data?.error) {
      const errorInfo = error.response.data.error;
      console.error('API Error:', errorInfo.code, errorInfo.message);
      
      // 自定義錯誤對象
      const customError = new Error(errorInfo.message);
      customError.code = errorInfo.code;
      customError.details = errorInfo.details;
      throw customError;
    }
    throw error;
  }
);

export default apiClient;
```

### 3. 安裝 IVS Web SDK

```bash
npm install amazon-ivs-web-broadcast
```

---

## 核心功能整合

## 1. 觀眾加入直播

### 完整流程圖
```
用戶進入直播頁面
    ↓
獲取觀眾 Token (API)
    ↓
初始化 IVS Stage
    ↓
加入 Stage
    ↓
開始接收音視頻流
    ↓
定期發送心跳 (每30秒)
    ↓
離開時通知服務器
```

### 實作代碼

```javascript
// viewerService.js - 觀眾服務
import apiClient from './apiClient';
import { Stage, SubscribeType } from 'amazon-ivs-web-broadcast';

class ViewerService {
  constructor() {
    this.stage = null;
    this.token = null;
    this.userId = null;
    this.stageArn = null;
    this.participantId = null;
    this.heartbeatInterval = null;
    this.isJoined = false;
  }

  /**
   * 加入直播
   * @param {string} userId - 觀眾唯一識別碼
   * @param {string} stageArn - (可選) 指定 Stage，不指定則自動分配
   */
  async joinLiveStream(userId, stageArn = null) {
    try {
      this.userId = userId;

      // Step 1: 獲取觀眾 Token
      console.log('正在獲取觀眾 Token...');
      const tokenData = await this.getViewerToken(userId, stageArn);
      
      this.token = tokenData.token;
      this.stageArn = tokenData.stageArn;
      this.participantId = tokenData.participantId;

      console.log('Token 獲取成功:', {
        participantId: this.participantId,
        stageArn: this.stageArn.substring(this.stageArn.length - 12),
        currentViewers: tokenData.currentViewers,
        expiresIn: tokenData.expiresIn
      });

      // Step 2: 初始化 IVS Stage
      await this.initializeStage();

      // Step 3: 加入 Stage
      await this.joinStage();

      // Step 4: 開始心跳
      this.startHeartbeat();

      // Step 5: 設置 Token 刷新
      this.scheduleTokenRefresh(tokenData.expiresIn);

      return {
        success: true,
        stageArn: this.stageArn,
        participantId: this.participantId
      };

    } catch (error) {
      console.error('加入直播失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取觀眾 Token
   */
  async getViewerToken(userId, stageArn = null) {
    const payload = { userId };
    if (stageArn) {
      payload.stageArn = stageArn;
    }

    const response = await apiClient.post('/api/token/viewer', payload);
    return response;
  }

  /**
   * 初始化 IVS Stage
   */
  async initializeStage() {
    this.stage = new Stage(this.token, {
      // Stage 選項
      stageStrategy: {
        participantId: this.participantId,
        shouldSubscribeToParticipant: (participant) => {
          // 訂閱所有參與者（主要是主播）
          return SubscribeType.AUDIO_VIDEO;
        }
      }
    });

    // 監聽事件
    this.stage.on('STAGE_CONNECTION_STATE_CHANGED', (state) => {
      console.log('Stage 連接狀態:', state);
      if (state === 'CONNECTED') {
        this.isJoined = true;
      } else if (state === 'DISCONNECTED') {
        this.isJoined = false;
        this.handleDisconnection();
      }
    });

    this.stage.on('STAGE_PARTICIPANT_JOINED', (participant) => {
      console.log('參與者加入:', participant);
      if (participant.isPublishing) {
        this.handlePublisherJoined(participant);
      }
    });

    this.stage.on('STAGE_PARTICIPANT_LEFT', (participant) => {
      console.log('參與者離開:', participant);
      if (participant.isPublishing) {
        this.handlePublisherLeft(participant);
      }
    });

    this.stage.on('STAGE_PARTICIPANT_STREAMS_ADDED', (participant, streams) => {
      console.log('收到媒體流:', participant.participantId);
      this.handleStreamsAdded(participant, streams);
    });

    this.stage.on('STAGE_PARTICIPANT_STREAMS_REMOVED', (participant, streams) => {
      console.log('媒體流移除:', participant.participantId);
      this.handleStreamsRemoved(participant, streams);
    });
  }

  /**
   * 加入 Stage
   */
  async joinStage() {
    try {
      await this.stage.join();
      console.log('成功加入 Stage');
    } catch (error) {
      console.error('加入 Stage 失敗:', error);
      throw error;
    }
  }

  /**
   * 處理收到的媒體流
   */
  handleStreamsAdded(participant, streams) {
    const videoElement = document.getElementById('video-player');
    if (!videoElement) {
      console.error('找不到視頻元素');
      return;
    }

    streams.forEach(stream => {
      if (stream.mediaStreamTrack.kind === 'video') {
        // 設置視頻流
        const mediaStream = new MediaStream([stream.mediaStreamTrack]);
        videoElement.srcObject = mediaStream;
        videoElement.play().catch(e => {
          console.error('播放失敗:', e);
          // 顯示播放按鈕讓用戶手動播放
          this.showPlayButton();
        });
      } else if (stream.mediaStreamTrack.kind === 'audio') {
        // 設置音頻流
        const audioElement = document.getElementById('audio-player');
        if (audioElement) {
          const mediaStream = new MediaStream([stream.mediaStreamTrack]);
          audioElement.srcObject = mediaStream;
          audioElement.play().catch(e => console.error('音頻播放失敗:', e));
        }
      }
    });
  }

  /**
   * 開始發送心跳
   */
  startHeartbeat() {
    // 立即發送第一次心跳
    this.sendHeartbeat();

    // 每 30 秒發送一次心跳
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 30000);
  }

  /**
   * 發送心跳
   */
  async sendHeartbeat() {
    if (!this.isJoined) return;

    try {
      await apiClient.post('/api/viewer/heartbeat', {
        userId: this.userId,
        stageArn: this.stageArn
      });
      console.log('心跳發送成功');
    } catch (error) {
      console.error('心跳發送失敗:', error);
    }
  }

  /**
   * 離開直播
   */
  async leaveLiveStream() {
    try {
      // 停止心跳
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      // 通知服務器離開
      if (this.userId && this.stageArn) {
        await apiClient.post('/api/viewer/leave', {
          userId: this.userId,
          stageArn: this.stageArn
        });
        console.log('已通知服務器觀眾離開');
      }

      // 離開 Stage
      if (this.stage) {
        await this.stage.leave();
        this.stage = null;
        console.log('已離開 Stage');
      }

      this.isJoined = false;

    } catch (error) {
      console.error('離開直播失敗:', error);
    }
  }

  /**
   * 處理斷線
   */
  async handleDisconnection() {
    console.log('檢測到斷線，嘗試重連...');
    
    // 停止心跳
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // 嘗試重新加入
    setTimeout(() => {
      this.rejoinLiveStream();
    }, 3000);
  }

  /**
   * 重新加入直播
   */
  async rejoinLiveStream() {
    try {
      // 使用 rejoin API
      await apiClient.post('/api/viewer/rejoin', {
        userId: this.userId,
        stageArn: this.stageArn,
        participantId: this.participantId
      });

      // 重新加入 Stage
      await this.joinStage();

      // 重新開始心跳
      this.startHeartbeat();

      console.log('重新加入成功');
    } catch (error) {
      console.error('重新加入失敗:', error);
      // 如果 Token 過期，需要重新獲取
      if (error.message.includes('token')) {
        await this.joinLiveStream(this.userId, this.stageArn);
      }
    }
  }

  /**
   * 定期刷新 Token
   */
  scheduleTokenRefresh(expiresIn) {
    // 提前 5 分鐘刷新 Token
    const refreshTime = (expiresIn - 300) * 1000;
    
    setTimeout(async () => {
      console.log('Token 即將過期，刷新中...');
      try {
        const tokenData = await this.getViewerToken(this.userId, this.stageArn);
        this.token = tokenData.token;
        
        // 更新 Stage Token
        // 注意：IVS SDK 可能需要重新加入 Stage
        await this.leaveLiveStream();
        await this.joinLiveStream(this.userId, this.stageArn);
      } catch (error) {
        console.error('Token 刷新失敗:', error);
      }
    }, refreshTime);
  }

  /**
   * 清理資源
   */
  destroy() {
    this.leaveLiveStream();
  }
}

export default ViewerService;
```

### 在 React 中使用

```jsx
// LiveStream.jsx - React 組件範例
import React, { useEffect, useRef, useState } from 'react';
import ViewerService from './services/viewerService';

function LiveStream({ userId }) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewerCount, setViewerCount] = useState(0);
  const viewerServiceRef = useRef(null);

  useEffect(() => {
    // 初始化觀眾服務
    viewerServiceRef.current = new ViewerService();

    // 加入直播
    const joinStream = async () => {
      try {
        setIsLoading(true);
        const result = await viewerServiceRef.current.joinLiveStream(userId);
        setIsLoading(false);
      } catch (err) {
        setError(err.message);
        setIsLoading(false);
      }
    };

    joinStream();

    // 清理函數
    return () => {
      if (viewerServiceRef.current) {
        viewerServiceRef.current.destroy();
      }
    };
  }, [userId]);

  // 頁面關閉時離開直播
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (viewerServiceRef.current) {
        viewerServiceRef.current.leaveLiveStream();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  if (isLoading) return <div>載入中...</div>;
  if (error) return <div>錯誤: {error}</div>;

  return (
    <div className="live-stream-container">
      <video 
        id="video-player"
        autoPlay
        playsInline
        controls
        style={{ width: '100%', maxWidth: '1280px' }}
      />
      <audio id="audio-player" autoPlay />
      <div className="viewer-count">
        觀看人數: {viewerCount}
      </div>
    </div>
  );
}

export default LiveStream;
```

---

## 2. 主播開始直播

### 完整流程
```
主播準備開播
    ↓
獲取主播 Token (API)
    ↓
配置 OBS 或初始化 WebRTC
    ↓
開始推流
    ↓
監控直播狀態
```

### 實作代碼

```javascript
// publisherService.js - 主播服務
import apiClient from './apiClient';
import { 
  Stage, 
  LocalStageStream,
  StagePublishState
} from 'amazon-ivs-web-broadcast';

class PublisherService {
  constructor() {
    this.stage = null;
    this.token = null;
    this.localStream = null;
    this.userId = null;
    this.isPublishing = false;
  }

  /**
   * 獲取主播 Token
   */
  async getPublisherToken(userId) {
    const response = await apiClient.post('/api/token/publisher', {
      userId
    });
    return response;
  }

  /**
   * 開始直播 (Web SDK)
   */
  async startBroadcast(userId) {
    try {
      this.userId = userId;

      // Step 1: 獲取 Token
      console.log('獲取主播 Token...');
      const tokenData = await this.getPublisherToken(userId);
      this.token = tokenData.token;

      console.log('Token 獲取成功:', {
        participantId: tokenData.participantId,
        stageArn: tokenData.stageArn,
        expiresIn: tokenData.expiresIn,
        whipEndpoint: tokenData.whipEndpoint
      });

      // 如果使用 OBS，顯示配置資訊
      if (this.isUsingOBS()) {
        this.showOBSConfiguration(tokenData);
        return;
      }

      // Step 2: 獲取本地媒體流
      const mediaStream = await this.getLocalMediaStream();

      // Step 3: 初始化 Stage
      await this.initializeStage();

      // Step 4: 開始推流
      await this.publishStream(mediaStream);

      return {
        success: true,
        participantId: tokenData.participantId,
        stageArn: tokenData.stageArn
      };

    } catch (error) {
      console.error('開始直播失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取本地媒體流
   */
  async getLocalMediaStream() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      console.log('獲取本地媒體流成功');
      return stream;

    } catch (error) {
      console.error('獲取媒體流失敗:', error);
      throw new Error('無法訪問攝像頭或麥克風');
    }
  }

  /**
   * 初始化 Stage (主播端)
   */
  async initializeStage() {
    this.stage = new Stage(this.token);

    // 監聽事件
    this.stage.on('STAGE_CONNECTION_STATE_CHANGED', (state) => {
      console.log('Stage 連接狀態:', state);
    });

    this.stage.on('STAGE_PUBLISH_STATE_CHANGED', (state) => {
      console.log('推流狀態:', state);
      this.isPublishing = (state === StagePublishState.PUBLISHED);
    });

    this.stage.on('STAGE_PARTICIPANT_JOINED', (participant) => {
      console.log('新觀眾加入:', participant.participantId);
    });

    this.stage.on('STAGE_PARTICIPANT_LEFT', (participant) => {
      console.log('觀眾離開:', participant.participantId);
    });
  }

  /**
   * 開始推流
   */
  async publishStream(mediaStream) {
    try {
      // 創建本地流
      const videoTrack = mediaStream.getVideoTracks()[0];
      const audioTrack = mediaStream.getAudioTracks()[0];

      this.localStream = new LocalStageStream(audioTrack, videoTrack);

      // 加入 Stage 並開始推流
      await this.stage.join();
      await this.stage.publish(this.localStream);

      console.log('開始推流成功');
      this.isPublishing = true;

    } catch (error) {
      console.error('推流失敗:', error);
      throw error;
    }
  }

  /**
   * 停止直播
   */
  async stopBroadcast() {
    try {
      // 停止推流
      if (this.stage && this.isPublishing) {
        await this.stage.unpublish(this.localStream);
        await this.stage.leave();
      }

      // 釋放媒體流
      if (this.localStream) {
        this.localStream.mediaStreamTrack.stop();
        this.localStream = null;
      }

      this.isPublishing = false;
      console.log('直播已停止');

    } catch (error) {
      console.error('停止直播失敗:', error);
    }
  }

  /**
   * 顯示 OBS 配置
   */
  showOBSConfiguration(tokenData) {
    const obsConfig = {
      service: 'WHIP',
      server: tokenData.whipEndpoint || 'https://global.whip.live-video.net',
      bearerToken: tokenData.token,
      settings: {
        videoEncoder: 'x264',
        audioEncoder: 'AAC',
        videoBitrate: '2500 Kbps',
        audioBitrate: '160 Kbps',
        keyframeInterval: '1s',
        cpuUsagePreset: 'ultrafast',
        tune: 'zerolatency',
        profile: 'baseline',
        resolution: '1280x720',
        fps: '30'
      }
    };

    console.log('=== OBS 配置資訊 ===');
    console.log('Service: WHIP');
    console.log('Server:', obsConfig.server);
    console.log('Bearer Token:', obsConfig.bearerToken);
    console.log('\n推薦設置:');
    console.log(JSON.stringify(obsConfig.settings, null, 2));
    
    // 可以在 UI 中顯示這些配置
    return obsConfig;
  }

  /**
   * 檢查是否使用 OBS
   */
  isUsingOBS() {
    // 可以通過 URL 參數或用戶選擇來判斷
    return new URLSearchParams(window.location.search).get('obs') === 'true';
  }
}

export default PublisherService;
```

---

## 3. 心跳機制

### 為什麼需要心跳？
- 追蹤觀眾在線狀態
- 準確計算觀眾數量
- 清理斷線的觀眾
- 計算觀看時長

### 實作要點

```javascript
// heartbeatManager.js - 心跳管理器
class HeartbeatManager {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.intervals = new Map(); // 存儲各個心跳定時器
  }

  /**
   * 開始心跳
   * @param {string} key - 唯一標識
   * @param {object} data - 心跳數據
   * @param {number} interval - 間隔時間（毫秒）
   */
  startHeartbeat(key, data, interval = 30000) {
    // 清除已存在的心跳
    this.stopHeartbeat(key);

    // 立即發送第一次
    this.sendHeartbeat(data);

    // 設置定時器
    const timer = setInterval(() => {
      this.sendHeartbeat(data);
    }, interval);

    this.intervals.set(key, timer);
    console.log(`心跳已啟動: ${key}, 間隔: ${interval}ms`);
  }

  /**
   * 發送心跳
   */
  async sendHeartbeat(data) {
    try {
      await this.apiClient.post('/api/viewer/heartbeat', data);
      console.log(`心跳發送成功: ${new Date().toISOString()}`);
    } catch (error) {
      console.error('心跳發送失敗:', error.message);
      
      // 如果連續失敗，可能需要重連
      if (error.response?.status === 401) {
        // Token 過期，需要重新獲取
        this.handleTokenExpired();
      }
    }
  }

  /**
   * 停止心跳
   */
  stopHeartbeat(key) {
    const timer = this.intervals.get(key);
    if (timer) {
      clearInterval(timer);
      this.intervals.delete(key);
      console.log(`心跳已停止: ${key}`);
    }
  }

  /**
   * 停止所有心跳
   */
  stopAll() {
    this.intervals.forEach((timer, key) => {
      clearInterval(timer);
      console.log(`停止心跳: ${key}`);
    });
    this.intervals.clear();
  }

  /**
   * 處理 Token 過期
   */
  handleTokenExpired() {
    // 觸發重新獲取 Token 的事件
    window.dispatchEvent(new CustomEvent('tokenExpired'));
  }
}

export default HeartbeatManager;
```

---

## 4. 即時統計

### WebSocket 連接

```javascript
// statsWebSocket.js - 統計 WebSocket 客戶端
class StatsWebSocket {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.reconnectInterval = 1000;
    this.maxReconnectInterval = 30000;
    this.listeners = new Map();
  }

  /**
   * 連接 WebSocket
   */
  connect() {
    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket 連接成功');
        this.reconnectInterval = 1000; // 重置重連間隔
        this.subscribe('stats'); // 訂閱統計頻道
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('解析 WebSocket 消息失敗:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket 錯誤:', error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket 連接關閉');
        this.scheduleReconnect();
      };

    } catch (error) {
      console.error('WebSocket 連接失敗:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * 訂閱頻道
   */
  subscribe(channel) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        action: 'subscribe',
        channel: channel
      }));
      console.log(`已訂閱頻道: ${channel}`);
    }
  }

  /**
   * 取消訂閱
   */
  unsubscribe(channel) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        action: 'unsubscribe',
        channel: channel
      }));
      console.log(`已取消訂閱: ${channel}`);
    }
  }

  /**
   * 處理收到的消息
   */
  handleMessage(data) {
    if (data.type === 'stats_update') {
      console.log('收到統計更新:', data.data);
      this.notifyListeners('stats', data.data);
    }
  }

  /**
   * 添加事件監聽器
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  /**
   * 移除事件監聽器
   */
  off(event, callback) {
    this.listeners.get(event)?.delete(callback);
  }

  /**
   * 通知監聽器
   */
  notifyListeners(event, data) {
    this.listeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('監聽器執行失敗:', error);
      }
    });
  }

  /**
   * 安排重連
   */
  scheduleReconnect() {
    setTimeout(() => {
      console.log('嘗試重新連接 WebSocket...');
      this.connect();
      
      // 指數退避
      this.reconnectInterval = Math.min(
        this.reconnectInterval * 2,
        this.maxReconnectInterval
      );
    }, this.reconnectInterval);
  }

  /**
   * 斷開連接
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
  }
}

// 使用範例
const statsWS = new StatsWebSocket('ws://localhost:3000/ws');

// 監聽統計更新
statsWS.on('stats', (data) => {
  console.log('統計數據更新:', {
    totalViewers: data.totalViewers,
    activeStages: data.activeStages,
    isPublisherLive: data.isPublisherLive
  });
  
  // 更新 UI
  updateViewerCount(data.totalViewers);
  updateLiveStatus(data.isPublisherLive);
});

// 連接
statsWS.connect();

export default StatsWebSocket;
```

---

## 完整實作範例

### Vue 3 + Composition API

```vue
<!-- LiveStreamViewer.vue -->
<template>
  <div class="live-stream-viewer">
    <!-- 載入中 -->
    <div v-if="loading" class="loading">
      <span>正在連接直播...</span>
    </div>

    <!-- 錯誤提示 -->
    <div v-if="error" class="error">
      <span>{{ error }}</span>
      <button @click="retry">重試</button>
    </div>

    <!-- 直播畫面 -->
    <div v-show="!loading && !error" class="video-container">
      <video
        ref="videoElement"
        autoplay
        playsinline
        controls
        @click="togglePlay"
      />
      <audio ref="audioElement" autoplay />
      
      <!-- 統計資訊 -->
      <div class="stats-overlay">
        <span class="viewer-count">
          <i class="icon-users"></i> {{ viewerCount }}
        </span>
        <span v-if="!isLive" class="offline-badge">
          直播已結束
        </span>
      </div>
      
      <!-- 控制欄 -->
      <div class="controls">
        <button @click="toggleMute">
          {{ isMuted ? '🔇' : '🔊' }}
        </button>
        <button @click="toggleFullscreen">
          全螢幕
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import ViewerService from '@/services/viewerService';
import StatsWebSocket from '@/services/statsWebSocket';
import config from '@/config';

// Props
const props = defineProps({
  userId: {
    type: String,
    required: true
  },
  stageArn: {
    type: String,
    default: null
  }
});

// State
const loading = ref(true);
const error = ref(null);
const isLive = ref(false);
const viewerCount = ref(0);
const isMuted = ref(false);

// Refs
const videoElement = ref(null);
const audioElement = ref(null);

// Services
let viewerService = null;
let statsWS = null;

// 初始化
onMounted(async () => {
  try {
    // 初始化服務
    viewerService = new ViewerService();
    statsWS = new StatsWebSocket(config.WS_URL);

    // 設置視頻元素
    viewerService.setVideoElement(videoElement.value);
    viewerService.setAudioElement(audioElement.value);

    // 監聽統計更新
    statsWS.on('stats', (data) => {
      viewerCount.value = data.totalViewers;
      isLive.value = data.isPublisherLive;
    });

    // 連接 WebSocket
    statsWS.connect();

    // 加入直播
    await viewerService.joinLiveStream(props.userId, props.stageArn);
    
    loading.value = false;
    isLive.value = true;

  } catch (err) {
    console.error('初始化失敗:', err);
    error.value = err.message || '連接失敗';
    loading.value = false;
  }
});

// 清理
onBeforeUnmount(() => {
  if (viewerService) {
    viewerService.destroy();
  }
  if (statsWS) {
    statsWS.disconnect();
  }
});

// 處理頁面關閉
window.addEventListener('beforeunload', () => {
  if (viewerService) {
    viewerService.leaveLiveStream();
  }
});

// Methods
const retry = async () => {
  error.value = null;
  loading.value = true;
  
  try {
    await viewerService.joinLiveStream(props.userId, props.stageArn);
    loading.value = false;
  } catch (err) {
    error.value = err.message;
    loading.value = false;
  }
};

const togglePlay = () => {
  if (videoElement.value.paused) {
    videoElement.value.play();
  } else {
    videoElement.value.pause();
  }
};

const toggleMute = () => {
  isMuted.value = !isMuted.value;
  if (videoElement.value) {
    videoElement.value.muted = isMuted.value;
  }
  if (audioElement.value) {
    audioElement.value.muted = isMuted.value;
  }
};

const toggleFullscreen = () => {
  if (videoElement.value) {
    if (videoElement.value.requestFullscreen) {
      videoElement.value.requestFullscreen();
    }
  }
};
</script>

<style scoped>
.live-stream-viewer {
  position: relative;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
}

.loading, .error {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  background: #000;
  color: #fff;
}

.video-container {
  position: relative;
  background: #000;
}

video {
  width: 100%;
  height: auto;
}

.stats-overlay {
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  gap: 15px;
}

.viewer-count {
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  padding: 8px 15px;
  border-radius: 20px;
  font-size: 14px;
}

.offline-badge {
  background: #ff4444;
  color: #fff;
  padding: 8px 15px;
  border-radius: 20px;
  font-size: 14px;
}

.controls {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 10px;
}

.controls button {
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.3s;
}

.controls button:hover {
  background: rgba(0, 0, 0, 0.9);
}
</style>
```

---

## 錯誤處理

### 錯誤碼對照表

| 錯誤碼 | HTTP 狀態 | 說明 | 處理方式 |
|--------|-----------|------|----------|
| `VALIDATION_ERROR` | 400 | 參數驗證失敗 | 檢查並補齊缺少的參數 |
| `UNAUTHORIZED` | 401 | 未授權 | 檢查 API Key 是否正確 |
| `NOT_FOUND` | 404 | 資源不存在 | 檢查主播是否在線 |
| `STAGE_FULL` | 503 | Stage 已滿 | 等待後重試或換 Stage |
| `TOKEN_GENERATION_FAILED` | 500 | Token 生成失敗 | 檢查 AWS 配置 |

### 錯誤處理示例

```javascript
// errorHandler.js - 統一錯誤處理
class ErrorHandler {
  static handle(error) {
    const errorCode = error.code || 'UNKNOWN_ERROR';
    const errorMessage = error.message || '未知錯誤';

    switch (errorCode) {
      case 'VALIDATION_ERROR':
        // 顯示缺少的欄位
        if (error.details?.missingFields) {
          return `請填寫: ${error.details.missingFields.join(', ')}`;
        }
        return errorMessage;

      case 'UNAUTHORIZED':
        // API Key 錯誤
        return '認證失敗，請檢查 API Key';

      case 'NOT_FOUND':
        // 資源不存在
        if (errorMessage.includes('主播')) {
          return '主播尚未開始直播';
        }
        return '找不到請求的資源';

      case 'STAGE_FULL':
        // Stage 已滿
        return '直播間人數已滿，請稍後再試';

      case 'TOKEN_GENERATION_FAILED':
        // Token 生成失敗
        return 'Token 生成失敗，請聯繫技術支援';

      case 'NETWORK_ERROR':
        // 網路錯誤
        return '網路連接失敗，請檢查網路設置';

      default:
        // 其他錯誤
        console.error('未處理的錯誤:', error);
        return errorMessage;
    }
  }

  static async retry(fn, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        console.log(`重試 ${i + 1}/${maxRetries}...`);
        
        if (i === maxRetries - 1) {
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
}

// 使用範例
async function getTokenWithRetry(userId) {
  return ErrorHandler.retry(
    async () => {
      const response = await apiClient.post('/api/token/viewer', { userId });
      return response.data;
    },
    3,  // 最多重試 3 次
    2000 // 延遲 2 秒
  );
}
```

---

## 最佳實踐

### 1. Token 管理

```javascript
class TokenManager {
  constructor() {
    this.token = null;
    this.expiresAt = null;
    this.refreshTimer = null;
  }

  setToken(token, expiresIn) {
    this.token = token;
    this.expiresAt = Date.now() + (expiresIn * 1000);
    
    // 提前 5 分鐘刷新
    const refreshTime = (expiresIn - 300) * 1000;
    this.scheduleRefresh(refreshTime);
  }

  scheduleRefresh(delay) {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    this.refreshTimer = setTimeout(() => {
      this.refreshToken();
    }, delay);
  }

  async refreshToken() {
    console.log('刷新 Token...');
    // 實作 Token 刷新邏輯
  }

  isExpired() {
    return Date.now() >= this.expiresAt;
  }

  getToken() {
    if (this.isExpired()) {
      throw new Error('Token 已過期');
    }
    return this.token;
  }

  clear() {
    this.token = null;
    this.expiresAt = null;
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}
```

### 2. 網路狀態監控

```javascript
class NetworkMonitor {
  constructor() {
    this.isOnline = navigator.onLine;
    this.listeners = new Set();
    
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
  }

  handleOnline() {
    console.log('網路已連接');
    this.isOnline = true;
    this.notifyListeners('online');
  }

  handleOffline() {
    console.log('網路已斷開');
    this.isOnline = false;
    this.notifyListeners('offline');
  }

  on(event, callback) {
    this.listeners.add({ event, callback });
  }

  notifyListeners(event) {
    this.listeners.forEach(listener => {
      if (listener.event === event) {
        listener.callback();
      }
    });
  }

  checkConnection() {
    return fetch('/api/health', { method: 'HEAD' })
      .then(() => true)
      .catch(() => false);
  }
}

// 使用
const networkMonitor = new NetworkMonitor();

networkMonitor.on('offline', () => {
  console.log('斷線，暫停心跳');
  // 暫停心跳等操作
});

networkMonitor.on('online', () => {
  console.log('重新連線，恢復心跳');
  // 恢復心跳，重新加入直播
});
```

### 3. 性能優化

```javascript
// 防抖和節流
const debounce = (fn, delay) => {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

const throttle = (fn, limit) => {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// 批量請求
class BatchRequestManager {
  constructor(batchSize = 10, delay = 100) {
    this.queue = [];
    this.batchSize = batchSize;
    this.delay = delay;
    this.timer = null;
  }

  add(request) {
    this.queue.push(request);
    
    if (this.queue.length >= this.batchSize) {
      this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  scheduleFlush() {
    if (this.timer) return;
    
    this.timer = setTimeout(() => {
      this.flush();
    }, this.delay);
  }

  async flush() {
    if (this.queue.length === 0) return;
    
    const batch = this.queue.splice(0, this.batchSize);
    clearTimeout(this.timer);
    this.timer = null;
    
    try {
      await Promise.all(batch);
    } catch (error) {
      console.error('批次請求失敗:', error);
    }
  }
}
```

### 4. 記憶體管理

```javascript
class ResourceManager {
  constructor() {
    this.resources = new Map();
  }

  register(key, resource, cleanup) {
    this.resources.set(key, { resource, cleanup });
  }

  get(key) {
    return this.resources.get(key)?.resource;
  }

  release(key) {
    const item = this.resources.get(key);
    if (item) {
      if (item.cleanup) {
        item.cleanup(item.resource);
      }
      this.resources.delete(key);
    }
  }

  releaseAll() {
    this.resources.forEach((item, key) => {
      this.release(key);
    });
  }
}

// 使用範例
const resourceManager = new ResourceManager();

// 註冊資源
resourceManager.register('viewer-service', viewerService, (service) => {
  service.destroy();
});

resourceManager.register('websocket', ws, (socket) => {
  socket.close();
});

// 清理所有資源
window.addEventListener('beforeunload', () => {
  resourceManager.releaseAll();
});
```

---

## API 端點總覽

### Token 相關

| 方法 | 端點 | 說明 | 認證 |
|------|------|------|------|
| POST | `/api/token/viewer` | 生成觀眾 Token | ✅ |
| POST | `/api/token/publisher` | 生成主播 Token | ✅ |

### 觀眾管理

| 方法 | 端點 | 說明 | 認證 |
|------|------|------|------|
| POST | `/api/viewer/rejoin` | 觀眾重新加入 | ✅ |
| POST | `/api/viewer/heartbeat` | 發送心跳 | ✅ |
| POST | `/api/viewer/leave` | 觀眾離開 | ✅ |
| GET | `/api/viewer/list/:stageArn` | 獲取觀眾列表 | ✅ |
| GET | `/api/viewer/duration` | 獲取觀看時長 | ✅ |
| GET | `/api/viewer/history/:userId` | 獲取觀看歷史 | ✅ |

### 統計數據

| 方法 | 端點 | 說明 | 認證 |
|------|------|------|------|
| GET | `/api/stats` | 獲取總體統計 | ✅ |
| GET | `/api/stats/viewers` | 獲取觀眾統計 | ✅ |
| GET | `/api/stats/publisher` | 獲取主播狀態 | ✅ |

### Stage 管理

| 方法 | 端點 | 說明 | 認證 |
|------|------|------|------|
| GET | `/api/stage/list` | 獲取 Stage 列表 | ✅ |
| GET | `/api/stage/master/info` | 獲取主 Stage 資訊 | ✅ |
| POST | `/api/stage` | 創建新 Stage | ✅ |
| DELETE | `/api/stage/:stageArn` | 刪除 Stage | ✅ |

### 健康檢查

| 方法 | 端點 | 說明 | 認證 |
|------|------|------|------|
| GET | `/health` | 服務健康檢查 | ❌ |

---

## 環境變數配置

前端需要的環境變數：

```javascript
// .env.development
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000/ws
VITE_API_KEY=your-development-api-key

// .env.production
VITE_API_URL=https://api.your-domain.com
VITE_WS_URL=wss://api.your-domain.com/ws
VITE_API_KEY=your-production-api-key
```

---

## 故障排除

### 常見問題

1. **Token 過期**
   - 症狀：API 返回 401 錯誤
   - 解決：重新獲取 Token 並更新

2. **Stage 已滿**
   - 症狀：返回 STAGE_FULL 錯誤
   - 解決：等待或嘗試其他 Stage

3. **心跳失敗**
   - 症狀：被判定離線
   - 解決：檢查網路，確保定期發送

4. **視頻無法播放**
   - 症狀：黑屏或載入中
   - 解決：檢查自動播放策略，提供手動播放按鈕

5. **WebSocket 斷線**
   - 症狀：統計數據不更新
   - 解決：實作自動重連機制

---

## 聯繫支援

- **技術文檔**: [AWS IVS 官方文檔](https://docs.aws.amazon.com/ivs/)
- **SDK 文檔**: [IVS Web Broadcast SDK](https://aws.github.io/amazon-ivs-web-broadcast/docs/)
- **問題回報**: GitHub Issues
- **技術支援**: support@your-domain.com

---

**文檔版本**: v1.0.0  
**最後更新**: 2025-10-25  
**維護者**: Your Team
