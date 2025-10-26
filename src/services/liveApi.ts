import type { ApiResponse } from '@/types'
import { config, isDevelopment } from '@/config'
import { storage } from './storage'
import { validateToken } from '@/utils/validation'
import { toast } from '@/stores/useToastStore'

/**
 * Live API Service
 * 專門處理直播相關的 API 請求（AWS IVS）
 * 與主 API server 分離
 */
class LiveApiService {
  private baseUrl: string

  constructor() {
    // In development mode, use Vite proxy (relative path)
    // In production, use the full liveApiUrl
    if (isDevelopment && config.liveApiUrl.includes('localhost')) {
      // Use Vite proxy for localhost to avoid CSP and CORS issues
      this.baseUrl = window.location.origin
      console.warn('🔧 開發模式: 直播 API 使用 Vite proxy (localhost:3000 → localhost:3005)')
    } else {
      this.baseUrl = config.liveApiUrl
    }
  }

  /**
   * Make authenticated API request to live API server
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

        // Handle 401 Unauthorized
        if (response.status === 401 || response.status === 403) {
          const errorMsg = '直播服務認證失敗'
          toast.error(errorMsg)
          throw new Error(errorMsg)
        }

        const errorMsg = errorData.error || errorData.message || `HTTP Error: ${response.status}`
        throw new Error(errorMsg)
      }

      const data = await response.json()

      // Debug logging in development
      if (isDevelopment) {
        console.log('🔍 [LiveAPI] Response from', endpoint, ':', data)
      }

      // Check if backend already returns { success, data } format
      // If so, return it as-is; otherwise wrap it
      if (typeof data === 'object' && 'success' in data && 'data' in data) {
        // Backend already returned ApiResponse format
        return data as ApiResponse<T>
      }

      // Backend returned raw data, wrap it in ApiResponse format
      return {
        success: true,
        data,
      }
    } catch (error) {
      console.error(`Live API request failed [${endpoint}]:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }
}

// Export singleton instance
export const liveApi = new LiveApiService()
