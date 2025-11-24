import { create } from 'zustand'
import type { Bet, BetOptionsData, BettingLimits, BetCategory } from '@/types'
import { api } from '@/services/api'
import { useUserStore } from './useUserStore'
import { useGameStore } from './useGameStore'
import { generateSecureId } from '@/utils/security'

interface BettingState {
  betOptionsData: BetOptionsData | null // Raw data from backend
  bettingLimits: BettingLimits | null
  currentBets: Bet[]
  selectedCategory: BetCategory
  selectedAmount: number
  isSubmitting: boolean

  // Actions
  setBetOptions: (options: BetOptionsData) => void
  setBettingLimits: (limits: BettingLimits) => void
  setSelectedCategory: (category: BetCategory) => void
  setSelectedAmount: (amount: number) => void
  addBet: (
    optionId: string,
    label: string,
    odds: number,
    betType?: string,
    position?: number | null,
    content?: (string | number)[]
  ) => void
  removeBet: (id: string) => void
  clearBets: () => void
  updateBetAmount: (id: string, amount: number) => void
  submitBets: () => Promise<boolean>
  fetchBettingData: () => Promise<void>
  getTotalBetAmount: () => number
  canPlaceBet: (amount: number) => boolean
}

export const useBettingStore = create<BettingState>((set, get) => ({
  betOptionsData: null,
  bettingLimits: null,
  currentBets: [],
  selectedCategory: 'position',
  selectedAmount: 100,
  isSubmitting: false,

  setBetOptions: (options) => set({ betOptionsData: options }),

  setBettingLimits: (limits) => set({ bettingLimits: limits }),

  setSelectedCategory: (category) => set({ selectedCategory: category }),

  setSelectedAmount: (amount) => set({ selectedAmount: amount }),

  addBet: (optionId, label, odds, betType, position, content) => {
    const { selectedCategory, selectedAmount, currentBets } = get()

    // Check if bet already exists for this option
    const existingBet = currentBets.find((b) => b.optionId === optionId)
    if (existingBet) {
      // Update amount
      set({
        currentBets: currentBets.map((b) =>
          b.optionId === optionId
            ? {
                ...b,
                amount: b.amount + selectedAmount,
                potentialWin: (b.amount + selectedAmount) * b.odds,
              }
            : b
        ),
      })
      return
    }

    // Add new bet
    const newBet: Bet = {
      id: generateSecureId(),
      category: selectedCategory,
      optionId,
      label,
      amount: selectedAmount,
      odds,
      potentialWin: selectedAmount * odds,
      type: betType,
      position,
      content,
    }

    set({ currentBets: [...currentBets, newBet] })
  },

  removeBet: (id) => {
    set((state) => ({
      currentBets: state.currentBets.filter((bet) => bet.id !== id),
    }))
  },

  clearBets: () => {
    set({ currentBets: [] })
  },

  updateBetAmount: (id, amount) => {
    set((state) => ({
      currentBets: state.currentBets.map((bet) =>
        bet.id === id
          ? {
              ...bet,
              amount,
              potentialWin: amount * bet.odds,
            }
          : bet
      ),
    }))
  },

  submitBets: async () => {
    const { currentBets } = get()
    const currentGame = useGameStore.getState().currentGame
    const user = useUserStore.getState().user

    if (!currentGame || !user) {
      return false
    }

    if (currentBets.length === 0) {
      return false
    }

    // Check balance
    const totalAmount = get().getTotalBetAmount()
    if (totalAmount > user.balance) {
      return false
    }

    set({ isSubmitting: true })

    try {
      // Convert bets to backend format (matching old app.js)
      const betsData = currentBets.map((bet) => {
        // Extract betType from either bet.type or bet.category
        let betType = bet.type || bet.category

        // Convert category names to backend format if needed
        const categoryMap: Record<string, string> = {
          'position': 'position',
          'sum': 'sum_value',
          'bigsmall': 'big_small',
          'oddeven': 'odd_even',
          'dragontiger': 'dragon_tiger'
        }

        if (!bet.type && bet.category) {
          betType = categoryMap[bet.category] || bet.category
        }

        // Build betContent
        let betContent = bet.content || []

        // If content is not provided, try to extract from optionId
        if (!betContent || betContent.length === 0) {
          // For position bets: optionId might be "position-1-5" -> content should be ["5"]
          // For sum bets: optionId might be "sum-15" -> content should be [15]
          const parts = bet.optionId.split('-')
          if (parts.length >= 2) {
            betContent = [parts[parts.length - 1]]
          }
        }

        // Extract subOption for sum_value type (冠亞和值的具體選項 3-19)
        let subOption: string | undefined = undefined
        if (betType === 'sum_value' && betContent && betContent.length > 0) {
          subOption = String(betContent[0])
        }

        // Build the bet item
        const betItem: any = {
          betType: betType,
          betContent: betContent,
          betAmount: bet.amount,
        }

        // Only include position if it's not null/undefined
        // For sum bets, position should be omitted or null
        if (bet.position !== undefined && bet.position !== null) {
          betItem.position = bet.position
        } else {
          betItem.position = null
        }

        // Include subOption for sum_value bets
        if (subOption !== undefined) {
          betItem.subOption = subOption
        }

        return betItem
      })

      const response = await api.submitBets({
        bets: betsData,
      })

      if (response.success && response.data) {
        // Try different possible balance field names from backend
        const newBalance = response.data.newBalance
                        || response.data.balance
                        || response.data.remainingBalance
                        || response.data.updatedBalance

        // Update balance
        if (newBalance !== undefined && newBalance !== null) {
          useUserStore.getState().updateBalance(newBalance)
        } else {
          // Fallback: fetch balance if not returned
          await useUserStore.getState().fetchBalance()
        }

        // Reload game history to show new bet immediately
        useGameStore.getState().fetchHistory()

        // Clear bets
        get().clearBets()

        return true
      }

      return false
    } catch (error) {
      console.error('Failed to submit bets:', error)
      return false
    } finally {
      set({ isSubmitting: false })
    }
  },

  fetchBettingData: async () => {
    try {
      const [optionsResponse, limitsResponse] = await Promise.all([
        api.getBettingOptions(),
        api.getBettingLimits(),
      ])

      if (optionsResponse.success && optionsResponse.data) {
        get().setBetOptions(optionsResponse.data)
      }

      if (limitsResponse.success && limitsResponse.data) {
        // 🔍 調試：打印後端返回的完整限額資料
        console.log('[fetchBettingData] 後端返回的限額:', JSON.stringify(limitsResponse.data, null, 2))
        get().setBettingLimits(limitsResponse.data)
      }
    } catch (error) {
      console.error('Failed to fetch betting data:', error)
    }
  },

  getTotalBetAmount: () => {
    return get().currentBets.reduce((total, bet) => total + bet.amount, 0)
  },

  /**
   * @deprecated 此函數存在限額查詢問題，請使用 useBetting.ts 的 placeBet 代替
   * ⚠️ 問題：使用 selectedCategory 而非 betType，導致冠亞和大小/單雙使用錯誤限額
   * 目前未被使用，保留僅供參考
   */
  canPlaceBet: (amount) => {
    const { bettingLimits, selectedCategory } = get()
    const user = useUserStore.getState().user

    if (!bettingLimits?.limits || !user) {
      return false
    }

    const totalAmount = get().getTotalBetAmount() + amount

    // ⚠️ 警告：此邏輯有問題！使用 selectedCategory 會導致錯誤
    const categoryToBetTypeMap: Record<string, string> = {
      'position': 'position:',
      'sum': 'sum_value:',  // ❌ 問題：冠亞和大小/單雙也會使用冠亞和值限額
      'bigsmall': 'big_small:',
      'oddeven': 'odd_even:',
      'dragontiger': 'dragon_tiger:'
    }

    const backendKey = categoryToBetTypeMap[selectedCategory] || selectedCategory
    let categoryLimit = bettingLimits.limits[backendKey]

    // 🔥 修復：對於 sum_value，如果找不到精確 key，使用基礎 key
    if (!categoryLimit && selectedCategory === 'sum') {
      categoryLimit = bettingLimits.limits['sum_value:']
    }

    if (!categoryLimit) {
      categoryLimit = bettingLimits.limits[selectedCategory]
    }

    if (!categoryLimit) {
      return false
    }

    return (
      totalAmount <= user.balance &&
      amount >= categoryLimit.minAmount &&
      amount <= categoryLimit.maxAmount
    )
  },
}))
