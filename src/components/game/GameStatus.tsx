import React from 'react'
import { useGameStore } from '@/stores/useGameStore'
import { useCountdown } from '@/hooks/useCountdown'
import './GameStatus.css'

export const GameStatus: React.FC = () => {
  const { currentGame, countdown } = useGameStore()
  const { formattedCountdown } = useCountdown()

  // 等待狀態顯示（matching original updateWaitingDisplay）
  if (!currentGame) {
    return (
      <div className="game-status waiting">
        <div className="round-info">
          <div className="waiting-message">目前無進行中遊戲</div>
        </div>
        <div className="countdown-timer large">等待新期數</div>
        <div className="countdown-label">請稍候...</div>
      </div>
    )
  }

  // 獲取倒數計時顯示內容（matching original updateRoundDisplay & updateCountdown）
  const getCountdownDisplay = () => {
    switch (currentGame.status) {
      case 'betting':
        // 投注中：顯示倒數計時
        return {
          label: '距離封盤',
          timer: formattedCountdown,
          timerSize: 'large', // 36px
          timerColor: countdown <= 10 && countdown > 0 ? '#ff0000' : '#FF6B6B',
        }
      case 'closed':
        // 已封盤：顯示準備開獎
        return {
          label: '已封盤',
          timer: '準備開獎',
          timerSize: 'medium', // 24px
          timerColor: '#FF6B6B',
        }
      case 'playing':
        // 遊戲進行中
        return {
          label: '遊戲進行中',
          timer: '等待結果',
          timerSize: 'medium', // 24px
          timerColor: '#FF6B6B',
        }
      case 'finished':
        // 已開獎
        return {
          label: '已開獎',
          timer: '等待下一期數',
          timerSize: 'small', // 20px
          timerColor: '#FF6B6B',
        }
      case 'waiting':
      default:
        return {
          label: '請稍候...',
          timer: '--:--',
          timerSize: 'large',
          timerColor: '#FF6B6B',
        }
    }
  }

  const displayInfo = getCountdownDisplay()

  // 正常狀態顯示（matching original updateRoundDisplay）
  return (
    <div className="game-status active">
      <div className="round-info">
        -第- {currentGame.roundId} -期數-
      </div>
      <div
        className={`countdown-timer ${displayInfo.timerSize}`}
        style={{ color: displayInfo.timerColor }}
      >
        {displayInfo.timer}
      </div>
      <div className="countdown-label">{displayInfo.label}</div>
    </div>
  )
}
