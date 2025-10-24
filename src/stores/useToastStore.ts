import { create } from 'zustand'
import type { ToastMessage, ToastType } from '@/types'
import { generateSecureId } from '@/utils/security'
import { CONSTANTS } from '@/config'

interface ToastState {
  toasts: ToastMessage[]

  // Actions
  addToast: (message: string, type?: ToastType, duration?: number) => void
  removeToast: (id: string) => void
  clearAll: () => void
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (message, type = 'info', duration = CONSTANTS.TOAST_DURATION) => {
    const id = generateSecureId()

    const toast: ToastMessage = {
      id,
      type,
      message,
      duration,
    }

    set((state) => ({
      toasts: [...state.toasts, toast],
    }))

    // Auto remove after duration
    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id)
      }, duration)
    }
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }))
  },

  clearAll: () => {
    set({ toasts: [] })
  },
}))

// Export convenience functions
export const toast = {
  success: (message: string, duration?: number) =>
    useToastStore.getState().addToast(message, 'success', duration),
  error: (message: string, duration?: number) =>
    useToastStore.getState().addToast(message, 'error', duration),
  warning: (message: string, duration?: number) =>
    useToastStore.getState().addToast(message, 'warning', duration),
  info: (message: string, duration?: number) =>
    useToastStore.getState().addToast(message, 'info', duration),
}
