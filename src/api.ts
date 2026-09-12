const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

export interface Pagination {
  hasMore: boolean
  nextCursor: string | null
}

export interface LeaderboardEntry {
  rank: number | null
  userId: string
  username: string | null
  displayName: string | null
  photoUrl: string | null
  verified: boolean
  verifiedGold: boolean
  networth: number | null
  pastNetworth: number | null
  delta: number | null
  percentChange: number | null
}

export interface LeaderboardResult {
  period: string
  entries: LeaderboardEntry[]
}

export interface Profile {
  id: string
  username: string | null
  displayName: string | null
  bio: string | null
  profilePhoto: string | null
  createdAt: string | null
  updatedAt: string | null
  counts: { followers: number | null; following: number | null; posts: number | null }
  aura: { total: number | null; spendable: number | null; invested: number | null }
  trading: { totalVolume: number | null; biggestWin: number | null; leaderboardRank: number | null }
  verification: { creator: boolean; creatorGold: boolean; account: boolean }
  visibility: { private: boolean; activityPublic: boolean }
  badges: string[]
}

export interface Post {
  id: string
  username: string | null
  authorPhotoUrl: string | null
  media: string | null
  carouselMedia: string[] | null
  thumbnailUrl: string | null
  isPhoto: boolean
  description: string | null
  hashtag: string | null
  createdAt: string | null
  updatedAt: string | null
  originalPostedAt: string | null
  counts: { views: number | null; likes: number | null; comments: number | null; shares: number | null; bookmarks: number | null }
  market: { tokenSupply: number | null; volume: number | null; pot: number | null; holders: number | null; trades: number | null }
  investorCount?: number | null
  topInvestors?: unknown[]
}

export class ApiError extends Error {
  constructor() {
    super('Data is temporarily unavailable. Please try again.')
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError()
  }
  if (!response.ok) throw new ApiError()
  try {
    return (await response.json()) as T
  } catch {
    throw new ApiError()
  }
}

export const api = {
  async getLeaderboard(period: '1d' | '1w', signal?: AbortSignal): Promise<LeaderboardResult> {
    const response = await request<{ data: LeaderboardResult; pagination: Pagination }>(`/api/v1/leaderboards?period=${period}&limit=20`, signal)
    return response.data
  },
  async getProfile(userId: string, signal?: AbortSignal): Promise<Profile> {
    const response = await request<{ data: Profile }>(`/api/v1/users/${encodeURIComponent(userId)}`, signal)
    return response.data
  },
  async getPost(postId: string, signal?: AbortSignal): Promise<Post> {
    const response = await request<{ data: Post }>(`/api/v1/posts/${encodeURIComponent(postId)}`, signal)
    return response.data
  },
}
