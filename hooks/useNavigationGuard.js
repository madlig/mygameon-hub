'use client'

import { useEffect } from 'react'

/**
 * Warns user before leaving the page when a condition is true.
 * @param {boolean} isActive - Whether to block navigation
 * @param {string} message - Warning message shown to user
 */
export function useNavigationGuard(isActive, message = 'Proses sedang berjalan. Yakin ingin meninggalkan halaman?') {
  useEffect(() => {
    if (!isActive) return

    const handleBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = message
      return message
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isActive, message])
}
