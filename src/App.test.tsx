import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'
import { RouteErrorBoundary } from './components/RouteErrorBoundary'

const fetchMock = vi.fn()

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response
}

function renderAt(path: string) {
  window.history.pushState({}, '', path)
  return render(<BrowserRouter><App /></BrowserRouter>)
}

afterEach(() => {
  cleanup()
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

describe('tracker routes', () => {
  it('renders the daily leaderboard from the backend', async () => {
    vi.stubGlobal('fetch', fetchMock.mockResolvedValue(jsonResponse({ data: { period: '1d', entries: [{ rank: 1, userId: 'db2bda0c-963e-4d3a-92ee-a54a5cfc9e08', username: 'pd', displayName: 'PD', photoUrl: null, verified: true, verifiedGold: false, networth: 72423.09, pastNetworth: null, delta: 100, percentChange: 4.2 }] } })))

    renderAt('/leaderboard?period=1d')
    expect(await screen.findByText('PD')).toBeTruthy()
    expect(fetchMock.mock.calls[0][0]).toContain('period=1d')
  })

  it('rejects malformed UUID input before making a request', () => {
    vi.stubGlobal('fetch', fetchMock)
    renderAt('/profile')
    fireEvent.change(screen.getByLabelText('Profile UUID'), { target: { value: 'not-a-uuid' } })
    fireEvent.click(screen.getByRole('button', { name: 'View data' }))

    expect(screen.getByText('Enter a complete profile UUID to continue.')).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps current data visible when a refresh fails', async () => {
    const profile = {
      id: 'db2bda0c-963e-4d3a-92ee-a54a5cfc9e08', username: 'pd', displayName: 'PD', bio: null, profilePhoto: null, createdAt: null, updatedAt: null,
      counts: { followers: 89, following: 0, posts: 1 }, aura: { total: 1, spendable: 1, invested: 0 },
      trading: { totalVolume: 1, biggestWin: 1, leaderboardRank: 1 }, verification: { creator: false, creatorGold: false, account: false },
      visibility: { private: false, activityPublic: true }, badges: [],
    }
    vi.stubGlobal('fetch', fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: profile }))
      .mockResolvedValueOnce(jsonResponse({}, false)))

    renderAt('/profile/db2bda0c-963e-4d3a-92ee-a54a5cfc9e08')
    expect(await screen.findByText('PD')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByText('PD')).toBeTruthy()
  })

  it('shows a safe error for an unavailable post', async () => {
    vi.stubGlobal('fetch', fetchMock.mockResolvedValue(jsonResponse({}, false)))
    renderAt('/post/7e1c8382-167d-4df8-8714-b620f8ed7dc7')

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Data is temporarily unavailable. Please try again.')
  })

  it('shows a safe error and keeps navigation for malformed profile data', async () => {
    vi.stubGlobal('fetch', fetchMock.mockResolvedValue(jsonResponse({ data: { unexpected: true } })))
    renderAt('/profile/db2bda0c-963e-4d3a-92ee-a54a5cfc9e08')
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Leaderboard' })).toBeTruthy()
  })

  it('labels leaderboard values and selected period, and colors the displayed percentage', async () => {
    vi.stubGlobal('fetch', fetchMock.mockResolvedValue(jsonResponse({ data: { period: '1d', entries: [{
      rank: 1, userId: 'db2bda0c-963e-4d3a-92ee-a54a5cfc9e08', username: 'pd', displayName: 'PD',
      photoUrl: 'https://example.test/missing.png', verified: false, verifiedGold: false,
      networth: 100, pastNetworth: null, delta: null, percentChange: -5,
    }] } })))
    renderAt('/leaderboard?period=1d')
    const row = await screen.findByRole('link', { name: /Rank.*1.*Account.*PD.*Net worth.*100.*Change.*-5%/ })
    expect(screen.getByRole('button', { name: 'Daily' }).getAttribute('aria-pressed')).toBe('true')
    expect(row.querySelector('.change')?.classList.contains('negative')).toBe(true)
    const avatar = row.querySelector('img')!
    fireEvent.error(avatar)
    expect(row.querySelector('img')).toBeNull()
    expect(row.querySelector('.avatar')?.textContent).toBe('P')
  })

  it('uses the first carousel image and labels total investors correctly', async () => {
    vi.stubGlobal('fetch', fetchMock.mockResolvedValue(jsonResponse({ data: {
      id: 'post', username: 'pd', isPhoto: true, media: null, thumbnailUrl: null,
      carouselMedia: ['https://example.test/first.png', 'https://example.test/second.png'],
      counts: {}, market: {}, investorCount: 15,
    } })))
    renderAt('/post/7e1c8382-167d-4df8-8714-b620f8ed7dc7')
    expect((await screen.findByRole('img', { name: 'Post media' })).getAttribute('src')).toBe('https://example.test/first.png')
    expect(screen.getByText('Investors', { exact: true })).toBeTruthy()
    expect(screen.queryByText('Top investors')).toBeNull()
  })

  it('contains rendering errors and allows retry', () => {
    let fail = true
    function BrokenView() {
      if (fail) throw new Error('synthetic render failure')
      return <p>Recovered view</p>
    }
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(<RouteErrorBoundary><BrokenView /></RouteErrorBoundary>)
      expect(screen.getByRole('alert')).toBeTruthy()
      fail = false
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
      expect(screen.getByText('Recovered view')).toBeTruthy()
    } finally { log.mockRestore() }
  })
})
