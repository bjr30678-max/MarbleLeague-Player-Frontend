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
  fetchRecentResults: (limit?: number) => Promise<void>
  fetchHistory: (page?: number) => Promise<void>
  resetGame: () => void
}

export const useGameStore = create<GameStoreState>((set, get) => ({
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
    set({ isLoading: true })
    try {
      const response = await api.getCurrentGame()
      if (response.success && response.data) {
        get().setCurrentGame(response.data)
      }
    } catch (error) {
      console.error('Failed to fetch current game:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  fetchRecentResults: async (limit = 10) => {
    try {
      const response = await api.getRecentResults(limit)
      if (response.success && response.data) {
        set({ recentResults: response.data })
      }
    } catch (error) {
      console.error('Failed to fetch recent results:', error)
    }
  },

  fetchHistory: async (page = 1) => {
    set({ isLoading: true })
    try {
      const response = await api.getGameHistory(page, 20)
      if (response.success && response.data) {
        set({
          history: response.data.data,
          historyPage: response.data.pagination.currentPage,
          historyTotalPages: response.data.pagination.totalPages,
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
