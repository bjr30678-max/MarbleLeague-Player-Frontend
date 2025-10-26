import { create } from 'zustand'
import type { GameState, GameResult, GameHistoryRecord } from '@/types'
import { api } from '@/services/api'

interface GameStoreState {
  currentGame: GameState | null
  recentResults: GameResult[]
  history: GameHistoryRecord[]
  historyPage: number
  historyTotalPages: number
  isLoading: boolean
  countdown: number

  // Actions
  setCurrentGame: (game: GameState) => void
  updateCountdown: (countdown: number) => void
  addResult: (result: GameResult) => void
  setRecentResults: (results: GameResult[]) => void
  fetchCurrentGame: () => Promise<void>
  fetchRecentResults: () => Promise<void>
  fetchHistory: (page?: number) => Promise<void>
  resetGame: () => void
}

export const useGameStore = create<GameStoreState>((set) => ({
  currentGame: null,
  recentResults: [],
  history: [],
  historyPage: 1,
  historyTotalPages: 1,
  isLoading: false,
  countdown: 0,

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

        // 檢查狀態是否有效（只處理 betting, closed, finished）
        if (!['betting', 'closed', 'finished'].includes(data.status)) {
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
    try {
      const response = await api.getRecentResults(10)
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
        set({ recentResults: results })
      }
    } catch (error) {
      console.error('Failed to fetch recent results:', error)
    }
  },

  fetchHistory: async (limit = 20) => {
    set({ isLoading: true })
    try {
      const response = await api.getGameHistory(limit)
      if (response.success && response.data?.games) {
        set({
          history: response.data.games,
          historyPage: 1,
          historyTotalPages: 1,
        })
      }
    } catch (error) {
      console.error('Failed to fetch history:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  resetGame: () => {
    set({
      currentGame: null,
      countdown: 0,
    })
  },
}))
