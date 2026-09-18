import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-12T12:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('API failure handling', () => {
  it('times out stalled headers and body reads', async () => {
    const { api } = await import('./api')
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce({ ok: true, json: () => new Promise(() => {}) })
    vi.stubGlobal('fetch', fetchMock)
    const headers = expect(api.getProfile('user')).rejects.toThrow('took too long')
    await vi.advanceTimersByTimeAsync(15_000)
    await headers
    const body = expect(api.getProfile('user')).rejects.toThrow('took too long')
    await vi.advanceTimersByTimeAsync(15_000)
    await body
  })

  it('preserves caller cancellation during body reading', async () => {
    const { api } = await import('./api')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => new Promise(() => {}) }))
    const controller = new AbortController()
    const result = expect(api.getProfile('user', controller.signal)).rejects.toHaveProperty('name', 'AbortError')
    await Promise.resolve()
    controller.abort()
    await result
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['120', 'Sat, 12 Sep 2026 12:02:00 GMT'])('honors Retry-After %s across API methods', async (retryAfter) => {
    const { api } = await import('./api')
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 429, headers: { 'retry-after': retryAfter } }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(api.getProfile('user')).rejects.toMatchObject({ status: 429 })
    await expect(api.getPost('post')).rejects.toMatchObject({ status: 429 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(120_000)
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { period: '1d', entries: [] } })))
    expect(await api.getLeaderboard('1d')).toEqual({ period: '1d', entries: [] })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('rejects malformed structures and wrong leaderboard periods', async () => {
    const { api } = await import('./api')
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ data: { unexpected: true } })))
    vi.stubGlobal('fetch', fetchMock)
    await expect(api.getProfile('user')).rejects.toThrow('temporarily unavailable')
    await expect(api.getPost('post')).rejects.toThrow('temporarily unavailable')
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { period: '1w', entries: [] } })))
    await expect(api.getLeaderboard('1d')).rejects.toThrow('temporarily unavailable')
  })
})
