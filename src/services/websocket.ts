import { io, Socket } from 'socket.io-client'
import type { IVSStatsUpdate } from './awsIvs'
import { getWebSocketUrl, isDevelopment } from '@/config'
import { storage } from './storage'
import { toast } from '@/stores/useToastStore'

type SocketEventCallback = (...args: any[]) => void

class WebSocketService {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 2000
  private connectionWarningShown = false
  private wsUrl = ''

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.socket?.connected) {
      return
    }

    const token = storage.getToken()
    this.wsUrl = getWebSocketUrl()

    if (isDevelopment) {
      console.log('🔌 WebSocket 連接 URL:', this.wsUrl)
      console.log('🔑 使用 Token:', token ? '已提供' : '未提供')
    }

    try {
      // Socket.IO 配置（匹配原版並增強）
      this.socket = io(this.wsUrl, {
        auth: {
          token
        },
        // 傳輸方式：先嘗試 websocket，失敗則降級為 polling
        transports: ['websocket', 'polling'],
        // 重連配置
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: 5000,
        // 超時配置
        timeout: 20000,
      })

      this.setupEventListeners()

      if (isDevelopment) {
        console.log('🔌 WebSocket 初始化完成，等待連線...')
      }
    } catch (error) {
      console.error('WebSocket connection failed:', error)
      toast.error('WebSocket 連線失敗')
    }
  }

  /**
   * Setup default event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0
      if (isDevelopment) {
        console.warn('✅ WebSocket 已連線')
      }
    })

    this.socket.on('disconnect', (reason) => {
      if (isDevelopment) {
        console.warn('⚠️ WebSocket 已斷線:', reason)
      }

      // Auto reconnect if not intentional disconnect
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        setTimeout(() => {
          this.reconnect()
        }, this.reconnectDelay)
      }
    })

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++

      // 詳細的錯誤日誌
      console.error('❌ WebSocket 連線失敗:', {
        url: this.wsUrl,
        error: error.message || error,
        errorType: error.constructor.name,
        attempts: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
        stack: isDevelopment ? error.stack : undefined
      })

      if (!this.connectionWarningShown && this.reconnectAttempts === 1) {
        // 只在第一次失敗時顯示提示
        toast.warning('正在嘗試連接遊戲伺服器...')
        this.connectionWarningShown = true
      }

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.warn(`⚠️ WebSocket 已達最大重連次數 (${this.maxReconnectAttempts})`)
        toast.error('無法連接到遊戲伺服器，請檢查網路連線')
      }
    })

    this.socket.on('error', (error) => {
      if (!isDevelopment) {
        console.error('WebSocket error:', error)
      }
    })
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  /**
   * Reconnect to WebSocket server
   */
  reconnect(): void {
    this.disconnect()
    this.connect()
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false
  }

  /**
   * Subscribe to event
   */
  on(event: string, callback: SocketEventCallback): void {
    if (!this.socket) {
      console.warn('Socket not initialized. Call connect() first.')
      return
    }

    this.socket.on(event, callback)
  }

  /**
   * Unsubscribe from event
   */
  off(event: string, callback?: SocketEventCallback): void {
    if (!this.socket) return

    if (callback) {
      this.socket.off(event, callback)
    } else {
      this.socket.off(event)
    }
  }

  /**
   * Emit event to server
   */
  emit(event: string, data?: any): void {
    if (!this.socket?.connected) {
      console.warn('Socket not connected. Cannot emit event:', event)
      return
    }

    this.socket.emit(event, data)
  }

  // Game-specific event handlers

  /**
   * Subscribe to round started event
   * WebSocket sends: { roundId: string, startTime?: string, timeLeft?: number }
   */
  onRoundStarted(callback: (data: any) => void): void {
    this.on('round-started', callback)
  }

  /**
   * Subscribe to betting closed event
   * WebSocket sends: { roundId?: string }
   */
  onBettingClosed(callback: (data?: any) => void): void {
    this.on('betting-closed', callback)
  }

  /**
   * Subscribe to result confirmed event
   * WebSocket sends: { roundId: string, result: number[] }
   */
  onResultConfirmed(callback: (data: any) => void): void {
    this.on('result-confirmed', callback)
  }

  /**
   * Subscribe to new bet event
   */
  onNewBet(callback: (data: { userId: string; amount: number }) => void): void {
    this.on('new-bet', callback)
  }

  /**
   * Subscribe to balance updated event
   */
  onBalanceUpdated(callback: (data: { balance: number }) => void): void {
    this.on('balance-updated', callback)
  }

  /**
   * Unsubscribe from all game events
   */
  offAllGameEvents(): void {
    const events = [
      'round-started',
      'betting-closed',
      'result-confirmed',
      'new-bet',
      'balance-updated',
    ]

    events.forEach((event) => {
      this.off(event)
    })
  }

  // AWS IVS Stats event handlers

  /**
   * Subscribe to AWS IVS stats channel
   * Receives real-time viewer statistics every 5 seconds
   */
  subscribeToIVSStats(): void {
    if (!this.socket?.connected) {
      console.warn('Socket not connected. Cannot subscribe to IVS stats.')
      return
    }

    // Send subscribe message to stats channel
    this.emit('subscribe', { channel: 'stats' })

    if (isDevelopment) {
      console.log('📊 Subscribed to IVS stats channel')
    }
  }

  /**
   * Unsubscribe from AWS IVS stats channel
   */
  unsubscribeFromIVSStats(): void {
    if (!this.socket?.connected) {
      return
    }

    this.emit('unsubscribe', { channel: 'stats' })

    if (isDevelopment) {
      console.log('📊 Unsubscribed from IVS stats channel')
    }
  }

  /**
   * Subscribe to IVS stats update event
   * The server broadcasts stats every 5 seconds
   */
  onIVSStatsUpdate(callback: (data: IVSStatsUpdate) => void): void {
    this.on('stats_update', (message: { type: string; data: IVSStatsUpdate }) => {
      if (message.type === 'stats_update' && message.data) {
        callback(message.data)
      }
    })
  }

  /**
   * Unsubscribe from IVS stats update event
   */
  offIVSStatsUpdate(callback?: SocketEventCallback): void {
    this.off('stats_update', callback)
  }

  /**
   * Join game room
   */
  joinRoom(roomId: string): void {
    this.emit('join-room', { roomId })
  }

  /**
   * Leave game room
   */
  leaveRoom(roomId: string): void {
    this.emit('leave-room', { roomId })
  }

  /**
   * Get connection status
   */
  getStatus(): {
    connected: boolean
    reconnectAttempts: number
  } {
    return {
      connected: this.isConnected(),
      reconnectAttempts: this.reconnectAttempts,
    }
  }
}

// Export singleton instance
export const websocket = new WebSocketService()
