# 彈珠聯賽 LINE LIFF 應用 - 重構優化版 v2.0

## 📋 專案簡介

這是一個基於 LINE LIFF 的彈珠聯賽投注應用，經過完全重構優化，採用模組化架構，提升了安全性、可維護性和擴展性。

## ✨ 主要改進

### 🔒 安全性增強

- ✅ **移除硬編碼配置** - 敏感配置（LIFF ID、API URL）從代碼中分離
- ✅ **Token 安全儲存** - 使用 `sessionStorage` 替代 `localStorage`，自動清除敏感資料
- ✅ **Token 過期檢查** - 自動檢測並處理 JWT Token 過期
- ✅ **CSP 安全頭** - 添加 Content Security Policy 防止 XSS 攻擊
- ✅ **敏感資訊過濾** - 日誌系統自動過濾密碼、Token 等敏感資訊
- ✅ **HTTPS 強制** - 生產環境自動重定向到 HTTPS

### 🏗️ 架構優化

#### 模組化結構

```
MarbleLeague-Player-Frontend/
├── config/
│   └── app.config.js          # 配置管理（單例模式）
├── src/
│   ├── js/
│   │   ├── core/              # 核心工具類
│   │   │   ├── Logger.js      # 統一日誌系統
│   │   │   ├── EventBus.js    # 事件總線（發布-訂閱）
│   │   │   └── Utils.js       # 工具函數集
│   │   ├── services/          # 服務層
│   │   │   ├── ApiService.js  # API 請求封裝
│   │   │   ├── AuthService.js # 認證服務
│   │   │   ├── SocketService.js # WebSocket 服務
│   │   │   └── StorageService.js # 安全存儲服務
│   │   ├── modules/           # 業務模組
│   │   │   ├── BettingManager.js # 投注管理
│   │   │   ├── GameManager.js    # 遊戲狀態管理
│   │   │   ├── LivePlayer.js     # 直播播放器
│   │   │   └── UIManager.js      # UI 管理
│   │   └── app.js             # 主應用入口
│   └── css/
│       ├── variables.css      # CSS 變數（設計系統）
│       └── main.css          # 主樣式
├── index.html                # 主頁面
└── *.backup                  # 舊版本備份
```

#### 設計模式應用

1. **單例模式** - 配置管理、事件總線
2. **工廠模式** - 日誌器創建
3. **觀察者模式** - 事件驅動架構
4. **依賴注入** - 服務間解耦

### 🎨 代碼品質提升

- **ES6+ 語法** - 使用 Class、async/await、模組化導入
- **統一錯誤處理** - 全局錯誤捕獲和處理機制
- **日誌分級** - DEBUG、INFO、WARN、ERROR 四級日誌
- **類型安全** - 參數驗證和邊界檢查
- **代碼註釋** - 完整的 JSDoc 風格註釋

### 📱 功能保留

✅ 所有原有功能完整保留：
- LINE LIFF 登入認證
- 用戶積分管理
- 多種投注類型（名次、冠亞和、大小、單雙、龍虎）
- 實時遊戲狀態同步（WebSocket）
- 直播播放（WebRTC/HLS）
- 投注限額檢查
- 歷史記錄查詢
- 投注草稿自動保存

## 🚀 快速開始

### 環境要求

- 現代瀏覽器（支持 ES6+ 和 ES Modules）
- LINE 應用（用於 LIFF 功能）
- 後端 API 服務（需配置 CORS）

### 安裝部署

1. **克隆專案**

```bash
git clone <repository-url>
cd MarbleLeague-Player-Frontend
```

2. **配置應用**

方式一：伺服器端配置（推薦）

```html
<!-- 在 index.html 的 <head> 中添加 -->
<script>
  window.ENV = {
    LIFF_ID: '你的LIFF_ID',
    API_URL: 'https://your-api.com',
    STREAM_HOST: 'your-stream.com',
    // ...其他配置
  };
</script>
```

方式二：開發模式 URL 參數

```
http://localhost:8080/?liff_id=YOUR_LIFF_ID&api_url=https://api.example.com
```

3. **啟動本地伺服器**

```bash
# 使用 Python
python -m http.server 8080

# 或使用 Node.js (http-server)
npx http-server -p 8080

# 或使用 PHP
php -S localhost:8080
```

4. **訪問應用**

```
http://localhost:8080
```

### LIFF 設置

