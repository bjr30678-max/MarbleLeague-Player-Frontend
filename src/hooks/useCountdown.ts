import { useEffect, useRef } from 'react'
import { useGameStore } from '@/stores/useGameStore'

export const useCountdown = () => {
  const { countdown, currentGame } = useGameStore()
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    // Only start countdown if game is in betting status and countdown > 0
    if (currentGame?.status === 'betting' && countdown > 0) {
      intervalRef.current = window.setInterval(() => {
        useGameStore.setState((state) => {
          const newCountdown = state.countdown - 1
          if (newCountdown <= 0) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current)
              intervalRef.current = null
            }
            return { countdown: 0 }
          }
          return { countdown: newCountdown }
        })
      }, 1000)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [currentGame?.status, currentGame?.roundId]) // Only restart when game changes

  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return {
    countdown,
    formattedCountdown: formatCountdown(countdown),
  }
}
