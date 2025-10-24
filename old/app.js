// ===== 配置 =====
const DEFAULT_LIFF_ID = '2008123093-KR57QjDP'; // 預設 LIFF ID（可被覆寫）
const DEFAULT_API_URL = 'https://api.bjr8888.com'; // 預設後端（可被覆寫）
// 允許用 QueryString 或 localStorage 覆寫設定
function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

// 優先順序：URL ?query > localStorage > 預設值 (修改為 URL 優先，避免快取問題)
const LIFF_ID = (getQueryParam('liff') || localStorage.getItem('LIFF_ID') || DEFAULT_LIFF_ID).trim();
const API_URL = (getQueryParam('api') || localStorage.getItem('API_URL') || DEFAULT_API_URL).trim().replace(/\/$/, '');

// 若透過查詢參數提供，順便存到 localStorage，之後可直接開
try {
    const qpLiff = getQueryParam('liff');
    const qpApi = getQueryParam('api');
    if (qpLiff) localStorage.setItem('LIFF_ID', qpLiff);
    if (qpApi) localStorage.setItem('API_URL', qpApi);
} catch (_) {}

console.log('[Config] LIFF_ID:', LIFF_ID);
console.log('[Config] API_URL:', API_URL);

// ===== 全域變數 =====
let userProfile = null;
let userBalance = 0;
let authToken = null;
let currentBets = []; // 當前選擇的投注
let currentCategory = 'position';
let countdownInterval = null;
let timeLeft = 300;
let betOptions = null; // 存儲所有投注選項
let currentTab = 'gaming'; // 追蹤當前頁籤
let bettingLimits = {}; // 投注限額
let currentBetAmount = 100; // 當前選擇的投注金額
let userPeriodStats = null; // 用戶當期統計
let currentOdds = {}; // 存儲當前賠率

// ===== API 請求封裝 =====
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
            
            throw new Error(error.error || '請求失敗');
        }

        return await response.json();
    } catch (error) {
        console.error('API 請求錯誤:', error);
        showToast(error.message || '網路錯誤');
        throw error;
    }
}

// ===== LIFF 初始化 =====
async function initializeLiff() {
    const loadingText = document.querySelector('.loading-text');

    try {
        // 開發模式檢測
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
            console.log('開發模式：使用模擬資料');
            await simulateLiffLogin();
            return;
        }

        loadingText.textContent = '正在初始化 LIFF...';

        await liff.init({ liffId: LIFF_ID });

        if (!liff.isLoggedIn()) {
            liff.login();
            return;
        }

        // 取得用戶資料
        loadingText.textContent = '正在載入用戶資料...';
        const profile = await liff.getProfile();
        const accessToken = liff.getAccessToken();

        // 登入到後端
        await loginToBackend({
            ...profile,
            accessToken
        });

    } catch (error) {
        console.error('LIFF 初始化失敗:', error);
        loadingText.textContent = '初始化失敗，請重新整理';
    }
}

// ===== 模擬 LIFF 登入（開發用）=====
async function simulateLiffLogin() {
    const testProfile = {
        userId: 'U-DEV-' + Date.now(),
        displayName: '開發測試用戶',
        pictureUrl: 'https://via.placeholder.com/100',
        accessToken: 'dev-token'
    };

    await loginToBackend(testProfile);
}

// ===== 登入到後端 =====
async function loginToBackend(profile) {
    try {
        const data = await apiRequest('/api/auth/liff-login', {
            method: 'POST',
            body: JSON.stringify({
                userId: profile.userId,
                displayName: profile.displayName,
                pictureUrl: profile.pictureUrl,
                accessToken: profile.accessToken
            })
        });

        if (data.success) {
            authToken = data.token;
            userProfile = data.user;
            localStorage.setItem('authToken', authToken);

            // 檢查投注狀態 - 如果是禁投用戶，顯示禁投訊息但允許登入
            if (userProfile.bettingStatus === 'disabled') {
                showBettingDisabledMessage();
                return;
            }

            showApp();
            updateUserDisplay();
            await loadUserBalance();
            await loadBetOptions();
            await loadBettingLimits();
            await loadGameHistory();
        } else {
            throw new Error(data.error || '登入回應格式錯誤');
        }

    } catch (error) {
        console.error('登入失敗:', error);
        showToast('登入失敗，請重試');
    }
}

