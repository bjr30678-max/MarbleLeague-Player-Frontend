# AWS-IVS API 快速參考指南

## 🚀 快速開始

### 基本配置
```javascript
// API 配置
const API_URL = 'http://localhost:3000'  // 生產: https://api.your-domain.com
const API_KEY = 'your-api-key'
const WS_URL = 'ws://localhost:3000/ws'  // 生產: wss://api.your-domain.com/ws

// 請求 Headers
headers: {
  'Content-Type': 'application/json',
  'x-api-key': API_KEY
}
```

---

## 📌 核心 API 流程

### 觀眾加入直播 - 完整流程
```javascript
// 1. 獲取觀眾 Token
POST /api/token/viewer
Body: {
  "userId": "viewer-123",
  "stageArn": "arn:aws:ivs:..."  // 可選，不填則自動分配
}
Response: {
  "token": "eyJhbGci...",
  "participantId": "participant-xyz",
  "stageArn": "arn:aws:ivs:...",
  "expiresIn": 3600,
  "currentViewers": 45
}

// 2. 使用 Token 加入 Stage (IVS SDK)
import { Stage } from 'amazon-ivs-web-broadcast';
const stage = new Stage(token);
await stage.join();

// 3. 定期發送心跳 (每30秒)
POST /api/viewer/heartbeat
Body: {
  "userId": "viewer-123",
  "stageArn": "arn:aws:ivs:..."
}

// 4. 離開時通知
POST /api/viewer/leave
Body: {
  "userId": "viewer-123",
  "stageArn": "arn:aws:ivs:..."
}
```

### 主播開始直播 - 完整流程
```javascript
// 1. 獲取主播 Token
POST /api/token/publisher
Body: {
  "userId": "publisher-123"
}
Response: {
  "token": "eyJhbGci...",
  "participantId": "participant-abc",
  "stageArn": "arn:aws:ivs:...",
  "expiresIn": 14400,
  "whipEndpoint": "https://global.whip.live-video.net",
  "instructions": {
    "obs": { /* OBS 配置 */ },
    "web": { /* Web SDK 配置 */ }
  }
}

// 2a. 使用 OBS 推流
OBS 設置:
- Service: WHIP
- Server: https://global.whip.live-video.net
- Bearer Token: [使用上面獲取的 token]

// 2b. 或使用 Web SDK
const stage = new Stage(token);
const localStream = new LocalStageStream(audioTrack, videoTrack);
await stage.join();
await stage.publish(localStream);
```

---

## 📊 即時統計 WebSocket

```javascript
// 連接 WebSocket
const ws = new WebSocket('ws://localhost:3000/ws');

// 訂閱統計頻道
ws.send(JSON.stringify({
  action: 'subscribe',
  channel: 'stats'
}));

// 接收統計更新 (每5秒)
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // data.type === 'stats_update'
  // data.data = {
  //   totalViewers: 68,
  //   activeStages: 2,
  //   isPublisherLive: true
  // }
};
```

---

## 🔑 重要參數說明

### Token 有效期
- **觀眾 Token**: 1 小時 (3600 秒)
- **主播 Token**: 4 小時 (14400 秒)
- 建議提前 5 分鐘刷新 Token

### 心跳機制
- **發送間隔**: 30 秒
- **超時時間**: 60 秒（60秒無心跳自動移除）
- **端點**: `POST /api/viewer/heartbeat`

### Stage 限制
- **每個 Stage 最大觀眾**: 50 人
- **最大 Stage 數量**: 20 個
- **自動擴展閾值**: ≥45 人時創建新 Stage

---

## 🎯 關鍵 API 端點

