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
import { FaGamepad, FaTv, FaClipboardList, FaUser, FaTrophy, FaTimesCircle, FaClock } from 'react-icons/fa'
import './App.css'

type Tab = 'game' | 'live' | 'history' | 'profile'

const App: React.FC = () => {
  const { isInitializing, isAuthenticated } = useAuth()
  const { isConnected } = useWebSocket()
  const { user } = useUserStore()
  const [activeTab, setActiveTab] = useState<Tab>('game')
  const dataFetchedRef = useRef(false) // Prevent duplicate data fetching

  // Fetch betting data only (game data is fetched by useWebSocket)
  useEffect(() => {
    if (isAuthenticated && !dataFetchedRef.current) {
      dataFetchedRef.current = true
      useBettingStore.getState().fetchBettingData()
      // Note: fetchCurrentGame and fetchRecentResults are now called in useWebSocket initialization
    }
  }, [isAuthenticated])

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

      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <div className="app-logo">
              <img src="/Logo-1.png" alt="紅海彈珠聯賽" />
            </div>
            <div className="header-text">
              <h1 className="app-title">紅海彈珠聯賽</h1>
              <div className="connection-status">
                <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
                <span className="status-text">{isConnected ? '已連線' : '未連線'}</span>
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
    <div className="tab-content">
      <LivePlayer />
      <HotBets />
      <GameStatus />
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
                    {record.odds && (
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
