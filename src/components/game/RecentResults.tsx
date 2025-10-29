import React, { useState, useEffect } from 'react'
import { useGameStore } from '@/stores/useGameStore'
import './RecentResults.css'

export const RecentResults: React.FC = () => {
  const { recentResults, loadResultsPage, currentResultsPage, isLoadingResults } = useGameStore()
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [hasNextPage, setHasNextPage] = useState(true)
  const [maxPageSeen, setMaxPageSeen] = useState(1)

  // 處理分頁切換
  const handlePageChange = async (page: number) => {
    if (page < 1) return

    try {
      // loadResultsPage 會返回是否有下一頁
      const hasNext = await loadResultsPage(page)
      const hasNextValue = hasNext ?? false
      setHasNextPage(hasNextValue)

      // 更新已知的最大頁數
      if (page > maxPageSeen) {
        setMaxPageSeen(page)
      }

      // 如果沒有下一頁,則總頁數就是當前頁數
      if (!hasNextValue && page >= maxPageSeen) {
        setMaxPageSeen(page)
      }
    } catch (error) {
      console.error('Failed to change page:', error)
      setHasNextPage(false)
    }
  }

  // 當模態窗口打開時,載入第一頁
  useEffect(() => {
    if (showHistoryModal) {
      handlePageChange(currentResultsPage)
    }
  }, [showHistoryModal])

  // 計算總頁數顯示: 如果有下一頁,顯示當前頁+1, 否則顯示確切頁數
  const totalPagesDisplay = hasNextPage ? currentResultsPage + 1 : maxPageSeen

  // 取最新一期作為上期結果
  const lastResult = recentResults[0]

  // 檢查是否有資料，並確保 positions 存在且是陣列
  if (!lastResult || !lastResult.positions || !Array.isArray(lastResult.positions)) {
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
              {recentResults
                .filter((result) => result.positions && Array.isArray(result.positions))
                .map((result) => (
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

              {/* 分頁控制 */}
              {!isLoadingResults && recentResults.length > 0 && (
                <div className="history-pagination">
                  <button
                    className="pagination-btn"
                    onClick={() => handlePageChange(currentResultsPage - 1)}
                    disabled={currentResultsPage === 1}
                  >
                    上一頁
                  </button>
                  <span className="page-info">
                    {currentResultsPage} / {totalPagesDisplay}
                  </span>
                  <button
                    className="pagination-btn"
                    onClick={() => handlePageChange(currentResultsPage + 1)}
                    disabled={!hasNextPage}
                  >
                    下一頁
                  </button>
                </div>
              )}

              {/* 載入中提示 */}
              {isLoadingResults && (
                <div className="loading-indicator">
                  <div>載入中...</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
