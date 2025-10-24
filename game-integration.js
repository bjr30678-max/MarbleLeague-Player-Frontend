// ===== 遊戲狀態管理 =====
let gameState = {
    currentRound: null,
    roundStatus: 'waiting', // waiting, betting, closed, finished
    timeLeft: 0,
    canBet: false,
    lastResults: [],
    socket: null
};

// ===== 初始化遊戲連接 =====
async function initializeGame() {
    console.log('初始化遊戲連接...');

    // 連接 WebSocket
    connectGameSocket();

    // 載入當前回合資訊
    await loadCurrentRound();

    // 載入最近開獎結果
    await loadRecentResults();

    // 開始同步計時器
    startGameTimer();
}

// ===== WebSocket 連接 =====
function connectGameSocket() {
    const socket = io(API_URL, {
        auth: {
            token: authToken
        }
    });

    gameState.socket = socket;

    socket.on('connect', () => {
        console.log('已連接到遊戲伺服器');
    });

    socket.on('disconnect', () => {
        console.log('與遊戲伺服器斷開連線');
    });

    // 新回合開始
    socket.on('round-started', (data) => {
        console.log('新回合開始:', data);
        gameState.currentRound = data.roundId;
        gameState.roundStatus = 'betting';
        gameState.canBet = true;
        gameState.timeLeft = 60; // 預設60秒

        updateRoundDisplay();
        updateLiveRaceInfo({
            roundId: data.roundId,
            status: 'betting',
            startTime: data.startTime || new Date()
        });
        showToast('新回合開始，可投注');

        // 清空之前的投注
        currentBets = [];
        updateBetSummary();

        // 重置當期統計
        userPeriodStats = {
            roundId: data.roundId,
            totalBets: 0,
            totalAmount: 0,
            limits: {}
        };
        updatePeriodStatsDisplay();

        // 重新啟用投注
        enableBetting();
    });

    // 封盤通知
    socket.on('betting-closed', (data) => {
        console.log('已封盤:', data);
        gameState.roundStatus = 'closed';
        gameState.canBet = false;
        gameState.timeLeft = 0; // 清除剩餘時間

        updateRoundDisplay();
        updateLiveRaceInfo({
            roundId: data.roundId || gameState.currentRound,
            status: 'closed'
        });
        showToast('本回合已封盤');

        // 禁用投注按鈕
        disableBetting();
    });

    // 開獎結果
    socket.on('result-confirmed', (data) => {
        console.log('開獎結果:', data);
        gameState.roundStatus = 'finished';
        gameState.canBet = false;
        gameState.currentRound = null; // 清除當前回合

        // 顯示開獎結果
        displayResults(data.result);
        updateLiveRaceInfo({
            roundId: data.roundId,
            status: 'finished'
        });

        // 重新載入歷史記錄
        loadGameHistory();

        // 更新餘額
        loadUserBalance();

        // 更新最近結果
        loadRecentResults();

        // 5秒後更新為等待狀態
        setTimeout(() => {
            if (!gameState.currentRound) {
                updateWaitingDisplay();
            }
        }, 5000);
    });

    // 其他玩家下注通知（可選）
    socket.on('new-bet', (data) => {
        console.log('有新的投注:', data);
        // 可以顯示即時投注資訊
    });
}

// ===== 載入當前期數 =====
async function loadCurrentRound() {
    try {
        const data = await apiRequest('/api/game/current-round');

        if (data.status === 'waiting') {
            gameState.roundStatus = 'waiting';
            gameState.canBet = false;
            gameState.currentRound = null;
            updateWaitingDisplay();
        } else {
            gameState.currentRound = data.roundId;
            gameState.roundStatus = data.status;
            gameState.timeLeft = data.timeLeft || 0;
            gameState.canBet = data.canBet || false;

            updateRoundDisplay();
            updateLiveRaceInfo({
                roundId: data.roundId,
                status: data.status,
                startTime: data.startTime || data.createdAt || new Date()
            });

            await loadUserPeriodStats();

            if (gameState.canBet) {
                enableBetting();
            } else {
                disableBetting();
            }
        }

    } catch (error) {
        console.error('載入期數資訊失敗:', error);
    }
}

// ===== 載入最近開獎結果 =====
async function loadRecentResults() {
    try {
        const results = await apiRequest('/api/game/results?limit=10');
        gameState.lastResults = results;

        // 顯示最近一期結果
        if (results.length > 0) {
            displayLastResult(results[0]);
        }

    } catch (error) {
        console.error('載入開獎結果失敗:', error);
    }
}

