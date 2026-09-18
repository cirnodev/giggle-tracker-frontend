import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useApiResource } from './useApiResource'
import { api } from '../api'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-12T12:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('never relabels daily data as weekly after a failed period switch', async () => {
  const daily = vi.fn().mockResolvedValue('daily rows')
  const weekly = vi.fn().mockRejectedValue(new Error('unavailable'))
  const { result, rerender } = renderHook(({ period }) => useApiResource(period, period === 'daily' ? daily : weekly), { initialProps: { period: 'daily' } })
  await act(async () => {})
  expect(result.current.data).toBe('daily rows')
  await act(async () => rerender({ period: 'weekly' }))
  expect(result.current.data).toBeNull()
  expect(result.current.lastUpdated).toBeNull()
  expect(result.current.error).toBeTruthy()
})

it('does not restart pending work on polling, visibility, or repeated refresh', async () => {
  let resolve!: (value: string) => void
  const load = vi.fn().mockImplementation(() => new Promise<string>((done) => { resolve = done }))
  const { result } = renderHook(() => useApiResource('profile', load))
  await act(async () => {
    await vi.advanceTimersByTimeAsync(35_000)
    document.dispatchEvent(new Event('visibilitychange'))
    result.current.refresh()
  })
  expect(load).toHaveBeenCalledTimes(1)
  expect(load.mock.calls[0][0].aborted).toBe(false)
  await act(async () => resolve('loaded'))
  expect(result.current.data).toBe('loaded')
  expect(result.current.loading).toBe(false)
})

it('does not let an abandoned request overwrite the new resource', async () => {
  let resolveOld!: (value: string) => void
  const oldLoad = () => new Promise<string>((resolve) => { resolveOld = resolve })
  const newLoad = vi.fn().mockResolvedValue('new')
  const { result, rerender } = renderHook(({ next }) => useApiResource(next ? 'new' : 'old', next ? newLoad : oldLoad), { initialProps: { next: false } })
  await act(async () => rerender({ next: true }))
  await act(async () => resolveOld('old'))
  expect(result.current.data).toBe('new')
})

it('pauses manual and automatic retries until cooldown ends', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 429, headers: { 'retry-after': '120' } }))
  vi.stubGlobal('fetch', fetchMock)
  const load = (signal: AbortSignal) => api.getLeaderboard('1d', signal)
  const { result } = renderHook(() => useApiResource('board', load))
  await act(async () => {})
  expect(result.current.retryInSeconds).toBe(120)
  await act(async () => {
    result.current.refresh()
    await vi.advanceTimersByTimeAsync(119_000)
  })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { period: '1d', entries: [] } })))
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(result.current.retryInSeconds).toBe(0)
  expect(result.current.error).toBeNull()
})
