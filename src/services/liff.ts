import type { UserProfile } from '@/types'
import { config, isDevelopment } from '@/config'
import { api } from './api'
import { storage } from './storage'

// Declare LIFF type for TypeScript
declare global {
  interface Window {
    liff: any
  }
}

class LiffService {
  private initialized = false
  private mockUser: UserProfile | null = null

  /**
   * Initialize LIFF SDK
   */
  async init(): Promise<boolean> {
    try {
      // Development mode - use mock authentication
      if (isDevelopment) {
        console.warn(
          '🔧 開發模式: 使用模擬 LIFF 驗證\n' +
          '   這是正常的開發環境行為，不會影響生產環境'
        )
        this.initialized = true
        return true
      }

      // Check if LIFF SDK is loaded
      if (!window.liff) {
        throw new Error('LIFF SDK not loaded')
      }

      // Initialize LIFF
      await window.liff.init({ liffId: config.liffId })

      this.initialized = true
      return true
    } catch (error) {
      console.error('LIFF initialization failed:', error)
      return false
    }
  }

  /**
   * Check if user is logged in
   */
  isLoggedIn(): boolean {
    if (isDevelopment) {
      return this.mockUser !== null || storage.hasItem('mock_user')
    }

    if (!this.initialized || !window.liff) {
      return false
    }

    return window.liff.isLoggedIn()
  }

  /**
   * Login with LIFF
   */
  async login(): Promise<void> {
    if (isDevelopment) {
      // Mock login for development
      this.mockUser = {
        userId: 'dev-user-' + Date.now(),
        displayName: '測試用戶',
        pictureUrl: 'https://via.placeholder.com/150',
        balance: 10000,
      }
      storage.setItem('mock_user', this.mockUser)
      return
    }

    if (!this.initialized || !window.liff) {
      throw new Error('LIFF not initialized')
    }

    if (!window.liff.isLoggedIn()) {
      window.liff.login()
    }
  }

  /**
   * Logout
   */
  logout(): void {
    if (isDevelopment) {
      this.mockUser = null
      storage.removeItem('mock_user')
      storage.clearAuth()
      return
    }

    if (!this.initialized || !window.liff) {
      return
    }

    if (window.liff.isLoggedIn()) {
      window.liff.logout()
    }

    storage.clearAuth()
  }

  /**
   * Get user profile from LIFF
   */
  async getProfile(): Promise<UserProfile | null> {
    try {
      if (isDevelopment) {
        const mockUser = storage.getItem<UserProfile | null>('mock_user', null)
        if (mockUser) {
          return mockUser
        }
        // Return default mock user
        return {
          userId: 'dev-user-123456',
          displayName: '測試用戶',
          pictureUrl: 'https://via.placeholder.com/150',
          balance: 10000,
        }
      }

      if (!this.initialized || !window.liff) {
        throw new Error('LIFF not initialized')
      }

      if (!window.liff.isLoggedIn()) {
        throw new Error('User not logged in')
      }

      const profile = await window.liff.getProfile()

      return {
        userId: profile.userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl,
        statusMessage: profile.statusMessage,
        balance: 0, // Will be fetched from backend
      }
    } catch (error) {
      console.error('Failed to get LIFF profile:', error)
      return null
    }
  }

  /**
   * Get LIFF access token
   */
  getAccessToken(): string | null {
    if (isDevelopment) {
      return 'dev-mock-token-' + Date.now()
    }

    if (!this.initialized || !window.liff) {
      return null
    }

    if (!window.liff.isLoggedIn()) {
      return null
    }

    return window.liff.getAccessToken()
  }

  /**
   * Complete authentication flow
   * Gets LIFF profile and authenticates with backend
   */
  async authenticate(): Promise<UserProfile | null> {
    try {
      // Get LIFF profile
      const profile = await this.getProfile()
      if (!profile) {
        throw new Error('Failed to get user profile')
      }

      // Development mode - skip backend authentication
      if (isDevelopment) {
        console.warn('🔧 開發模式: 跳過後端驗證，使用模擬資料')

        // Store mock token
        storage.setToken('dev-mock-token-' + Date.now())

        // Store user profile with mock balance
        storage.setUserProfile(profile)

        return profile
      }

      // Get LIFF access token
      const liffToken = this.getAccessToken()
      if (!liffToken) {
        throw new Error('Failed to get access token')
      }

      // Authenticate with backend (production only)
      const response = await api.loginWithLiff(liffToken, profile.userId)

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Backend authentication failed')
      }

      // Store token
      storage.setToken(response.data.token)

      // Update profile with balance from backend
      const userProfile: UserProfile = {
        ...profile,
        balance: response.data.balance,
      }

      // Store user profile
      storage.setUserProfile(userProfile)

      return userProfile
    } catch (error) {
      console.error('Authentication failed:', error)
      return null
    }
  }

  /**
   * Check if running in LINE app
   */
  isInClient(): boolean {
    if (isDevelopment) {
      return false
    }

    if (!this.initialized || !window.liff) {
      return false
    }

    return window.liff.isInClient()
  }

  /**
   * Close LIFF window
   */
  closeWindow(): void {
    if (!this.initialized || !window.liff) {
      return
    }

    if (window.liff.isInClient()) {
      window.liff.closeWindow()
    }
  }

  /**
   * Open external URL in LINE browser
   */
  openWindow(url: string): void {
    if (!this.initialized || !window.liff) {
      window.open(url, '_blank')
      return
    }

    window.liff.openWindow({
      url,
      external: true,
    })
  }
}

// Export singleton instance
export const liff = new LiffService()
