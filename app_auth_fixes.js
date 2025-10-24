// ===== API 請求封裝（修復版）=====
async function apiRequest(endpoint, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        }
    };

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        });

        console.log(`API 請求: ${endpoint}`, {
            status: response.status,
            hasAuth: !!authToken
        });

        if (!response.ok) {
            const error = await response.json();
            
            // 如果是認證錯誤，清除本地 token 並重新登入
            if (response.status === 401 || response.status === 403) {
                console.error('認證失敗，清除 token');
                authToken = null;
                localStorage.removeItem('authToken');
                
                // 如果不是登入請求，嘗試重新登入
                if (!endpoint.includes('/auth/liff-login')) {
                    showToast('登入已失效，請重新整理頁面');
                    setTimeout(() => {
                        window.location.reload();
                    }, 2000);
                }
            }
            
            throw new Error(error.error || `請求失敗 (${response.status})`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('API 請求錯誤:', {
            endpoint,
            error: error.message,
            hasToken: !!authToken
        });
        
        // 只在非登入請求時顯示錯誤
        if (!endpoint.includes('/auth/liff-login')) {
            showToast(error.message || '網路錯誤');
        }
        throw error;
    }
}

// ===== 登入到後端（修復版）=====
async function loginToBackend(profile) {
    try {
        console.log('嘗試登入後端:', {
            userId: profile.userId,
            displayName: profile.displayName
        });

        const data = await apiRequest('/api/auth/liff-login', {
            method: 'POST',
            body: JSON.stringify({
                userId: profile.userId,
                displayName: profile.displayName,
                pictureUrl: profile.pictureUrl,
                accessToken: profile.accessToken
            })
        });

        console.log('後端登入回應:', {
            success: data.success,
            hasToken: !!data.token,
            hasUser: !!data.user
        });

        if (data.success && data.token) {
            authToken = data.token;
            userProfile = data.user;
            
            // 儲存 token 到本地存儲
            localStorage.setItem('authToken', authToken);
            
            console.log('認證成功:', {
                userId: userProfile.userId,
                displayName: userProfile.displayName,
                balance: userProfile.balance,
                bettingStatus: userProfile.bettingStatus
            });

            // 檢查投注狀態 - 如果是禁投用戶，顯示禁投訊息但允許登入
            if (userProfile.bettingStatus === 'disabled') {
                showBettingDisabledMessage();
                return;
            }

            // 顯示主程式
            showApp();
            updateUserDisplay();
            
            // 載入初始資料
            await Promise.all([
                loadUserBalance(),
                loadBetOptions(),
                loadBettingLimits(),
                loadGameHistory()
            ]);

        } else {
            throw new Error(data.error || '登入回應格式錯誤');
        }

    } catch (error) {
        console.error('登入失敗:', error);
        
        // 清除可能的無效 token
        authToken = null;
        localStorage.removeItem('authToken');
        
        // 顯示錯誤訊息
        const loadingText = document.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = `登入失敗: ${error.message}`;
            loadingText.style.color = '#ff0000';
        }
        
        // 提供重試選項
        setTimeout(() => {
            if (loadingText) {
                loadingText.innerHTML = `
                    登入失敗<br>
                    <button onclick="window.location.reload()" 
                            style="margin-top: 10px; padding: 10px 20px; 
                                   background: #FF6B6B; color: white; 
                                   border: none; border-radius: 5px; cursor: pointer;">
                        重新嘗試
                    </button>
                `;
            }
        }, 2000);
    }
}

