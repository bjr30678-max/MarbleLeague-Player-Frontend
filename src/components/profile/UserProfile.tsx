import React from 'react'
import { useUserStore } from '@/stores/useUserStore'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/common'
import { formatCurrency } from '@/utils/validation'
import './UserProfile.css'

export const UserProfile: React.FC = () => {
  const { user, bettingBan } = useUserStore()
  const { logout } = useAuth()

  if (!user) {
    return (
      <div className="user-profile empty">
        <p>無法載入用戶資料</p>
      </div>
    )
  }

  return (
    <div className="user-profile">
      <div className="profile-header">
        {user.pictureUrl && (
          <img src={user.pictureUrl} alt={user.displayName} className="profile-avatar" />
        )}
        <h2 className="profile-name">{user.displayName}</h2>
        {user.statusMessage && <p className="profile-status">{user.statusMessage}</p>}
      </div>

      <div className="profile-info-card">
        <h3>帳戶資訊</h3>
        <div className="info-list">
          <div className="info-row">
            <span className="info-label">用戶 ID</span>
            <span className="info-value">{user.userId}</span>
          </div>
          <div className="info-row highlight">
            <span className="info-label">當前餘額</span>
            <span className="info-value balance">{formatCurrency(user?.balance ?? 0)}</span>
          </div>
        </div>
      </div>

      {bettingBan?.isBanned && (
        <div className="ban-notice">
          <div className="ban-icon">🚫</div>
          <div className="ban-content">
            <h4>投注限制</h4>
            <p>{bettingBan.reason || '您的帳戶目前無法投注'}</p>
            {bettingBan.bannedAt && (
              <p className="ban-time">時間: {new Date(bettingBan.bannedAt).toLocaleString('zh-TW')}</p>
            )}
            {bettingBan.bannedUntil && (
              <p className="ban-until">
                解除時間: {new Date(bettingBan.bannedUntil).toLocaleString('zh-TW')}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="profile-actions">
        <Button variant="danger" fullWidth onClick={logout}>
          登出
        </Button>
      </div>

      <div className="app-info">
        <h3>應用程式資訊</h3>
        <div className="info-list">
          <div className="info-row">
            <span className="info-label">版本</span>
            <span className="info-value">2.0.0</span>
          </div>
          <div className="info-row">
            <span className="info-label">框架</span>
            <span className="info-value">React + TypeScript</span>
          </div>
          <div className="info-row">
            <span className="info-label">建構工具</span>
            <span className="info-value">Vite</span>
          </div>
        </div>
      </div>
    </div>
  )
}
