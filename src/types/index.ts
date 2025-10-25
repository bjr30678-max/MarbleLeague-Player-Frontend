// User Types
export interface UserProfile {
  userId: string
  displayName: string
  pictureUrl?: string
  balance: number
  statusMessage?: string
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
}

// Backend betting limits format
export interface BettingLimit {
  minAmount: number
  maxAmount: number
  maxPerPeriod: number
}

export interface BettingLimits {
  limits: {
    position: BettingLimit
    sum: BettingLimit
    bigsmall: BettingLimit
    oddeven: BettingLimit
    dragontiger: BettingLimit
  }
}

// Game Types
export type GameStatus = 'waiting' | 'betting' | 'closed' | 'finished'

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
}

// Backend game history format
export interface GameHistoryRecord {
  roundId: string | number
  betType: string
  betTypeName?: string
  betContent: any
  betContentDisplay?: string
  betAmount: number
  status: 'win' | 'lose' | 'pending'
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
    bettingStatus?: 'active' | 'disabled'
  }
}

export interface BalanceResponse {
  balance: number
}

export interface BetSubmitRequest {
  roundId: string
  bets: {
    category: BetCategory
    optionId: string
    amount: number
  }[]
}

export interface BetSubmitResponse {
  success: boolean
  betIds: string[]
  newBalance: number
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
  env: 'development' | 'production'
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