// ===== 顯示禁投訊息 =====
function showBettingDisabledMessage(error = '您已被禁止投注', reason = '未提供原因', disabledAt = null) {
    console.log('用戶被禁投:', { error, reason, disabledAt });
    
    // 清除載入畫面
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) {
        loadingDiv.remove();
    }
    
    // 顯示主程式但禁用投注功能
    showApp();
    updateUserDisplay();
    
    // 禁用所有投注相關功能
    disableBetting();

    // 移除已存在的橫幅（避免重複）
    const existingBanner = document.getElementById('bettingDisabledBanner');
    if (existingBanner) {
        existingBanner.remove();
    }

    // 創建禁投通知橫幅（插入到 header 下方）
    const banner = document.createElement('div');
    banner.id = 'bettingDisabledBanner';
    banner.style.cssText = `
        background: #FF7A6F;
        color: white;
        padding: 15px 20px;
        text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 15px;
        font-weight: 600;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        border-bottom: 2px solid rgba(255, 255, 255, 0.3);
        position: relative;
        z-index: 100;
    `;

    const formatDate = (dateStr) => {
        if (!dateStr) return '未知時間';
        try {
            return new Date(dateStr).toLocaleString('zh-TW');
        } catch {
            return '未知時間';
        }
    };

    banner.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap;">
            <span style="font-size: 20px;">🚫</span>
            <div style="flex: 1; min-width: 150px;">
                <div style="font-size: 15px;">投注功能已停用</div>
                ${reason && reason !== '未提供原因' ? `
                    <div style="font-size: 12px; opacity: 0.9; margin-top: 3px;">
                        ${reason}
                    </div>
                ` : ''}
            </div>
            <button onclick="showBettingDisabledDetails()" style="
                background: rgba(255, 255, 255, 0.25);
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.4);
                border-radius: 20px;
                padding: 6px 15px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.3s;
                font-weight: 500;
            " onmouseover="this.style.background='rgba(255, 255, 255, 0.35)'"
               onmouseout="this.style.background='rgba(255, 255, 255, 0.25)'">
                詳情
            </button>
        </div>
    `;

    // 插入到 header 後面
    const app = document.getElementById('app');
    const header = app ? app.querySelector('.header') : null;
    if (header) {
        header.after(banner);
    } else {
        document.body.appendChild(banner);
    }
    
    // 載入用戶資料（但不載入投注相關功能）
    loadUserBalance();
    loadGameHistory();
    
    // 儲存禁投詳細資訊供詳細資訊彈窗使用
    window.bettingDisabledInfo = {
        error,
        reason,
        disabledAt,
        formatDate
    };
}

// ===== 顯示禁投詳細資訊 =====
function showBettingDisabledDetails() {
    const info = window.bettingDisabledInfo;
    if (!info) return;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        padding: 20px;
        box-sizing: border-box;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 15px;
            padding: 30px;
            max-width: 400px;
            width: 100%;
            text-align: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ">
            <div style="
                font-size: 48px;
                margin-bottom: 20px;
                color: #ff6b6b;
            ">🚫</div>
            
            <h2 style="
                color: #333;
                margin: 0 0 15px 0;
                font-size: 20px;
            ">投注功能已停用</h2>
            
            <p style="
                color: #666;
                margin: 0 0 20px 0;
                line-height: 1.5;
            ">${info.error}</p>
            
            ${info.reason && info.reason !== '未提供原因' ? `
                <div style="
                    background: #f8f9fa;
                    border-radius: 10px;
                    padding: 15px;
                    margin: 20px 0;
                    border-left: 4px solid #ff6b6b;
                ">
                    <div style="font-size: 14px; color: #666; margin-bottom: 5px;">停用原因</div>
                    <div style="font-size: 15px; color: #333;">${info.reason}</div>
                </div>
            ` : ''}
            
            ${info.disabledAt ? `
                <div style="
                    font-size: 14px;
                    color: #666;
                    margin: 20px 0;
                ">
                    停用時間：${info.formatDate(info.disabledAt)}
                </div>
            ` : ''}
            
            <div style="
                font-size: 14px;
                color: #666;
                margin-top: 30px;
                padding: 15px;
                background: #f8f9fa;
                border-radius: 10px;
            ">
                如需恢復投注功能，請聯繫您的代理
            </div>
            
            <button onclick="this.closest('.modal').remove()" style="
                background: #ff6b6b;
                color: white;
                border: none;
                border-radius: 25px;
                padding: 12px 30px;
                font-size: 16px;
                cursor: pointer;
                margin-top: 20px;
                transition: all 0.3s ease;
            " onmouseover="this.style.background='#ff5252'" 
               onmouseout="this.style.background='#ff6b6b'">
                關閉
            </button>
        </div>
    `;
    
    modal.className = 'modal';
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
    
    document.body.appendChild(modal);
}

// ===== 禁用投注功能 =====
function disableBetting() {
    // 禁用所有投注按鈕
    document.querySelectorAll('.position-number, .option-btn, .sum-value-btn').forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
    });

    // 禁用提交按鈕
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.5';
        submitBtn.style.cursor = 'not-allowed';
        submitBtn.textContent = '投注功能已停用';
    }
    
    // 禁用投注金額選擇器
    document.querySelectorAll('.bet-amount-btn').forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
    });
    
    // 禁用自定義金額輸入
    const customAmountInput = document.getElementById('customAmount');
    if (customAmountInput) {
        customAmountInput.disabled = true;
        customAmountInput.style.opacity = '0.5';
        customAmountInput.placeholder = '投注功能已停用';
    }
}

