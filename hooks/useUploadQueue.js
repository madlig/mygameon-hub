'use client'

import { useState, useCallback } from 'react'

/**
 * Manages the upload queue state for CleanWorkbench.
 * Extracted to reduce prop drilling and co-locate related state.
 */
export function useUploadQueue() {
  const [queue, setQueue] = useState([])
  const [activeItem, setActiveItem] = useState(null)
  const [queueProcessing, setQueueProcessing] = useState(false)

  const addToQueue = useCallback((item) => {
    setQueue(prev => {
      if (prev.find(q => q.folderPath === item.folderPath)) return prev
      return [...prev, item]
    })
  }, [])

  const removeFromQueue = useCallback((folderPath) => {
    setQueue(prev => prev.filter(q => q.folderPath !== folderPath))
  }, [])

  const clearQueue = useCallback(() => {
    setQueue([])
    setActiveItem(null)
  }, [])

  return {
    queue,
    setQueue,
    activeItem,
    setActiveItem,
    queueProcessing,
    setQueueProcessing,
    addToQueue,
    removeFromQueue,
    clearQueue
  }
}
