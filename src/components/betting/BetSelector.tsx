import React, { useState } from 'react'
import { useBetting } from '@/hooks/useBetting'
import { CONSTANTS, BETTING_CATEGORIES } from '@/config'
import type { BetCategory } from '@/types'
import { 
  FaTrophy,        // 名次
  FaCalculator,    // 冠亞和
  FaChartBar,      // 大小
  FaDice,          // 單雙
  FaFire,          // 龍虎 (使用 Fire 作為替代)
  FaChevronUp,     // 大
  FaChevronDown,   // 小
  FaCircle,        // 單
  FaCircleNotch    // 雙
} from 'react-icons/fa'
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
  const [customChips, setCustomChips] = useState<number[]>([])

  // 圖標映射
  const categoryIcons: Record<BetCategory, React.ReactNode> = {
    position: <FaTrophy />,
    sum: <FaCalculator />,
    bigsmall: <FaChartBar />,
    oddeven: <FaDice />,
    dragontiger: <FaFire />
  }

  // 籌碼顏色配置 - 鮮豔賭場風格
  const chipColors: Record<number, string> = {
    10: '#dc2626',    // 紅色
    50: '#2563eb',    // 藍色
    100: '#059669',   // 綠色
    500: '#7c3aed',   // 紫色
    1000: '#ea580c',  // 橙色
  }

  // 為自訂籌碼生成顏色
  const customChipColors = ['#0891b2', '#be185d', '#65a30d', '#ca8a04', '#e11d48']
  const getCustomChipColor = (index: number) => {
    return customChipColors[index % customChipColors.length]
  }

  const handleCustomAmountSubmit = () => {
    const amount = parseInt(customAmount)
    const isDefaultAmount = CONSTANTS.BET_AMOUNTS.some(a => a === amount)
    if (amount && amount > 0 && !customChips.includes(amount) && !isDefaultAmount) {
      setCustomChips([...customChips, amount])
      setSelectedAmount(amount)
      setShowCustomAmount(false)
      setCustomAmount('')
    }
  }

  const removeCustomChip = (amount: number) => {
    setCustomChips(customChips.filter(chip => chip !== amount))
    if (selectedAmount === amount) {
      setSelectedAmount(CONSTANTS.BET_AMOUNTS[0])
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
                  onClick={() => placeBet(
                    `position-${pos}-${num}`,
                    `第${pos}名: ${num}號`,
                    positionOdds,
                    'position',      // betType
                    pos,             // position
                    [num]            // content (number, not string!)
                  )}
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
                  onClick={() => placeBet(
                    `sum-${item.value}`,
                    `和值${item.value}`,
                    item.odds,
                    'sum_value',           // betType
                    null,                  // position (null for sum bets)
                    [item.value]           // content (number, not string!)
                  )}
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
                      opt.odds,
                      option.type,        // betType (e.g., 'sum_big_small', 'sum_odd_even')
                      null,               // position (null for sum bets)
                      [opt.value]         // content
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

  // 渲染大小投注 (BigSmall) - 每個名次都可以下注
  const renderBigSmallOptions = () => {
    const bigSmallOdds = betOptionsData?.positionOptions?.[0]?.bigSmall?.odds || 1.98

    return (
      <div className="position-based-betting">
        <div className="odds-info">賠率 1:{bigSmallOdds}</div>

        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((pos) => (
          <div key={pos} className="position-option-group">
            <h4 className="position-title">第{pos}名</h4>
            <div className="option-grid">
              <button
                className="option-btn"
                onClick={() => placeBet(
                  `big_small_${pos}_big`,
                  `第${pos}名: 大`,
                  bigSmallOdds,
                  'big_small',
                  pos,
                  ['big']
                )}
              >
                <FaChevronUp /> 大 (6-10)
              </button>
              <button
                className="option-btn"
                onClick={() => placeBet(
                  `big_small_${pos}_small`,
                  `第${pos}名: 小`,
                  bigSmallOdds,
                  'big_small',
                  pos,
                  ['small']
                )}
              >
                <FaChevronDown /> 小 (1-5)
              </button>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // 渲染單雙投注 (OddEven) - 每個名次都可以下注
  const renderOddEvenOptions = () => {
    const oddEvenOdds = betOptionsData?.positionOptions?.[0]?.oddEven?.odds || 1.98

    return (
      <div className="position-based-betting">
        <div className="odds-info">賠率 1:{oddEvenOdds}</div>

        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((pos) => (
          <div key={pos} className="position-option-group">
            <h4 className="position-title">第{pos}名</h4>
            <div className="option-grid">
              <button
                className="option-btn"
                onClick={() => placeBet(
                  `odd_even_${pos}_odd`,
                  `第${pos}名: 單`,
                  oddEvenOdds,
                  'odd_even',
                  pos,
                  ['odd']
                )}
              >
                <FaCircle /> 單數
              </button>
              <button
                className="option-btn"
                onClick={() => placeBet(
                  `odd_even_${pos}_even`,
                  `第${pos}名: 雙`,
                  oddEvenOdds,
                  'odd_even',
                  pos,
                  ['even']
                )}
              >
                <FaCircleNotch /> 雙數
              </button>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // 渲染龍虎投注 (DragonTiger) - 根據 betOptions.dragonTiger 配對
  const renderDragonTigerOptions = () => {
    const dragonTigerOdds = betOptionsData?.dragonTiger?.[0]?.odds || 1.98

    if (!betOptionsData?.dragonTiger || betOptionsData.dragonTiger.length === 0) {
      return (
        <div className="no-options">
          <p>暫無龍虎投注選項</p>
        </div>
      )
    }

    return (
      <div className="dragon-tiger-betting">
        <div className="odds-info">賠率 1:{dragonTigerOdds}</div>

        <div className="dragon-tiger-grid">
          {betOptionsData.dragonTiger.map((pair) => (
            <div key={pair.position} className="dragon-tiger-item">
              <div className="dragon-tiger-title">{pair.name}</div>
              <div className="dragon-tiger-options">
                <button
                  className="option-btn"
                  onClick={() => placeBet(
                    `dragon_tiger_${pair.position}_dragon`,
                    `${pair.name}: 龍`,
                    pair.odds,
                    'dragon_tiger',
                    pair.position,
                    ['dragon']
                  )}
                >
                  {pair.dragon} 龍
                </button>
                <button
                  className="option-btn"
                  onClick={() => placeBet(
                    `dragon_tiger_${pair.position}_tiger`,
                    `${pair.name}: 虎`,
                    pair.odds,
                    'dragon_tiger',
                    pair.position,
                    ['tiger']
                  )}
                >
                  {pair.tiger} 虎
                </button>
              </div>
            </div>
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
            <span className="category-icon">{categoryIcons[category]}</span>
            <span className="category-label">{BETTING_CATEGORIES[category].label}</span>
          </button>
        ))}
      </div>

      {/* Amount Selection - Chip Style */}
      <div className="amount-selector">
        <h3>選擇籌碼</h3>
        <div className="chip-container">
          {/* 預設籌碼 */}
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

          {/* 自訂籌碼列表 */}
          {customChips.map((amount, index) => (
            <button
              key={`custom-${amount}`}
              className={`chip custom-chip ${selectedAmount === amount ? 'active' : ''}`}
              style={{
                '--chip-color': getCustomChipColor(index)
              } as React.CSSProperties}
              onClick={() => setSelectedAmount(amount)}
            >
              <div className="chip-inner">
                <div className="chip-amount">{amount}</div>
              </div>
              <button
                className="remove-chip-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  removeCustomChip(amount)
                }}
              >
                ×
              </button>
            </button>
          ))}

          {/* 新增自訂籌碼按鈕 */}
          <button
            className={`chip add-custom ${showCustomAmount ? 'active' : ''}`}
            onClick={() => setShowCustomAmount(!showCustomAmount)}
          >
            <div className="chip-inner">
              <div className="chip-amount">+</div>
            </div>
          </button>
        </div>

        {/* 新增自訂金額輸入 */}
        {showCustomAmount && (
          <div className="custom-amount-input">
            <input
              type="number"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder="輸入自訂金額"
              min="1"
              autoFocus
            />
            <button
              className="confirm-btn"
              onClick={handleCustomAmountSubmit}
              disabled={!customAmount || parseInt(customAmount) <= 0}
            >
              新增
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
        {selectedCategory === 'bigsmall' && renderBigSmallOptions()}
        {selectedCategory === 'oddeven' && renderOddEvenOptions()}
        {selectedCategory === 'dragontiger' && renderDragonTigerOptions()}
      </div>
    </div>
  )
}
