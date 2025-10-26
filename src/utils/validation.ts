import type { BetCategory } from '@/types'

/**
 * Validate bet amount
 */
export const validateBetAmount = (
  amount: number,
  min: number = 10,
  max: number = 10000
): { valid: boolean; error?: string } => {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return { valid: false, error: '無效的投注金額' }
  }

  if (amount < min) {
    return { valid: false, error: `最低投注金額為 ${min}` }
  }

  if (amount > max) {
    return { valid: false, error: `最高投注金額為 ${max}` }
  }

  if (amount % 10 !== 0) {
    return { valid: false, error: '投注金額必須是 10 的倍數' }
  }

  return { valid: true }
}

/**
 * Validate bet category
 */
export const validateBetCategory = (category: string): category is BetCategory => {
  const validCategories: BetCategory[] = [
    'position',
    'sum',
    'bigsmall',
    'oddeven',
    'dragontiger',
  ]
  return validCategories.includes(category as BetCategory)
}

/**
 * Validate position number
 */
export const validatePosition = (position: number): boolean => {
  return Number.isInteger(position) && position >= 1 && position <= 10
}

/**
 * Validate sum value
 */
export const validateSum = (sum: number): boolean => {
  return Number.isInteger(sum) && sum >= 3 && sum <= 19
}

/**
 * Check if user has sufficient balance
 */
export const hasSufficientBalance = (
  userBalance: number,
  totalBetAmount: number
): { valid: boolean; error?: string } => {
  if (totalBetAmount > userBalance) {
    return {
      valid: false,
      error: `餘額不足。當前餘額: ${userBalance}, 需要: ${totalBetAmount}`,
    }
  }
  return { valid: true }
}

/**
 * Validate round ID format
 */
export const validateRoundId = (roundId: string): boolean => {
  // Round ID should be in format: YYYYMMDD-NNNN or similar
  return /^[A-Za-z0-9-_]{8,50}$/.test(roundId)
}

/**
 * Validate user ID
 */
export const validateUserId = (userId: string): boolean => {
  return typeof userId === 'string' && userId.length > 0 && userId.length <= 100
}

/**
 * Validate token format
 */
export const validateToken = (token: string): boolean => {
  return typeof token === 'string' && token.length >= 20 && token.length <= 500
}

/**
 * Calculate total bet amount from bets array
 */
export const calculateTotalBetAmount = (
  bets: Array<{ amount: number }>
): number => {
  return bets.reduce((total, bet) => total + (bet.amount || 0), 0)
}

/**
 * Validate period number
 */
export const validatePeriod = (period: number): boolean => {
  return Number.isInteger(period) && period > 0 && period < 10000000
}

/**
 * Format currency display
 */
export const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('zh-TW', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

/**
 * Format date for display
 */
export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * Validate odds value
 */
export const validateOdds = (odds: number): boolean => {
  return typeof odds === 'number' && odds > 0 && odds <= 1000
}