// ===== 顯示禁投訊息 =====
function showBettingDisabledMessage(error = '您已被禁止投注', reason = '未提供原因', disabledAt = null) {
    console.log('用戶被禁投:', { error, reason, disabledAt });
    
    // 清除載入畫面
    const loadingDiv = document.getElementById('loadingScreen');
    if (loadingDiv) {
        loadingDiv.style.display = 'none';
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

// ===== 顯示主程式 =====
function showApp() {
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('app').style.display = 'block';

    if (window.initLivePlayer) {
        window.initLivePlayer();
    }

    // 初始化投注金額選擇器
    initializeBetAmountSelector();

    // 初始化遊戲連接
    initializeGame();

    // 初始化投注區域
    updateBettingArea();

    // 更新提交區域顯示
    updateSubmitSectionVisibility();
}

// ===== 初始化投注金額選擇器 =====
function initializeBetAmountSelector() {
    // 在適當的位置插入金額選擇器
    const bettingArea = document.getElementById('bettingArea');
    const amountSelector = document.createElement('div');
    amountSelector.id = 'betAmountSelector';
    amountSelector.className = 'bet-amount-selector';
    amountSelector.innerHTML = `
        <div class="amount-selector-title">投注金額</div>
        <div class="amount-buttons">
            <button class="amount-btn" onclick="setBetAmount(10)">10</button>
            <button class="amount-btn" onclick="setBetAmount(50)">50</button>
            <button class="amount-btn active" onclick="setBetAmount(100)">100</button>
            <button class="amount-btn" onclick="setBetAmount(500)">500</button>
            <button class="amount-btn" onclick="setBetAmount(1000)">1000</button>
            <button class="amount-btn" onclick="showCustomAmount()">自訂</button>
        </div>
        <div class="current-amount">
            當前金額：<span id="currentAmountDisplay">100</span> 積分
        </div>
    `;

    // 插入到投注類型選擇下方
    const categoryTabs = document.querySelector('.bet-category-tabs');
    categoryTabs.parentNode.insertBefore(amountSelector, categoryTabs.nextSibling);
}

// ===== 設定投注金額 =====
function setBetAmount(amount) {
    currentBetAmount = amount;

    console.log('設定投注金額為:', currentBetAmount); // 調試用

    // 更新按鈕狀態
    document.querySelectorAll('.amount-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // 更新顯示
    document.getElementById('currentAmountDisplay').textContent = amount;

    // 更新投注摘要
    updateBetSummary();
}

// ===== 顯示自訂金額輸入 =====
function showCustomAmount() {
    const amount = prompt('請輸入投注金額：', currentBetAmount);
    if (amount && !isNaN(amount) && amount > 0) {
        const numAmount = parseInt(amount);

        console.log('輸入的自訂金額:', amount, '轉換後:', numAmount); // 調試用

        // 檢查限額 - 修正這裡的邏輯
        if (bettingLimits && Object.keys(bettingLimits).length > 0) {
            // 找出所有限額中的最小和最大值
            let minLimit = Number.MAX_SAFE_INTEGER;
            let maxLimit = 0;

            Object.values(bettingLimits).forEach(limit => {
                if (limit.minAmount < minLimit) minLimit = limit.minAmount;
                if (limit.maxAmount > maxLimit) maxLimit = limit.maxAmount;
            });

            console.log('限額範圍:', { minLimit, maxLimit }); // 調試用

            if (numAmount < minLimit) {
                showToast(`最小投注金額為 ${minLimit}`);
                return;
            }

            if (numAmount > maxLimit) {
                showToast(`最大投注金額為 ${maxLimit}`);
                return;
            }
        }

        currentBetAmount = numAmount;
        document.getElementById('currentAmountDisplay').textContent = numAmount;

        // 更新按鈕狀態
        document.querySelectorAll('.amount-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        updateBetSummary();
    }
}

// ===== 載入投注限額 =====
async function loadBettingLimits() {
    try {
        const data = await apiRequest('/api/game/betting-limits');
        bettingLimits = data.limits;
        console.log('投注限額載入完成:', bettingLimits);

        // 顯示限額資訊（調試用）
        Object.entries(bettingLimits).forEach(([type, limit]) => {
            (`${getBetTypeName(type)}: 最小 ${limit.minAmount}, 最大 ${limit.maxAmount}, 單期 ${limit.maxPerPeriod}`);
        });
    } catch (error) {
        console.error('載入投注限額失敗:', error);
    }
}

// ===== 檢查盤口限額 =====
async function checkMarketLimit(betType, amount) {
    try {
        const response = await apiRequest(`/api/game/market-status/${betType}`);

        if (response.used + amount > response.limit) {
            return {
                success: false,
                message: `${response.betTypeName} 盤口限額剩餘 ${response.remaining} 積分，無法投注 ${amount} 積分`,
                remaining: response.remaining
            };
        }

        return {
            success: true,
            remaining: response.remaining
        };

    } catch (error) {
        console.error('檢查盤口限額失敗:', error);
        // 如果查詢失敗，不阻止投注（讓後端做最終檢查）
        return { success: true };
    }
}

// ===== 限額檢查函數 =====
function checkBettingLimit(betType, betAmount) {
    if (!bettingLimits || !bettingLimits[betType]) {
        console.warn('找不到投注類型的限額設定:', betType);
        return true; // 如果沒有限額設定，允許投注
    }

    const limit = bettingLimits[betType];
    console.log(`檢查限額 - 類型: ${betType}, 金額: ${betAmount}, 限額:`, limit); // 調試用

    // 檢查單期限額
    // 計算當前已選擇的同類型投注總額
    let currentTypeTotal = 0;
    currentBets.forEach(bet => {
        if (bet.type === betType) {
            currentTypeTotal += bet.betAmount;
        }
    });

    // 如果有當期統計，加上已經提交的投注
    let periodUsed = 0;
    if (userPeriodStats && userPeriodStats.limits && userPeriodStats.limits[betType]) {
        periodUsed = userPeriodStats.limits[betType].used || 0;
    }

    // 計算總使用額度
    const totalWouldUse = periodUsed + currentTypeTotal + betAmount;

    console.log(`單槍限額檢查 - 已使用: ${periodUsed}, 當前選擇: ${currentTypeTotal}, 本次: ${betAmount}, 總計: ${totalWouldUse}, 單槍限額: ${limit.maxAmount}`);

    if (totalWouldUse > limit.maxAmount) {
        const remaining = limit.maxAmount - periodUsed - currentTypeTotal;
        if (remaining <= 0) {
            showToast(`${getBetTypeName(betType)} 已達單槍限額 ${limit.maxAmount} 積分`);
        } else {
            showToast(`${getBetTypeName(betType)} 單槍限額剩餘 ${remaining} 積分，目前投注 ${betAmount} 積分會超過限額`);
        }
        return false;
    }

    return true;
}

// ===== 輔助函數：獲取投注類型名稱 =====
function getBetTypeName(betType) {
    const names = {
        'position': '名次投注',
        'sum_value': '冠亞和值',
        'sum_big_small': '冠亞和大小',
        'sum_odd_even': '冠亞和單雙',
        'big_small': '大小',
        'odd_even': '單雙',
        'dragon_tiger': '龍虎'
    };
    return names[betType] || betType;
}

// ===== 載入用戶當期統計 =====
async function loadUserPeriodStats() {
    try {
        const data = await apiRequest('/api/game/user-period-stats');
        userPeriodStats = data;

        // 檢查是否為新回合
        if (gameState && gameState.currentRound) {
            if (!userPeriodStats.roundId || userPeriodStats.roundId !== gameState.currentRound) {
                // 新回合，重置統計
                console.log('偵測到新回合，重置限額統計');
                userPeriodStats = {
                    roundId: gameState.currentRound,
                    totalBets: 0,
                    totalAmount: 0,
                    limits: {}
                };
            }
        }

        updatePeriodStatsDisplay();
    } catch (error) {
        console.error('載入當期統計失敗:', error);
    }
}

// ===== 更新當期統計顯示 =====
function updatePeriodStatsDisplay() {
    if (!userPeriodStats || !userPeriodStats.roundId) return;

    // 可以在介面上顯示當期已投注金額和剩餘限額
    console.log('當期統計:', {
        回合: userPeriodStats.roundId,
        已投注數: userPeriodStats.totalBets,
        已投注金額: userPeriodStats.totalAmount
    });

    // 顯示各類型的使用情況
    if (userPeriodStats.limits) {
        Object.entries(userPeriodStats.limits).forEach(([type, limit]) => {
            if (limit.used > 0) {
                console.log(`${getBetTypeName(type)}: 已使用 ${limit.used}/${limit.maxPerPeriod} (剩餘 ${limit.remaining})`);
            }
        });
    }
}

// ===== 更新用戶顯示 =====
function updateUserDisplay() {
    if (!userProfile) return;

    // 頭部資訊
    document.getElementById('userAvatar').src = userProfile.pictureUrl || 'https://via.placeholder.com/40';
    document.getElementById('userName').textContent = userProfile.displayName;

    // 個人頁面資訊
    document.getElementById('profileName').textContent = userProfile.displayName;
    document.getElementById('profileId').textContent = userProfile.userId;
    document.getElementById('profileAvatar').src = userProfile.pictureUrl || 'https://via.placeholder.com/80';
}

// ===== 載入用戶餘額 =====
async function loadUserBalance() {
    try {
        const data = await apiRequest(`/api/points/balance/${userProfile.userId}`);

        userBalance = data.balance;
        document.getElementById('userBalance').textContent = userBalance.toLocaleString();
        document.getElementById('profileBalance').textContent = userBalance.toLocaleString();

    } catch (error) {
        console.error('載入餘額失敗:', error);
    }
}

// ===== 載入投注選項（包含動態賠率）=====
async function loadBetOptions() {
    try {
        betOptions = await apiRequest('/api/game/bet-options');
        console.log('投注選項載入完成', betOptions);

        // 更新當前顯示的投注區域以反映新賠率
        updateBettingArea();
    } catch (error) {
        console.error('載入投注選項失敗:', error);
    }
}

// ===== 切換頁面 =====
function switchTab(tabName) {
    currentTab = tabName; // 更新當前頁籤

    // 更新頁籤狀態
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');

    // 更新頁面顯示
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');

    // 更新提交區域顯示
    updateSubmitSectionVisibility();

    // 特殊處理
    if (tabName === 'history') {
        loadGameHistory();
    }
}

// ===== 更新提交區域顯示 =====
function updateSubmitSectionVisibility() {
    const submitSection = document.querySelector('.submit-section');
    if (submitSection) {
        // 只在遊戲頁面顯示提交區域
        submitSection.style.display = currentTab === 'gaming' ? 'block' : 'none';
    }
}

// ===== 前往投注頁面 =====
function goToBetting() {
    // 切換到遊戲頁面
    currentTab = 'gaming';

    // 更新頁籤狀態
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.tab === 'gaming') {
            tab.classList.add('active');
        }
    });

    // 更新頁面顯示
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById('gaming').classList.add('active');

    // 更新提交區域顯示
    updateSubmitSectionVisibility();

    // 顯示提示訊息
    showToast('已切換到投注頁面');
}

// ===== 選擇投注類別 =====
function selectBetCategory(category) {
    currentCategory = category;

    // 更新選中狀態
    document.querySelectorAll('.bet-category').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    updateBettingArea();
}

// ===== 更新投注區域 =====
function updateBettingArea() {
    const area = document.getElementById('bettingArea');
    if (!area) return;

    // 保留金額選擇器
    const amountSelector = document.getElementById('betAmountSelector');

    let html = '';
    switch (currentCategory) {
        case 'position':
            html = createPositionBetHTML();
            break;
        case 'sum':
            html = createSumBetHTML();
            break;
        case 'bigSmall':
            html = createBigSmallHTML();
            break;
        case 'oddEven':
            html = createOddEvenHTML();
            break;
        case 'dragonTiger':
            html = createDragonTigerHTML();
            break;
    }

    area.innerHTML = html;

    // 將金額選擇器移回來
    if (amountSelector) {
        area.insertBefore(amountSelector, area.firstChild);
    }

    // 恢復已選中的狀態
    restoreSelectedState();

    // 根據遊戲狀態更新按鈕
    if (!gameState || !gameState.canBet) {
        disableBetting();
    }
}

// ===== 創建名次投注 HTML（支援動態賠率）=====
function createPositionBetHTML() {
    let html = '<div class="position-bet-container">';

    // 添加賠率資訊和快捷選擇
    const positionOdds = betOptions?.positions?.[0]?.odds || 9.8;
    html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">';
    html += `<div style="color: #666;">賠率 1:${positionOdds}</div>`;
    html += '<div class="quick-select-container" style="margin-bottom: 0;">';
    html += '<span class="quick-select-label">快捷選擇：</span>';
    html += '<button class="quick-btn" onclick="quickSelectAll()">全選</button>';
    html += '<button class="quick-btn" onclick="quickSelectBig()">大</button>';
    html += '<button class="quick-btn" onclick="quickSelectSmall()">小</button>';
    html += '<button class="quick-btn" onclick="quickSelectOdd()">單</button>';
    html += '<button class="quick-btn" onclick="quickSelectEven()">雙</button>';
    html += '<button class="quick-btn" onclick="quickClearAll()">清除</button>';
    html += '</div>';
    html += '</div>';

    // 標題行
    html += '<div class="position-header">';
    html += '<div class="position-label">名次</div>';
    for (let i = 1; i <= 10; i++) {
        html += `<div class="position-label">${i}</div>`;
    }
    html += '</div>';

    // 每個名次的行
    for (let pos = 1; pos <= 10; pos++) {
        html += '<div class="position-row">';
        html += `<div class="position-label">第${pos}名</div>`;

        for (let num = 1; num <= 10; num++) {
            html += `<div class="position-number" onclick="togglePositionBet(${pos}, ${num})" 
                     data-position="${pos}" data-number="${num}">${num}</div>`;
        }

        html += '</div>';
    }

    html += '</div>';
    return html;
}

// ===== 快捷選擇功能（加入批量限額檢查）=====
function quickSelectAll() {
    const position = getCurrentPositionFromUI();
    if (!position) {
        showToast('請先點擊要投注的名次');
        return;
    }

    // 計算將要添加的投注總額
    const willAddCount = 10 - currentBets.filter(bet =>
        bet.type === 'position' && bet.position === position
    ).length;

    const willAddAmount = willAddCount * currentBetAmount;

    // 計算已有的同類型投注總額
    let existingAmount = 0;
    currentBets.forEach(bet => {
        if (bet.type === 'position') {
            existingAmount += bet.betAmount;
        }
    });

    // 檢查是否會超過限額
    if (bettingLimits['position']) {
        const limit = bettingLimits['position'];
        let periodUsed = 0;

        if (userPeriodStats && userPeriodStats.limits && userPeriodStats.limits['position']) {
            periodUsed = userPeriodStats.limits['position'].used || 0;
        }

        const totalWouldUse = periodUsed + existingAmount + willAddAmount;

        if (totalWouldUse > limit.maxAmount) {
            const remaining = limit.maxAmount - periodUsed - existingAmount;
            showToast(`名次投注單槍限額剩餘 ${remaining} 積分，全選需要 ${willAddAmount} 積分`);
            return;
        }
    }

    for (let num = 1; num <= 10; num++) {
        addPositionBet(position, num);
    }
    updateSelectedState();
    updateBetSummary();
}

function quickSelectBig() {
    const position = getCurrentPositionFromUI();
    if (!position) {
        showToast('請先點擊要投注的名次');
        return;
    }

    // 計算將要添加的投注
    const numbers = [6, 7, 8, 9, 10];
    const existingBets = currentBets.filter(bet =>
        bet.type === 'position' && bet.position === position && numbers.includes(bet.content[0])
    );

    const willAddCount = numbers.length - existingBets.length;
    const willAddAmount = willAddCount * currentBetAmount;

    // 計算已有的同類型投注總額
    let existingAmount = 0;
    currentBets.forEach(bet => {
        if (bet.type === 'position') {
            existingAmount += bet.betAmount;
        }
    });

    // 檢查限額
    if (bettingLimits['position']) {
        const limit = bettingLimits['position'];
        let periodUsed = 0;

        if (userPeriodStats && userPeriodStats.limits && userPeriodStats.limits['position']) {
            periodUsed = userPeriodStats.limits['position'].used || 0;
        }

        const totalWouldUse = periodUsed + existingAmount + willAddAmount;

        if (totalWouldUse > limit.maxAmount) {
            const remaining = limit.maxAmount - periodUsed - existingAmount;
            showToast(`名次投注單槍限額剩餘 ${remaining} 積分，大號需要 ${willAddAmount} 積分`);
            return;
        }
    }

    for (let num = 6; num <= 10; num++) {
        addPositionBet(position, num);
    }
    updateSelectedState();
    updateBetSummary();
}

function quickSelectSmall() {
    const position = getCurrentPositionFromUI();
    if (!position) {
        showToast('請先點擊要投注的名次');
        return;
    }

    // 計算將要添加的投注
    const numbers = [1, 2, 3, 4, 5];
    const existingBets = currentBets.filter(bet =>
        bet.type === 'position' && bet.position === position && numbers.includes(bet.content[0])
    );

    const willAddCount = numbers.length - existingBets.length;
    const willAddAmount = willAddCount * currentBetAmount;

    // 計算已有的同類型投注總額
    let existingAmount = 0;
    currentBets.forEach(bet => {
        if (bet.type === 'position') {
            existingAmount += bet.betAmount;
        }
    });

    // 檢查限額
    if (bettingLimits['position']) {
        const limit = bettingLimits['position'];
        let periodUsed = 0;

        if (userPeriodStats && userPeriodStats.limits && userPeriodStats.limits['position']) {
            periodUsed = userPeriodStats.limits['position'].used || 0;
        }

        const totalWouldUse = periodUsed + existingAmount + willAddAmount;

        if (totalWouldUse > limit.maxAmount) {
            const remaining = limit.maxAmount - periodUsed - existingAmount;
            showToast(`名次投注單槍限額剩餘 ${remaining} 積分，小號需要 ${willAddAmount} 積分`);
            return;
        }
    }

    for (let num = 1; num <= 5; num++) {
        addPositionBet(position, num);
    }
    updateSelectedState();
    updateBetSummary();
}

function quickSelectOdd() {
    const position = getCurrentPositionFromUI();
    if (!position) {
        showToast('請先點擊要投注的名次');
        return;
    }

    // 計算將要添加的投注
    const numbers = [1, 3, 5, 7, 9];
    const existingBets = currentBets.filter(bet =>
        bet.type === 'position' && bet.position === position && numbers.includes(bet.content[0])
    );

    const willAddCount = numbers.length - existingBets.length;
    const willAddAmount = willAddCount * currentBetAmount;

    // 計算已有的同類型投注總額
    let existingAmount = 0;
    currentBets.forEach(bet => {
        if (bet.type === 'position') {
            existingAmount += bet.betAmount;
        }
    });

    // 檢查限額
    if (bettingLimits['position']) {
        const limit = bettingLimits['position'];
        let periodUsed = 0;

        if (userPeriodStats && userPeriodStats.limits && userPeriodStats.limits['position']) {
            periodUsed = userPeriodStats.limits['position'].used || 0;
        }

        const totalWouldUse = periodUsed + existingAmount + willAddAmount;

        if (totalWouldUse > limit.maxAmount) {
            const remaining = limit.maxAmount - periodUsed - existingAmount;
            showToast(`名次投注單槍限額剩餘 ${remaining} 積分，單號需要 ${willAddAmount} 積分`);
            return;
        }
    }

    for (let num = 1; num <= 10; num += 2) {
        addPositionBet(position, num);
    }
    updateSelectedState();
    updateBetSummary();
}

function quickSelectEven() {
    const position = getCurrentPositionFromUI();
    if (!position) {
        showToast('請先點擊要投注的名次');
        return;
    }

    // 計算將要添加的投注
    const numbers = [2, 4, 6, 8, 10];
    const existingBets = currentBets.filter(bet =>
        bet.type === 'position' && bet.position === position && numbers.includes(bet.content[0])
    );

    const willAddCount = numbers.length - existingBets.length;
    const willAddAmount = willAddCount * currentBetAmount;

    // 計算已有的同類型投注總額
    let existingAmount = 0;
    currentBets.forEach(bet => {
        if (bet.type === 'position') {
            existingAmount += bet.betAmount;
        }
    });

    // 檢查限額
    if (bettingLimits['position']) {
        const limit = bettingLimits['position'];
        let periodUsed = 0;

        if (userPeriodStats && userPeriodStats.limits && userPeriodStats.limits['position']) {
            periodUsed = userPeriodStats.limits['position'].used || 0;
        }

        const totalWouldUse = periodUsed + existingAmount + willAddAmount;

        if (totalWouldUse > limit.maxAmount) {
            const remaining = limit.maxAmount - periodUsed - existingAmount;
            showToast(`名次投注單槍限額剩餘 ${remaining} 積分，雙號需要 ${willAddAmount} 積分`);
            return;
        }
    }

    for (let num = 2; num <= 10; num += 2) {
        addPositionBet(position, num);
    }
    updateSelectedState();
    updateBetSummary();
}

function quickClearAll() {
    if (currentCategory === 'position') {
        // 清除所有名次投注
        currentBets = currentBets.filter(bet => bet.type !== 'position');
    } else {
        // 清除當前類別的投注
        currentBets = currentBets.filter(bet => !bet.type.includes(currentCategory));
    }
    updateSelectedState();
    updateBetSummary();
}

// ===== 獲取當前操作的名次 =====
let lastClickedPosition = null;

function getCurrentPositionFromUI() {
    return lastClickedPosition;
}

// ===== 添加名次投注（不重複）=====
function addPositionBet(position, number) {
    // 檢查用戶是否被禁止投注
    if (userProfile && userProfile.bettingStatus === 'disabled') {
        showToast('您已被禁止投注');
        return;
    }

    // 檢查是否可以投注
    if (!gameState || !gameState.canBet) {
        showToast('目前無法投注');
        return;
    }

    const betId = `position_${position}_${number}`;
    const existingIndex = currentBets.findIndex(bet => bet.id === betId);

    if (existingIndex === -1) {
        currentBets.push({
            id: betId,
            type: 'position',
            position: position,
            content: [number],
            betAmount: currentBetAmount,  // 使用當前選擇的金額
            display: `第${position}名: ${number}號`
        });
    }
}

// ===== 投注選擇函數（支援多選）=====
function togglePositionBet(position, number) {
    // 記錄最後點擊的名次
    lastClickedPosition = position;

    // 檢查用戶是否被禁止投注
    if (userProfile && userProfile.bettingStatus === 'disabled') {
        showToast('您已被禁止投注');
        return;
    }

    // 檢查是否可以投注
    if (!gameState || !gameState.canBet) {
        showToast('目前無法投注');
        return;
    }

    const betId = `position_${position}_${number}`;
    const existingIndex = currentBets.findIndex(bet => bet.id === betId);

    if (existingIndex > -1) {
        currentBets.splice(existingIndex, 1);
    } else {
        // 新增投注前檢查限額
        if (!checkBettingLimit('position', currentBetAmount)) {
            return; // checkBettingLimit 會顯示 toast
        }

        const newBet = {
            id: betId,
            type: 'position',
            position: position,
            content: [number],
            betAmount: currentBetAmount,
            display: `第${position}名: ${number}號`
        };
        console.log('新增投注:', newBet, '當前金額:', currentBetAmount);
        currentBets.push(newBet);
    }

    updateSelectedState();
    updateBetSummary();
}

// ===== 創建冠亞和投注 HTML（使用動態賠率）=====
function createSumBetHTML() {
    let html = '<div>';

    // 冠亞和值
    html += '<h3 style="margin-bottom: 15px;">冠亞和值</h3>';
    html += '<div class="sum-value-grid">';

    if (betOptions && betOptions.sumValues) {
        betOptions.sumValues.forEach(item => {
            html += `
                <div class="sum-value-btn" onclick="toggleSumValue(${item.value})" 
                     data-value="${item.value}">
                    <div class="sum-value">${item.value}</div>
                    <div class="sum-odds">1:${item.odds}</div>
                </div>
            `;
        });
    }

    html += '</div>';

    // 冠亞和大小單雙（顯示動態賠率）
    html += '<h3 style="margin: 20px 0 15px;">冠亞和大小單雙</h3>';
    html += '<div class="option-grid">';

    if (betOptions && betOptions.sumOptions) {
        betOptions.sumOptions.forEach(option => {
            if (option.type === 'sum_big_small') {
                option.options.forEach(opt => {
                    html += `
                        <button class="option-btn" onclick="toggleSumOption('${option.type}', '${opt.value}')" 
                                data-type="${option.type}" data-value="${opt.value}">
                            <div>${opt.name} ${opt.value === 'big' ? '(≥12)' : '(≤11)'}</div>
                            <div class="odds-display">1:${opt.odds}</div>
                        </button>
                    `;
                });
            } else if (option.type === 'sum_odd_even') {
                option.options.forEach(opt => {
                    html += `
                        <button class="option-btn" onclick="toggleSumOption('${option.type}', '${opt.value}')" 
                                data-type="${option.type}" data-value="${opt.value}">
                            <div>${opt.name}</div>
                            <div class="odds-display">1:${opt.odds}</div>
                        </button>
                    `;
                });
            }
        });
    }

    html += '</div>';
    html += '</div>';
    return html;
}

// ===== 創建大小投注 HTML（使用動態賠率）=====
function createBigSmallHTML() {
    let html = '<div>';

    // 在頂部顯示賠率資訊
    const bigSmallOdds = betOptions?.positionOptions?.[0]?.bigSmall?.odds || 1.98;
    html += '<div style="text-align: center; margin-bottom: 20px; color: #666;">';
    html += `賠率 1:${bigSmallOdds}`;
    html += '</div>';

    for (let pos = 1; pos <= 10; pos++) {
        html += `
            <div style="margin-bottom: 15px;">
                <h4 style="margin-bottom: 10px;">第${pos}名</h4>
                <div class="option-grid">
                    <button class="option-btn" onclick="toggleBigSmall(${pos}, 'big')" 
                            data-position="${pos}" data-value="big">
                        大 (6-10)
                    </button>
                    <button class="option-btn" onclick="toggleBigSmall(${pos}, 'small')" 
                            data-position="${pos}" data-value="small">
                        小 (1-5)
                    </button>
                </div>
            </div>
        `;
    }

    html += '</div>';
    return html;
}

// ===== 創建單雙投注 HTML（使用動態賠率）=====
function createOddEvenHTML() {
    let html = '<div>';

    // 在頂部顯示賠率資訊
    const oddEvenOdds = betOptions?.positionOptions?.[0]?.oddEven?.odds || 1.98;
    html += '<div style="text-align: center; margin-bottom: 20px; color: #666;">';
    html += `賠率 1:${oddEvenOdds}`;
    html += '</div>';

    for (let pos = 1; pos <= 10; pos++) {
        html += `
            <div style="margin-bottom: 15px;">
                <h4 style="margin-bottom: 10px;">第${pos}名</h4>
                <div class="option-grid">
                    <button class="option-btn" onclick="toggleOddEven(${pos}, 'odd')" 
                            data-position="${pos}" data-value="odd">
                        單數
                    </button>
                    <button class="option-btn" onclick="toggleOddEven(${pos}, 'even')" 
                            data-position="${pos}" data-value="even">
                        雙數
                    </button>
                </div>
            </div>
        `;
    }

    html += '</div>';
    return html;
}

// ===== 創建龍虎投注 HTML（使用動態賠率）=====
function createDragonTigerHTML() {
    let html = '<div class="dragon-tiger-grid">';

    // 在頂部顯示賠率資訊
    const dragonTigerOdds = betOptions?.dragonTiger?.[0]?.odds || 1.98;
    html += '<div style="text-align: center; margin-bottom: 20px; color: #666; grid-column: 1/-1;">';
    html += `賠率 1:${dragonTigerOdds}`;
    html += '</div>';

    if (betOptions && betOptions.dragonTiger) {
        betOptions.dragonTiger.forEach(pair => {
            html += `
                <div class="dragon-tiger-item">
                    <div class="dragon-tiger-title">${pair.name}</div>
                    <div class="dragon-tiger-options">
                        <button class="option-btn" onclick="toggleDragonTiger(${pair.position}, 'dragon')" 
                                data-position="${pair.position}" data-value="dragon">
                            ${pair.dragon} 龍
                        </button>
                        <button class="option-btn" onclick="toggleDragonTiger(${pair.position}, 'tiger')" 
                                data-position="${pair.position}" data-value="tiger">
                            ${pair.tiger} 虎
                        </button>
                    </div>
                </div>
            `;
        });
    }

    html += '</div>';
    return html;
}

// ===== 其他投注類型函數（加入限額檢查）=====
function toggleSumValue(value) {
    // 檢查用戶是否被禁止投注
    if (userProfile && userProfile.bettingStatus === 'disabled') {
        showToast('您已被禁止投注');
        return;
    }

    if (!gameState || !gameState.canBet) {
        showToast('目前無法投注');
        return;
    }

    const betId = `sum_value_${value}`;
    const existingIndex = currentBets.findIndex(bet => bet.id === betId);

    if (existingIndex > -1) {
        currentBets.splice(existingIndex, 1);
    } else {
        // 檢查限額
        if (!checkBettingLimit('sum_value', currentBetAmount)) {
            return;
        }

        currentBets.push({
            id: betId,
            type: 'sum_value',
            content: [value],
            betAmount: currentBetAmount,
            display: `冠亞和值: ${value}`
        });
    }

    updateSelectedState();
    updateBetSummary();
}

function toggleSumOption(type, value) {
    // 檢查用戶是否被禁止投注
    if (userProfile && userProfile.bettingStatus === 'disabled') {
        showToast('您已被禁止投注');
        return;
    }

    if (!gameState || !gameState.canBet) {
        showToast('目前無法投注');
        return;
    }

    const betId = `${type}_${value}`;
    const existingIndex = currentBets.findIndex(bet => bet.id === betId);

    if (existingIndex > -1) {
        currentBets.splice(existingIndex, 1);
    } else {
        // 檢查限額
        if (!checkBettingLimit(type, currentBetAmount)) {
            return;
        }

        // 移除同類型的其他選擇
        currentBets = currentBets.filter(bet => bet.type !== type);

        const displayMap = {
            'sum_big_small': {
                'big': '冠亞和: 大',
                'small': '冠亞和: 小'
            },
            'sum_odd_even': {
                'odd': '冠亞和: 單',
                'even': '冠亞和: 雙'
            }
        };

        currentBets.push({
            id: betId,
            type: type,
            content: [value],
            betAmount: currentBetAmount,
            display: displayMap[type][value]
        });
    }

    updateSelectedState();
    updateBetSummary();
}

function toggleBigSmall(position, value) {
    // 檢查用戶是否被禁止投注
    if (userProfile && userProfile.bettingStatus === 'disabled') {
        showToast('您已被禁止投注');
        return;
    }

    if (!gameState || !gameState.canBet) {
        showToast('目前無法投注');
        return;
    }

    const betId = `big_small_${position}_${value}`;
    const existingIndex = currentBets.findIndex(bet => bet.id === betId);

    if (existingIndex > -1) {
        currentBets.splice(existingIndex, 1);
    } else {
        // 檢查限額
        if (!checkBettingLimit('big_small', currentBetAmount)) {
            return;
        }

        // 移除同位置的其他選擇
        currentBets = currentBets.filter(bet =>
            !(bet.type === 'big_small' && bet.position === position)
        );

        currentBets.push({
            id: betId,
            type: 'big_small',
            position: position,
            content: [value],
            betAmount: currentBetAmount,
            display: `第${position}名: ${value === 'big' ? '大' : '小'}`
        });
    }

    updateSelectedState();
    updateBetSummary();
}

function toggleOddEven(position, value) {
    // 檢查用戶是否被禁止投注
    if (userProfile && userProfile.bettingStatus === 'disabled') {
        showToast('您已被禁止投注');
        return;
    }

    if (!gameState || !gameState.canBet) {
        showToast('目前無法投注');
        return;
    }

    const betId = `odd_even_${position}_${value}`;
    const existingIndex = currentBets.findIndex(bet => bet.id === betId);

    if (existingIndex > -1) {
        currentBets.splice(existingIndex, 1);
    } else {
        // 檢查限額
        if (!checkBettingLimit('odd_even', currentBetAmount)) {
            return;
        }

        // 移除同位置的其他選擇
        currentBets = currentBets.filter(bet =>
            !(bet.type === 'odd_even' && bet.position === position)
        );

        currentBets.push({
            id: betId,
            type: 'odd_even',
            position: position,
            content: [value],
            betAmount: currentBetAmount,
            display: `第${position}名: ${value === 'odd' ? '單' : '雙'}`
        });
    }

    updateSelectedState();
    updateBetSummary();
}

function toggleDragonTiger(position, value) {
    // 檢查用戶是否被禁止投注
    if (userProfile && userProfile.bettingStatus === 'disabled') {
        showToast('您已被禁止投注');
        return;
    }

    if (!gameState || !gameState.canBet) {
        showToast('目前無法投注');
        return;
    }

    const betId = `dragon_tiger_${position}_${value}`;
    const existingIndex = currentBets.findIndex(bet => bet.id === betId);

    if (existingIndex > -1) {
        currentBets.splice(existingIndex, 1);
    } else {
        // 檢查限額
        if (!checkBettingLimit('dragon_tiger', currentBetAmount)) {
            return;
        }

        // 移除同位置的其他選擇
        currentBets = currentBets.filter(bet =>
            !(bet.type === 'dragon_tiger' && bet.position === position)
        );

        const pair = betOptions.dragonTiger[position - 1];
        currentBets.push({
            id: betId,
            type: 'dragon_tiger',
            position: position,
            content: [value],
            betAmount: currentBetAmount,
            display: `${pair.name}: ${value === 'dragon' ? '龍' : '虎'}`
        });
    }

    updateSelectedState();
    updateBetSummary();
}

// ===== 更新選中狀態 =====
function updateSelectedState() {
    // 清除所有選中狀態
    document.querySelectorAll('.selected').forEach(el => {
        el.classList.remove('selected');
    });

    // 根據 currentBets 更新選中狀態
    currentBets.forEach(bet => {
        if (bet.type === 'position') {
            const el = document.querySelector(`[data-position="${bet.position}"][data-number="${bet.content[0]}"]`);
            if (el) el.classList.add('selected');
        } else if (bet.type === 'sum_value') {
            const el = document.querySelector(`[data-value="${bet.content[0]}"].sum-value-btn`);
            if (el) el.classList.add('selected');
        } else if (bet.type.includes('sum_')) {
            const el = document.querySelector(`[data-type="${bet.type}"][data-value="${bet.content[0]}"]`);
            if (el) el.classList.add('selected');
        } else if (['big_small', 'odd_even', 'dragon_tiger'].includes(bet.type)) {
            const el = document.querySelector(`[data-position="${bet.position}"][data-value="${bet.content[0]}"]`);
            if (el) el.classList.add('selected');
        }
    });
}

// ===== 恢復選中狀態 =====
function restoreSelectedState() {
    updateSelectedState();
}

// ===== 計算預期獲勝金額（使用動態賠率）=====
function calculateExpectedWin(betType, betContent, betAmount, position = null) {
    if (!betOptions) return 0;

    let odds = 0;

    switch (betType) {
        case 'position':
            odds = betOptions.positions?.[0]?.odds || 9.8;
            break;

        case 'sum_value':
            const sumValue = betOptions.sumValues?.find(v => v.value === betContent[0]);
            odds = sumValue?.odds || 0;
            break;

        case 'sum_big_small':
            const sumBS = betOptions.sumOptions?.find(o => o.type === 'sum_big_small');
            const bsOpt = sumBS?.options?.find(o => o.value === betContent[0]);
            odds = bsOpt?.odds || 0;
            break;

        case 'sum_odd_even':
            const sumOE = betOptions.sumOptions?.find(o => o.type === 'sum_odd_even');
            const oeOpt = sumOE?.options?.find(o => o.value === betContent[0]);
            odds = oeOpt?.odds || 0;
            break;

        case 'big_small':
            odds = betOptions.positionOptions?.[0]?.bigSmall?.odds || 1.98;
            break;

        case 'odd_even':
            odds = betOptions.positionOptions?.[0]?.oddEven?.odds || 1.98;
            break;

        case 'dragon_tiger':
            odds = betOptions.dragonTiger?.[0]?.odds || 1.98;
            break;
    }

    return Math.floor(betAmount * odds);
}

// ===== 更新投注摘要（顯示預期獲勝金額）=====
function updateBetSummary() {
    const summary = document.getElementById('betSummary');
    const betList = document.getElementById('betList');
    const betCount = document.getElementById('betCount');
    const submitBtn = document.getElementById('submitBtn');

    // 計算總金額
    const totalAmount = currentBets.reduce((sum, bet) => sum + (bet.betAmount || 100), 0);

    if (currentBets.length === 0) {
        summary.classList.remove('active');
        submitBtn.disabled = true;
    } else {
        summary.classList.add('active');
        submitBtn.disabled = false;

        betList.innerHTML = currentBets.map(bet => {
            const expectedWin = calculateExpectedWin(bet.type, bet.content, bet.betAmount, bet.position);
            return `
                <div class="bet-item">
                    <div>
                        <span>${bet.display} - ${bet.betAmount || 100} 積分</span>
                        <span class="expected-win" style="color: #4CAF50; font-size: 12px; margin-left: 10px;">
                            預期獲勝: ${expectedWin} 積分
                        </span>
                    </div>
                    <span class="bet-remove" onclick="removeBet('${bet.id}')">移除</span>
                </div>
            `;
        }).join('');
    }

    betCount.textContent = currentBets.length;

    // 更新按鈕文字顯示總金額
    submitBtn.textContent = `確認投注 (${totalAmount} 積分)`;
}

// ===== 移除投注 =====
function removeBet(betId) {
    currentBets = currentBets.filter(bet => bet.id !== betId);
    updateSelectedState();
    updateBetSummary();
}

// ===== 提交所有投注（修正限額檢查）=====
async function submitAllBets() {
    // 檢查用戶是否被禁止投注
    if (userProfile && userProfile.bettingStatus === 'disabled') {
        showToast('您已被禁止投注');
        return;
    }

    // 檢查是否可以投注（從 game-integration.js 整合）
    if (!gameState || !gameState.canBet) {
        showToast('目前無法投注');
        return;
    }

    if (currentBets.length === 0) {
        showToast('請選擇投注項目');
        return;
    }

    const totalCost = currentBets.reduce((sum, bet) => sum + (bet.betAmount || 100), 0);

    if (userBalance < totalCost) {
        showToast('積分不足，請聯繫您的代理');
        return;
    }

    // 載入當期統計檢查限額
    await loadUserPeriodStats();

    // 重新計算每種類型的總投注額，檢查是否超過單槍限額
    const betTypeTotals = {};

    // 統計當前要提交的投注
    currentBets.forEach(bet => {
        if (!betTypeTotals[bet.type]) {
            betTypeTotals[bet.type] = 0;
        }
        betTypeTotals[bet.type] += bet.betAmount;
    });

    // 檢查每種類型的單槍限額（個人單期總額限制）
    for (const [betType, typeTotal] of Object.entries(betTypeTotals)) {
        if (!bettingLimits[betType]) continue;

        const limit = bettingLimits[betType];
        let periodUsed = 0;

        if (userPeriodStats && userPeriodStats.limits && userPeriodStats.limits[betType]) {
            periodUsed = userPeriodStats.limits[betType].used || 0;
        }

        const totalWouldUse = periodUsed + typeTotal;

        console.log(`單槍限額檢查 - ${getBetTypeName(betType)}: 已使用 ${periodUsed}, 本次 ${typeTotal}, 總計 ${totalWouldUse}, 單槍限額 ${limit.maxAmount}`);

        // 檢查是否達到最小限額要求
        if (totalWouldUse < limit.minAmount) {
            const required = limit.minAmount - totalWouldUse;
            showToast(`${getBetTypeName(betType)} 單槍最小限額為 ${limit.minAmount} 積分，還需投注 ${required} 積分`);
            return; // 直接中止，不允許提交
        }

        // 檢查是否超過單槍限額
        if (totalWouldUse > limit.maxAmount) {
            const remaining = limit.maxAmount - periodUsed;
            if (remaining <= 0) {
                showToast(`${getBetTypeName(betType)} 已達單槍限額 ${limit.maxAmount} 積分`);
            } else {
                showToast(`${getBetTypeName(betType)} 單槍限額剩餘 ${remaining} 積分，本次投注 ${typeTotal} 積分會超過限額`);
            }
            return;
        }

    }

    // 檢查盤口限額（全平台單期總額限制）
    showToast('正在檢查盤口狀態...', false);

    for (const [betType, typeTotal] of Object.entries(betTypeTotals)) {
        const marketCheck = await checkMarketLimit(betType, typeTotal);

        if (!marketCheck.success) {
            showToast(marketCheck.message);
            return;
        }
    }

    // 移除檢查中的提示
    const checkingToast = document.getElementById('toast');
    if (checkingToast && checkingToast.textContent === '正在檢查盤口狀態...') {
        checkingToast.style.display = 'none';
    }

    showConfirmModal();
}

// ===== 顯示確認彈窗 =====
function showConfirmModal() {
    const modal = document.getElementById('confirmModal');
    const modalBody = document.getElementById('modalBody');

    const totalCost = currentBets.reduce((sum, bet) => sum + (bet.betAmount || 100), 0);

    // 安全地獲取回合號
    let roundNumber = '未知';
    if (gameState && gameState.currentRound) {
        roundNumber = gameState.currentRound;
    } else {
        // 嘗試從 roundInfo 中提取
        const roundInfo = document.getElementById('roundInfo');
        if (roundInfo && roundInfo.textContent.includes('-第-')) {
            const match = roundInfo.textContent.match(/-第-\s*(\S+)\s*-回合-/);
            if (match && match[1]) {
                roundNumber = match[1];
            }
        }
    }

    modalBody.innerHTML = `
        <div style="margin-bottom: 20px;">
            <p style="font-size: 18px; margin-bottom: 15px;">
                <strong>回合：</strong>第 ${roundNumber} 回合
            </p>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                <h4 style="margin-bottom: 10px;">投注項目</h4>
                ${currentBets.map(bet => {
        const expectedWin = calculateExpectedWin(bet.type, bet.content, bet.betAmount, bet.position);
        return `
                        <div style="padding: 5px 0; border-bottom: 1px solid #e0e0e0;">
                            ${bet.display} - ${bet.betAmount || 100} 積分
                            <span style="color: #4CAF50; font-size: 12px;">
                                (預期獲勝: ${expectedWin} 積分)
                            </span>
                        </div>
                    `;
    }).join('')}
            </div>
            <p style="font-size: 16px; margin-bottom: 10px;">
                <strong>投注數量：</strong>${currentBets.length} 個
            </p>
            <p style="font-size: 16px; margin-bottom: 10px;">
                <strong>總計消耗：</strong>${totalCost} 積分
            </p>
            <p style="color: #666; font-size: 14px;">
                剩餘積分：${userBalance - totalCost}
            </p>
        </div>
    `;

    modal.classList.add('active');
}

// ===== 關閉彈窗 =====
function closeModal() {
    document.getElementById('confirmModal').classList.remove('active');
}

// ===== 確認所有投注（整合遊戲狀態檢查）=====
async function confirmAllBets() {
    closeModal();

    // 檢查用戶是否被禁止投注
    if (userProfile && userProfile.bettingStatus === 'disabled') {
        showToast('您已被禁止投注');
        return;
    }

    // 再次檢查是否可以投注（從 game-integration.js 整合）
    if (!gameState || !gameState.canBet) {
        showToast('投注時間已結束');
        return;
    }

    const loadingToast = showToast('正在提交投注...', false);

    try {
        // 準備批量投注資料
        const betsData = currentBets.map(bet => ({
            betType: bet.type,
            betContent: bet.content,
            position: bet.position || null,
            betAmount: bet.betAmount || currentBetAmount || 100  // 確保金額正確傳遞
        }));

        console.log('提交的投注資料:', betsData); // 調試用

        // 使用批量投注 API
        const response = await apiRequest('/api/game/batch-play', {
            method: 'POST',
            body: JSON.stringify({ bets: betsData })
        });

        // 隱藏載入提示
        if (loadingToast) loadingToast.remove();

        if (response.success) {
            showToast(`成功提交 ${response.betCount} 個投注！`);

            // 清空當前投注
            currentBets = [];
            updateBetSummary();
            updateSelectedState();

            // 更新餘額
            await loadUserBalance();

            // 更新當期統計
            await loadUserPeriodStats();

            // 播放成功音效（可選）
            playSuccessSound();

            // 如果在 LINE 內，發送訊息
            if (typeof liff !== 'undefined' && liff.isInClient()) {
                try {
                    await liff.sendMessages([{
                        type: 'text',
                        text: `🎮 投注成功\n回合：${response.roundId}\n數量：${response.betCount} 個\n消耗：${response.totalAmount} 積分\n餘額：${response.balance}`
                    }]);
                } catch (error) {
                    console.error('發送訊息失敗', error);
                }
            }
        } else {
            showToast('投注失敗，請重試');
        }

    } catch (error) {
        console.error('提交投注失敗:', error);
        showToast(error.message || '提交失敗，請重試');
        if (loadingToast) loadingToast.remove();
    }
}

// ===== 載入遊戲歷史 =====
async function loadGameHistory() {
    try {
        const data = await apiRequest('/api/game/history?limit=20');
        const historyList = document.getElementById('historyList');

        if (data.games.length === 0) {
            historyList.innerHTML = '<p style="text-align: center; color: #666;">暫無遊戲記錄</p>';
            return;
        }

        historyList.innerHTML = data.games.map(game => {
            const statusClass = game.status === 'win' ? 'status-win' :
                game.status === 'lose' ? 'status-lose' : '';
            const statusText = game.status === 'win' ? '獲勝' :
                game.status === 'lose' ? '未中' : '等待結果';

            return `
                <div class="history-item">
                    <div class="history-header">
                        <div>
                            <div style="font-weight: bold;">第 ${game.roundId} 回合</div>
                            <div style="font-size: 12px; color: #666;">
                                ${new Date(game.createdAt).toLocaleString('zh-TW')}
                            </div>
                        </div>
                        <div class="status-badge ${statusClass}">${statusText}</div>
                    </div>
                    <div style="margin-bottom: 10px;">
                        <span style="color: #666;">${game.betTypeName || game.betType}</span>
                        <span style="font-weight: bold;">${game.betContentDisplay || JSON.stringify(game.betContent)}</span>
                        <span style="color: #FF6B6B;"> - ${game.betAmount} 積分</span>
                    </div>
                    ${game.winAmount > 0 ? `
                        <div style="color: #4CAF50; font-weight: bold;">
                            贏得: ${game.winAmount} 積分
                        </div>
                    ` : ''}
                    ${game.round && game.round.result ? `
                        <div class="history-numbers">
                            ${game.round.result.map(n =>
                `<div class="history-number">${n}</div>`
            ).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('載入遊戲歷史失敗:', error);
    }
}

// ===== 修正的輔助函數 =====
function showToast(message, autoHide = true) {
    let toast = document.getElementById('toast');

    // 如果找不到 toast 元素，創建一個
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 15px 30px;
            border-radius: 30px;
            z-index: 10000;
            display: none;
            max-width: 80%;
            text-align: center;
            animation: slideUp 0.3s;
            white-space: pre-line;
        `;
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.display = 'block';

    if (autoHide) {
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }

    return toast;
}

// ===== 音效功能 =====
function playSuccessSound() {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBi');
    audio.volume = 0.3;
    audio.play().catch(e => console.log('音效播放失敗'));
}

// ===== 頁面載入時初始化 =====
window.addEventListener('load', () => {
    // 檢查是否有儲存的 token
    const savedToken = localStorage.getItem('authToken');
    if (savedToken) {
        authToken = savedToken;
    }

    initializeLiff();
});
