import React from 'react'
import { useGameStore } from '@/stores/useGameStore'
import './RecentResults.css'

export const RecentResults: React.FC = () => {
  const { recentResults } = useGameStore()

  if (recentResults.length === 0) {
    return (
      <div className="recent-results empty">
        <p>暫無開獎記錄</p>
      </div>
    )
  }

  return (
    <div className="recent-results">
      <h3>最近開獎</h3>
      <div className="results-list">
        {recentResults.map((result) => (
          <div key={result.roundId} className="result-item">
            <div className="result-period">第 {result.period} 期</div>
            <div className="result-positions">
              {result.positions.slice(0, 3).map((pos, idx) => (
                <span key={idx} className={`position-badge rank-${idx + 1}`}>
                  {pos}
                </span>
              ))}
            </div>
            <div className="result-stats">
              <span className="stat-item">
                和: <strong>{result.sum}</strong>
              </span>
              <span className={`stat-item ${result.bigsmall}`}>
                {result.bigsmall === 'big' ? '大' : '小'}
              </span>
              <span className={`stat-item ${result.oddeven}`}>
                {result.oddeven === 'odd' ? '單' : '雙'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
