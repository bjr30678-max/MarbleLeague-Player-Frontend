import { create } from 'zustand'
import type { GameState, GameResult, GameHistoryRecord } from '@/types'
import { api } from '@/services/api'

interface GameStoreState {
  currentGame: GameState | null
  recentResults: GameResult[]
  history: GameHistoryRecord[]
  allHistory: GameHistoryRecord[] // 儲存所有歷史記錄
  historyPage: number
  historyTotalPages: number
  isLoading: boolean
  countdown: number
  currentResultsPage: number
  isLoadingResults: boolean
  currentHistoryPage: number
  isLoadingHistory: boolean

  // Actions
  setCurrentGame: (game: GameState) => void
  updateCountdown: (countdown: number) => void
  addResult: (result: GameResult) => void
  setRecentResults: (results: GameResult[]) => void
  fetchCurrentGame: () => Promise<void>
  fetchRecentResults: () => Promise<void>
  loadResultsPage: (page: number) => Promise<boolean | undefined>
  fetchHistory: (page?: number) => Promise<void>
  loadHistoryPage: (page: number) => Promise<boolean | undefined>
  resetGame: () => void
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  currentGame: null,
  recentResults: [],
  history: [],
  allHistory: [], // 初始化為空陣列
  historyPage: 1,
  historyTotalPages: 1,
  isLoading: false,
  countdown: 0,
  currentResultsPage: 1,
  isLoadingResults: false,
  currentHistoryPage: 1,
  isLoadingHistory: false,

  setCurrentGame: (game) => {
    set({ currentGame: game, countdown: game.countdown })
  },

  updateCountdown: (countdown) => {
    set({ countdown })
  },

  addResult: (result) => {
    set((state) => ({
      recentResults: [result, ...state.recentResults].slice(0, 10),
    }))
  },

  setRecentResults: (results) => {
    set({ recentResults: results })
  },

  fetchCurrentGame: async () => {
    // Load current round state from API (原始: /api/game/current-round)
    try {
      const response = await api.getCurrentRound()
      if (response.success && response.data) {
        const data = response.data

        // 檢查狀態是否為等待中（matching original logic）
        if (data.status === 'waiting' || !data.roundId) {
          // No active round - 清空遊戲狀態
          set({
            currentGame: null,
            countdown: 0,
          })
          return
        }

        // 檢查狀態是否有效（只處理 betting, closed, playing, finished）
        if (!['betting', 'closed', 'playing', 'finished'].includes(data.status)) {
          console.warn('Unknown game status:', data.status)
          // 未知狀態也清空
          set({
            currentGame: null,
            countdown: 0,
          })
          return
        }

        // 有效的活動回合
        set({
          currentGame: {
            roundId: data.roundId,
            period: data.period || parseInt(data.roundId) || 0,
            status: data.status,
            countdown: data.timeLeft || 0,
            timestamp: Date.now(),
          },
          countdown: data.timeLeft || 0,
        })
      }
    } catch (error) {
      console.error('Failed to fetch current game:', error)
    }
  },

  fetchRecentResults: async () => {
    // Load recent results from API (原始: /api/game/results?limit=10)
    // 初始載入時重置到第一頁
    try {
      const response = await api.getRecentResults(10, 0)
      if (response.success && response.data && Array.isArray(response.data)) {
        // Convert RecentResult[] to GameResult[]
        const results = response.data.map((item) => {
          const sum = item.result.slice(0, 2).reduce((a, b) => a + b, 0)
          return {
            roundId: item.roundId,
            period: parseInt(item.roundId) || 0,
            positions: item.result,
            sum,
            bigsmall: sum > 11 ? 'big' : 'small',
            oddeven: sum % 2 === 0 ? 'even' : 'odd',
            dragontiger: {},
            timestamp: new Date(item.resultTime).getTime(),
          } as GameResult
        })
        set({
          recentResults: results,
          currentResultsPage: 1,
        })
      }
    } catch (error) {
      console.error('Failed to fetch recent results:', error)
    }
  },

  loadResultsPage: async (page: number) => {
    if (page < 1) return

    const pageSize = 10
    set({ isLoadingResults: true })

    try {
      // 載入 pageSize + 1 筆來判斷是否還有下一頁
      const offset = (page - 1) * pageSize
      const response = await api.getRecentResults(pageSize + 1, offset)

      if (response.success && response.data && Array.isArray(response.data)) {
        const hasNextPage = response.data.length > pageSize
        const currentPageData = response.data.slice(0, pageSize)

        // 如果當前頁沒有資料且不是第一頁，回到上一頁
        if (currentPageData.length === 0 && page > 1) {
          return await get().loadResultsPage(page - 1)
        }

        // Convert RecentResult[] to GameResult[]
        const results = currentPageData.map((item) => {
          const sum = item.result.slice(0, 2).reduce((a, b) => a + b, 0)
          return {
            roundId: item.roundId,
            period: parseInt(item.roundId) || 0,
            positions: item.result,
            sum,
            bigsmall: sum > 11 ? 'big' : 'small',
            oddeven: sum % 2 === 0 ? 'even' : 'odd',
            dragontiger: {},
            timestamp: new Date(item.resultTime).getTime(),
          } as GameResult
        })

        set({
          recentResults: results,
          currentResultsPage: page,
        })

        // 返回是否有下一頁的資訊 (透過在組件中檢查)
        return hasNextPage
      }
    } catch (error) {
      console.error('Failed to load results page:', error)
    } finally {
      set({ isLoadingResults: false })
    }
  },

  fetchHistory: async (limit = 200) => {
    set({ isLoading: true })
    try {
      // 由於後端不支援 offset，一次載入大量資料（200筆）
      const response = await api.getGameHistory(limit, 0)
      if (response.success && response.data?.games) {
        const pageSize = 20
        const totalPages = Math.ceil(response.data.games.length / pageSize)

        set({
          allHistory: response.data.games, // 儲存所有資料
          history: response.data.games.slice(0, pageSize), // 顯示第一頁
          historyPage: 1,
          historyTotalPages: totalPages,
          currentHistoryPage: 1,
        })
      }
    } catch (error) {
      console.error('Failed to fetch history:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  loadHistoryPage: async (page: number) => {
    if (page < 1) return

    const { allHistory } = get()
    const pageSize = 20

    // 如果還沒載入所有資料，先載入
    if (allHistory.length === 0) {
      await get().fetchHistory()
      return
    }

    set({ isLoadingHistory: true })

    try {
      // 前端分頁：從 allHistory 切片
      const startIndex = (page - 1) * pageSize
      const endIndex = startIndex + pageSize
      const currentPageData = allHistory.slice(startIndex, endIndex)
      const hasNextPage = endIndex < allHistory.length

      // 如果當前頁沒有資料且不是第一頁，回到上一頁
      if (currentPageData.length === 0 && page > 1) {
        return await get().loadHistoryPage(page - 1)
      }

      set({
        history: currentPageData,
        currentHistoryPage: page,
        historyTotalPages: Math.ceil(allHistory.length / pageSize),
      })

      return hasNextPage
    } catch (error) {
      console.error('Failed to load history page:', error)
    } finally {
      set({ isLoadingHistory: false })
    }
  },

  resetGame: () => {
    set({
      currentGame: null,
      countdown: 0,
    })
  },
}))
