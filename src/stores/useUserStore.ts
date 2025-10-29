import { create } from 'zustand'
import type { UserProfile, BettingBan } from '@/types'
import { storage } from '@/services/storage'
import { api } from '@/services/api'

interface UserState {
  user: UserProfile | null
  isAuthenticated: boolean
  isLoading: boolean
  bettingBan: BettingBan | null

  // Actions
  setUser: (user: UserProfile | null) => void
  updateBalance: (balance: number) => void
  fetchBalance: () => Promise<void>
  setBettingBan: (ban: BettingBan | null) => void
  logout: () => void
}

export const useUserStore = create<UserState>((set, get) => ({
  user: storage.getUserProfile<UserProfile>(),
  isAuthenticated: !!storage.getToken(),
  isLoading: false,
  bettingBan: null,

  setUser: (user) => {
    set({ user, isAuthenticated: !!user })
    if (user) {
      storage.setUserProfile(user)
    } else {
      storage.removeUserProfile()
    }
  },

  updateBalance: (balance) => {
    const { user } = get()
    if (user) {
      const updatedUser = { ...user, balance }
      set({ user: updatedUser })
      storage.setUserProfile(updatedUser)
    }
  },

  fetchBalance: async () => {
    const { user } = get()
    if (!user) {
      console.error('Cannot fetch balance: user not logged in')
      return
    }

    set({ isLoading: true })
    try {
      console.log('💰 Fetching balance for user:', user.userId)
      const response = await api.getUserBalance(user.userId)
      console.log('💰 Balance API response:', response)

      if (response.success && response.data) {
        console.log('💰 Updating balance to:', response.data.balance)
        get().updateBalance(response.data.balance)
      } else {
        console.error('💰 Balance fetch failed:', response.error)
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  setBettingBan: (ban) => {
    set({ bettingBan: ban })
  },

  logout: () => {
    storage.clearAuth()
    set({
      user: null,
      isAuthenticated: false,
      bettingBan: null,
    })
  },
}))
