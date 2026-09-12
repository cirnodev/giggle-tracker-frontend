import { useCallback, useEffect, useState } from 'react'

interface ResourceState<T> {
  key: string
  data: T | null
  error: string | null
  loading: boolean
  lastUpdated: Date | null
}

export function useApiResource<T>(key: string, load: (signal: AbortSignal) => Promise<T>, enabled = true) {
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [state, setState] = useState<ResourceState<T>>({ key, data: null, error: null, loading: enabled, lastUpdated: null })
  const refresh = useCallback(() => setRefreshVersion((version) => version + 1), [])

  useEffect(() => {
    if (!enabled) return

    let active = true
    let controller: AbortController | null = null
    const fetchResource = async () => {
      controller?.abort()
      controller = new AbortController()
      setState((previous) => ({ ...previous, loading: true, error: null }))
      try {
        const data = await load(controller.signal)
        if (active) setState({ key, data, error: null, loading: false, lastUpdated: new Date() })
      } catch (error) {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return
        setState((previous) => ({ ...previous, key, loading: false, error: 'Data is temporarily unavailable. Please try again.' }))
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void fetchResource()
    }
    void fetchResource()
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void fetchResource()
    }, 30_000)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      active = false
      controller?.abort()
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [key, load, enabled, refreshVersion])

  const isCurrentResource = enabled && state.key === key
  return {
    data: isCurrentResource ? state.data : null,
    error: isCurrentResource ? state.error : null,
    loading: enabled ? state.loading : false,
    lastUpdated: isCurrentResource ? state.lastUpdated : null,
    refresh,
  }
}
