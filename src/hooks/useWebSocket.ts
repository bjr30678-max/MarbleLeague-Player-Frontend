import { useEffect, useRef } from 'react'
import { websocket } from '@/services/websocket'
import { ivsStatsService } from '@/services/awsIvs'
import { useGameStore } from '@/stores/useGameStore'
import { useUserStore } from '@/stores/useUserStore'
import { useBettingStore } from '@/stores/useBettingStore'
import { toast } from '@/stores/useToastStore'
import type { GameState, GameResult } from '@/types'
import type { IVSStatsUpdate } from '@/services/awsIvs'

export const useWebSocket = () => {
  const isInitialized = useRef(false)

  useEffect(() => {
    // Prevent duplicate initialization in StrictMode
    if (isInitialized.current) {
      return
    }
    isInitialized.current = true

    // Connect to WebSocket
    websocket.connect()

    // Setup event handlers with store getState to avoid dependency issues
    const handleRoundStarted = (data: GameState) => {
      console.log('🎮 [WebSocket] Round started:', data)
      useGameStore.getState().setCurrentGame(data)
      useBettingStore.getState().clearBets()
      toast.info(`新一輪開始: 第 ${data.period} 期`)
    }

    const handleBettingClosed = () => {
      console.log('🔒 [WebSocket] Betting closed')
      toast.warning('投注已封盤')
    }

    const handleResultConfirmed = (data: GameResult) => {
      console.log('✅ [WebSocket] Result confirmed:', data)
      useGameStore.getState().addResult(data)
      toast.success('開獎結果已公布')
    }

    const handleBalanceUpdated = (data: { balance: number }) => {
      console.log('💰 [WebSocket] Balance updated:', data)
      useUserStore.getState().updateBalance(data.balance)
    }

    const handleIVSStatsUpdate = (data: IVSStatsUpdate) => {
      console.log('📊 [WebSocket] IVS stats update:', data)
      // Forward stats to IVS stats service
      ivsStatsService.handleStatsUpdate(data)
    }

    // Subscribe to events
    websocket.onRoundStarted(handleRoundStarted)
    websocket.onBettingClosed(handleBettingClosed)
    websocket.onResultConfirmed(handleResultConfirmed)
    websocket.onBalanceUpdated(handleBalanceUpdated)

    // Subscribe to AWS IVS stats
    websocket.onIVSStatsUpdate(handleIVSStatsUpdate)

    // Wait for connection then subscribe to stats channel
    const connectHandler = () => {
      websocket.subscribeToIVSStats()
    }
    websocket.on('connect', connectHandler)

    // If already connected, subscribe immediately
    if (websocket.isConnected()) {
      websocket.subscribeToIVSStats()
    }

    // Cleanup on unmount
    return () => {
      websocket.offAllGameEvents()
      websocket.offIVSStatsUpdate()
      websocket.unsubscribeFromIVSStats()
      websocket.off('connect', connectHandler)
      websocket.disconnect()
    }
  }, []) // Empty dependency array - only run once

  return {
    isConnected: websocket.isConnected(),
    reconnect: () => websocket.reconnect(),
  }
}
