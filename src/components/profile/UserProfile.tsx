import React, { useState } from 'react'
import { useUserStore } from '@/stores/useUserStore'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/common'
import { formatCurrency } from '@/utils/validation'
import { toast } from '@/stores/useToastStore'
import { FaCopy, FaCheck } from 'react-icons/fa'
import './UserProfile.css'

export const UserProfile: React.FC = () => {
  const { user, bettingBan } = useUserStore()
  const { logout } = useAuth()
  const [copied, setCopied] = useState(false)

  const handleCopyUserId = async () => {
    if (!user?.userId) return

    try {
      await navigator.clipboard.writeText(user.userId)
      setCopied(true)
      toast.success('用戶 ID 已複製')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error('複製失敗')
    }
  }

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
            <div className="info-value-with-copy">
              <span className="info-value user-id">{user.userId}</span>
              <button className="copy-btn" onClick={handleCopyUserId} title="複製用戶 ID">
                {copied ? <FaCheck className="icon-success" /> : <FaCopy />}
              </button>
            </div>
          </div>
          <div className="info-row highlight">
            <span className="info-label">當前積分</span>
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
    </div>
  )
}