// ===== 遊戲計時器 =====
function startGameTimer() {
    // 清除舊的計時器
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }

    countdownInterval = setInterval(() => {
        if (gameState.timeLeft > 0 && gameState.roundStatus === 'betting') {
            gameState.timeLeft--;
            updateCountdown();

            // 時間到自動封盤
            if (gameState.timeLeft === 0) {
                gameState.canBet = false;
                gameState.roundStatus = 'closed';
                disableBetting();
                updateRoundDisplay(); // 更新顯示狀態
                updateLiveRaceInfo({ roundId: gameState.currentRound, status: 'closed' });
            }
        } else if (gameState.roundStatus === 'betting' && gameState.timeLeft === 0) {
            // 時間到了但還在投注狀態，重新載入
            loadCurrentRound();
        }
    }, 1000);
}

// ===== 更新顯示函數 =====
function updateRoundDisplay() {
    const roundInfo = document.getElementById('roundInfo');
    const countdown = document.getElementById('countdown');
    const countdownLabel = document.getElementById('countdownLabel');

    if (!gameState.currentRound) {
        // 如果沒有當前期數，顯示等待狀態
        updateWaitingDisplay();
        return;
    }

    // 恢復正常的期數顯示格式
    if (roundInfo) {
        roundInfo.innerHTML = `-第- ${gameState.currentRound} -期數-`;
    }

    // 恢復倒數計時字體大小
    if (countdown) {
        countdown.style.fontSize = '36px';
    }

    // 根據狀態更新標籤
    if (countdownLabel) {
        switch (gameState.roundStatus) {
            case 'betting':
                countdownLabel.textContent = '距離封盤';
                break;
            case 'closed':
                countdownLabel.textContent = '已封盤';
                countdown.textContent = '準備開獎';
                countdown.style.fontSize = '24px';
                break;
            case 'playing':
                countdownLabel.textContent = '遊戲進行中';
                countdown.textContent = '等待結果';
                countdown.style.fontSize = '24px';
                break;
            case 'finished':
                countdownLabel.textContent = '已開獎';
                countdown.textContent = '等待下一期數';
                countdown.style.fontSize = '20px';
                break;
            default:
                countdownLabel.textContent = '請稍候...';
        }
    }

    // 更新狀態文字（用於控制台輸出）
    const statusMap = {
        'waiting': '等待開始',
        'betting': '接受投注',
        'closed': '已封盤',
        'playing': '遊戲進行中',
        'finished': '已開獎'
    };

    const statusText = statusMap[gameState.roundStatus] || '未知';
    console.log('當前狀態:', statusText);
}

