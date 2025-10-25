/**
 * AWS IVS (Interactive Video Service) Integration
 *
 * This service provides:
 * 1. Viewer service for audience joining live streams
 * 2. Publisher service for broadcasters
 * 3. Token management with auto-refresh
 * 4. Heartbeat mechanism for tracking active viewers
 */

import { api } from './api'
import { isDevelopment } from '../config'

// ==================== Types ====================

export interface IVSTokenResponse {
  token: string
  participantId: string
  stageArn: string
  expiresIn: number
  currentViewers?: number
  whipEndpoint?: string
  instructions?: {
    obs?: Record<string, any>
    web?: Record<string, any>
  }
}

export interface IVSStatsUpdate {
  totalViewers: number
  activeStages: number
  isPublisherLive: boolean
}

export interface IVSHeartbeatResponse {
  success: boolean
  currentViewers: number
  timestamp: string
}

// ==================== Constants ====================

const IVS_CONFIG = {
  VIEWER_TOKEN_EXPIRY: 3600, // 1 hour in seconds
  PUBLISHER_TOKEN_EXPIRY: 14400, // 4 hours in seconds
  HEARTBEAT_INTERVAL: 30000, // 30 seconds in ms
  HEARTBEAT_TIMEOUT: 60000, // 60 seconds in ms
  TOKEN_REFRESH_BUFFER: 300000, // Refresh 5 minutes before expiry (in ms)
}

// ==================== Viewer Service ====================

export class ViewerService {
  private userId: string
  private stageArn: string | null = null
  private participantId: string | null = null
  private token: string | null = null
  private heartbeatInterval: number | null = null
  private tokenRefreshTimeout: number | null = null
  private isActive = false

  constructor(userId: string) {
    this.userId = userId
  }

  /**
   * Join a live stream as a viewer
   * @param stageArn Optional - Stage ARN to join. If not provided, auto-assigns to available stage
   * @returns Token response with stage information
   */
  async join(stageArn?: string): Promise<IVSTokenResponse> {
    try {
      const response = await api.post<IVSTokenResponse>('/api/token/viewer', {
        userId: this.userId,
        ...(stageArn && { stageArn })
      })

      if (!response.success || !response.data) {
        throw new Error('Failed to get viewer token')
      }

      const data = response.data
      this.token = data.token
      this.participantId = data.participantId
      this.stageArn = data.stageArn
      this.isActive = true

      // Start heartbeat mechanism
      this.startHeartbeat()

      // Schedule token refresh
      this.scheduleTokenRefresh(data.expiresIn)

      if (isDevelopment) {
        console.log('✅ IVS Viewer joined:', {
          stageArn: this.stageArn,
          participantId: this.participantId,
          currentViewers: data.currentViewers
        })
      }

      return data
    } catch (error) {
      console.error('❌ Failed to join as viewer:', error)
      throw error
    }
  }

  /**
   * Send heartbeat to maintain viewer presence
   * Automatically called every 30 seconds after joining
   */
  private async sendHeartbeat(): Promise<void> {
    if (!this.isActive || !this.stageArn) {
      return
    }

    try {
      const response = await api.post<IVSHeartbeatResponse>('/api/viewer/heartbeat', {
        userId: this.userId,
        stageArn: this.stageArn
      })

      if (response.success && isDevelopment) {
        console.log('💓 Heartbeat sent:', response.data?.currentViewers, 'viewers')
      }
    } catch (error) {
      console.error('❌ Heartbeat failed:', error)
      // Don't throw - let the interval continue
    }
  }

  /**
   * Start periodic heartbeat
   */
  private startHeartbeat(): void {
    this.stopHeartbeat() // Clear any existing interval

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat()
    }, IVS_CONFIG.HEARTBEAT_INTERVAL)

    // Send initial heartbeat immediately
    this.sendHeartbeat()
  }

  /**
   * Stop heartbeat mechanism
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  /**
   * Schedule automatic token refresh before expiry
   */
  private scheduleTokenRefresh(expiresIn: number): void {
    // Clear any existing timeout
    if (this.tokenRefreshTimeout) {
      clearTimeout(this.tokenRefreshTimeout)
    }

    // Refresh 5 minutes before expiry
    const refreshTime = (expiresIn * 1000) - IVS_CONFIG.TOKEN_REFRESH_BUFFER

    if (refreshTime > 0) {
      this.tokenRefreshTimeout = setTimeout(() => {
        this.refreshToken()
      }, refreshTime)

      if (isDevelopment) {
        console.log(`🔄 Token refresh scheduled in ${Math.round(refreshTime / 60000)} minutes`)
      }
    }
  }

  /**
   * Refresh viewer token
   */
  private async refreshToken(): Promise<void> {
    if (!this.isActive || !this.stageArn) {
      return
    }

    try {
      if (isDevelopment) {
        console.log('🔄 Refreshing viewer token...')
      }

      await this.join(this.stageArn)

      if (isDevelopment) {
        console.log('✅ Token refreshed successfully')
      }
    } catch (error) {
      console.error('❌ Token refresh failed:', error)
    }
  }

  /**
   * Leave the live stream
   */
  async leave(): Promise<void> {
    this.isActive = false
    this.stopHeartbeat()

    if (this.tokenRefreshTimeout) {
      clearTimeout(this.tokenRefreshTimeout)
      this.tokenRefreshTimeout = null
    }

    if (this.stageArn) {
      try {
        await api.post('/api/viewer/leave', {
          userId: this.userId,
          stageArn: this.stageArn
        })

        if (isDevelopment) {
          console.log('👋 Viewer left the stream')
        }
      } catch (error) {
        console.error('❌ Failed to notify server of leave:', error)
      }
    }

    // Clear state
    this.token = null
    this.participantId = null
    this.stageArn = null
  }

  /**
   * Get current token (for use with IVS SDK)
   */
  getToken(): string | null {
    return this.token
  }

  /**
   * Get stage information
   */
  getStageInfo(): { stageArn: string | null; participantId: string | null } {
    return {
      stageArn: this.stageArn,
      participantId: this.participantId
    }
  }

  /**
   * Check if viewer is currently active
   */
  isViewerActive(): boolean {
    return this.isActive && this.token !== null
  }
}

