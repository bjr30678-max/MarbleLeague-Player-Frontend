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
    // TODO: 原始 app.js 沒有這個 API，透過 WebSocket 獲取遊戲狀態
    console.warn('fetchCurrentGame: 使用 WebSocket 事件獲取遊戲狀態')
  },

  fetchRecentResults: async () => {
    // TODO: 原始 app.js 沒有獨立的 recent results API
    // 結果通過 WebSocket 推送或從 history 中取得
    console.warn('fetchRecentResults: 使用 WebSocket 或 history API')
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
