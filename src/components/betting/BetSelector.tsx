import React, { useState } from 'react'
import { useBetting } from '@/hooks/useBetting'
import { CONSTANTS, BETTING_CATEGORIES } from '@/config'
import type { BetCategory } from '@/types'
import './BetSelector.css'

export const BetSelector: React.FC = () => {
  const {
    selectedCategory,
    selectedAmount,
    setSelectedCategory,
    setSelectedAmount,
    betOptionsData,
    placeBet,
  } = useBetting()

  const [showCustomAmount, setShowCustomAmount] = useState(false)
  const [customAmount, setCustomAmount] = useState('')

  // 籌碼顏色配置
  const chipColors: Record<number, string> = {
    10: '#EF4444',    // 紅色
    50: '#3B82F6',    // 藍色
    100: '#10B981',   // 綠色
    500: '#8B5CF6',   // 紫色
    1000: '#F59E0B',  // 橙色
  }

  const handleCustomAmountSubmit = () => {
    const amount = parseInt(customAmount)
    if (amount && amount > 0) {
      setSelectedAmount(amount)
      setShowCustomAmount(false)
      setCustomAmount('')
    }
  }

  // 渲染名次投注 (Position)
  const renderPositionBetting = () => {
    const positionOdds = betOptionsData?.positions?.[0]?.odds || 9.8

    return (
      <div className="position-betting">
        <div className="odds-info">賠率 1:{positionOdds}</div>

        {/* 10x10 網格 */}
        <div className="position-grid">
          <div className="position-header">
            <div className="position-label">名次</div>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
              <div key={num} className="position-label">{num}</div>
            ))}
          </div>

          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(pos => (
            <div key={pos} className="position-row">
              <div className="position-label">第{pos}名</div>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                <button
                  key={`${pos}-${num}`}
                  className="position-cell"
                  onClick={() => placeBet(`position-${pos}-${num}`, `第${pos}名: ${num}號`, positionOdds)}
                >
                  {num}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // 渲染冠亞和投注 (Sum)
  const renderSumBetting = () => {
    return (
      <div className="sum-betting">
        {/* 冠亞和值 */}
        {betOptionsData?.sumValues && (
          <div className="sum-values">
            <h4>冠亞和值</h4>
            <div className="sum-grid">
              {betOptionsData.sumValues.map((item: any) => (
                <button
                  key={item.value}
                  className="sum-btn"
                  onClick={() => placeBet(`sum-${item.value}`, `和值${item.value}`, item.odds)}
                >
                  <div className="sum-value">{item.value}</div>
                  <div className="sum-odds">1:{item.odds}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 冠亞和大小單雙 */}
        {betOptionsData?.sumOptions && (
          <div className="sum-options">
            <h4>冠亞和大小單雙</h4>
            <div className="options-grid">
              {betOptionsData.sumOptions.map((option: any) =>
                option.options.map((opt: any) => (
                  <button
                    key={`${option.type}-${opt.value}`}
                    className="option-btn"
                    onClick={() => placeBet(
                      `${option.type}-${opt.value}`,
                      opt.name,
                      opt.odds
                    )}
                  >
                    <div className="option-label">{opt.name}</div>
                    <div className="option-odds">1:{opt.odds}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // 渲染簡單選項 (BigSmall, OddEven, DragonTiger)
  const renderSimpleOptions = () => {
    let options: Array<{ id: string; label: string; odds: number }> = []

    switch (selectedCategory) {
      case 'bigsmall':
        options = [
          { id: 'big', label: '大 (≥12)', odds: 1.98 },
          { id: 'small', label: '小 (≤11)', odds: 1.98 },
        ]
        break
      case 'oddeven':
        options = [
          { id: 'odd', label: '單', odds: 1.98 },
          { id: 'even', label: '雙', odds: 1.98 },
        ]
        break
      case 'dragontiger':
        options = [
          { id: 'dragon', label: '龍', odds: 1.98 },
          { id: 'tiger', label: '虎', odds: 1.98 },
        ]
        break
    }

    return (
      <div className="simple-options">
        <div className="options-grid">
          {options.map((option) => (
            <button
              key={option.id}
              className="option-btn large"
              onClick={() => placeBet(
                `${selectedCategory}-${option.id}`,
                option.label,
                option.odds
              )}
            >
              <div className="option-label">{option.label}</div>
              <div className="option-odds">賠率: {option.odds}</div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bet-selector">
      {/* Category Selection */}
      <div className="bet-categories">
        {(Object.keys(BETTING_CATEGORIES) as BetCategory[]).map((category) => (
          <button
            key={category}
            className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
            onClick={() => setSelectedCategory(category)}
          >
            <span className="category-icon">{BETTING_CATEGORIES[category].icon}</span>
            <span className="category-label">{BETTING_CATEGORIES[category].label}</span>
          </button>
        ))}
      </div>

      {/* Amount Selection - Chip Style */}
      <div className="amount-selector">
        <h3>選擇籌碼</h3>
        <div className="chip-container">
          {CONSTANTS.BET_AMOUNTS.map((amount) => (
            <button
              key={amount}
              className={`chip ${selectedAmount === amount ? 'active' : ''}`}
              style={{
                '--chip-color': chipColors[amount] || '#94a3b8'
              } as React.CSSProperties}
              onClick={() => setSelectedAmount(amount)}
            >
              <div className="chip-inner">
                <div className="chip-amount">{amount}</div>
              </div>
            </button>
          ))}

          {/* 自訂籌碼 */}
          <button
            className={`chip custom ${showCustomAmount ? 'active' : ''}`}
            onClick={() => setShowCustomAmount(!showCustomAmount)}
          >
            <div className="chip-inner">
              <div className="chip-label">自訂</div>
            </div>
          </button>
        </div>

        {/* 自訂金額輸入 */}
        {showCustomAmount && (
          <div className="custom-amount-input">
            <input
              type="number"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder="輸入金額"
              min="1"
              autoFocus
            />
            <button
              className="confirm-btn"
              onClick={handleCustomAmountSubmit}
              disabled={!customAmount || parseInt(customAmount) <= 0}
            >
              確認
            </button>
            <button
              className="cancel-btn"
              onClick={() => {
                setShowCustomAmount(false)
                setCustomAmount('')
              }}
            >
              取消
            </button>
          </div>
        )}
      </div>

      {/* Betting Options */}
      <div className="betting-options">
        <h3>{BETTING_CATEGORIES[selectedCategory].label}</h3>
        {selectedCategory === 'position' && renderPositionBetting()}
        {selectedCategory === 'sum' && renderSumBetting()}
        {(selectedCategory === 'bigsmall' ||
          selectedCategory === 'oddeven' ||
          selectedCategory === 'dragontiger') && renderSimpleOptions()}
      </div>
    </div>
  )
}