// ===== 檢查儲存的認證（新增）=====
async function checkStoredAuth() {
    const savedToken = localStorage.getItem('authToken');
    
    if (savedToken) {
        console.log('發現儲存的 token，驗證中...');
        authToken = savedToken;
        
        try {
            // 嘗試使用儲存的 token 取得用戶資料
            const data = await apiRequest('/api/users/profile');
            
            if (data.userId) {
                userProfile = data;
                console.log('Token 驗證成功，直接登入');
                
                // 檢查投注狀態
                if (userProfile.bettingStatus === 'disabled') {
                    showBettingDisabledMessage();
                    return true; // 仍然返回 true，因為已經處理了禁投狀態
                }
                
                showApp();
                updateUserDisplay();
                
                await Promise.all([
                    loadUserBalance(),
                    loadBetOptions(), 
                    loadBettingLimits(),
                    loadGameHistory()
                ]);
                
                return true; // 表示已成功使用儲存的 token
            }
        } catch (error) {
            console.log('儲存的 token 無效，清除並重新登入');
            authToken = null;
            localStorage.removeItem('authToken');
        }
    }
    
    return false; // 表示需要重新登入
}

// ===== LIFF 初始化（修復版）=====
async function initializeLiff() {
    const loadingText = document.querySelector('.loading-text');

    try {
        // 首先檢查是否有有效的儲存認證
        const hasValidAuth = await checkStoredAuth();
        
        if (hasValidAuth) {
            console.log('使用儲存的認證成功');
            return;
        }

        // 開發模式檢測
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
            console.log('開發模式：使用模擬資料');
            if (loadingText) loadingText.textContent = '開發模式登入中...';
            await simulateLiffLogin();
            return;
        }

        if (loadingText) loadingText.textContent = '正在初始化 LIFF...';

        // 檢查 LIFF SDK 是否可用
        if (typeof liff === 'undefined') {
            throw new Error('LIFF SDK 未載入');
        }

        await liff.init({ liffId: LIFF_ID });

        if (!liff.isLoggedIn()) {
            console.log('用戶未登入 LINE，導向登入頁面');
            liff.login();
            return;
        }

        // 取得用戶資料
        if (loadingText) loadingText.textContent = '正在載入用戶資料...';
        
        const profile = await liff.getProfile();
        const accessToken = liff.getAccessToken();

        console.log('LIFF 資料取得成功:', {
            userId: profile.userId,
            displayName: profile.displayName,
            hasAccessToken: !!accessToken
        });

        // 登入到後端
        await loginToBackend({
            ...profile,
            accessToken
        });

    } catch (error) {
        console.error('LIFF 初始化失敗:', error);
        
        if (loadingText) {
            loadingText.textContent = `初始化失敗: ${error.message}`;
            loadingText.style.color = '#ff0000';
        }
        
        // 提供重試選項
        setTimeout(() => {
            if (loadingText) {
                loadingText.innerHTML = `
                    初始化失敗<br>
                    <button onclick="window.location.reload()" 
                            style="margin-top: 10px; padding: 10px 20px; 
                                   background: #FF6B6B; color: white; 
                                   border: none; border-radius: 5px; cursor: pointer;">
                        重新載入
                    </button>
                `;
            }
        }, 2000);
    }
}

// ===== 模擬 LIFF 登入（開發用）修復版 =====
async function simulateLiffLogin() {
    const testProfile = {
        userId: 'U-DEV-' + Date.now(),
        displayName: '開發測試用戶',
        pictureUrl: 'https://via.placeholder.com/100',
        accessToken: 'dev-token-' + Date.now()
    };

    console.log('模擬登入:', testProfile);
    await loginToBackend(testProfile);
}

// 在原有的 app.js 中，將上述函數替換對應的部分，其餘保持不變

// ===== 頁面載入時初始化（修復版）=====
window.addEventListener('load', () => {
    console.log('頁面載入完成，開始初始化');
    initializeLiff();
});

// ===== 錯誤邊界處理（新增）=====
window.addEventListener('error', (event) => {
    console.error('全域錯誤:', event.error);
    
    if (event.error.message.includes('auth') || event.error.message.includes('token')) {
        showToast('認證錯誤，請重新整理頁面');
    }
});

// ===== 網路狀態檢查（新增）=====
window.addEventListener('online', () => {
    console.log('網路連線恢復');
    showToast('網路連線恢復');
});

window.addEventListener('offline', () => {
    console.log('網路連線中斷');
    showToast('網路連線中斷，請檢查網路設定');
});
