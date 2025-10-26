import { sanitizeObject, safeJsonParse } from '@/utils/security'
import { CONSTANTS } from '@/config'

/**
 * Secure Storage Service
 * Provides safe localStorage operations with sanitization
 */
class StorageService {
  private prefix = 'mbl_'

  /**
   * Get item from localStorage with sanitization
   */
  getItem<T>(key: string, defaultValue: T): T {
    try {
      const fullKey = this.prefix + key
      const item = localStorage.getItem(fullKey)

      if (!item) {
        return defaultValue
      }

      const parsed = safeJsonParse<T>(item, defaultValue)

      // Sanitize if it's an object
      if (typeof parsed === 'object' && parsed !== null) {
        return sanitizeObject(parsed as any) as T
      }

      return parsed
    } catch (error) {
      console.error(`Storage getItem error for key ${key}:`, error)
      return defaultValue
    }
  }

  /**
   * Set item in localStorage with sanitization
   */
  setItem<T>(key: string, value: T): void {
    try {
      const fullKey = this.prefix + key

      // Sanitize before storing
      let sanitized = value
      if (typeof value === 'object' && value !== null) {
        sanitized = sanitizeObject(value as any) as T
      }

      localStorage.setItem(fullKey, JSON.stringify(sanitized))
    } catch (error) {
      console.error(`Storage setItem error for key ${key}:`, error)
    }
  }

  /**
   * Remove item from localStorage
   */
  removeItem(key: string): void {
    try {
      const fullKey = this.prefix + key
      localStorage.removeItem(fullKey)
    } catch (error) {
      console.error(`Storage removeItem error for key ${key}:`, error)
    }
  }

  /**
   * Clear all items with our prefix
   */
  clear(): void {
    try {
      const keys = Object.keys(localStorage)
      keys.forEach((key) => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key)
        }
      })
    } catch (error) {
      console.error('Storage clear error:', error)
    }
  }

  /**
   * Check if key exists
   */
  hasItem(key: string): boolean {
    const fullKey = this.prefix + key
    return localStorage.getItem(fullKey) !== null
  }

  // Convenience methods for common storage items

  getToken(): string | null {
    return this.getItem<string | null>(CONSTANTS.TOKEN_KEY, null)
  }

  setToken(token: string): void {
    this.setItem(CONSTANTS.TOKEN_KEY, token)
  }

  removeToken(): void {
    this.removeItem(CONSTANTS.TOKEN_KEY)
  }

  getUserProfile<T>(): T | null {
    return this.getItem<T | null>(CONSTANTS.USER_KEY, null)
  }

  setUserProfile<T>(profile: T): void {
    this.setItem(CONSTANTS.USER_KEY, profile)
  }

  removeUserProfile(): void {
    this.removeItem(CONSTANTS.USER_KEY)
  }

  /**
   * Clear all auth-related data
   */
  clearAuth(): void {
    this.removeToken()
    this.removeUserProfile()
  }
}

// Export singleton instance
export const storage = new StorageService()
