# 彈珠聯盟 - MarbleLeague Player Frontend

## 📋 專案簡介

這是一個 LINE LIFF 遊戲投注平台的前端應用程式,使用現代化的技術棧重構,提供安全、高效、易維護的程式碼架構。

## 🚀 技術棧

### 核心框架
- **React 18** - 使用最新的 React 特性
- **TypeScript** - 提供型別安全
- **Vite** - 快速的建構工具

### 狀態管理
- **Zustand** - 輕量級狀態管理庫

### 通訊與即時功能
- **Socket.IO Client** - WebSocket 即時通訊
- **LIFF SDK** - LINE 平台整合
- **AWS IVS (Interactive Video Service)** - 互動式直播串流

### 直播串流
- **AWS IVS Web Broadcast SDK** - 觀眾加入直播
- **OvenPlayer** - 傳統 WebRTC 播放器 (向後相容)

### 程式碼品質
- **ESLint** - 程式碼檢查
- **Prettier** - 程式碼格式化
- **TypeScript Strict Mode** - 嚴格型別檢查

### 安全性
- **DOMPurify** - XSS 防護
- **環境變數管理** - 敏感資訊保護
- **CSP 標頭** - 內容安全政策
- **輸入驗證** - 完整的輸入清理與驗證

## 📁 專案架構

```
src/
├── assets/              # 靜態資源
├── components/          # React 組件
│   ├── betting/        # 投注相關組件
│   ├── game/           # 遊戲顯示組件
│   ├── live/           # 直播組件
│   ├── profile/        # 個人資料組件
│   ├── common/         # 共用組件 (Loading, Toast, Button)
│   └── layout/         # 版面組件
├── config/             # 配置管理
│   └── index.ts       # 應用程式配置
├── hooks/              # 自定義 React Hooks
│   ├── useAuth.ts     # 認證 Hook
│   ├── useWebSocket.ts # WebSocket Hook
│   ├── useCountdown.ts # 倒數計時 Hook
│   └── useBetting.ts  # 投注 Hook
├── services/           # 服務層
│   ├── api.ts         # API 服務
│   ├── liff.ts        # LIFF SDK 封裝
│   ├── websocket.ts   # WebSocket 管理
│   ├── awsIvs.ts      # AWS IVS 直播服務
│   └── storage.ts     # 安全的儲存管理
├── stores/             # Zustand 狀態管理
│   ├── useUserStore.ts    # 用戶狀態
│   ├── useGameStore.ts    # 遊戲狀態
│   ├── useBettingStore.ts # 投注狀態
│   └── useToastStore.ts   # Toast 通知
├── types/              # TypeScript 型別定義
│   └── index.ts       # 所有型別定義
├── utils/              # 工具函數
│   ├── security.ts    # 安全工具 (XSS 防護, 清理)
│   └── validation.ts  # 輸入驗證
├── App.tsx             # 主應用程式
└── main.tsx            # 入口點
```

## 🔒 安全性改善

### 1. 環境變數管理
- ✅ 移除 hardcoded 的 LIFF ID 和 API URL
- ✅ 使用 `.env` 文件管理敏感配置
- ✅ `.env` 已加入 `.gitignore`
- ✅ 提供 `.env.example` 作為範本

### 2. XSS 防護
- ✅ 使用 DOMPurify 清理所有 HTML 輸出
- ✅ 實作 `sanitizeHtml()` 函數
- ✅ 移除直接使用 `innerHTML` 的風險
- ✅ 實作輸入清理函數 `sanitizeInput()`

### 3. Token 管理
- ✅ 使用 Storage Service 統一管理
- ✅ 實作 token 驗證
- ✅ 自動處理 401 錯誤並清除無效 token
- ✅ 實作物件清理防止 prototype pollution

### 4. 安全標頭
- ✅ Content-Security-Policy (CSP)
- ✅ X-Content-Type-Options
- ✅ X-Frame-Options
- ✅ X-XSS-Protection
- ✅ Referrer-Policy

### 5. 輸入驗證
- ✅ 完整的投注金額驗證
- ✅ URL 清理與驗證
- ✅ 數字範圍檢查
- ✅ 格式驗證 (roundId, userId, token)

### 6. 生產建構
- ✅ 自動移除 console.log (透過 Terser)
- ✅ 程式碼壓縮與最小化
- ✅ 無 source maps (生產環境)

## 🛠️ 安裝與設定

### 1. 安裝依賴

```bash
npm install
```

### 2. 環境變數設定

複製 `.env.example` 為 `.env` 並填入您的配置:

```bash
cp .env.example .env
```

編輯 `.env`:

```env
VITE_LIFF_ID=your-liff-id-here
VITE_API_URL=https://your-api-url.com
VITE_ENV=production
```

### 3. 開發模式