// ==================== Publisher Service ====================

export class PublisherService {
  private userId: string
  private token: string | null = null
  private participantId: string | null = null
  private stageArn: string | null = null
  private tokenRefreshTimeout: number | null = null
  private isActive = false

  constructor(userId: string) {
    this.userId = userId
  }

  /**
   * Start publishing as a broadcaster
   * @returns Token response with WHIP endpoint and instructions
   */
  async startPublishing(): Promise<IVSTokenResponse> {
    try {
      const response = await api.post<IVSTokenResponse>('/api/token/publisher', {
        userId: this.userId
      })

      if (!response.success || !response.data) {
        throw new Error('Failed to get publisher token')
      }

      const data = response.data
      this.token = data.token
      this.participantId = data.participantId
      this.stageArn = data.stageArn
      this.isActive = true

      // Schedule token refresh (4 hours for publisher)
      this.scheduleTokenRefresh(data.expiresIn)

      if (isDevelopment) {
        console.log('✅ IVS Publisher started:', {
          stageArn: this.stageArn,
          participantId: this.participantId,
          whipEndpoint: data.whipEndpoint
        })
      }

      return data
    } catch (error) {
      console.error('❌ Failed to start publishing:', error)
      throw error
    }
  }

  /**
   * Schedule automatic token refresh before expiry
   */
  private scheduleTokenRefresh(expiresIn: number): void {
    if (this.tokenRefreshTimeout) {
      clearTimeout(this.tokenRefreshTimeout)
    }

    // Refresh 5 minutes before expiry
    const refreshTime = (expiresIn * 1000) - IVS_CONFIG.TOKEN_REFRESH_BUFFER

    if (refreshTime > 0) {
      this.tokenRefreshTimeout = setTimeout(() => {
        this.refreshToken()
      }, refreshTime)

      if (isDevelopment) {
        console.log(`🔄 Publisher token refresh scheduled in ${Math.round(refreshTime / 60000)} minutes`)
      }
    }
  }

  /**
   * Refresh publisher token
   */
  private async refreshToken(): Promise<void> {
    if (!this.isActive) {
      return
    }

    try {
      if (isDevelopment) {
        console.log('🔄 Refreshing publisher token...')
      }

      await this.startPublishing()

      if (isDevelopment) {
        console.log('✅ Publisher token refreshed successfully')
      }
    } catch (error) {
      console.error('❌ Publisher token refresh failed:', error)
    }
  }

  /**
   * Stop publishing
   */
  async stopPublishing(): Promise<void> {
    this.isActive = false

    if (this.tokenRefreshTimeout) {
      clearTimeout(this.tokenRefreshTimeout)
      this.tokenRefreshTimeout = null
    }

    if (isDevelopment) {
      console.log('🛑 Publisher stopped')
    }

    // Clear state
    this.token = null
    this.participantId = null
    this.stageArn = null
  }

  /**
   * Get current token (for use with IVS SDK or OBS)
   */
  getToken(): string | null {
    return this.token
  }

  /**
   * Get publishing information
   */
  getPublishingInfo(): {
    stageArn: string | null
    participantId: string | null
    token: string | null
  } {
    return {
      stageArn: this.stageArn,
      participantId: this.participantId,
      token: this.token
    }
  }

  /**
   * Check if publisher is currently active
   */
  isPublisherActive(): boolean {
    return this.isActive && this.token !== null
  }
}

// ==================== Stats Service ====================

/**
 * Subscribe to real-time statistics updates via WebSocket
 * Note: This integrates with the existing WebSocket service
 */
export class IVSStatsService {
  private statsCallback: ((stats: IVSStatsUpdate) => void) | null = null

  /**
   * Set callback for stats updates
   */
  onStatsUpdate(callback: (stats: IVSStatsUpdate) => void): void {
    this.statsCallback = callback
  }

  /**
   * Handle stats update from WebSocket
   * This should be called by the WebSocket service when it receives stats
   */
  handleStatsUpdate(data: IVSStatsUpdate): void {
    if (this.statsCallback) {
      this.statsCallback(data)
    }

    if (isDevelopment) {
      console.log('📊 IVS Stats:', data)
    }
  }

  /**
   * Clear stats callback
   */
  clearCallback(): void {
    this.statsCallback = null
  }
}

// ==================== Exports ====================

// Singleton instances will be created in the consuming components
export const createViewerService = (userId: string): ViewerService => {
  return new ViewerService(userId)
}

export const createPublisherService = (userId: string): PublisherService => {
  return new PublisherService(userId)
}

export const ivsStatsService = new IVSStatsService()
