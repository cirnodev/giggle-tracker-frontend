import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'

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
})
