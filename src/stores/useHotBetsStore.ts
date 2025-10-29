import { create } from 'zustand'

export interface HotBet {
  option: string
  count: number
  amount: number
  percentage: number
}

interface BetStats {
  totalBets: number
  totalAmount: number
  hotBets: HotBet[]
}

interface HotBetsStoreState {
  totalBets: number
  totalAmount: number
  hotBets: HotBet[]

  // Actions
  updateBetStats: (stats: BetStats) => void
  clearStats: () => void
}

export const useHotBetsStore = create<HotBetsStoreState>((set) => ({
  totalBets: 0,
  totalAmount: 0,
  hotBets: [],

  updateBetStats: (stats) => {
    set({
      totalBets: stats.totalBets,
      totalAmount: stats.totalAmount,
      hotBets: stats.hotBets,
    })
  },

  clearStats: () => {
    set({
      totalBets: 0,
      totalAmount: 0,
      hotBets: [],
    })
  },
}))
