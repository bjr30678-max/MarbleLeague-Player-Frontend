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
import { FaGamepad, FaTv, FaClipboardList, FaUser } from 'react-icons/fa'
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
  const { history, loadHistoryPage, currentHistoryPage, isLoadingHistory } = useGameStore()
  const [hasNextPage, setHasNextPage] = useState(true)
  const [maxPageSeen, setMaxPageSeen] = useState(1)
  const historyFetchedRef = useRef(false)

  useEffect(() => {
    if (history.length === 0 && !historyFetchedRef.current) {
      historyFetchedRef.current = true
      handlePageChange(1)
    }
  }, [])

  const handlePageChange = async (page: number) => {
    if (page < 1) return

    try {
      const hasNext = await loadHistoryPage(page)
      const hasNextValue = hasNext ?? false
      setHasNextPage(hasNextValue)

      // 更新已知的最大頁數
      if (page > maxPageSeen) {
        setMaxPageSeen(page)
      }

      // 如果沒有下一頁,則總頁數就是當前頁數
      if (!hasNextValue && page >= maxPageSeen) {
        setMaxPageSeen(page)
      }
    } catch (error) {
      console.error('Failed to change page:', error)
      setHasNextPage(false)
    }
  }

  // 計算總頁數顯示: 如果有下一頁,顯示當前頁+1, 否則顯示確切頁數
  const totalPagesDisplay = hasNextPage ? currentHistoryPage + 1 : maxPageSeen

  return (
    <div className="tab-content">
      <h2>遊戲記錄</h2>
      {history.length > 0 ? (
        <>
          <div className="history-list">
            {history.map((record, idx) => {
              const statusClass = record.status === 'win' ? 'status-win' :
                                  record.status === 'lose' ? 'status-lose' : ''
              const statusText = record.status === 'win' ? '獲勝' :
                                record.status === 'lose' ? '未中' : '等待結果'

              return (
                <div key={record.roundId + '-' + idx} className="history-record">
                  <div className="record-header">
                    <div>
                      <div style={{ fontWeight: 'bold' }}>第 {record.roundId} 回合</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {new Date(record.createdAt).toLocaleString('zh-TW')}
                      </div>
                    </div>
                    <div className={`status-badge ${statusClass}`}>{statusText}</div>
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <span style={{ color: '#666' }}>{record.betTypeName || record.betType}</span>
                    {' '}
                    <span style={{ fontWeight: 'bold' }}>
                      {record.betContentDisplay || JSON.stringify(record.betContent)}
                    </span>
                    {' '}
                    <span style={{ color: '#FF6B6B' }}>- {record.betAmount} 積分</span>
                  </div>
                  {record.status === 'win' && record.winAmount && (
                    <div className="win-amount" style={{ color: '#00D9FF', fontWeight: 'bold' }}>
                      獲得: {formatCurrency(record.winAmount)}
                    </div>
                  )}
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
                {currentHistoryPage} / {totalPagesDisplay}
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