function updateLiveRaceInfo({ roundId, status, startTime }) {
    const numberEl = document.getElementById('liveRaceNumber');
    const statusEl = document.getElementById('liveRaceStatus');
    const startTimeEl = document.getElementById('liveRaceStartTime');

    if (numberEl) {
        numberEl.textContent = roundId ? String(roundId) : '-';
    }

    if (statusEl) {
        const statusMap = {
            waiting: '等待開始',
            betting: '接受投注',
            closed: '已封盤',
            playing: '遊戲進行中',
            finished: '已開獎'
        };
        statusEl.textContent = statusMap[status] || statusMap['waiting'];
    }

    if (startTimeEl) {
        if (startTime) {
            // 如果有提供開始時間，格式化顯示
            const date = new Date(startTime);
            startTimeEl.textContent = date.toLocaleString('zh-TW', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } else if (status === 'betting') {
            // 如果正在投注中，顯示「進行中」
            startTimeEl.textContent = '進行中';
        } else if (status === 'waiting') {
            // 等待狀態顯示 -
            startTimeEl.textContent = '-';
        } else {
            // 其他狀態保持當前時間或顯示狀態
            startTimeEl.textContent = status === 'closed' ? '準備開獎' :
                                      status === 'finished' ? '已開獎' : '-';
        }
    }
}

function updateWaitingDisplay() {
    // 更新整個期數資訊區域
    const roundInfo = document.getElementById('roundInfo');
    const countdown = document.getElementById('countdown');
    const countdownLabel = document.getElementById('countdownLabel');

    if (roundInfo) {
        roundInfo.innerHTML = '<div style="font-size: 20px; font-weight: bold;">目前無進行中遊戲</div>';
    }

    if (countdown) {
        countdown.textContent = '等待新期數';
        countdown.style.fontSize = '24px'; // 稍微縮小字體
    }

    if (countdownLabel) {
        countdownLabel.textContent = '請稍候...';
    }

    // 禁用所有投注按鈕
    disableBetting();

    updateLiveRaceInfo({ roundId: null, status: 'waiting' });
}

function updateCountdown() {
    if (gameState.roundStatus === 'waiting') {
        // 等待狀態時不顯示時間
        return;
    }

    // 只在投注狀態時顯示倒數計時
    if (gameState.roundStatus === 'betting' && gameState.timeLeft >= 0) {
        const minutes = Math.floor(gameState.timeLeft / 60);
        const seconds = gameState.timeLeft % 60;
        const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        const countdown = document.getElementById('countdown');
        if (countdown) {
            countdown.textContent = timeStr;
            countdown.style.fontSize = '36px';

            // 最後10秒警告
            if (gameState.timeLeft <= 10 && gameState.timeLeft > 0) {
                countdown.style.color = '#ff0000';
            } else {
                countdown.style.color = '#FF6B6B';
            }
        }
    }

    updateLiveRaceInfo({ roundId: gameState.currentRound, status: gameState.roundStatus });
}

function displayLastResult(result) {
    // 確保展開按鈕樣式已載入
    ensureExpandBtnStyle();
    
    // 創建上期結果顯示區域（如果不存在）
    let lastResultSection = document.getElementById('lastResultSection');
    if (!lastResultSection) {
        const countdownDiv = document.querySelector('.countdown');
        lastResultSection = document.createElement('div');
        lastResultSection.id = 'lastResultSection';
        lastResultSection.style.cssText = `
            background: #f8f9fa;
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 20px;
            text-align: center;
            position: relative;
        `;
        countdownDiv.parentNode.insertBefore(lastResultSection, countdownDiv.nextSibling);
    }

    lastResultSection.innerHTML = `
        <div class="lr-header">
            <div class="lr-title">
                上期結果 - 第 ${result.roundId} 回合
            </div>
            <button class="expand-btn" onclick="showHistoryModal()">展開</button>
        </div>

        <div class="history-numbers">
            ${result.result.map(n => `<div class="history-number">${n}</div>`).join('')}
        </div>
    `;
}

// 開獎歷史記錄相關變數
let historyModal = null;
let currentHistoryPage = 1;
const historyPageSize = 10;

// 顯示開獎歷史記錄模態窗口
async function showHistoryModal() {
    if (historyModal) {
        historyModal.style.display = 'flex';
        return;
    }

    // 創建模態窗口
    historyModal = document.createElement('div');
    historyModal.className = 'history-modal';
    historyModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        padding: 20px;
        box-sizing: border-box;
    `;

    historyModal.innerHTML = `
        <div class="history-modal-content" style="
            background: white;
            border-radius: 12px;
            max-width: 100%;
            width: 100%;
            max-height: 90vh;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        ">
            <div class="history-header" style="
                padding: 16px 20px;
                border-bottom: 1px solid #eee;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: #f8f9fa;
            ">
                <h3 style="margin: 0; font-size: 18px; color: #333;">開獎歷史記錄</h3>
                <button onclick="closeHistoryModal()" style="
                    background: #dc3545;
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 32px;
                    height: 32px;
                    font-size: 18px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">×</button>
            </div>
            <div id="historyContent" style="
                padding: 20px;
                max-height: calc(90vh - 140px);
                overflow-y: auto;
            ">
                <div style="text-align: center; padding: 40px;">
                    <div style="color: #666;">載入中...</div>
                </div>
            </div>
            <div class="history-pagination" style="
                padding: 8px 20px;
                border-top: 1px solid #eee;
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 8px;
                background: #f8f9fa;
            ">
                <button id="prevPageBtn" onclick="loadHistoryPage(currentHistoryPage - 1)" style="
                    background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    padding: 6px 12px;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.3s;
                ">上一頁</button>
                <span id="pageInfo" style="font-size: 12px; color: #666; min-width: 80px; text-align: center;">
                    第 1 頁
                </span>
                <button id="nextPageBtn" onclick="loadHistoryPage(currentHistoryPage + 1)" style="
                    background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    padding: 6px 12px;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.3s;
                ">下一頁</button>
            </div>
        </div>
    `;

    // 點擊背景關閉
    historyModal.onclick = (e) => {
        if (e.target === historyModal) {
            closeHistoryModal();
        }
    };

    document.body.appendChild(historyModal);

    // 載入第一頁數據
    loadHistoryPage(1);
}

// 關閉開獎歷史記錄模態窗口
function closeHistoryModal() {
    if (historyModal) {
        historyModal.style.display = 'none';
    }
}

// 載入指定頁數的開獎記錄
async function loadHistoryPage(page) {
    if (page < 1) return;

    currentHistoryPage = page;
    const historyContent = document.getElementById('historyContent');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const pageInfo = document.getElementById('pageInfo');

    // 顯示載入中
    historyContent.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div style="color: #666;">載入中...</div>
        </div>
    `;

    try {
        // 載入開獎記錄，一次多載入一筆來判斷是否還有下一頁
        const response = await apiRequest(`/api/game/results?limit=${historyPageSize + 1}&offset=${(page - 1) * historyPageSize}`);

        const hasNextPage = response.length > historyPageSize;
        const currentPageData = response.slice(0, historyPageSize);

        if (currentPageData.length === 0 && page > 1) {
            // 如果當前頁沒有數據且不是第一頁，回到上一頁
            loadHistoryPage(page - 1);
            return;
        }

        // 渲染開獎記錄
        historyContent.innerHTML = currentPageData.map(record => `
            <div style="
                background: #f8f9fa;
                border-radius: 8px;
                padding: 15px;
                margin-bottom: 12px;
                border-left: 4px solid #FF6B6B;
            ">
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                ">
                    <div style="font-weight: bold; color: #333; font-size: 14px;">
                        第 ${record.roundId} 回合
                    </div>
                    <div style="font-size: 12px; color: #666;">
                        ${new Date(record.resultTime).toLocaleString('zh-TW')}
                    </div>
                </div>
                <div class="history-numbers" style="justify-content: flex-start; gap: 6px; flex-wrap: wrap;">
                    ${record.result.map((num, index) => `
                        <div style="
                            width: 30px;
                            height: 30px;
                            background: #FF6B6B;
                            color: white;
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 14px;
                        ">
                            ${num}
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');

        // 更新分頁控制
        prevBtn.disabled = page === 1;
        prevBtn.style.opacity = page === 1 ? '0.5' : '1';
        nextBtn.disabled = !hasNextPage;
        nextBtn.style.opacity = !hasNextPage ? '0.5' : '1';
        pageInfo.textContent = `第 ${page} 頁`;

    } catch (error) {
        console.error('載入開獎記錄失敗:', error);
        historyContent.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #dc3545;">
                載入失敗，請重試
            </div>
        `;
    }
}

function displayResults(result) {
    // 建立開獎結果彈窗
    const modal = document.createElement('div');
    modal.className = 'result-modal';
    modal.innerHTML = `
        <div class="result-modal-content">
            <h2>開獎結果</h2>
            <div class="result-numbers">
                ${result.map((num, index) => `
                    <div class="result-item">
                        <div class="result-position">第${index + 1}名</div>
                        <div class="result-number large">${num}</div>
                    </div>
                `).join('')}
            </div>
            <button onclick="this.closest('.result-modal').remove()" class="close-result-btn">關閉</button>
        </div>
    `;

    document.body.appendChild(modal);

    // 5秒後自動關閉
    setTimeout(() => {
        modal.remove();
    }, 5000);
}

// ===== 投注控制 =====
function enableBetting() {
    // 只在遊戲頁面啟用投注按鈕
    if (currentTab !== 'gaming') return;

    // 啟用所有投注按鈕
    document.querySelectorAll('.position-number, .option-btn, .sum-value-btn').forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    });

    // 啟用提交按鈕
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn && currentBets.length > 0) {
        submitBtn.disabled = false;
    }
}

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
    }
}

// ===== 加入 CSS 樣式 =====
const gameStyles = `
<style>
.result-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    animation: fadeIn 0.3s;
}

.result-modal-content {
    background: white;
    padding: 30px;
    border-radius: 15px;
    max-width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    animation: scaleIn 0.3s;
}

.result-modal-content h2 {
    text-align: center;
    color: #FF6B6B;
    margin-bottom: 20px;
}

.result-numbers {
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    gap: 8px;
    margin-bottom: 20px;
}

@media (max-width: 480px) {
    .result-numbers {
        grid-template-columns: repeat(5, 1fr);
        gap: 6px;
    }
}

.result-item {
    text-align: center;
}

.result-position {
    font-size: 12px;
    color: #666;
    margin-bottom: 5px;
}

.result-number.large {
    width: 50px;
    height: 50px;
    font-size: 24px;
    margin: 0 auto;
}

.close-result-btn {
    width: 100%;
    padding: 15px;
    background: #FF6B6B;
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 16px;
    cursor: pointer;
}

.close-result-btn:hover {
    background: #ff5252;
}

/* 禁用狀態樣式 */
.position-number:disabled,
.option-btn:disabled,
.sum-value-btn:disabled {
    opacity: 0.5 !important;
    cursor: not-allowed !important;
}

/* 上期結果樣式 - 移除全域 flex 規則，現在由 ensureExpandBtnStyle 的 Grid 規則處理 */

.history-number {
    width: 30px;
    height: 30px;
    background: #FF6B6B;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
}

/* 展開按鈕樣式 - 確保在手機版也能正確顯示 */
#lastResultSection {
    position: relative;
}

#lastResultSection .expand-btn {
    position: absolute !important;
    top: 12px !important;
    right: 12px !important;
    z-index: 10 !important;
    min-width: 50px;
    white-space: nowrap;
}

/* 確保按鈕在小螢幕上也能看到 */
@media (max-width: 480px) {
    #lastResultSection .expand-btn {
        font-size: 11px !important;
        padding: 3px 8px !important;
        min-width: 45px;
    }
}
</style>
`;

// 將樣式加入頁面
document.head.insertAdjacentHTML('beforeend', gameStyles);

// 確保展開按鈕樣式正確載入的函數
function ensureExpandBtnStyle() {
    let s = document.getElementById('expandBtnStyle');
    if (!s) {
        s = document.createElement('style');
        s.id = 'expandBtnStyle';
        document.head.appendChild(s);
    }
    s.textContent = `
        /* 1) 讓容器能當絕對定位錨點 */
        #lastResultSection { position: relative; }

        /* 2) 標題列：與按鈕同高，並讓標題能吃滿剩餘寬 */
        #lastResultSection .lr-header {
            display:flex; align-items:center; margin-bottom:10px;
            min-height:28px; padding-right:80px; /* 預留右上角按鈕空間 */
        }
        /* ⚠️ 重點：移除 70% 限寬，用 flex:1 + min-width:0 防止過早省略 */
        #lastResultSection .lr-header .lr-title {
            flex:1; min-width:0;
            font-size:14px; color:#666;
            white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }

        /* 3) 右上角固定的「展開」按鈕樣式 */
        #lastResultSection .expand-btn {
            position:absolute !important; top:10px !important; right:12px !important; z-index:10 !important;
            background: linear-gradient(135deg,#FF6B6B 0%,#FF8E53 100%) !important;
            color:#fff !important; border:none !important; border-radius:15px !important;
            padding:4px 12px !important; font-size:12px !important; cursor:pointer !important;
            box-shadow:0 2px 4px rgba(255,107,107,.3) !important;
            transition:all .3s !important;
        }

        /* 4) 10 顆圓點：用 Grid 固定每行 5 顆，整塊置中 */
        /* 先強制把可能存在的 flex 規則蓋掉 */
        #lastResultSection .history-numbers {
            display:grid !important;
            grid-template-columns: repeat(5, 30px) !important;
            column-gap:8px !important; row-gap:8px !important;

            /* 這兩行用來蓋掉舊規則 */
            max-width: none !important;
            width: 100% !important;          /* 讓容器吃滿，下面置中才生效 */

            justify-content: center !important;   /* 整塊在父層水平置中 */
            justify-items: center !important;     /* 每顆在各自格子置中 */
            margin: 0 auto !important;
            flex-wrap: initial !important;        /* 覆蓋可能的 flex-wrap */
        }


        /* 歷史記錄分頁按鈕樣式 */
        #prevPageBtn:hover, #nextPageBtn:hover {
            transform: translateY(-1px) !important;
            box-shadow: 0 2px 8px rgba(255, 107, 107, 0.3) !important;
        }


        #prevPageBtn:disabled, #nextPageBtn:disabled {
            opacity: 0.5 !important;
            cursor: not-allowed !important;
            transform: none !important;
        }
    `;
}
