import type { AppConfig } from '@/types'

// Get configuration from environment variables
const getConfig = (): AppConfig => {
  // Check URL parameters first (for dynamic configuration)
  const urlParams = new URLSearchParams(window.location.search)
  const liffFromUrl = urlParams.get('liff')
  const apiFromUrl = urlParams.get('api')

  // Get from environment variables (Vite)
  const liffId = liffFromUrl || import.meta.env.VITE_LIFF_ID
  let apiUrl = apiFromUrl || import.meta.env.VITE_API_URL
  const env = (import.meta.env.VITE_ENV as 'development' | 'production') || 'production'

  // In development mode, if API URL is empty, use current origin for Vite proxy
  if (!apiUrl && (env === 'development' || import.meta.env.DEV)) {
    apiUrl = window.location.origin
    console.warn('🔧 開發模式: 使用 Vite proxy，API URL:', apiUrl)
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
    env,
  }
}

export const config = getConfig()

// Development mode detection
export const isDevelopment = config.env === 'development' ||
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'

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
  CONFIG_VERSION: '2.0.0',
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
export const BETTING_CATEGORIES = {
  position: { label: '名次', icon: '🏆' },
  sum: { label: '冠亞和', icon: '➕' },
  bigsmall: { label: '大小', icon: '📊' },
  oddeven: { label: '單雙', icon: '🎲' },
  dragontiger: { label: '龍虎', icon: '🐉' },
} as const

// Export types
export type BetAmounts = typeof CONSTANTS.BET_AMOUNTS[number]
