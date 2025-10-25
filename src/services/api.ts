import type {
  ApiResponse,
  LoginResponse,
  BalanceResponse,
  BetOption,
  BettingLimits,
  BetSubmitRequest,
  BetSubmitResponse,
  GameState,
  GameHistoryRecord,
  GameResult,
  PaginatedResponse,
} from '@/types'
import { config, API_ENDPOINTS } from '@/config'
import { storage } from './storage'
import { validateToken } from '@/utils/validation'

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
        }))

        // Handle 401 Unauthorized - clear token
        if (response.status === 401) {
          storage.clearAuth()
          throw new Error('認證失敗，請重新登入')
        }

        throw new Error(errorData.message || `HTTP Error: ${response.status}`)
      }

      const data = await response.json()
      return {
        success: true,
        data,
      }
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Login with LIFF token
   */
  async loginWithLiff(liffToken: string, userId: string): Promise<ApiResponse<LoginResponse>> {
    return this.request<LoginResponse>(API_ENDPOINTS.AUTH.LIFF_LOGIN, {
      method: 'POST',
      body: JSON.stringify({
        liffToken,
        userId,
      }),
    })
  }

  /**
   * Get user balance
   */
  async getUserBalance(): Promise<ApiResponse<BalanceResponse>> {
    return this.request<BalanceResponse>(API_ENDPOINTS.USER.BALANCE, {
      method: 'GET',
    })
  }

  /**
   * Get betting options
   */
  async getBettingOptions(): Promise<ApiResponse<BetOption[]>> {
    return this.request<BetOption[]>(API_ENDPOINTS.BETTING.OPTIONS, {
      method: 'GET',
    })
  }

  /**
   * Get betting limits
   */
  async getBettingLimits(): Promise<ApiResponse<BettingLimits>> {
    return this.request<BettingLimits>(API_ENDPOINTS.BETTING.LIMITS, {
      method: 'GET',
    })
  }

  /**
   * Submit bets
   */
  async submitBets(request: BetSubmitRequest): Promise<ApiResponse<BetSubmitResponse>> {
    return this.request<BetSubmitResponse>(API_ENDPOINTS.BETTING.SUBMIT, {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  /**
   * Get current game state
   */
  async getCurrentGame(): Promise<ApiResponse<GameState>> {
    return this.request<GameState>(API_ENDPOINTS.GAMES.CURRENT, {
      method: 'GET',
    })
  }

  /**
   * Get game history with pagination
   */
  async getGameHistory(
    page: number = 1,
    pageSize: number = 20
  ): Promise<ApiResponse<PaginatedResponse<GameHistoryRecord>>> {
    return this.request<PaginatedResponse<GameHistoryRecord>>(
      `${API_ENDPOINTS.GAMES.HISTORY}?page=${page}&pageSize=${pageSize}`,
      {
        method: 'GET',
      }
    )
  }

  /**
   * Get recent results
   */
  async getRecentResults(limit: number = 10): Promise<ApiResponse<GameResult[]>> {
    return this.request<GameResult[]>(
      `${API_ENDPOINTS.RESULTS.RECENT}?limit=${limit}`,
      {
        method: 'GET',
      }
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
