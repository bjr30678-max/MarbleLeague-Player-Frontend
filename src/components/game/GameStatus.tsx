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
      <div className="countdown">
        <div id="roundInfo">
          <div className="waiting-message">目前無進行中遊戲</div>
        </div>
        <div className="countdown-timer" id="countdown">等待新期數</div>
        <div id="countdownLabel">請稍候...</div>
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
          timerClass: 'large', // 36px
          timerColor: countdown <= 10 && countdown > 0 ? '#ef4444' : '#667eea',
        }
      case 'closed':
        // 已封盤：顯示準備開獎
        return {
          label: '已封盤',
          timer: '準備開獎',
          timerClass: 'medium', // 24px
          timerColor: '#667eea',
        }
      case 'finished':
        // 已開獎
        return {
          label: '已開獎',
          timer: '等待下一期數',
          timerClass: 'small', // 20px
          timerColor: '#667eea',
        }
      case 'waiting':
      default:
        return {
          label: '請稍候...',
          timer: '--:--',
          timerClass: 'large',
          timerColor: '#667eea',
        }
    }
  }

  const displayInfo = getCountdownDisplay()

  // 正常狀態顯示（matching original updateRoundDisplay）
  return (
    <div className="countdown">
      <div id="roundInfo">-第- {currentGame.roundId} -期數-</div>
      <div
        className={`countdown-timer ${displayInfo.timerClass}`}
        id="countdown"
        style={{ color: displayInfo.timerColor }}
      >
        {displayInfo.timer}
      </div>
      <div id="countdownLabel">{displayInfo.label}</div>
    </div>
  )
}
