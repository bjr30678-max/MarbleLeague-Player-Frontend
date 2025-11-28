import React, { useState, useEffect, useRef } from 'react'
import { Loading, ToastContainer } from './components/common'
import { BetSelector, BetList } from './components/betting'
import { GameStatus, RecentResults, HotBets } from './components/game'
import { LivePlayer } from './components/live'
import { UserProfile } from './components/profile'
import { useAuth, useWebSocket } from './hooks'
import { useUserStore } from './stores/useUserStore'
import { useGameStore } from './stores/useGameStore'
import { useBettingStore } from './stores/useBettingStore'
import { formatCurrency } from './utils/validation'
import { FaGamepad, FaTv, FaClipboardList, FaUser, FaTrophy, FaTimesCircle, FaClock, FaQuestionCircle, FaTimes, FaExclamationTriangle } from 'react-icons/fa'
import './App.css'

type Tab = 'game' | 'live' | 'history' | 'profile'

const App: React.FC = () => {
  const { isInitializing, isAuthenticated } = useAuth()
  const { isConnected } = useWebSocket()
  const { user } = useUserStore()
  const [activeTab, setActiveTab] = useState<Tab>('game')
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(true)
  const [showRulesModal, setShowRulesModal] = useState(false)
  const [showBettingDisabledModal, setShowBettingDisabledModal] = useState(false)
  const [typedText, setTypedText] = useState('')
  const dataFetchedRef = useRef(false) // Prevent duplicate data fetching

  // 打字機效果
  useEffect(() => {
    // 只在彈窗可見且已通過初始化與登入時才啟動
    if (!showDisclaimerModal || isInitializing || !isAuthenticated || !user) {
      setTypedText('')
      return
    }

    const text = '歡迎來到紅海彈珠聯賽'
    let currentIndex = 0
    setTypedText('') // 重置文字

    const timer = setInterval(() => {
      currentIndex++
      if (currentIndex <= text.length) {
        setTypedText(text.slice(0, currentIndex))
      } else {
        clearInterval(timer)
      }
    }, 150) // 每個字 150ms

    return () => clearInterval(timer)
  }, [showDisclaimerModal, isInitializing, isAuthenticated, user])

  // Fetch betting data only (game data is fetched by useWebSocket)
  useEffect(() => {
    if (isAuthenticated && !dataFetchedRef.current) {
      dataFetchedRef.current = true
      useBettingStore.getState().fetchBettingData()
      // Note: fetchCurrentGame and fetchRecentResults are now called in useWebSocket initialization
    }
  }, [isAuthenticated])

  // 檢查投注禁用狀態
  useEffect(() => {
    // 當免責聲明關閉後，檢查是否需要顯示投注禁用通知
    if (!showDisclaimerModal && user && user.bettingStatus === 'disabled') {
      setShowBettingDisabledModal(true)
    }
  }, [showDisclaimerModal, user])

  const handleAcceptDisclaimer = () => {
    setShowDisclaimerModal(false)
  }

  if (isInitializing) {
    return <Loading text="初始化中..." fullScreen />
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="app-error">
        <h2>認證失敗</h2>
        <p>請重新載入頁面</p>
      </div>
    )
  }

  return (
    <div className="app">
      <ToastContainer />

      {/* Disclaimer Modal */}
      {showDisclaimerModal && (
        <div className="modal-overlay">
          <div className="modal-content disclaimer-modal">
            <h2 className="modal-title">重要聲明</h2>
            <div className="modal-body">
              <div className="disclaimer-text">
                {/* 歡迎區塊 */}
                <div className="disclaimer-welcome">
                  <h3 className="typewriter-text">
                    {typedText}
                    <span className="cursor"></span>
                  </h3>
                  <p>在開始遊戲前，請您仔細閱讀以下重要聲明</p>
                </div>

                {/* 遊戲注意事項 */}
                <div className="disclaimer-section">
                  <h4 className="disclaimer-section-title">遊戲注意事項</h4>
                  <ul>
                    <li>本站為真人即時影像設置，若有發生特殊情況，將依照本網站公告之辦法處理</li>
                    <li>比賽過程中如有彈珠停止在軌道上、卡住、掉落、飛出鏡頭或發生異常，該局視為無效局（已結算完成之局不受影響）</li>
                    <li>攝影設備異常或遊戲斷線情況下，該局視為無效局</li>
                    <li>遊戲過程中，如荷官操作造成順序錯亂無法立即判別，將暫停比賽，請主管調閱回放並依正確結果判定</li>
                  </ul>
                </div>

                {/* 其他條款 */}
                <div className="disclaimer-section">
                  <h4 className="disclaimer-section-title">其他條款</h4>
                  <ul>
                    <li>遊戲規則與賠率以系統公告為準</li>
                    <li>如有任何問題，請聯繫客服人員</li>
                    <li>本平台提供之所有服務均提供於合法地區使用，非法地區將不承擔任何責任</li>
                  </ul>
                </div>

                {/* 同意提示 */}
                <div className="disclaimer-highlight">
                  <p>點擊下方按鈕即表示您已詳細閱讀並同意以上聲明內容</p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn primary" onClick={handleAcceptDisclaimer}>
                我已詳閱，接受並進入遊戲
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Betting Disabled Modal */}
      {showBettingDisabledModal && (
        <div className="modal-overlay">
          <div className="modal-content disclaimer-modal" style={{ maxWidth: '500px' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <FaExclamationTriangle style={{ fontSize: '64px', color: '#ff4d4f', marginBottom: '16px' }} />
              <h2 className="modal-title" style={{ color: '#ff4d4f', marginBottom: '8px' }}>投注已被禁止</h2>
            </div>
            <div className="modal-body">
              <div className="disclaimer-text">
                <div className="disclaimer-section">
                  <p style={{ fontSize: '16px', textAlign: 'center', marginBottom: '16px' }}>
                    您的帳號目前已被禁止投注
                  </p>
                  <p style={{ fontSize: '14px', textAlign: 'center', color: '#888' }}>
                    請聯絡您的上級代理以恢復投注權限
                  </p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn primary" onClick={() => setShowBettingDisabledModal(false)}>
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules Modal */}
      {showRulesModal && (
        <div className="modal-overlay" onClick={() => setShowRulesModal(false)}>
          <div className="modal-content rules-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">遊戲規則說明</h2>
              <button className="modal-close" onClick={() => setShowRulesModal(false)}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <div className="rules-section">
                <h3>遊戲玩法</h3>
                <p>紅海彈珠聯賽是一款結合運氣與策略的投注遊戲，每局會有10顆彈珠進行比賽，玩家可以對不同的投注項目下注。</p>
              </div>

              <div className="rules-section">
                <h3>投注項目</h3>

                <h4 style={{ fontSize: '1.1rem', color: '#94a3b8', marginTop: '1rem', marginBottom: '0.75rem' }}>第一名～第十名 號碼指定</h4>
                <p>每一個號碼為一投注組合，開獎結果『投注號碼』對應所投名次視為中獎，其餘情形視為不中獎。</p>

                <h4 style={{ fontSize: '1.1rem', color: '#94a3b8', marginTop: '1rem', marginBottom: '0.75rem' }}>第1名～第10名 大小單雙</h4>
                <ul>
                  <li><strong>單、雙：</strong>號碼為雙數叫雙（如4、8）；號碼為單數叫單（如5、9）</li>
                  <li><strong>大、小：</strong>開出之號碼大於或等於6為大，小於或等於5為小</li>
                </ul>

                <h4 style={{ fontSize: '1.1rem', color: '#94a3b8', marginTop: '1rem', marginBottom: '0.75rem' }}>龍虎</h4>
                <ul>
                  <li><strong>1V10 龍/虎：</strong>『第一名』號碼大於『第十名』號碼視為【龍】中獎、反之小於視為【虎】中獎</li>
                  <li><strong>2V9 龍/虎：</strong>『第二名』號碼大於『第九名』號碼視為【龍】中獎、反之小於視為【虎】中獎</li>
                  <li><strong>3V8 龍/虎：</strong>『第三名』號碼大於『第八名』號碼視為【龍】中獎、反之小於視為【虎】中獎</li>
                  <li><strong>4V7 龍/虎：</strong>『第四名』號碼大於『第七名』號碼視為【龍】中獎、反之小於視為【虎】中獎</li>
                  <li><strong>5V6 龍/虎：</strong>『第五名』號碼大於『第六名』號碼視為【龍】中獎、反之小於視為【虎】中獎</li>
                </ul>

                <h4 style={{ fontSize: '1.1rem', color: '#94a3b8', marginTop: '1rem', marginBottom: '0.75rem' }}>冠亞和值</h4>
                <p>第一名號碼 ＋ 第二名號碼 ＝ 冠亞和值（可能結果為3～19）</p>
                <ul>
                  <li><strong>冠亞和值：</strong>投中對應數字視為中獎</li>
                  <li><strong>冠亞和大小：</strong>『冠亞和值』大於11時投注『大』中獎，小於或等於11時投注『小』中獎</li>
                  <li><strong>冠亞和單雙：</strong>『冠亞和值』為單視為投注『單』的注單中獎，為雙視為投注『雙』的注單中獎</li>
                </ul>
              </div>

              <div className="rules-section">
                <h3>遊戲流程</h3>
                <ol>
                  <li>等待新回合開始</li>
                  <li>在投注時間內選擇投注項目並下注</li>
                  <li>投注截止後，系統會進行開獎</li>
                  <li>根據開獎結果結算獎金</li>
                  <li>如遇無效局，所有投注將全額退款</li>
                </ol>
              </div>

              <div className="rules-section">
                <h3>無效局說明</h3>
                <p>當比賽過程中出現技術問題、系統異常或其他不可抗力因素時，該局可能被宣告為無效局。無效局的所有投注將全額退還至您的帳戶。</p>
              </div>

              <div className="rules-section">
                <h3>注意事項</h3>
                <ul>
                  <li>請在投注時間內完成投注，截止後將無法下注</li>
                  <li>每個投注項目都有最低和最高投注限額</li>
                  <li>請確保帳戶餘額充足</li>
                </ul>
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn secondary" onClick={() => setShowRulesModal(false)}>
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <div className="app-logo">
              <img src="/Logo-1.png" alt="紅海彈珠聯賽" />
            </div>
            <div className="header-text">
              <h1 className="app-title">紅海彈珠聯賽</h1>
              <div className="connection-row">
                <div className="connection-status">
                  <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
                  <span className="status-text">{isConnected ? '已連線' : '未連線'}</span>
                </div>
                <button className="rules-btn-header" onClick={() => setShowRulesModal(true)}>
                  <FaQuestionCircle />
                  <span>規則</span>
                </button>
              </div>
            </div>
          </div>
          <div className="header-right">
            <div className="user-balance">
              <div className="balance-label">積分</div>
              <div className="balance-amount">{formatCurrency(user?.balance ?? 0)}</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-content">
        {activeTab === 'game' && <GameTab />}
        {activeTab === 'live' && <LiveTab />}
        {activeTab === 'history' && <HistoryTab />}
        {activeTab === 'profile' && <ProfileTab />}
      </main>

      {/* Bottom Navigation */}
      <nav className="app-nav">
        <button
          className={`nav-btn ${activeTab === 'game' ? 'active' : ''}`}
          onClick={() => setActiveTab('game')}
        >
          <span className="nav-icon"><FaGamepad /></span>
          <span className="nav-label">遊戲</span>
        </button>
        <button
          className={`nav-btn ${activeTab === 'live' ? 'active' : ''}`}
          onClick={() => setActiveTab('live')}
        >
          <span className="nav-icon"><FaTv /></span>
          <span className="nav-label">直播</span>
        </button>
        <button
          className={`nav-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <span className="nav-icon"><FaClipboardList /></span>
          <span className="nav-label">記錄</span>
        </button>
        <button
          className={`nav-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <span className="nav-icon"><FaUser /></span>
          <span className="nav-label">個人</span>
        </button>
      </nav>
    </div>
  )
}

// Tab components
const GameTab: React.FC = () => {
  return (
    <div className="tab-content game-tab">
      <GameStatus />
      <RecentResults />
      <div className="betting-section">
        <BetSelector />
        <BetList />
      </div>
    </div>
  )
}

const LiveTab: React.FC = () => {
  return (
    <div className="tab-content live-tab">
      <GameStatus />
      <LivePlayer />
      <HotBets />
    </div>
  )
}

const HistoryTab: React.FC = () => {
  const history = useGameStore((state) => state.history)
  const loadHistoryPage = useGameStore((state) => state.loadHistoryPage)
  const currentHistoryPage = useGameStore((state) => state.currentHistoryPage)
  const historyTotalPages = useGameStore((state) => state.historyTotalPages)
  const isLoadingHistory = useGameStore((state) => state.isLoadingHistory)
  const historyFetchedRef = useRef(false)

  // 根據當前頁和總頁數計算是否有下一頁
  const hasNextPage = currentHistoryPage < historyTotalPages

  useEffect(() => {
    if (history.length === 0 && !historyFetchedRef.current) {
      historyFetchedRef.current = true
      handlePageChange(1)
    }
  }, [])

  const handlePageChange = async (page: number) => {
    if (page < 1 || (historyTotalPages > 0 && page > historyTotalPages)) return

    try {
      await loadHistoryPage(page)
    } catch (error) {
      console.error('Failed to change page:', error)
    }
  }

  return (
    <div className="tab-content">
      <h2>遊戲記錄</h2>
      {history.length > 0 ? (
        <>
          <div className="history-list">
            {history.map((record, idx) => {
              const isWin = record.status === 'win'
              const isLose = record.status === 'lose'
              const isPending = record.status === 'pending'
              const isVoided = record.status === 'voided'

              return (
                <div key={record.roundId + '-' + idx} className={`history-record ${record.status}`}>
                  {/* 狀態指示條 */}
                  <div className={`status-indicator ${record.status}`} />

                  {/* 頂部：回合 + 狀態徽章 */}
                  <div className="record-top">
                    <div className="round-info">
                      <span className="round-label">第 {record.roundId} 期</span>
                      <span className="bet-time">
                        {new Date(record.createdAt).toLocaleString('zh-TW', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className={`status-badge ${record.status}`}>
                      {isWin && <><FaTrophy /> 獲勝</>}
                      {isLose && <><FaTimesCircle /> 未中</>}
                      {isPending && <><FaClock /> 等待</>}
                      {isVoided && <><FaTimesCircle /> 已退款</>}
                    </div>
                  </div>

                  {/* 中間：投注內容 */}
                  <div className="bet-content">
                    <div className="bet-type-label">{record.betTypeName || record.betType}</div>
                    <div className="bet-details">
                      {record.betContentDisplay || JSON.stringify(record.betContent)}
                    </div>
                  </div>

                  {/* 底部：金額資訊 */}
                  <div className="bet-amounts">
                    <div className="bet-cost">
                      <span className="amount-label">投注</span>
                      <span className="amount-value cost">-{formatCurrency(record.betAmount)}</span>
                    </div>
                    {isWin && record.winAmount && (
                      <div className="bet-win">
                        <span className="amount-label">獲得</span>
                        <span className="amount-value win">+{formatCurrency(record.winAmount)}</span>
                      </div>
                    )}
                    {isVoided && (
                      <div className="bet-win">
                        <span className="amount-label">退款</span>
                        <span className="amount-value refund">+{formatCurrency(record.betAmount)}</span>
                      </div>
                    )}
                    {record.odds && !isVoided && (
                      <div className="bet-odds">
                        <span className="odds-label">賠率</span>
                        <span className="odds-value">{record.odds}x</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* 分頁控制 */}
          {!isLoadingHistory && history.length > 0 && (
            <div className="history-pagination">
              <button
                className="pagination-btn"
                onClick={() => handlePageChange(currentHistoryPage - 1)}
                disabled={currentHistoryPage === 1}
              >
                上一頁
              </button>
              <span className="page-info">
                {currentHistoryPage} / {historyTotalPages}
              </span>
              <button
                className="pagination-btn"
                onClick={() => handlePageChange(currentHistoryPage + 1)}
                disabled={!hasNextPage}
              >
                下一頁
              </button>
            </div>
          )}

          {/* 載入中提示 */}
          {isLoadingHistory && (
            <div className="loading-indicator">
              <div>載入中...</div>
            </div>
          )}
        </>
      ) : (
        <p className="empty-message">暫無記錄</p>
      )}
    </div>
  )
}

const ProfileTab: React.FC = () => {
  return (
    <div className="tab-content">
      <UserProfile />
    </div>
  )
}

export default App
