import { useBettingStore } from '@/stores/useBettingStore'
import { useUserStore } from '@/stores/useUserStore'
import { useGameStore } from '@/stores/useGameStore'
import { toast } from '@/stores/useToastStore'
import { validateBetAmount, hasSufficientBalance } from '@/utils/validation'

export const useBetting = () => {
  const bettingStore = useBettingStore()
  const { user } = useUserStore()
  const { currentGame } = useGameStore()

  const canBet = () => {
    if (!currentGame) {
      toast.error('目前沒有進行中的遊戲')
      return false
    }

    if (currentGame.status !== 'betting') {
      toast.error('目前無法投注')
      return false
    }

    if (!user) {
      toast.error('請先登入')
      return false
    }

    const userStore = useUserStore.getState()
    if (userStore.bettingBan?.isBanned) {
      toast.error(`投注已被禁止: ${userStore.bettingBan.reason}`)
      return false
    }

    return true
  }

  const placeBet = (optionId: string, label: string, odds: number) => {
    if (!canBet()) {
      return false
    }

    const { selectedAmount, bettingLimits, selectedCategory } = bettingStore

    // Validate amount
    const validation = validateBetAmount(selectedAmount)
    if (!validation.valid) {
      toast.error(validation.error || '無效的投注金額')
      return false
    }

    // Check category limit
    if (bettingLimits?.limits?.[selectedCategory]) {
      const limit = bettingLimits.limits[selectedCategory]
      if (selectedAmount < limit.minAmount) {
        toast.error(`最小投注金額為 ${limit.minAmount}`)
        return false
      }
      if (selectedAmount > limit.maxAmount) {
        toast.error(`最大投注金額為 ${limit.maxAmount}`)
        return false
      }
    }

    // Check balance
    if (user) {
      const totalAmount = bettingStore.getTotalBetAmount() + selectedAmount
      const balanceCheck = hasSufficientBalance(user.balance, totalAmount)
      if (!balanceCheck.valid) {
        toast.error(balanceCheck.error || '餘額不足')
        return false
      }
    }

    bettingStore.addBet(optionId, label, odds)
    toast.success(`已添加投注: ${label}`)
    return true
  }

  const submitAllBets = async () => {
    if (!canBet()) {
      return false
    }

    if (bettingStore.currentBets.length === 0) {
      toast.error('請先選擇投注項目')
      return false
    }

    const success = await bettingStore.submitBets()

    if (success) {
      toast.success('投注成功!')
      return true
    } else {
      toast.error('投注失敗，請稍後再試')
      return false
    }
  }

  return {
    ...bettingStore,
    canBet,
    placeBet,
    submitAllBets,
  }
}
