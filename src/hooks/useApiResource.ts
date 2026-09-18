import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, getRetryAt } from '../api'

interface ResourceState<T> {
  key: string
  data: T | null
  error: string | null
  loading: boolean
  lastUpdated: Date | null
  retryInSeconds: number
}

function emptyState<T>(key: string, loading: boolean): ResourceState<T> {
  return { key, data: null, error: null, loading, lastUpdated: null, retryInSeconds: 0 }
}

export function useApiResource<T>(key: string, load: (signal: AbortSignal) => Promise<T>, enabled = true) {
  const [state, setState] = useState<ResourceState<T>>(() => emptyState(key, enabled))
  const refreshRef = useRef<() => void>(() => {})
  const refresh = useCallback(() => refreshRef.current(), [])

  useEffect(() => {
    if (!enabled) return

    let active = true
    let busy = false
    let nextRefreshAt = Infinity
    let controller: AbortController | null = null

    const fetchResource = async () => {
      if (busy) return
      busy = true
      controller = new AbortController()
      setState((previous) => ({
        ...(previous.key === key ? previous : emptyState<T>(key, true)),
        loading: true,
        error: null,
      }))
      try {
        const data = await load(controller.signal)
        if (active) setState({ key, data, error: null, loading: false, lastUpdated: new Date(), retryInSeconds: 0 })
      } catch (error) {
        if (!active || controller.signal.aborted) return
        setState((previous) => ({
          ...(previous.key === key ? previous : emptyState<T>(key, false)),
          loading: false,
          error: error instanceof ApiError ? error.message : 'Data is temporarily unavailable. Please try again.',
          retryInSeconds: Math.max(0, Math.ceil((getRetryAt() - Date.now()) / 1000)),
        }))
      } finally {
        busy = false
        nextRefreshAt = Math.max(Date.now() + 30_000, getRetryAt())
      }
    }

    const manualRefresh = () => {
      if (Date.now() >= getRetryAt()) void fetchResource()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') manualRefresh()
    }
    refreshRef.current = manualRefresh
    void fetchResource()
    const interval = window.setInterval(() => {
      const retryInSeconds = Math.max(0, Math.ceil((getRetryAt() - Date.now()) / 1000))
      setState((previous) => previous.key === key && previous.retryInSeconds !== retryInSeconds
        ? { ...previous, retryInSeconds }
        : previous)
      if (document.visibilityState === 'visible' && Date.now() >= nextRefreshAt && retryInSeconds === 0) void fetchResource()
    }, 1000)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      active = false
      controller?.abort()
      refreshRef.current = () => {}
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [key, load, enabled])

  const isCurrentResource = enabled && state.key === key
  return {
    data: isCurrentResource ? state.data : null,
    error: isCurrentResource ? state.error : null,
    loading: enabled && (!isCurrentResource || state.loading),
    lastUpdated: isCurrentResource ? state.lastUpdated : null,
    retryInSeconds: isCurrentResource ? state.retryInSeconds : 0,
    refresh,
  }
}
