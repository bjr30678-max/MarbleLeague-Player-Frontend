import React, { useState, useEffect } from 'react'
import { useGameStore } from '@/stores/useGameStore'
import './RecentResults.css'

export const RecentResults: React.FC = () => {
  const recentResults = useGameStore((state) => state.recentResults)
  const allRecentResults = useGameStore((state) => state.allRecentResults)
  const loadResultsPage = useGameStore((state) => state.loadResultsPage)
  const currentResultsPage = useGameStore((state) => state.currentResultsPage)
  const isLoadingResults = useGameStore((state) => state.isLoadingResults)
  const [showHistoryModal, setShowHistoryModal] = useState(false)

  // 使用實際資料計算總頁數(與 loadResultsPage 邏輯一致)
  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(allRecentResults.length / pageSize))
  const hasNextPage = currentResultsPage < totalPages

  // 處理分頁切換
  const handlePageChange = async (page: number) => {
    if (page < 1 || page > totalPages) return

    try {
      await loadResultsPage(page)
    } catch (error) {
      console.error('Failed to change page:', error)
    }
  }

  // 當模態窗口打開時,載入第一頁
  useEffect(() => {
    if (showHistoryModal) {
      handlePageChange(currentResultsPage)
    }
  }, [showHistoryModal])

  // 取最新一期作為上期結果
  const lastResult = recentResults[0]

  // 檢查是否有資料
  if (!lastResult) {
    return (
      <div className="last-result-section empty">
        <p>暫無開獎記錄</p>
      </div>
    )
  }

  // 檢查是否為無效局
  const isVoided = lastResult.status === 'voided'

  return (
    <>
      {/* 上期結果區域 */}
      <div className={`last-result-section ${isVoided ? 'voided' : ''}`}>
        <div className="lr-header">
          <div className="lr-title">
            上期結果 - 第 {lastResult.roundId} 期
            {isVoided && <span className="voided-badge">無效局</span>}
          </div>
          <button className="expand-btn" onClick={() => setShowHistoryModal(true)}>
            展開
          </button>
        </div>

        {/* 無效局顯示原因，正常局顯示結果 */}
        {isVoided ? (
          <div className="voided-info">
            <div className="voided-message">此局已宣告無效，所有投注已退款</div>
            {lastResult.voidReason && (
              <div className="voided-reason">原因: {lastResult.voidReason}</div>
            )}
          </div>
        ) : lastResult.positions && Array.isArray(lastResult.positions) ? (
          <div className="history-numbers">
            {lastResult.positions.map((num, idx) => (
              <div key={idx} className="history-number">
                {num}
              </div>
            ))}
          </div>
        ) : (
          <div className="voided-info">
            <div className="voided-message">結果載入中...</div>
          </div>
        )}
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
              {recentResults.map((result) => {
                const resultIsVoided = result.status === 'voided'

                return (
                  <div key={result.roundId} className={`history-record ${resultIsVoided ? 'voided' : ''}`}>
                    <div className="record-header">
                      <span className="record-title">
                        第 {result.roundId} 期
                        {resultIsVoided && <span className="voided-badge-small">無效</span>}
                      </span>
                      <span className="record-time">
                        {new Date(result.timestamp).toLocaleString('zh-TW', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {resultIsVoided ? (
                      <div className="record-voided-info">
                        <div className="record-voided-message">此局已宣告無效</div>
                        {result.voidReason && (
                          <div className="record-voided-reason">原因: {result.voidReason}</div>
                        )}
                      </div>
                    ) : result.positions && Array.isArray(result.positions) ? (
                      <>
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
                      </>
                    ) : null}
                  </div>
                )
              })}

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
                    {currentResultsPage} / {totalPages}
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
