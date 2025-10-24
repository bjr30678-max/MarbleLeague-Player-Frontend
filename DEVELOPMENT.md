# 開發模式指南

## 🔧 開發環境說明

本應用程式在開發環境下會自動啟用模擬模式，這是正常且預期的行為。

### 開發模式觸發條件

當符合以下任一條件時，應用程式會進入開發模式：

1. `VITE_ENV=development` (在 .env 中設定)
2. `hostname === 'localhost'`
3. `hostname === '127.0.0.1'`

---

## ⚠️ 開發模式的控制台訊息

### 預期的警告訊息

以下訊息是**正常的開發環境行為**，不會影響生產環境：

#### 1. LIFF 模擬驗證

```
🔧 開發模式: 使用模擬 LIFF 驗證
   這是正常的開發環境行為，不會影響生產環境
```

**說明**:
- 開發環境使用模擬的 LINE LIFF 認證
- 自動創建測試用戶
- 餘額設定為 10,000
- 生產環境會使用真實的 LIFF SDK

#### 2. WebSocket 連線錯誤

```
🔧 WebSocket 連線錯誤 (開發模式)
   這在開發環境中是正常的，如果後端服務未啟動
   嘗試連線到: https://api.bjr8888.com
   錯誤: Timeout
```

**說明**:
- 如果後端 API 服務未啟動，會看到此訊息
- 應用程式會自動以離線模式運行
- 前端功能仍可正常使用和測試
- 生產環境連線到真實的 WebSocket 伺服器

#### 3. WebSocket 連線成功

```
✅ WebSocket 已連線
```

**說明**:
- 當成功連線到後端時顯示
- 即時功能將正常運作

#### 4. WebSocket 斷線

```
⚠️ WebSocket 已斷線: transport close
```

**說明**:
- WebSocket 連線中斷
- 應用程式會自動嘗試重連
- 最多重試 5 次

---

## 🚀 開發環境設定

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定環境變數

複製 `.env.example` 為 `.env`:

```bash
cp .env.example .env
```

編輯 `.env`:

```env
VITE_LIFF_ID=your-liff-id-here
VITE_API_URL=http://localhost:8080  # 本地後端
VITE_ENV=development
```

### 3. 啟動開發伺服器

```bash
npm run dev
```

應用程式將在 `http://localhost:3000` 啟動

---

## 🔌 後端服務 (可選)

如果想測試完整功能 (包括 WebSocket)，需要啟動後端服務：

### 後端需提供的 API

1. **認證 API**
   - `POST /api/auth/liff-login`

2. **用戶 API**
   - `GET /api/user/balance`

3. **投注 API**
   - `GET /api/betting/options`
   - `GET /api/betting/limits`
   - `POST /api/bets/submit`

4. **遊戲 API**
   - `GET /api/games/current`
   - `GET /api/games/history`
   - `GET /api/results/recent`

5. **WebSocket 事件**
   - `round-started`
   - `betting-closed`
   - `result-confirmed`
   - `balance-updated`

### 無後端開發

即使沒有後端服務，前端仍可正常運行：

- ✅ UI 組件可以正常瀏覽
- ✅ 投注介面可以操作
- ✅ 模擬用戶資料
- ❌ 無法提交真實投注
- ❌ 無法獲取即時遊戲狀態

---

## 🐛 常見開發問題

### Q: 為什麼看到 "WebSocket 連線錯誤"?

**A**: 這是正常的，如果後端服務未啟動。應用程式會以離線模式運行。

### Q: 模擬用戶的餘額可以修改嗎?

**A**: 可以，編輯 `src/services/liff.ts` 中的 mock 用戶設定：

```typescript
this.mockUser = {
  userId: 'dev-user-' + Date.now(),
  displayName: '測試用戶',
  pictureUrl: 'https://via.placeholder.com/150',
  balance: 10000, // 修改這裡
}
```

### Q: 如何測試不同的投注狀態?

**A**: 在沒有後端的情況下，可以直接修改 store 的狀態：

```typescript
// 在瀏覽器控制台
import { useGameStore } from '@/stores/useGameStore'

// 修改遊戲狀態
useGameStore.setState({
  currentGame: {
    roundId: 'test-round',
    period: 12345,
    status: 'betting', // 'waiting' | 'betting' | 'closed' | 'finished'
    countdown: 30,
    timestamp: Date.now(),
  }
})
```

### Q: 如何測試 Toast 通知?

**A**: 在瀏覽器控制台：

```typescript
import { toast } from '@/stores/useToastStore'

toast.success('測試成功訊息')
toast.error('測試錯誤訊息')
toast.warning('測試警告訊息')
toast.info('測試資訊訊息')
```

---

## 📝 開發模式 vs 生產模式

| 功能 | 開發模式 | 生產模式 |
|------|----------|----------|
| LIFF 認證 | 模擬 | 真實 LINE LIFF |
| API 請求 | 可選 | 必需 |
| WebSocket | 可選 | 必需 |
| Console 訊息 | 詳細 | 最小化 |
| 錯誤處理 | 友善提示 | 靜默處理 |
| Source Maps | 啟用 | 禁用 |
| 程式碼壓縮 | 否 | 是 |

---

## 🔍 除錯技巧

### 1. 查看 Redux DevTools

安裝 Redux DevTools 擴充功能可以查看 Zustand 狀態：

```typescript
// stores 已配置 devtools
```

### 2. 查看網路請求

在 Chrome DevTools 的 Network 標籤中：
- 篩選 "Fetch/XHR" 查看 API 請求
- 篩選 "WS" 查看 WebSocket 連線

### 3. React Developer Tools

安裝 React DevTools 可以：
- 檢視組件樹
- 查看 props 和 state
- 追蹤效能

### 4. 清除快取

如果遇到問題，嘗試清除 localStorage：

```typescript
// 在瀏覽器控制台
localStorage.clear()
location.reload()
```

---

## ⚙️ 開發配置

### Vite 開發伺服器

- **Port**: 3000
- **HMR**: 啟用
- **CORS**: 啟用

### TypeScript

- **Strict Mode**: 啟用
- **Source Maps**: 啟用

### ESLint

- **Auto Fix**: 建議啟用
- **Rules**: 參見 `.eslintrc.cjs`

---

## 📦 建構測試

在部署前，務必測試建構：

```bash
npm run build
npm run preview
```

這會：
1. 編譯 TypeScript
2. 建構 Vite 專案
3. 在本地預覽生產版本

---

**最後更新**: 2025-10-24
**版本**: 2.0.0