**開發環境配置 (繞過 CORS)**:

```bash
# 複製開發環境範例檔
cp .env.development.example .env

# 或手動建立 .env
cat > .env << EOF
VITE_LIFF_ID=2008123093-KR57QjDP  # 預設 LIFF ID
VITE_API_URL=                      # 留空使用 Vite proxy
VITE_ENV=development
EOF
```

**啟動開發伺服器**:

```bash
npm run dev
```

應用程式將在 `http://localhost:3000` 啟動

**Vite Proxy 功能**:
- ✅ 自動代理 `/api` 到 `https://api.bjr8888.com`
- ✅ 自動代理 `/socket.io` WebSocket 連線
- ✅ 完全繞過瀏覽器 CORS 限制
- ✅ 無需配置後端 CORS headers

### 4. 建構生產版本

```bash
npm run build
```

建構完成的檔案會在 `dist/` 目錄

### 5. 預覽生產版本

```bash
npm run preview
```

## 📝 開發指南

### 添加新功能

1. **創建型別定義** - 在 `src/types/index.ts` 添加
2. **創建服務** - 在 `src/services/` 添加 API 或 WebSocket 處理
3. **創建 Store** - 在 `src/stores/` 使用 Zustand 管理狀態
4. **創建 Hook** - 在 `src/hooks/` 封裝邏輯
5. **創建組件** - 在 `src/components/` 實作 UI

### 程式碼風格

執行 ESLint:
```bash
npm run lint
```

格式化程式碼:
```bash
npm run format
```

### 安全最佳實踐

1. **永遠清理用戶輸入**
   ```typescript
   import { sanitizeInput } from '@/utils/security'
   const cleaned = sanitizeInput(userInput)
   ```

2. **清理 HTML 輸出**
   ```typescript
   import { sanitizeHtml } from '@/utils/security'
   const safe = sanitizeHtml(htmlContent)
   ```

3. **驗證數值**
   ```typescript
   import { validateBetAmount } from '@/utils/validation'
   const validation = validateBetAmount(amount)
   if (!validation.valid) {
     toast.error(validation.error)
   }
   ```

4. **使用 Toast 而非 alert**
   ```typescript
   import { toast } from '@/stores/useToastStore'
   toast.success('操作成功')
   toast.error('操作失敗')
   ```

## 📺 AWS IVS 直播整合

本應用程式整合了 AWS Interactive Video Service (IVS) 提供低延遲的互動式直播功能。

### 功能特性

- ✅ **觀眾服務** - 自動加入直播間並管理觀眾 Token
- ✅ **主播服務** - 支援推流 (WHIP 協議 / Web SDK)
- ✅ **心跳機制** - 每 30 秒自動發送心跳維持在線狀態
- ✅ **Token 自動刷新** - 提前 5 分鐘自動刷新 Token
- ✅ **即時統計** - WebSocket 推送觀眾數與直播狀態
- ✅ **雙模式支援** - 支援 AWS IVS 和 OvenPlayer (向後相容)

### 使用方式

#### 1. 環境設定

在 `.env` 中配置 (可選,預設使用 VITE_API_URL):

```env
# AWS IVS 配置 (可選)
VITE_AWS_IVS_API_URL=https://api.example.com
VITE_AWS_IVS_API_KEY=your-api-key
```

#### 2. 觀眾模式 (預設)

應用程式會自動以 AWS IVS 模式啟動直播功能:

```typescript
// LivePlayer 組件會自動處理
// 1. 獲取觀眾 Token
// 2. 加入 IVS Stage
// 3. 顯示主播視訊
// 4. 發送心跳維持連線
// 5. 顯示即時觀眾統計
```

#### 3. 切換到 OvenPlayer 模式

如需使用傳統 WebRTC 串流,在 URL 添加參數:

```
?mode=ovenplayer&host=stream.example.com&stream=live
```

### 服務架構

#### ViewerService (觀眾服務)

```typescript
import { createViewerService } from '@/services/awsIvs'

// 創建觀眾服務
const viewerService = createViewerService(userId)

// 加入直播
const tokenResponse = await viewerService.join()
// 自動處理: Token 獲取、心跳、自動刷新

// 離開直播
await viewerService.leave()
```

#### PublisherService (主播服務)

```typescript
import { createPublisherService } from '@/services/awsIvs'

// 創建主播服務
const publisherService = createPublisherService(userId)

// 開始推流
const tokenResponse = await publisherService.startPublishing()
// 返回 WHIP endpoint 和 Token 用於 OBS 或 Web SDK

// 停止推流
await publisherService.stopPublishing()
```

#### IVSStatsService (統計服務)

```typescript
import { ivsStatsService } from '@/services/awsIvs'

// 訂閱統計更新
ivsStatsService.onStatsUpdate((stats) => {
  console.log('觀眾數:', stats.totalViewers)
  console.log('直播狀態:', stats.isPublisherLive)
})
```

