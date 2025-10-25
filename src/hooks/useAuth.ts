import { useEffect, useState, useRef } from 'react'
import { liff } from '@/services/liff'
import { useUserStore } from '@/stores/useUserStore'
import { toast } from '@/stores/useToastStore'

export const useAuth = () => {
  const [isInitializing, setIsInitializing] = useState(true)
  const { user, setUser, isAuthenticated } = useUserStore()
  const initializeRef = useRef(false) // Prevent duplicate initialization in StrictMode

  useEffect(() => {
    // Prevent duplicate initialization (React StrictMode runs effects twice)
    if (initializeRef.current) {
      return
    }
    initializeRef.current = true

    const initialize = async () => {
      try {
        // Initialize LIFF
        const initialized = await liff.init()
        if (!initialized) {
          throw new Error('LIFF initialization failed')
        }

        // Check if user is logged in
        if (!liff.isLoggedIn()) {
          await liff.login()
          return
        }

        // Authenticate with backend
        const userProfile = await liff.authenticate()
        if (!userProfile) {
          throw new Error('Authentication failed')
        }

        setUser(userProfile)
      } catch (error) {
        console.error('Auth initialization error:', error)
        toast.error('認證失敗，請重新登入')
      } finally {
        setIsInitializing(false)
      }
    }

    initialize()
  }, [setUser])

  const logout = () => {
    liff.logout()
    useUserStore.getState().logout()
    toast.info('已登出')
  }

  return {
    user,
    isAuthenticated,
    isInitializing,
    logout,
  }
}
