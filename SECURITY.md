# 安全性說明文件

## 🔒 已實作的安全措施

### 1. 環境變數保護 ✅

**問題**: 敏感資訊 hardcoded 在原始碼中
- LIFF ID: `2008123093-KR57QjDP`
- API URL: `https://api.bjr8888.com`

**解決方案**:
- 使用 `.env` 文件管理配置
- `.env` 已加入 `.gitignore`
- 提供 `.env.example` 作為範本
- Vite 環境變數透過 `import.meta.env` 安全存取

**實作位置**:
- `.env` - 環境變數配置
- `src/config/index.ts` - 配置管理

---

### 2. XSS (Cross-Site Scripting) 防護 ✅

**問題**: 原始碼大量使用 `.innerHTML` 且無輸入清理

**解決方案**:
- 使用 **DOMPurify** 清理所有 HTML
- 實作 `sanitizeHtml()` 函數
- 實作 `escapeHtml()` 函數
- 實作 `sanitizeInput()` 清理用戶輸入
- React 預設會 escape 輸出,避免 XSS

**實作位置**:
- `src/utils/security.ts` - 所有安全工具函數
- 使用範例:
  ```typescript
  import { sanitizeHtml, sanitizeInput } from '@/utils/security'

  // 清理 HTML
  const safeHtml = sanitizeHtml(untrustedHtml)

  // 清理輸入
  const safeInput = sanitizeInput(userInput)
  ```

---

### 3. Token 管理改善 ✅

**問題**: Token 直接存在 localStorage 且無保護

**解決方案**:
- 統一使用 **Storage Service** 管理
- 實作物件清理防止 prototype pollution
- 自動處理 401 錯誤並清除 token
- 實作 token 格式驗證
- API 請求時驗證 token 有效性

**實作位置**:
- `src/services/storage.ts` - 安全儲存服務
- `src/services/api.ts` - API 服務層處理 401
- `src/utils/validation.ts` - Token 驗證

**保護措施**:
```typescript
// 防止 prototype pollution
sanitizeObject({ __proto__: {...} }) // 會被過濾

// Token 驗證
validateToken(token) // 檢查長度與格式

// 401 自動處理
if (response.status === 401) {
  storage.clearAuth()
  throw new Error('認證失敗,請重新登入')
}
```

---

### 4. Content Security Policy (CSP) ✅

**問題**: 無 CSP 標頭,容易受到注入攻擊

**解決方案**:
- Vite 開發伺服器設定 CSP 標頭
- 限制 script, style, img 來源
- 允許必要的外部資源 (LINE CDN, Socket.IO)

**實作位置**:
- `vite.config.ts` - server.headers
- `index.html` - meta tags

**CSP 設定**:
```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.line-scdn.net https://cdn.socket.io https://cdn.jsdelivr.net;
style-src 'self' 'unsafe-inline';
img-src 'self' data: https: blob:;
connect-src 'self' wss: ws: https:;
```

---

### 5. 輸入驗證 ✅

**問題**: 缺少完整的輸入驗證

**解決方案**:
- 實作完整的驗證函數庫
- 投注金額驗證 (範圍, 倍數)
- 餘額檢查
- 格式驗證 (roundId, userId, period)
- 數值範圍檢查

**實作位置**:
- `src/utils/validation.ts` - 所有驗證函數

**驗證函數**:
```typescript
validateBetAmount(amount, min, max)
validatePosition(position)
validateSum(sum)
hasSufficientBalance(balance, amount)
validateRoundId(roundId)
validateUserId(userId)
validateToken(token)
validatePeriod(period)
validateOdds(odds)
```

---

### 6. 生產建構安全 ✅

**問題**: 敏感的 console.log 可能洩露資訊

**解決方案**:
- Terser 壓縮時自動移除 console.log
- Source maps 在生產環境關閉
- 程式碼最小化與混淆

**實作位置**:
- `vite.config.ts` - build.terserOptions