### API 端點

所有 AWS IVS API 端點已在 `src/config/index.ts` 中定義:

- `POST /api/token/viewer` - 獲取觀眾 Token
- `POST /api/token/publisher` - 獲取主播 Token
- `POST /api/viewer/heartbeat` - 發送心跳
- `POST /api/viewer/leave` - 離開直播
- `GET /api/stats` - 獲取統計資訊

### 配置參數

所有 AWS IVS 相關配置位於 `src/config/index.ts`:

```typescript
CONSTANTS.IVS = {
  VIEWER_TOKEN_EXPIRY: 3600,      // 1 小時
  PUBLISHER_TOKEN_EXPIRY: 14400,   // 4 小時
  HEARTBEAT_INTERVAL: 30000,       // 30 秒
  TOKEN_REFRESH_BUFFER: 300000,    // 提前 5 分鐘刷新
  MAX_VIEWERS_PER_STAGE: 50,       // 每個 Stage 最大觀眾數
}
```

### 開發文檔

詳細的 AWS IVS 整合文檔位於:

- `doc/AWS-IVS-Frontend-Integration-Guide.md` - 完整整合指南 (1700+ 行)
- `doc/AWS-IVS-Quick-Reference.md` - API 快速參考

## 🎯 核心功能

### 已實作

- ✅ LIFF 認證與用戶管理
- ✅ WebSocket 即時連線
- ✅ 狀態管理 (Zustand)
- ✅ API 服務層
- ✅ 安全的儲存管理
- ✅ Toast 通知系統
- ✅ 載入狀態管理
- ✅ 響應式設計
- ✅ 底部導航
- ✅ **AWS IVS 直播整合** (觀眾/主播服務、心跳、統計)
- ✅ **完整投注介面** (5 種投注類型)
- ✅ **遊戲結果顯示**
- ✅ **直播播放器** (AWS IVS + OvenPlayer 雙模式)
- ✅ **歷史記錄分頁**

### 可選擴展功能

- ⏳ 投注歷史詳細分析
- ⏳ 投注策略儲存
- ⏳ 趨勢分析圖表
- ⏳ 主題切換 (深色/淺色)
- ⏳ 多語言支援

## 🔧 配置選項

### Vite 配置 (`vite.config.ts`)

- **安全標頭** - CSP, X-Frame-Options 等
- **程式碼分割** - Vendor, Socket.IO 分離
- **壓縮設定** - 移除 console.log
- **路徑別名** - `@/` 指向 `src/`

### TypeScript 配置 (`tsconfig.json`)

- **嚴格模式** - 完整的型別檢查
- **路徑映射** - 支援 `@/` 別名
- **目標** - ES2020

### ESLint 配置 (`.eslintrc.cjs`)

- **React Hooks** 檢查
- **TypeScript** 規則
- **Console 警告** - 提醒移除 console.log

## 📦 部署

### 建構

```bash
npm run build
```

### 部署到靜態主機

建構完成後,將 `dist/` 目錄的內容部署到您的靜態主機:

- Netlify
- Vercel
- GitHub Pages
- AWS S3 + CloudFront
- 或任何靜態網站主機

### 環境變數

確保在部署平台設定相應的環境變數:

- `VITE_LIFF_ID`
- `VITE_API_URL`
- `VITE_ENV`

## 🐛 常見問題

### Q: LIFF 初始化失敗
A: 檢查 `.env` 中的 `VITE_LIFF_ID` 是否正確

### Q: API 請求失敗
A: 檢查 `.env` 中的 `VITE_API_URL` 並確保 CORS 設定正確

### Q: WebSocket 無法連線
A: 確保後端支援 Socket.IO 並檢查連線 URL

### Q: 開發模式看不到 LIFF 登入
A: 開發模式會使用 mock 認證,這是正常的

## 📄 授權

本專案為私有專案

## 👥 聯絡資訊

如有問題請聯絡開發團隊

---

## 🔄 從舊版遷移

舊版檔案已備份至 `old/` 目錄:
- `old/index.html` - 舊版 HTML
- `old/app.js` - 舊版主程式
- `old/app_auth_fixes.js` - 舊版認證
- `old/game-integration.js` - 舊版遊戲邏輯
- `old/live-player.js` - 舊版直播播放器

新版採用完全重構的架構,不與舊版相容,但保留所有功能。

## 🎉 版本歷史

### Version 1.0.1 (2025-10-24)
- 🚀 使用 React + TypeScript + Vite 完全重構
- 🔒 實作完整的安全防護措施
- 📦 採用現代化的專業架構
- ✨ 改善程式碼可維護性與擴展性
- 🎨 優化 UI/UX 設計
- ⚡ 提升效能與載入速度
