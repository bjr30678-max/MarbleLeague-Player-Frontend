import { useEffect, useRef, useState } from 'react'
import { websocket } from '@/services/websocket'
import { ivsStatsService } from '@/services/awsIvs'
import { useGameStore } from '@/stores/useGameStore'
import { useUserStore } from '@/stores/useUserStore'
import { useBettingStore } from '@/stores/useBettingStore'
import { useHotBetsStore } from '@/stores/useHotBetsStore'
import { toast } from '@/stores/useToastStore'
import { storage } from '@/services/storage'
import type { GameState, GameResult } from '@/types'
import type { IVSStatsUpdate } from '@/services/awsIvs'

export const useWebSocket = () => {
  const isInitialized = useRef(false)
  const { isAuthenticated } = useUserStore()
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // Only connect after authentication is complete
    if (!isAuthenticated) {
      console.log('⏳ WebSocket: 等待認證完成...')
      return
    }

    // Prevent duplicate initialization in StrictMode
    if (isInitialized.current) {
      return
    }
    isInitialized.current = true

    // Verify token exists before connecting
    const token = storage.getToken()
    if (!token) {
      console.error('❌ WebSocket: Token 不存在，無法連接')
      toast.error('認證失敗，請重新登入')
      return
    }

    console.log('✅ WebSocket: 認證完成，準備連接...')

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
    // WebSocket event data types (from backend, matching original app.js)
    interface RoundStartedData {
      roundId: string
      startTime?: string
      timeLeft?: number
    }

    interface BettingClosedData {
      roundId?: string
    }

    const handleRoundStarted = (data: RoundStartedData) => {
      console.log('🎮 [WebSocket] Round started:', data)

      // Construct complete GameState from WebSocket data (matching original)
      const gameState: GameState = {
        roundId: data.roundId,
        period: parseInt(data.roundId) || 0,
        status: 'betting',
        countdown: data.timeLeft || 60, // 預設60秒（matching original）
        timestamp: Date.now(),
      }

      // Update game state
      useGameStore.getState().setCurrentGame(gameState)

      // Clear previous bets (matching original)
      useBettingStore.getState().clearBets()

      // Clear hot bets for new round
      useHotBetsStore.getState().clearStats()

      // Load initial bet stats for new round (after a short delay to allow bets to come in)
      setTimeout(async () => {
        try {
          const response = await api.getBetStats()
          if (response.data && response.data.totalBets > 0) {
            const { totalBets, totalAmount, typeSummary } = response.data
            const sortedBets = [...typeSummary]
              .sort((a, b) => b.count - a.count)
              .slice(0, 4)
            const hotBets = sortedBets.map(bet => ({
              option: bet.betTypeName,
              count: bet.count,
              amount: bet.amount,
              percentage: totalBets > 0 ? Math.round((bet.count / totalBets) * 100) : 0
            }))
            useHotBetsStore.getState().updateBetStats({ totalBets, totalAmount, hotBets })
          }
        } catch (error) {
          console.error('Failed to load initial bet stats:', error)
        }
      }, 2000)

      // Show toast notification
      toast.info(`新回合開始: 第 ${data.roundId} 期`)
    }

    const handleBettingClosed = (data?: BettingClosedData) => {
      console.log('🔒 [WebSocket] Betting closed:', data)

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

    interface ResultConfirmedData {
      roundId: string
      result: number[] // Array of 10 numbers
    }

    const handleResultConfirmed = (data: ResultConfirmedData) => {
      console.log('✅ [WebSocket] Result confirmed:', data)

      // Convert WebSocket data to GameResult (matching fetchRecentResults logic)
      const sum = data.result.slice(0, 2).reduce((a, b) => a + b, 0)
      const gameResult: GameResult = {
        roundId: data.roundId,
        period: parseInt(data.roundId) || 0,
        positions: data.result,
        sum,
        bigsmall: sum > 11 ? 'big' : 'small',
        oddeven: sum % 2 === 0 ? 'even' : 'odd',
        dragontiger: {},
        timestamp: Date.now(),
      }

      // Add result to recent results
      useGameStore.getState().addResult(gameResult)

      // Immediately update current game status to 'finished' or clear it
      const currentGame = useGameStore.getState().currentGame
      if (currentGame && currentGame.roundId === data.roundId) {
        // Update status to finished to show "等待下一期數"
        useGameStore.getState().setCurrentGame({
          ...currentGame,
          status: 'finished',
        })
      }

      // Show toast
      toast.success('開獎結果已公布')

      // Reload game history (matching original)
      useGameStore.getState().fetchHistory()

      // Reload user balance (matching original)
      useUserStore.getState().fetchBalance()

      // Reload recent results (matching original)
      useGameStore.getState().fetchRecentResults()

      // After 5 seconds, reset to waiting state if no new round started
      setTimeout(() => {
        const currentGame = useGameStore.getState().currentGame
        if (currentGame && currentGame.status === 'finished' && currentGame.roundId === data.roundId) {
          // Set to waiting state only if still showing the finished round
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

    // Track new bets for 熱門投注 feature
    // Load betting statistics from API when a new bet is placed
    const handleNewBet = async (data: any) => {
      console.log('💰 [WebSocket] New bet:', data)

      try {
        // Fetch latest betting statistics from API
        const response = await api.getBetStats()

        if (response.data) {
          const { totalBets, totalAmount, typeSummary } = response.data

          // Sort by count and take top 4
          const sortedBets = [...typeSummary]
            .sort((a, b) => b.count - a.count)
            .slice(0, 4)

          // Calculate percentages
          const hotBets = sortedBets.map(bet => ({
            option: bet.betTypeName,
            count: bet.count,
            amount: bet.amount,
            percentage: totalBets > 0
              ? Math.round((bet.count / totalBets) * 100)
              : 0
          }))

          // Update hot bets store
          useHotBetsStore.getState().updateBetStats({
            totalBets,
            totalAmount,
            hotBets
          })
        }
      } catch (error) {
        console.error('Failed to fetch bet stats:', error)
      }
    }

    // Subscribe to events
    websocket.onRoundStarted(handleRoundStarted)
    websocket.onBettingClosed(handleBettingClosed)
    websocket.onResultConfirmed(handleResultConfirmed)
    websocket.onBalanceUpdated(handleBalanceUpdated)
    websocket.onNewBet(handleNewBet)

    // Subscribe to AWS IVS stats
    websocket.onIVSStatsUpdate(handleIVSStatsUpdate)

    // Wait for connection then subscribe to stats channel
    const connectHandler = () => {
      setIsConnected(true)
      websocket.subscribeToIVSStats()
    }
    websocket.on('connect', connectHandler)

    // Handle disconnect event
    const disconnectHandler = () => {
      setIsConnected(false)
    }
    websocket.on('disconnect', disconnectHandler)

    // If already connected, subscribe immediately and update state
    if (websocket.isConnected()) {
      setIsConnected(true)
      websocket.subscribeToIVSStats()
    }

    // Cleanup on unmount
    return () => {
      websocket.offAllGameEvents()
      websocket.offIVSStatsUpdate()
      websocket.unsubscribeFromIVSStats()
      websocket.off('connect', connectHandler)
      websocket.off('disconnect', disconnectHandler)
      websocket.disconnect()
      isInitialized.current = false // Reset for potential re-authentication
    }
  }, [isAuthenticated]) // Depend on authentication status

  return {
    isConnected, // Use local state that updates with events
    reconnect: () => websocket.reconnect(),
  }
}
