import { useEffect, useRef } from 'react'
import { useGameStore } from '@/stores/useGameStore'

export const useCountdown = () => {
  const { countdown } = useGameStore()
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    if (countdown > 0) {
      intervalRef.current = window.setInterval(() => {
        useGameStore.setState((state) => {
          const newCountdown = state.countdown - 1
          if (newCountdown <= 0) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current)
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
      }
    }
  }, [countdown])

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
