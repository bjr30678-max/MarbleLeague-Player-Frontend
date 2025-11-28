// User Types
export interface UserProfile {
  userId: string
  displayName: string
  pictureUrl?: string
  balance: number
  statusMessage?: string
  bettingStatus?: 'enabled' | 'disabled'
  bettingDisabledReason?: string | null
  bettingDisabledAt?: string | null
  bettingDisabledBy?: string | null
}

// Betting Types
export type BetCategory = 'position' | 'sum' | 'bigsmall' | 'oddeven' | 'dragontiger'

export interface BetOption {
  id: string
  category: BetCategory
  label: string
  value: string | number
  odds: number
  enabled?: boolean
}

// Backend bet options format (from original app.js)
export interface BetOptionsData {
  positions?: Array<{ odds: number }>
  sumValues?: Array<{ value: number; odds: number }>
  sumOptions?: Array<{
    type: string
    options: Array<{ name: string; value: string; odds: number }>
  }>
  positionOptions?: Array<{
    position: number
    bigSmall?: { odds: number }
    oddEven?: { odds: number }
  }>
  dragonTiger?: Array<{
    position: number
    name: string
    dragon: string
    tiger: string
    odds: number
  }>
  [key: string]: any // Allow other categories
}

export interface Bet {
  id: string
  category: BetCategory
  optionId: string
  label: string
  amount: number
  odds: number
  potentialWin: number
  // Additional fields for position-based bets (bigsmall, oddeven, dragontiger)
  position?: number | null
  content?: (string | number)[]
  type?: string  // Backend bet type (e.g., 'big_small', 'odd_even', 'dragon_tiger')
}

// Backend betting limits format
export interface BettingLimit {
  minAmount: number
  maxAmount: number
  maxPerPeriod: number
}

export interface BettingLimits {
  limits: {
    position?: BettingLimit
    sum?: BettingLimit
    bigsmall?: BettingLimit
    oddeven?: BettingLimit
    dragontiger?: BettingLimit
    [key: string]: BettingLimit | undefined  // 允許動態鍵值（如 "position:", "sum_value:"）
  }
}

// Game Types
export type GameStatus = 'waiting' | 'betting' | 'closed' | 'playing' | 'finished' | 'voided'

export interface GameState {
  roundId: string
  period: number
  status: GameStatus
  countdown: number
  timestamp: number
}

export interface GameResult {
  roundId: string
  period: number
  positions: number[]
  sum: number
  bigsmall: 'big' | 'small'
  oddeven: 'odd' | 'even'
  dragontiger: { [key: string]: 'dragon' | 'tiger' }
  timestamp: number
  // 無效局相關
  status?: 'finished' | 'voided'
  voidedAt?: string
  voidedBy?: string
  voidReason?: string
}

// Backend game history format
export interface GameHistoryRecord {
  roundId: string | number
  betType: string
  betTypeName?: string
  betContent: any
  betContentDisplay?: string
  betAmount: number
  status: 'win' | 'lose' | 'pending' | 'voided'
  createdAt: string
  odds: number
  winAmount?: number
}

export interface GameHistoryResponse {
  games: GameHistoryRecord[]
}

// Current round response (from /api/game/current-round)
export interface CurrentRoundResponse {
  status: GameStatus
  roundId?: string
  period?: number
  timeLeft?: number
  canBet?: boolean
  startTime?: string
  createdAt?: string
}

// Recent results response (from /api/game/results?limit=N)
export interface RecentResult {
  roundId: string
  result: number[] // Array of 10 numbers (positions)
  resultTime: string
  // 回合狀態欄位（後端新增）
  status?: 'finished' | 'voided'
  createdAt?: string
  voidedAt?: string
  voidedBy?: string
  voidReason?: string
}

export type RecentResultsResponse = RecentResult[]

export interface UserBet {
  category: BetCategory
  label: string
  amount: number
  odds: number
  result: 'win' | 'lose' | 'pending'
}

// WebSocket Event Types
export interface SocketEvents {
  connect: () => void
  disconnect: (reason: string) => void
  'round-started': (data: GameState) => void
  'betting-closed': () => void
  'result-confirmed': (data: GameResult) => void
  'new-bet': (data: { userId: string; amount: number }) => void
  'balance-updated': (data: { balance: number }) => void
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

export interface LoginResponse {
  token: string
  user: {
    userId: string
    displayName: string
    pictureUrl?: string
    bettingStatus?: 'enabled' | 'disabled'
    bettingDisabledReason?: string | null
    bettingDisabledAt?: string | null
    bettingDisabledBy?: string | null
  }
}

export interface BalanceResponse {
  balance: number
}

// Bet format matching backend API (based on old app.js)
export interface BetItem {
  betType: string        // e.g. 'position', 'sum', 'big_small', 'odd_even', 'dragon_tiger'
  betContent: any        // Can be string[] or number[] depending on betType
  position?: number | null      // For position-based bets (1-10), null for sum bets
  betAmount: number
}

export interface BetSubmitRequest {
  bets: BetItem[]  // Note: No roundId needed, backend tracks current round
}

export interface BetSubmitResponse {
  success: boolean
  betIds?: string[]
  bets?: any[]
  betCount?: number
  roundId?: string
  totalAmount?: number
  transactionId?: string
  // Different possible balance field names from backend
  newBalance?: number
  balance?: number
  remainingBalance?: number
  updatedBalance?: number
  message?: string
}

// Betting Ban Types
export interface BettingBan {
  isBanned: boolean
  reason?: string
  bannedAt?: string
  bannedUntil?: string
}

// Configuration Types
export interface AppConfig {
  liffId: string
  apiUrl: string
  liveApiUrl: string
  env: 'development' | 'production'
  awsIvsApiKey: string
}

// Stream Types
export interface StreamConfig {
  host?: string
  app?: string
  stream?: string
  camera?: string
}

// Pagination Types
export interface PaginationInfo {
  currentPage: number
  totalPages: number
  pageSize: number
  totalRecords: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationInfo
}

// Toast/Notification Types
export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastMessage {
  id: string
  type: ToastType
  message: string
  duration?: number
}

// Period Statistics
export interface PeriodStats {
  period: number
  totalBets: number
  totalAmount: number
  winAmount: number
  loseAmount: number
}
