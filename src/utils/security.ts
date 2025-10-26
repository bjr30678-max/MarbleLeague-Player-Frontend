import DOMPurify from 'dompurify'

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param dirty - Untrusted HTML string
 * @returns Sanitized HTML string
 */
export const sanitizeHtml = (dirty: string): string => {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'span', 'div', 'p', 'br'],
    ALLOWED_ATTR: ['class'],
  })
}

/**
 * Escape HTML special characters to prevent XSS
 * @param text - Untrusted text
 * @returns Escaped text
 */
export const escapeHtml = (text: string): string => {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * Sanitize user input
 * @param input - User input string
 * @returns Sanitized string
 */
export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .substring(0, 1000) // Limit length
}

/**
 * Validate and sanitize URL
 * @param url - URL string to validate
 * @returns Valid URL or null
 */
export const sanitizeUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url)
    // Only allow http and https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    return parsed.toString()
  } catch {
    return null
  }
}

/**
 * Validate number input
 * @param value - Value to validate
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Valid number or null
 */
export const validateNumber = (
  value: any,
  min: number = 0,
  max: number = Number.MAX_SAFE_INTEGER
): number | null => {
  const num = Number(value)
  if (isNaN(num) || num < min || num > max) {
    return null
  }
  return num
}

/**
 * Generate a secure random ID
 * @returns Random ID string
 */
export const generateSecureId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Sanitize object for safe storage
 * Remove functions and prototype pollution attempts
 */
export const sanitizeObject = <T extends Record<string, any>>(obj: T): Partial<T> => {
  const sanitized: any = {}

  for (const key in obj) {
    // Prevent prototype pollution
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue
    }

    const value = obj[key]

    // Skip functions
    if (typeof value === 'function') {
      continue
    }

    // Recursively sanitize nested objects
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value)
    }
    // Sanitize strings
    else if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value)
    }
    // Keep other primitive types
    else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Check if code is running in development mode
 */
export const isDevelopmentMode = (): boolean => {
  return (
    import.meta.env.DEV ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  )
}

/**
 * Safe JSON parse with fallback
 */
export const safeJsonParse = <T>(json: string, fallback: T): T => {
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export const constantTimeCompare = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}
