import React from 'react'
import { useBetting } from '@/hooks/useBetting'
import { Button } from '@/components/common'
import { formatCurrency } from '@/utils/validation'
import './BetList.css'

export const BetList: React.FC = () => {
  const { currentBets, removeBet, clearBets, submitAllBets, isSubmitting, getTotalBetAmount } =
    useBetting()

  const totalAmount = getTotalBetAmount()
  const totalPotentialWin = currentBets.reduce((sum, bet) => sum + bet.potentialWin, 0)

  if (currentBets.length === 0) {
    return (
      <div className="bet-list empty">
        <p className="empty-message">尚未選擇任何投注</p>
      </div>
    )
  }

  return (
    <div className="bet-list">
      <div className="bet-list-header">
        <h3>投注清單</h3>
        <button className="clear-btn" onClick={clearBets}>
          清除全部
        </button>
      </div>

      <div className="bet-items">
        {currentBets.map((bet) => (
          <div key={bet.id} className="bet-item">
            <div className="bet-info">
              <div className="bet-label">{bet.label}</div>
              <div className="bet-details">
                <span className="bet-amount">{formatCurrency(bet.amount)}</span>
                <span className="bet-odds">× {bet.odds}</span>
                <span className="bet-win">= {formatCurrency(bet.potentialWin)}</span>
              </div>
            </div>
            <button className="remove-btn" onClick={() => removeBet(bet.id)}>
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="bet-summary">
        <div className="summary-row">
          <span>投注總額:</span>
          <span className="amount">{formatCurrency(totalAmount)}</span>
        </div>
        <div className="summary-row potential">
          <span>可能獲得:</span>
          <span className="amount">{formatCurrency(totalPotentialWin)}</span>
        </div>
      </div>

      <Button
        variant="success"
        size="large"
        fullWidth
        loading={isSubmitting}
        onClick={submitAllBets}
      >
        確認投注
      </Button>
    </div>
  )
}
