import React from 'react'
import { useGameStore } from '@/stores/useGameStore'
import { useCountdown } from '@/hooks/useCountdown'
import './GameStatus.css'

export const GameStatus: React.FC = () => {
  const { currentGame, countdown } = useGameStore()
  const { formattedCountdown } = useCountdown()

  // 等待狀態顯示
  if (!currentGame) {
    return (
      <div className="game-status empty">
        <div className="status-icon">⏳</div>
        <p>等待遊戲開始...</p>
      </div>
    )
  }

  const getStatusInfo = () => {
    switch (currentGame.status) {
      case 'waiting':
        return {
          icon: '⏰',
          label: '準備中',
          color: '#94a3b8',
          message: '下一輪即將開始',
        }
      case 'betting':
        return {
          icon: '🎲',
          label: '投注中',
          color: '#10b981',
          message: '請選擇您的投注',
        }
      case 'closed':
        return {
          icon: '🔒',
          label: '已封盤',
          color: '#ef4444',
          message: '停止接受投注',
        }
      case 'finished':
        return {
          icon: '✅',
          label: '已結束',
          color: '#3b82f6',
          message: '本輪已結算',
        }
      default:
        return {
          icon: '❓',
          label: '未知',
          color: '#64748b',
          message: '',
        }
    }
  }

  const statusInfo = getStatusInfo()

  return (
    <div className="game-status" style={{ borderColor: statusInfo.color }}>
      <div className="status-header">
        <div className="status-badge" style={{ background: `${statusInfo.color}20` }}>
          <span className="status-icon">{statusInfo.icon}</span>
          <span className="status-label" style={{ color: statusInfo.color }}>
            {statusInfo.label}
          </span>
        </div>
        <div className="period-info">
          <span className="period-label">期數</span>
          <span className="period-number">{currentGame.roundId}</span>
        </div>
      </div>

      {currentGame.status === 'betting' && countdown > 0 && (
        <div className="countdown-section">
          <div className="countdown-label">封盤倒計時</div>
          <div
            className="countdown-timer"
            style={{ color: countdown <= 10 && countdown > 0 ? '#ff0000' : '#10b981' }}
          >
            {formattedCountdown}
          </div>
        </div>
      )}

      {statusInfo.message && (
        <div className="status-message">{statusInfo.message}</div>
      )}
    </div>
  )
}
