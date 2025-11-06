import type {
  ApiResponse,
  LoginResponse,
  BalanceResponse,
  BetOptionsData,
  BettingLimits,
  BetSubmitRequest,
  BetSubmitResponse,
  GameHistoryResponse,
  CurrentRoundResponse,
  RecentResultsResponse,
} from '@/types'
import { config, API_ENDPOINTS } from '@/config'
import { storage } from './storage'
import { validateToken } from '@/utils/validation'
import { toast } from '@/stores/useToastStore'

class ApiService {
  private baseUrl: string

  constructor() {
    this.baseUrl = config.apiUrl
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const token = storage.getToken()
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      }

      // Add auth token if available
      if (token && validateToken(token)) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
        mode: 'cors',
        credentials: 'omit', // Don't send cookies for security
      })

      // Handle HTTP errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          message: 'Network error',
          error: 'Network error',
        }))

        // Handle 401 Unauthorized - clear token
        if (response.status === 401 || response.status === 403) {
          storage.clearAuth()
          const errorMsg = '認證失敗，請重新登入'

          // Only show toast if not a login request (matching original app.js)
          if (!endpoint.includes('/auth/liff-login')) {
            toast.error('登入已失效，請重新整理頁面')
            setTimeout(() => {
              window.location.reload()
            }, 2000)
          }

          throw new Error(errorMsg)
        }

        // Use errorData.error (backend format) or errorData.message
        const errorMsg = errorData.error || errorData.message || `HTTP Error: ${response.status}`
        throw new Error(errorMsg)
      }

      const data = await response.json()
      return {
        success: true,
        data,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`API request failed for ${endpoint}:`, error)

      // Show toast for all errors (matching original app.js behavior)
      // The toast will display the error message to the user
      toast.error(errorMessage || '網路錯誤')

      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * Login with LIFF token (原始格式: userId, displayName, pictureUrl, accessToken)
   */
  async loginWithLiff(profile: {
    userId: string
    displayName: string
    pictureUrl?: string
    accessToken: string
  }): Promise<ApiResponse<LoginResponse>> {
    return this.request<LoginResponse>(API_ENDPOINTS.AUTH.LIFF_LOGIN, {
      method: 'POST',
      body: JSON.stringify({
        userId: profile.userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl,
        accessToken: profile.accessToken,
      }),
    })
  }

  /**
   * Get user balance (原始路徑: /api/points/balance/{userId})
   */
  async getUserBalance(userId: string): Promise<ApiResponse<BalanceResponse>> {
    return this.request<BalanceResponse>(`${API_ENDPOINTS.POINTS.BALANCE}/${userId}`, {
      method: 'GET',
    })
  }

  /**
   * Get betting options (原始路徑: /api/game/bet-options)
   * Returns object with different bet categories
   */
  async getBettingOptions(): Promise<ApiResponse<BetOptionsData>> {
    return this.request<BetOptionsData>(API_ENDPOINTS.GAME.BET_OPTIONS, {
      method: 'GET',
    })
  }

  /**
   * Get betting limits (原始路徑: /api/game/betting-limits)
   */
  async getBettingLimits(): Promise<ApiResponse<BettingLimits>> {
    return this.request<BettingLimits>(API_ENDPOINTS.GAME.BETTING_LIMITS, {
      method: 'GET',
    })
  }

  /**
   * Get user period stats (原始路徑: /api/game/user-period-stats)
   */
  async getUserPeriodStats(): Promise<ApiResponse<any>> {
    return this.request<any>(API_ENDPOINTS.GAME.USER_PERIOD_STATS, {
      method: 'GET',
    })
  }

  /**
   * Submit bets (原始路徑: /api/game/batch-play)
   */
  async submitBets(request: BetSubmitRequest): Promise<ApiResponse<BetSubmitResponse>> {
    return this.request<BetSubmitResponse>(API_ENDPOINTS.GAME.BATCH_PLAY, {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  /**
   * Get game history (原始路徑: /api/game/history?limit=N&offset=N)
   * Returns { games: GameHistoryRecord[] }
   */
  async getGameHistory(limit: number = 20, offset: number = 0): Promise<ApiResponse<GameHistoryResponse>> {
    return this.request<GameHistoryResponse>(
      `${API_ENDPOINTS.GAME.HISTORY}?limit=${limit}&offset=${offset}`,
      {
        method: 'GET',
      }
    )
  }

  /**
   * Get current round state (原始路徑: /api/game/current-round)
   * Returns current round status, roundId, timeLeft, canBet
   */
  async getCurrentRound(): Promise<ApiResponse<CurrentRoundResponse>> {
    return this.request<CurrentRoundResponse>(API_ENDPOINTS.GAME.CURRENT_ROUND, {
      method: 'GET',
    })
  }

  /**
   * Get recent results (原始路徑: /api/game/results?limit=N&offset=N)
   * Returns array of recent game results
   */
  async getRecentResults(limit: number = 10, offset: number = 0): Promise<ApiResponse<RecentResultsResponse>> {
    return this.request<RecentResultsResponse>(
      `${API_ENDPOINTS.GAME.RESULTS}?limit=${limit}&offset=${offset}`,
      {
        method: 'GET',
      }
    )
  }

  /**
   * Get current round betting statistics (用於熱門投注)
   */
  async getBetStats(): Promise<ApiResponse<{
    roundId: string
    totalBets: number
    totalAmount: number
    typeSummary: Array<{
      betType: string
      position: number | null
      betTypeName: string
      count: number
      amount: number
    }>
  }>> {
    return this.request(
      '/api/game/bet-stats',
      { method: 'GET' }
    )
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        mode: 'cors',
      })
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Generic POST request
   */
  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  /**
   * Generic GET request
   */
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'GET',
    })
  }
}

// Export singleton instance
export const api = new ApiService()