1. 前往 [LINE Developers Console](https://developers.line.biz/)
2. 創建 LINE Login Channel
3. 添加 LIFF 應用
4. 設置 Endpoint URL 為你的部署地址
5. 複製 LIFF ID 並配置到應用中

## 📖 配置說明

### 配置優先級

```
URL 參數 > window.ENV > sessionStorage > 預設值
```

### 可配置項目

| 配置項 | 類型 | 預設值 | 說明 |
|--------|------|--------|------|
| `LIFF_ID` | String | - | LINE LIFF ID |
| `API_URL` | String | - | 後端 API 地址 |
| `STREAM_HOST` | String | - | 直播伺服器地址 |
| `STREAM_APP` | String | `app` | 直播應用名稱 |
| `STREAM_NAME` | String | - | 直播流名稱 |
| `DEBUG_LOG` | Boolean | `false` | 是否啟用調試日誌 |

### 環境檢測

應用會自動檢測運行環境：

- **生產環境** - 域名部署，啟用所有安全檢查
- **開發環境** - `localhost`、`127.0.0.1`、`192.168.*`，允許模擬登入

## 🔧 開發指南

### 添加新功能

1. **創建服務**

```javascript
// src/js/services/YourService.js
import Logger from '../core/Logger.js';

class YourService {
    constructor(config) {
        this.logger = new Logger('YourService', config);
    }

    async yourMethod() {
        // 實現邏輯
    }
}

export default YourService;
```

2. **在主應用中整合**

```javascript
// src/js/app.js
import YourService from './services/YourService.js';

// 在 initServices 方法中
this.yourService = new YourService(appConfig);
```

### 事件系統使用

```javascript
import eventBus, { Events } from './core/EventBus.js';

// 訂閱事件
eventBus.on(Events.USER_BALANCE_UPDATED, (balance) => {
    console.log('餘額更新:', balance);
});

// 發布事件
eventBus.emit(Events.USER_BALANCE_UPDATED, newBalance);

// 一次性訂閱
eventBus.once(Events.AUTH_LOGIN_SUCCESS, (profile) => {
    console.log('登入成功');
});

// 取消訂閱
const unsubscribe = eventBus.on(Events.GAME_STATE_CHANGED, handler);
unsubscribe(); // 取消訂閱
```

### 日誌記錄

```javascript
import Logger from './core/Logger.js';

const logger = new Logger('ModuleName', config);

logger.debug('調試資訊', { data });  // 僅開發環境
logger.info('一般資訊', { data });   // 記錄重要操作
logger.warn('警告資訊', { data });   // 異常但可恢復
logger.error('錯誤資訊', error);     // 錯誤和異常
```

## 🧪 測試

### 開發模式測試

1. 修改配置啟用開發模式
2. 訪問 `http://localhost:8080`
3. 應用會使用模擬用戶自動登入

### 功能測試清單

- [ ] 登入流程
- [ ] 投注選擇和提交
- [ ] 餘額更新
- [ ] 遊戲狀態同步
- [ ] 直播播放
- [ ] 歷史記錄查詢
- [ ] 網路斷線恢復
- [ ] Token 過期處理

## 📦 生產部署

### 部署前檢查清單

- [ ] 配置正確的 LIFF ID
- [ ] 配置正確的 API URL
- [ ] 啟用 HTTPS（必須）
- [ ] 設置正確的 CSP 策略
- [ ] 測試所有功能
- [ ] 檢查控制台無錯誤

### 建議的部署環境

- **靜態網站託管** - GitHub Pages、Netlify、Vercel
- **CDN 加速** - Cloudflare
- **HTTPS** - Let's Encrypt（必須）

### 性能優化建議

1. 啟用 Gzip 壓縮
2. 設置資源快取頭
3. 使用 CDN 分發靜態資源
4. 壓縮圖片和資源

## 🐛 故障排除

### 常見問題

**Q: 應用無法啟動，顯示配置錯誤**
A: 檢查 LIFF ID 和 API URL 是否正確配置

**Q: Token 過期錯誤**
A: 檢查後端 JWT 配置，確保過期時間合理（建議 7 天）

**Q: WebSocket 連接失敗**
A: 檢查 API URL 是否支持 WebSocket（Socket.IO）

**Q: 直播無法播放**
A: 檢查直播服務器配置和 CORS 設置

**Q: 模組載入失敗（404）**
A: 確保使用 HTTP 服務器，不能直接用 `file://` 協議

### 調試模式

在瀏覽器控制台輸入：

```javascript
// 查看應用實例（僅開發模式）
window.app

// 查看配置
window.app.config.getAll()

// 查看當前狀態
window.app.game.getGameState()
window.app.betting.getBetSummary()
```

## 📄 授權

本專案僅供內部使用，未經授權不得分發或商用。

## 👥 維護團隊

- 架構設計與開發：Claude AI
- 原始開發：原團隊

## 📝 更新日誌

### v2.0.0 (2025-10-24)

- 🎉 完全重構，模組化架構
- 🔒 安全性大幅提升
- 📦 ES6 模組化支持
- 🎨 CSS 變數設計系統
- 📊 統一日誌和錯誤處理
- 🚀 性能優化
- 📖 完整文檔

### v1.0.0 (舊版本)

- 基礎功能實現
- 單文件架構
- 硬編碼配置

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 📞 支援

如遇問題，請聯繫開發團隊或提交 Issue。

---

**注意**: 本專案需要配合後端 API 使用，請確保後端服務正常運行。
