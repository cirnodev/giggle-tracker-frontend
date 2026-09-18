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
}

export class ApiError extends Error {
  readonly status?: number
  readonly retryAt: number

  constructor(message = 'Data is temporarily unavailable. Please try again.', status?: number, retryAt = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.retryAt = retryAt
  }
}

let retryAt = 0
export const getRetryAt = () => retryAt
const REQUEST_TIMEOUT_MS = 15_000

function parseRetryAfter(value: string | null): number {
  if (!value?.trim()) return 0
  if (/^\d+$/.test(value.trim())) {
    const milliseconds = Number(value) * 1000
    return Number.isFinite(milliseconds) ? Date.now() + milliseconds : 0
  }
  const date = Date.parse(value)
  return Number.isFinite(date) ? Math.max(Date.now(), date) : 0
}

async function request(path: string, signal?: AbortSignal): Promise<unknown> {
  signal?.throwIfAborted()
  if (Date.now() < retryAt) throw new ApiError('Requests are temporarily limited. Please wait before refreshing.', 429, retryAt)
  const controller = new AbortController()
  const onAbort = () => controller.abort(signal?.reason)
  signal?.addEventListener('abort', onAbort, { once: true })
  const timeout = window.setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), REQUEST_TIMEOUT_MS)
  try {
    return await withAbort((async () => {
      const response = await fetch(`${API_BASE_URL}${path}`, { signal: controller.signal })
      controller.signal.throwIfAborted()
      if (!response.ok) {
        const headerRetryAt = parseRetryAfter(response.headers?.get('retry-after') ?? null)
        if (response.status === 429 || (response.status === 503 && headerRetryAt > Date.now())) {
          retryAt = Math.max(retryAt, headerRetryAt || Date.now() + 30_000)
          throw new ApiError('Requests are temporarily limited. Please wait before refreshing.', response.status, retryAt)
        }
        throw new ApiError()
      }
      return await response.json()
    })(), controller.signal)
  } catch (error) {
    if (signal?.aborted) throw signal.reason
    if (controller.signal.aborted) throw new ApiError('The request took too long. Please try again.')
    if (error instanceof ApiError) throw error
    throw new ApiError()
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', onAbort)
  }
}

function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
    if (signal.aborted) onAbort()
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort))
  })
}

export const api = {
  async getLeaderboard(period: '1d' | '1w', signal?: AbortSignal): Promise<LeaderboardResult> {
    const data = object(object(await request(`/api/v1/leaderboards?period=${period}&limit=20`, signal)).data)
    if (data.period !== period || !Array.isArray(data.entries)) throw new ApiError()
    return { period, entries: data.entries.map(parseLeaderboardEntry) }
  },
  async getProfile(userId: string, signal?: AbortSignal): Promise<Profile> {
    return parseProfile(object(await request(`/api/v1/users/${encodeURIComponent(userId)}`, signal)).data)
  },
  async getPost(postId: string, signal?: AbortSignal): Promise<Post> {
    return parsePost(object(await request(`/api/v1/posts/${encodeURIComponent(postId)}`, signal)).data)
  },
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError()
  return value as Record<string, unknown>
}

function text(value: unknown): string | null {
  if (value == null) return null
  if (typeof value !== 'string') throw new ApiError()
  return value
}

function requiredText(value: unknown): string {
  const result = text(value)
  if (!result) throw new ApiError()
  return result
}

function number(value: unknown): number | null {
  if (value == null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ApiError()
  return value
}

function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new ApiError()
  return value
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) throw new ApiError()
  return value.map(requiredText)
}

function fields<K extends string, T>(value: unknown, parse: (value: unknown) => T, ...keys: K[]): Record<K, T> {
  const data = object(value)
  return Object.fromEntries(keys.map((key) => [key, parse(data[key])])) as Record<K, T>
}

function parseLeaderboardEntry(value: unknown): LeaderboardEntry {
  const data = object(value)
  return {
    userId: requiredText(data.userId),
    ...fields(data, text, 'username', 'displayName', 'photoUrl'),
    ...fields(data, number, 'rank', 'networth', 'pastNetworth', 'delta', 'percentChange'),
    ...fields(data, boolean, 'verified', 'verifiedGold'),
  }
}

function parseProfile(value: unknown): Profile {
  const data = object(value)
  return {
    id: requiredText(data.id),
    ...fields(data, text, 'username', 'displayName', 'bio', 'profilePhoto', 'createdAt', 'updatedAt'),
    counts: fields(data.counts, number, 'followers', 'following', 'posts'),
    aura: fields(data.aura, number, 'total', 'spendable', 'invested'),
    trading: fields(data.trading, number, 'totalVolume', 'biggestWin', 'leaderboardRank'),
    verification: fields(data.verification, boolean, 'creator', 'creatorGold', 'account'),
    visibility: fields(data.visibility, boolean, 'private', 'activityPublic'),
    badges: strings(data.badges),
  }
}

function parsePost(value: unknown): Post {
  const data = object(value)
  return {
    id: requiredText(data.id),
    ...fields(data, text, 'username', 'authorPhotoUrl', 'media', 'thumbnailUrl', 'description', 'hashtag', 'createdAt', 'updatedAt', 'originalPostedAt'),
    carouselMedia: data.carouselMedia == null ? null : strings(data.carouselMedia),
    isPhoto: boolean(data.isPhoto),
    counts: fields(data.counts, number, 'views', 'likes', 'comments', 'shares', 'bookmarks'),
    market: fields(data.market, number, 'tokenSupply', 'volume', 'pot', 'holders', 'trades'),
    investorCount: number(data.investorCount),
  }
}