**設定**:
```typescript
terserOptions: {
  compress: {
    drop_console: true,
    drop_debugger: true,
  },
}
```

---

### 7. API 安全 ✅

**問題**: API 請求缺少統一的錯誤處理

**解決方案**:
- 統一的 API Service
- Bearer Token 認證
- CORS 正確配置
- 自動重試機制 (可選)
- 錯誤統一處理

**實作位置**:
- `src/services/api.ts`

**特性**:
```typescript
// 自動添加 Bearer Token
headers['Authorization'] = `Bearer ${token}`

// 統一錯誤處理
if (!response.ok) {
  if (response.status === 401) {
    storage.clearAuth()
  }
  throw new Error(errorData.message)
}

// 不傳送 cookies
credentials: 'omit'
```

---

### 8. WebSocket 安全 ✅

**問題**: WebSocket 連線缺少認證

**解決方案**:
- 連線時傳送 auth token
- 自動重連機制
- 錯誤處理
- 事件訂閱管理

**實作位置**:
- `src/services/websocket.ts`

**安全連線**:
```typescript
io(config.apiUrl, {
  auth: {
    token,  // 認證 token
  },
  transports: ['websocket', 'polling'],
  reconnection: true,
})
```

---

### 9. 安全標頭 ✅

**實作的安全標頭**:

| 標頭 | 值 | 用途 |
|------|-----|------|
| Content-Security-Policy | (見上方) | 防止注入攻擊 |
| X-Content-Type-Options | nosniff | 防止 MIME 類型嗅探 |
| X-Frame-Options | SAMEORIGIN | 防止點擊劫持 |
| X-XSS-Protection | 1; mode=block | 啟用瀏覽器 XSS 過濾 |
| Referrer-Policy | strict-origin-when-cross-origin | 控制 Referrer 資訊 |

**實作位置**:
- `vite.config.ts` - server.headers
- `index.html` - meta tags

---

### 10. 程式碼品質與安全 ✅

**工具**:
- **TypeScript** - 型別安全
- **ESLint** - 程式碼檢查
- **Prettier** - 程式碼格式化
- **Strict Mode** - 嚴格型別檢查

**規則**:
```typescript
// ESLint 安全規則
'no-console': ['warn', { allow: ['warn', 'error'] }]
'@typescript-eslint/no-explicit-any': 'warn'

// TypeScript 嚴格模式
"strict": true,
"noUnusedLocals": true,
"noUnusedParameters": true,
```

---

## 🚨 仍需注意的安全事項

### 1. HTTPS 必須使用
生產環境必須使用 HTTPS,否則:
- Token 可能被攔截
- WebSocket 可能不安全
- Cookie 無法設定 Secure flag

### 2. Rate Limiting
前端無法實作有效的 rate limiting,必須由後端實作:
- API 請求限制
- 投注頻率限制
- 登入嘗試限制

### 3. 後端驗證
所有前端驗證都必須在後端重複驗證:
- 投注金額
- 餘額檢查
- 遊戲狀態
- 權限檢查

### 4. Token 過期
建議實作:
- Token 過期機制
- Refresh token
- 自動續期

### 5. 審計日誌
建議後端記錄:
- 所有投注行為
- 認證事件
- 異常行為

---

## 🔐 安全檢查清單

部署前請確認:

- [ ] `.env` 不在 git 中
- [ ] 生產環境使用 HTTPS
- [ ] CSP 標頭正確設定
- [ ] API 有適當的 rate limiting
- [ ] 後端驗證所有輸入
- [ ] Token 有過期機制
- [ ] 日誌記錄已啟用
- [ ] 錯誤訊息不洩露敏感資訊
- [ ] WebSocket 連線有認證
- [ ] CORS 設定正確

---

## 📚 相關資源

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [DOMPurify 文檔](https://github.com/cure53/DOMPurify)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [React Security](https://reactjs.org/docs/dom-elements.html#dangerouslysetinnerhtml)

---

**最後更新**: 2025-10-24
**版本**: 2.0.0
