import React, { useState, useEffect } from 'react'
import { Loading, ToastContainer } from './components/common'
import { BetSelector, BetList } from './components/betting'
import { GameStatus, RecentResults } from './components/game'
import { LivePlayer } from './components/live'
import { UserProfile } from './components/profile'
import { useAuth, useWebSocket } from './hooks'
import { useUserStore } from './stores/useUserStore'
import { useGameStore } from './stores/useGameStore'
import { useBettingStore } from './stores/useBettingStore'
import { formatCurrency } from './utils/validation'
import './App.css'

type Tab = 'game' | 'live' | 'history' | 'profile'

const App: React.FC = () => {
  const { isInitializing, isAuthenticated } = useAuth()
  const { isConnected } = useWebSocket()
  const { user } = useUserStore()
  const [activeTab, setActiveTab] = useState<Tab>('game')

  // Fetch initial data
  useEffect(() => {
    if (isAuthenticated) {
      useBettingStore.getState().fetchBettingData()
      useGameStore.getState().fetchCurrentGame()
      useGameStore.getState().fetchRecentResults()
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
          <h1 className="app-title">彈珠聯盟</h1>
          <div className="header-info">
            <div className="connection-status">
              <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
              {isConnected ? '已連線' : '未連線'}
            </div>
            <div className="user-balance">
              餘額: {formatCurrency(user.balance)}
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
          <span className="nav-icon">🎮</span>
          <span className="nav-label">遊戲</span>
        </button>
        <button
          className={`nav-btn ${activeTab === 'live' ? 'active' : ''}`}
          onClick={() => setActiveTab('live')}
        >
          <span className="nav-icon">📺</span>
          <span className="nav-label">直播</span>
        </button>
        <button
          className={`nav-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <span className="nav-icon">📋</span>
          <span className="nav-label">記錄</span>
        </button>
        <button
          className={`nav-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <span className="nav-icon">👤</span>
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
      <div className="game-layout">
        <div className="betting-section">
          <BetSelector />
          <BetList />
        </div>
        <div className="results-section">
          <RecentResults />
        </div>
      </div>
    </div>
  )
}

const LiveTab: React.FC = () => {
  return (
    <div className="tab-content">
      <LivePlayer />
      <div className="live-game-info">
        <GameStatus />
        <RecentResults />
      </div>
    </div>
  )
}

const HistoryTab: React.FC = () => {
  const { history, fetchHistory, historyPage, historyTotalPages, isLoading } = useGameStore()

  useEffect(() => {
    if (history.length === 0) {
      fetchHistory(1)
    }
  }, [])

  const handleLoadMore = () => {
    if (historyPage < historyTotalPages && !isLoading) {
      fetchHistory(historyPage + 1)
    }
  }

  return (
    <div className="tab-content">
      <h2>遊戲記錄</h2>
      {history.length > 0 ? (
        <>
          <div className="history-list">
            {history.map((record) => (
              <div key={record.id} className="history-record">
                <div className="record-header">
                  <span className="record-period">第 {record.period} 期</span>
                  <span className="record-time">{record.timestamp}</span>
                </div>
                <div className="record-positions">
                  {record.positions.slice(0, 3).map((pos, idx) => (
                    <span key={idx} className={`position-badge rank-${idx + 1}`}>
                      {pos}
                    </span>
                  ))}
                </div>
                {record.myBets && record.myBets.length > 0 && (
                  <div className="record-bets">
                    <div className="bets-header">我的投注</div>
                    {record.myBets.map((bet, idx) => (
                      <div key={idx} className={`bet-record ${bet.result}`}>
                        <span>{bet.label}</span>
                        <span>{bet.amount}</span>
                        <span className="bet-result-icon">
                          {bet.result === 'win' ? '✓' : '✕'}
                        </span>
                      </div>
                    ))}
                    {record.winAmount && record.winAmount > 0 && (
                      <div className="win-amount">獲得: {formatCurrency(record.winAmount)}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          {historyPage < historyTotalPages && (
            <button
              className="load-more-btn"
              onClick={handleLoadMore}
              disabled={isLoading}
            >
              {isLoading ? '載入中...' : '載入更多'}
            </button>
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
