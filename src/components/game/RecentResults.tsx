import React, { useState } from 'react'
import { useGameStore } from '@/stores/useGameStore'
import './RecentResults.css'

export const RecentResults: React.FC = () => {
  const { recentResults } = useGameStore()
  const [showHistoryModal, setShowHistoryModal] = useState(false)

  // 取最新一期作為上期結果
  const lastResult = recentResults[0]

  if (!lastResult) {
    return (
      <div className="last-result-section empty">
        <p>暫無開獎記錄</p>
      </div>
    )
  }

  return (
    <>
      {/* 上期結果區域 */}
      <div className="last-result-section">
        <div className="lr-header">
          <div className="lr-title">上期結果 - 第 {lastResult.roundId} 期</div>
          <button className="expand-btn" onClick={() => setShowHistoryModal(true)}>
            展開
          </button>
        </div>

        {/* 10顆球結果 - Grid布局 */}
        <div className="history-numbers">
          {lastResult.positions.map((num, idx) => (
            <div key={idx} className="history-number">
              {num}
            </div>
          ))}
        </div>
      </div>

      {/* 歷史記錄模態窗口 */}
      {showHistoryModal && (
        <div className="history-modal" onClick={() => setShowHistoryModal(false)}>
          <div className="history-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="history-header">
              <h3>開獎歷史記錄</h3>
              <button className="close-btn" onClick={() => setShowHistoryModal(false)}>
                ✕
              </button>
            </div>

            <div className="history-body">
              {recentResults.map((result) => (
                <div key={result.roundId} className="history-record">
                  <div className="record-header">
                    <span className="record-title">第 {result.roundId} 期</span>
                    <span className="record-time">
                      {new Date(result.timestamp).toLocaleString('zh-TW', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* 10顆球結果 */}
                  <div className="record-numbers">
                    {result.positions.map((num, idx) => (
                      <div key={idx} className="record-number">
                        {num}
                      </div>
                    ))}
                  </div>

                  {/* 統計資訊 */}
                  <div className="record-stats">
                    <span className="stat-badge">和: {result.sum}</span>
                    <span className={`stat-badge ${result.bigsmall}`}>
                      {result.bigsmall === 'big' ? '大' : '小'}
                    </span>
                    <span className={`stat-badge ${result.oddeven}`}>
                      {result.oddeven === 'odd' ? '單' : '雙'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
