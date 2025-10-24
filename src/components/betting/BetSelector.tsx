import React from 'react'
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
    betOptions,
    placeBet,
  } = useBetting()

  const categoryOptions = betOptions.filter((opt) => opt.category === selectedCategory)

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

      {/* Amount Selection */}
      <div className="amount-selector">
        <h3>選擇金額</h3>
        <div className="amount-buttons">
          {CONSTANTS.BET_AMOUNTS.map((amount) => (
            <button
              key={amount}
              className={`amount-btn ${selectedAmount === amount ? 'active' : ''}`}
              onClick={() => setSelectedAmount(amount)}
            >
              {amount}
            </button>
          ))}
        </div>
      </div>

      {/* Betting Options */}
      <div className="betting-options">
        <h3>{BETTING_CATEGORIES[selectedCategory].label}</h3>
        {categoryOptions.length > 0 ? (
          <div className="options-grid">
            {categoryOptions.map((option) => (
              <button
                key={option.id}
                className="option-btn"
                onClick={() => placeBet(option.id, option.label, option.odds)}
                disabled={!option.enabled}
              >
                <div className="option-label">{option.label}</div>
                <div className="option-odds">賠率: {option.odds}</div>
              </button>
            ))}
          </div>
        ) : (
          <p className="no-options">暫無可用選項</p>
        )}
      </div>
    </div>
  )
}
