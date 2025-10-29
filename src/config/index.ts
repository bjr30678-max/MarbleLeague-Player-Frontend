import type { AppConfig } from '@/types'

// Get configuration from environment variables
const getConfig = (): AppConfig => {
  // Check URL parameters first (for dynamic configuration)
  const urlParams = new URLSearchParams(window.location.search)
  const liffFromUrl = urlParams.get('liff')
  const apiFromUrl = urlParams.get('api')
  const liveApiFromUrl = urlParams.get('liveApi')

  // Get from environment variables (Vite)
  const liffId = liffFromUrl || import.meta.env.VITE_LIFF_ID
  let apiUrl = apiFromUrl || import.meta.env.VITE_API_URL
  let liveApiUrl = liveApiFromUrl || import.meta.env.VITE_LIVE_API_URL || ''
  const env = (import.meta.env.VITE_ENV as 'development' | 'production') || 'production'
  const awsIvsApiKey = import.meta.env.VITE_AWS_IVS_API_KEY || ''

  // In development mode, if API URL is empty, use current origin for Vite proxy
  if (!apiUrl && (env === 'development' || import.meta.env.DEV)) {
    apiUrl = window.location.origin
    console.warn('🔧 開發模式: 使用 Vite proxy，API URL:', apiUrl)
  }

  // If live API URL is not set, fall back to main API URL
  if (!liveApiUrl) {
    liveApiUrl = apiUrl
    console.warn('⚠️ VITE_LIVE_API_URL 未設定，使用主 API URL:', liveApiUrl)
  }

  if (!liffId) {
    console.error('Missing LIFF ID. Please check your .env file.')
    throw new Error('Configuration error: LIFF ID is required')
  }

  if (!apiUrl) {
    console.error('Missing API URL. Please check your .env file.')
    throw new Error('Configuration error: API URL is required')
  }

  return {
    liffId,
    apiUrl,
    liveApiUrl,
    env,
    awsIvsApiKey,
  }
}

export const config = getConfig()

// Development mode detection
export const isDevelopment = config.env === 'development' ||
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'

// WebSocket URL configuration
// Socket.io CAN use Vite proxy in development mode to avoid CORS issues
export const getWebSocketUrl = (): string => {
  const apiFromUrl = new URLSearchParams(window.location.search).get('api')
  const envApiUrl = import.meta.env.VITE_API_URL

  // If we have an explicit API URL from env or URL param, use it (production mode)
  if (apiFromUrl) {
    return apiFromUrl
  }

  if (envApiUrl) {
    return envApiUrl
  }

  // In development mode with empty API URL, use Vite proxy
  // Socket.io will connect to localhost:3000/socket.io
  // Vite proxy will forward to https://api.bjr8888.com/socket.io
  if (isDevelopment) {
    console.warn('🔧 WebSocket 開發模式: 使用 Vite proxy (localhost:3000 → api.bjr8888.com)')
    return window.location.origin // localhost:3000
  }

  // Production: use current origin (same domain)
  return window.location.origin
}

// API endpoints (matching original app.js)
export const API_ENDPOINTS = {
  AUTH: {
    LIFF_LOGIN: '/api/auth/liff-login',
  },
  GAME: {
    BET_OPTIONS: '/api/game/bet-options',
    BETTING_LIMITS: '/api/game/betting-limits',
    BATCH_PLAY: '/api/game/batch-play',
    HISTORY: '/api/game/history',
    USER_PERIOD_STATS: '/api/game/user-period-stats',
    CURRENT_ROUND: '/api/game/current-round', // Get current round state
    RESULTS: '/api/game/results', // Get recent results with ?limit=N
  },
  POINTS: {
    BALANCE: '/api/points/balance', // /{userId} will be appended
  },
  IVS: {
    VIEWER_TOKEN: '/api/token/viewer',
    PUBLISHER_TOKEN: '/api/token/publisher',
    HEARTBEAT: '/api/viewer/heartbeat',
    LEAVE: '/api/viewer/leave',
    REJOIN: '/api/viewer/rejoin',
    STATS: '/api/stats',
  },
} as const

// Constants
export const CONSTANTS = {
  BET_AMOUNTS: [10, 50, 100, 500, 1000],
  COUNTDOWN_DURATION: 30,
  HISTORY_PAGE_SIZE: 20,
  RECENT_RESULTS_LIMIT: 10,
  TOAST_DURATION: 3000,
  TOKEN_KEY: 'auth_token',
  USER_KEY: 'user_profile',
  CONFIG_VERSION: '1.0.2',
  // AWS IVS Configuration
  IVS: {
    VIEWER_TOKEN_EXPIRY: 3600, // 1 hour in seconds
    PUBLISHER_TOKEN_EXPIRY: 14400, // 4 hours in seconds
    HEARTBEAT_INTERVAL: 30000, // 30 seconds in ms
    HEARTBEAT_TIMEOUT: 60000, // 60 seconds in ms
    TOKEN_REFRESH_BUFFER: 300000, // Refresh 5 minutes before expiry (in ms)
    MAX_VIEWERS_PER_STAGE: 50,
    MAX_STAGES: 20,
    AUTO_SCALE_THRESHOLD: 45, // Create new stage when viewers >= 45
  },
} as const

// Betting categories configuration
// Icons are now imported as React components in BetSelector.tsx
export const BETTING_CATEGORIES = {
  position: { label: '名次' },
  sum: { label: '冠亞和' },
  bigsmall: { label: '大小' },
  oddeven: { label: '單雙' },
  dragontiger: { label: '龍虎' },
} as const

// Export types
export type BetAmounts = typeof CONSTANTS.BET_AMOUNTS[number]
