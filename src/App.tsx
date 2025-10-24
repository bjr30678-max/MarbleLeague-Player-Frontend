import React, { useState, useEffect } from 'react'
import { Loading, ToastContainer } from './components/common'
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

// Simplified tab components
const GameTab: React.FC = () => {
  const { currentGame } = useGameStore()

  return (
    <div className="tab-content">
      <div className="game-info">
        <h2>遊戲大廳</h2>
        {currentGame ? (
          <div className="game-status">
            <p>當前期數: {currentGame.period}</p>
            <p>狀態: {getStatusText(currentGame.status)}</p>
          </div>
        ) : (
          <p>載入中...</p>
        )}
      </div>
      <div className="betting-area">
        <p className="info-text">投注功能開發中...</p>
        <p className="info-text">所有核心服務已就緒</p>
      </div>
    </div>
  )
}

const LiveTab: React.FC = () => {
  return (
    <div className="tab-content">
      <h2>直播</h2>
      <div className="live-placeholder">
        <p>直播功能將在此顯示</p>
      </div>
    </div>
  )
}

const HistoryTab: React.FC = () => {
  const { history } = useGameStore()

  return (
    <div className="tab-content">
      <h2>遊戲記錄</h2>
      {history.length > 0 ? (
        <div className="history-list">
          {history.map((record) => (
            <div key={record.id} className="history-item">
              <span>期數: {record.period}</span>
              <span>{record.timestamp}</span>
            </div>
          ))}
        </div>
      ) : (
        <p>暫無記錄</p>
      )}
    </div>
  )
}

const ProfileTab: React.FC = () => {
  const { user, logout } = useUserStore()

  if (!user) return null

  return (
    <div className="tab-content">
      <div className="profile-card">
        {user.pictureUrl && (
          <img src={user.pictureUrl} alt={user.displayName} className="profile-avatar" />
        )}
        <h2>{user.displayName}</h2>
        <div className="profile-info">
          <div className="info-row">
            <span>用戶ID:</span>
            <span>{user.userId}</span>
          </div>
          <div className="info-row">
            <span>餘額:</span>
            <span className="balance">{formatCurrency(user.balance)}</span>
          </div>
        </div>
        <button className="btn btn-danger" onClick={logout}>
          登出
        </button>
      </div>
    </div>
  )
}

const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    waiting: '等待中',
    betting: '投注中',
    closed: '已封盤',
    finished: '已結束',
  }
  return statusMap[status] || status
}

export default App