| 功能 | 方法 | 端點 | 必要參數 |
|------|------|------|----------|
| **獲取觀眾 Token** | POST | `/api/token/viewer` | `userId` |
| **獲取主播 Token** | POST | `/api/token/publisher` | `userId` |
| **發送心跳** | POST | `/api/viewer/heartbeat` | `userId`, `stageArn` |
| **觀眾離開** | POST | `/api/viewer/leave` | `userId`, `stageArn` |
| **重新加入** | POST | `/api/viewer/rejoin` | `userId`, `stageArn`, `participantId` |
| **獲取統計** | GET | `/api/stats` | - |
| **健康檢查** | GET | `/health` | - |

---

## ⚠️ 錯誤處理

### 統一響應格式
```javascript
// 成功
{
  "success": true,
  "data": { /* 實際數據 */ },
  "timestamp": "2025-10-25T10:30:00.000Z"
}

// 失敗
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "錯誤描述",
    "details": { /* 詳細資訊 */ }
  },
  "timestamp": "2025-10-25T10:30:00.000Z"
}
```

### 常見錯誤碼
| 錯誤碼 | 說明 | 處理方式 |
|--------|------|----------|
| `VALIDATION_ERROR` | 參數錯誤 | 檢查 details.missingFields |
| `UNAUTHORIZED` | API Key 錯誤 | 檢查 x-api-key header |
| `NOT_FOUND` | 主播不在線 | 提示用戶稍後再試 |
| `STAGE_FULL` | Stage 已滿 | 等待或嘗試其他 Stage |
| `TOKEN_GENERATION_FAILED` | Token 生成失敗 | 檢查 AWS 配置 |

---

## 💡 最佳實踐檢查清單

### ✅ Token 管理
- [ ] 實作 Token 刷新機制（提前 5 分鐘）
- [ ] 處理 Token 過期自動重新獲取
- [ ] 安全存儲 Token（不要存在 localStorage）

### ✅ 心跳機制
- [ ] 每 30 秒發送心跳
- [ ] 頁面隱藏時暫停心跳
- [ ] 頁面恢復時恢復心跳
- [ ] 處理心跳失敗重試

### ✅ 錯誤處理
- [ ] 實作統一錯誤處理器
- [ ] 處理網路斷線重連
- [ ] 提供用戶友好的錯誤提示
- [ ] 實作重試機制

### ✅ 資源管理
- [ ] 頁面關閉時調用離開 API
- [ ] 清理定時器和監聽器
- [ ] 釋放媒體流資源
- [ ] 斷開 WebSocket 連接

### ✅ 用戶體驗
- [ ] 顯示載入狀態
- [ ] 顯示觀眾數量
- [ ] 提供重連按鈕
- [ ] 處理自動播放限制

---

## 🔧 調試技巧

### 1. 啟用詳細日誌
```javascript
// API 請求日誌
axios.interceptors.request.use(request => {
  console.log('API Request:', request);
  return request;
});

// IVS Stage 事件日誌
stage.on('*', (event) => {
  console.log('Stage Event:', event);
});
```

### 2. 測試心跳
```bash
# 手動測試心跳 API
curl -X POST http://localhost:3000/api/viewer/heartbeat \
  -H "x-api-key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user","stageArn":"arn:aws:ivs:..."}'
```

### 3. 監控 WebSocket
```javascript
// Chrome DevTools Console
ws = new WebSocket('ws://localhost:3000/ws');
ws.onmessage = e => console.log(JSON.parse(e.data));
ws.send(JSON.stringify({action: 'subscribe', channel: 'stats'}));
```

---

## 📚 相關資源

- **完整 API 文檔**: `/docs/API.md`
- **IVS SDK**: `npm install amazon-ivs-web-broadcast`
- **AWS IVS 文檔**: https://docs.aws.amazon.com/ivs/
- **範例代碼**: GitHub Repository

---

## 🆘 緊急聯繫

- **技術支援 Email**: support@your-domain.com
- **緊急熱線**: +886-XXX-XXXX
- **Slack 頻道**: #aws-ivs-support

---

**版本**: v1.0.0 | **更新日期**: 2025-10-25
