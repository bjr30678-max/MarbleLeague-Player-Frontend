import React from 'react'
import { useHotBetsStore } from '@/stores/useHotBetsStore'
import './HotBets.css'

export const HotBets: React.FC = () => {
  const { totalBets, totalAmount, hotBets } = useHotBetsStore()

  return (
    <div className="hot-bets-container">
      <div className="hot-bets-header">
        <h3 className="hot-bets-title">熱門投注</h3>
        <div className="hot-bets-summary">
          總投注: {totalBets}筆 | {totalAmount.toLocaleString()}
        </div>
      </div>

      <div className="hot-bets-divider" />

      <div className="hot-bets-list">
        {hotBets.length > 0 ? (
          hotBets.map((bet, index) => (
            <div key={index} className="hot-bet-row">
              <span className="bet-option">{bet.option}</span>
              <div className="bar-container">
                <div className="bar-fill" style={{ width: `${bet.percentage}%` }} />
              </div>
              <span className="bet-percentage">{bet.percentage}%</span>
              <span className="bet-count">{bet.count}筆</span>
              <span className="bet-amount">{bet.amount.toLocaleString()}</span>
            </div>
          ))
        ) : (
          <div className="empty-message">暫無投注數據</div>
        )}
      </div>
    </div>
  )
}
