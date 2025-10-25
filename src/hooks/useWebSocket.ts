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

    // Initialize game connection (matching original initializeGame)
    const initializeGame = async () => {
      // 1. Connect to WebSocket
      websocket.connect()

      // 2. Load current round info
      await useGameStore.getState().fetchCurrentGame()

      // 3. Load recent results
      await useGameStore.getState().fetchRecentResults()

      // Timer is handled by useCountdown hook
    }

    initializeGame()

    // Setup event handlers with store getState to avoid dependency issues
    const handleRoundStarted = (data: GameState) => {
      console.log('🎮 [WebSocket] Round started:', data)

      // Update game state
      useGameStore.getState().setCurrentGame(data)

      // Clear previous bets (matching original)
      useBettingStore.getState().clearBets()

      // Show toast notification
      toast.info(`新一輪開始: 第 ${data.period} 期`)
    }

    const handleBettingClosed = () => {
      console.log('🔒 [WebSocket] Betting closed')

      // Update game status to closed
      const currentGame = useGameStore.getState().currentGame
      if (currentGame) {
        useGameStore.getState().setCurrentGame({
          ...currentGame,
          status: 'closed',
          countdown: 0,
        })
      }

      toast.warning('投注已封盤')
    }

    const handleResultConfirmed = (data: GameResult) => {
      console.log('✅ [WebSocket] Result confirmed:', data)

      // Add result to recent results
      useGameStore.getState().addResult(data)

      // Show toast
      toast.success('開獎結果已公布')

      // Reload game history (matching original)
      useGameStore.getState().fetchHistory()

      // Reload user balance (matching original)
      useUserStore.getState().fetchBalance()

      // Reload recent results (matching original)
      useGameStore.getState().fetchRecentResults()

      // After 5 seconds, check if we should show waiting state
      setTimeout(() => {
        const currentGame = useGameStore.getState().currentGame
        if (!currentGame || currentGame.roundId === data.roundId) {
          // Set to waiting state
          useGameStore.getState().resetGame()
        }
      }, 5000)
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
