import { useEffect } from 'react'
import { websocket } from '@/services/websocket'
import { useGameStore } from '@/stores/useGameStore'
import { useUserStore } from '@/stores/useUserStore'
import { useBettingStore } from '@/stores/useBettingStore'
import { toast } from '@/stores/useToastStore'
import type { GameState, GameResult } from '@/types'

export const useWebSocket = () => {
  const { setCurrentGame, addResult } = useGameStore()
  const { updateBalance } = useUserStore()
  const { clearBets } = useBettingStore()

  useEffect(() => {
    // Connect to WebSocket
    websocket.connect()

    // Setup event handlers
    const handleRoundStarted = (data: GameState) => {
      setCurrentGame(data)
      clearBets()
      toast.info(`新一輪開始: 第 ${data.period} 期`)
    }

    const handleBettingClosed = () => {
      toast.warning('投注已封盤')
    }

    const handleResultConfirmed = (data: GameResult) => {
      addResult(data)
      toast.success('開獎結果已公布')
    }

    const handleBalanceUpdated = (data: { balance: number }) => {
      updateBalance(data.balance)
    }

    // Subscribe to events
    websocket.onRoundStarted(handleRoundStarted)
    websocket.onBettingClosed(handleBettingClosed)
    websocket.onResultConfirmed(handleResultConfirmed)
    websocket.onBalanceUpdated(handleBalanceUpdated)

    // Cleanup on unmount
    return () => {
      websocket.offAllGameEvents()
      websocket.disconnect()
    }
  }, [setCurrentGame, addResult, updateBalance, clearBets])

  return {
    isConnected: websocket.isConnected(),
    reconnect: () => websocket.reconnect(),
  }
}
