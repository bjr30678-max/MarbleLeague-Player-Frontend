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

  const placeBet = (
    optionId: string,
    label: string,
    odds: number,
    betType?: string,
    position?: number | null,
    content?: (string | number)[]
  ) => {
    if (!canBet()) {
      return false
    }

    const { selectedAmount, bettingLimits, selectedCategory } = bettingStore

    // 🔧 映射前端 category 到後端 betType 格式
    const categoryToBetTypeMap: Record<string, string> = {
      'position': 'position:',
      'sum': 'sum_value:',
      'bigsmall': 'big_small:',
      'oddeven': 'odd_even:',
      'dragontiger': 'dragon_tiger:'
    }

    const backendKey = categoryToBetTypeMap[selectedCategory] || selectedCategory

    // 🔍 調試：打印所有限額鍵值
    console.log('[useBetting] selectedCategory:', selectedCategory)
    console.log('[useBetting] backendKey:', backendKey)
    console.log('[useBetting] bettingLimits.limits:', bettingLimits?.limits)

    // Get category limit from backend format
    const categoryLimit = bettingLimits?.limits?.[backendKey] || bettingLimits?.limits?.[selectedCategory]

    console.log('[useBetting] categoryLimit:', categoryLimit)

    if (!categoryLimit) {
      console.warn(`未找到 ${selectedCategory} 的限額設定，使用預設值`)
    }

    const minAmount = categoryLimit?.minAmount || 10
    const maxAmount = categoryLimit?.maxAmount || 10000

    console.log('[useBetting] Final limits - min:', minAmount, 'max:', maxAmount)

    // Validate amount with correct limits
    const validation = validateBetAmount(selectedAmount, minAmount, maxAmount)
    if (!validation.valid) {
      toast.error(validation.error || '無效的投注金額')
      return false
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

    bettingStore.addBet(optionId, label, odds, betType, position, content)
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
