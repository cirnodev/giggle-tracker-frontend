import { useCallback, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { LeaderboardEntry, Post, Profile } from './api'
import { api } from './api'
import './App.css'
import { formatAmount, formatDate, formatNumber, formatSigned, isUuid } from './lib/format'
import { useApiResource } from './hooks/useApiResource'
import { RouteErrorBoundary } from './components/RouteErrorBoundary'

function App() {
  const location = useLocation()
  return (
    <div className="app-shell">
      <header className="site-header">
        <NavLink className="brand" to="/leaderboard?period=1d" aria-label="Giggle Tracker home">
          <span className="brand-mark">GT</span>
          <span>Giggle Tracker <em>beta</em></span>
        </NavLink>
        <nav aria-label="Primary navigation">
          <NavLink to="/leaderboard?period=1d">Leaderboard</NavLink>
          <NavLink to="/profile">Profile lookup</NavLink>
          <NavLink to="/post">Post analytics</NavLink>
        </nav>
      </header>
      <main>
        <RouteErrorBoundary key={location.pathname + location.search}>
        <Routes>
          <Route path="/" element={<Navigate to="/leaderboard?period=1d" replace />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/profile/:userId?" element={<ProfilePage />} />
          <Route path="/post/:postId?" element={<PostPage />} />
          <Route path="*" element={<Navigate to="/leaderboard?period=1d" replace />} />
        </Routes>
        </RouteErrorBoundary>
      </main>
    </div>
  )
}

function LeaderboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const period = searchParams.get('period') === '1w' ? '1w' : '1d'
  const load = useCallback((signal: AbortSignal) => api.getLeaderboard(period, signal), [period])
  const resource = useApiResource(`leaderboard:${period}`, load)

  const setPeriod = (nextPeriod: '1d' | '1w') => setSearchParams({ period: nextPeriod })
  return (
    <section className="page leaderboard-page">
      <div className="page-intro leaderboard-intro">
        <div>
          <p className="kicker">The current board</p>
          <h1>Who is moving<br />Giggles today?</h1>
          <p className="lede">A live scorecard for the accounts changing the most right now.</p>
        </div>
        <div className="period-control" aria-label="Leaderboard period">
          <button className={period === '1d' ? 'selected' : ''} aria-pressed={period === '1d'} type="button" onClick={() => setPeriod('1d')}>Daily</button>
          <button className={period === '1w' ? 'selected' : ''} aria-pressed={period === '1w'} type="button" onClick={() => setPeriod('1w')}>Weekly</button>
        </div>
      </div>

      <ResourceMeta lastUpdated={resource.lastUpdated} onRefresh={resource.refresh} loading={resource.loading} retryInSeconds={resource.retryInSeconds} />
      {resource.error && <ErrorNotice message={resource.error} />}
      {resource.loading && !resource.data ? <LoadingRows /> : resource.data ? <Leaderboard entries={resource.data.entries} /> : null}
    </section>
  )
}

function Leaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) return <EmptyState title="No leaderboard data yet" description="Try refreshing in a moment." />
  return (
    <section className="leaderboard" aria-label="Leaderboard results">
      <div className="leaderboard-heading" aria-hidden="true"><span>Rank</span><span>Account</span><span>Net worth</span><span>Change</span></div>
      {entries.map((entry) => <LeaderboardRow key={entry.userId} entry={entry} />)}
    </section>
  )
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  const changeClass = entry.percentChange == null || entry.percentChange === 0 ? 'neutral' : entry.percentChange > 0 ? 'positive' : 'negative'
  return (
    <NavLink className="leaderboard-row" to={`/profile/${entry.userId}`}>
      <span className="rank"><span className="sr-only">Rank </span>{formatNumber(entry.rank)}</span>
      <span className="account-cell">
        <Avatar src={entry.photoUrl} name={entry.username ?? entry.displayName ?? 'Unknown'} />
        <span className="account-text"><span className="sr-only">Account </span><strong>{entry.displayName || entry.username || 'Unknown account'} {entry.verifiedGold ? <b className="gold-check" aria-label="Gold verified">●</b> : entry.verified ? <b className="verified-check" aria-label="Verified">✓</b> : null}</strong><small>@{entry.username || 'unknown'}</small></span>
      </span>
      <span className="amount"><span className="sr-only">Net worth </span>{formatAmount(entry.networth)}</span>
      <span className={`change ${changeClass}`}><span className="sr-only">Change </span>{formatSigned(entry.percentChange, '%')}</span>
    </NavLink>
  )
}

function ProfilePage() {
  const { userId } = useParams()
  return <ProfilePageContent key={userId ?? 'empty'} userId={userId} />
}

function ProfilePageContent({ userId }: { userId?: string }) {
  const navigate = useNavigate()
  const [input, setInput] = useState(userId ?? '')
  const [inputError, setInputError] = useState('')
  const validId = Boolean(userId && isUuid(userId))
  const load = useCallback((signal: AbortSignal) => api.getProfile(userId ?? '', signal), [userId])
  const resource = useApiResource(`profile:${userId ?? ''}`, load, validId)

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = input.trim()
    if (!isUuid(value)) return setInputError('Enter a complete profile UUID to continue.')
    setInputError('')
    navigate(`/profile/${value}`)
  }

  return (
    <section className="page detail-page">
      <div className="page-intro compact-intro"><div><p className="kicker">Profile lookup</p><h1>Read the current<br />account picture.</h1></div><p className="lede">Paste a Giggles profile UUID to inspect current audience, aura, and market data.</p></div>
      <LookupForm label="Profile UUID" input={input} setInput={setInput} error={inputError || (userId && !validId ? 'That profile UUID is not valid.' : '')} onSubmit={submit} />
      {validId && (
        <>
          <ResourceMeta lastUpdated={resource.lastUpdated} onRefresh={resource.refresh} loading={resource.loading} retryInSeconds={resource.retryInSeconds} />
          {resource.error && <ErrorNotice message={resource.error} />}
          {resource.loading && !resource.data ? <LoadingPanel /> : resource.data ? <ProfileDetails profile={resource.data} /> : null}
        </>
      )}
    </section>
  )
}

function PostPage() {
  const { postId } = useParams()
  return <PostPageContent key={postId ?? 'empty'} postId={postId} />
}

function PostPageContent({ postId }: { postId?: string }) {
  const navigate = useNavigate()
  const [input, setInput] = useState(postId ?? '')
  const [inputError, setInputError] = useState('')
  const validId = Boolean(postId && isUuid(postId))
  const load = useCallback((signal: AbortSignal) => api.getPost(postId ?? '', signal), [postId])
  const resource = useApiResource(`post:${postId ?? ''}`, load, validId)

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = input.trim()
    if (!isUuid(value)) return setInputError('Enter a complete post UUID to continue.')
    setInputError('')
    navigate(`/post/${value}`)
  }

  return (
    <section className="page detail-page">
      <div className="page-intro compact-intro"><div><p className="kicker">Post analytics</p><h1>See what the post<br />actually did.</h1></div><p className="lede">Paste a Giggles post UUID to inspect engagement, market activity, and investor information.</p></div>
      <LookupForm label="Post UUID" input={input} setInput={setInput} error={inputError || (postId && !validId ? 'That post UUID is not valid.' : '')} onSubmit={submit} />
      {validId && (
        <>
          <ResourceMeta lastUpdated={resource.lastUpdated} onRefresh={resource.refresh} loading={resource.loading} retryInSeconds={resource.retryInSeconds} />
          {resource.error && <ErrorNotice message={resource.error} />}
          {resource.loading && !resource.data ? <LoadingPanel /> : resource.data ? <PostDetails post={resource.data} /> : null}
        </>
      )}
    </section>
  )
}

function LookupForm({ label, input, setInput, error, onSubmit }: { label: string; input: string; setInput: (value: string) => void; error: string; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  const inputId = label.toLowerCase().replace(' ', '-')
  return <form className="lookup-form" onSubmit={onSubmit} noValidate><label htmlFor={inputId}>{label}</label><div><input id={inputId} value={input} onChange={(event) => setInput(event.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" aria-describedby={error ? `${inputId}-error` : undefined} aria-invalid={Boolean(error)} /><button type="submit">View data</button></div>{error && <p className="field-error" id={`${inputId}-error`}>{error}</p>}</form>
}

function ProfileDetails({ profile }: { profile: Profile }) {
  return <div className="detail-content"><section className="profile-card surface"><div className="profile-identity"><Avatar src={profile.profilePhoto} name={profile.username ?? 'Unknown'} large /><div><p className="kicker">Profile</p><h2>{profile.displayName || profile.username || 'Unknown account'}</h2><p>@{profile.username || 'unknown'}</p>{profile.bio && <p className="bio">{profile.bio}</p>}</div></div><div className="profile-flags">{profile.verification.account && <span>Verified</span>}{profile.visibility.private && <span>Private</span>}{profile.badges.map((badge) => <span key={String(badge)}>{String(badge)}</span>)}</div></section><MetricGrid title="Audience" metrics={[['Followers', formatNumber(profile.counts.followers)], ['Following', formatNumber(profile.counts.following)], ['Posts', formatNumber(profile.counts.posts)]]} /><MetricGrid title="Aura" metrics={[['Total aura', formatAmount(profile.aura.total)], ['Spendable', formatAmount(profile.aura.spendable)], ['Invested', formatAmount(profile.aura.invested)]]} /><MetricGrid title="Market position" metrics={[['Leaderboard rank', formatNumber(profile.trading.leaderboardRank)], ['Total volume', formatAmount(profile.trading.totalVolume)], ['Biggest win', formatAmount(profile.trading.biggestWin)]]} /></div>
}

function PostDetails({ post }: { post: Post }) {
  const media = post.media || post.thumbnailUrl || post.carouselMedia?.[0]
  const isPhoto = post.isPhoto || (!post.media && Boolean(post.carouselMedia?.length))
  return <div className="detail-content"><section className="post-overview surface"><div className="post-preview">{media ? isPhoto ? <img src={media} alt="Post media" /> : <video controls preload="metadata" poster={post.thumbnailUrl || undefined} src={post.media || undefined} /> : <span>Post media unavailable</span>}</div><div className="post-copy"><p className="kicker">@{post.username || 'unknown'}</p><h2>{post.description || 'No post description'}</h2><p>{post.hashtag ? `#${post.hashtag}` : 'No hashtag'} · Posted {formatDate(post.createdAt)}</p></div></section><MetricGrid title="Engagement" metrics={[['Views', formatNumber(post.counts.views)], ['Likes', formatNumber(post.counts.likes)], ['Comments', formatNumber(post.counts.comments)], ['Shares', formatNumber(post.counts.shares)], ['Bookmarks', formatNumber(post.counts.bookmarks)]]} /><MetricGrid title="Market activity" metrics={[['Token supply', formatAmount(post.market.tokenSupply)], ['Volume', formatAmount(post.market.volume)], ['Market pot', formatAmount(post.market.pot)], ['Holders', formatNumber(post.market.holders)], ['Trades', formatNumber(post.market.trades)], ['Investors', formatNumber(post.investorCount)]]} /></div>
}

function MetricGrid({ title, metrics }: { title: string; metrics: [string, string][] }) {
  return <section className="metric-section"><h2>{title}</h2><dl className="metric-grid">{metrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
}

function ResourceMeta({ lastUpdated, onRefresh, loading, retryInSeconds }: { lastUpdated: Date | null; onRefresh: () => void; loading: boolean; retryInSeconds: number }) {
  return <div className="resource-meta"><span>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}` : 'Waiting for live data'}</span><button className="refresh-button" type="button" onClick={onRefresh} disabled={loading || retryInSeconds > 0}>{loading ? 'Updating…' : retryInSeconds > 0 ? `Retry in ${retryInSeconds}s` : 'Refresh'}</button></div>
}

function ErrorNotice({ message }: { message: string }) { return <p className="error-notice" role="alert">{message}</p> }
function EmptyState({ title, description }: { title: string; description: string }) { return <section className="empty-state surface"><h2>{title}</h2><p>{description}</p></section> }
function LoadingPanel() { return <section className="loading-panel surface" aria-label="Loading data"><span /><span /><span /></section> }
function LoadingRows() { return <section className="loading-rows" aria-label="Loading leaderboard">{Array.from({ length: 7 }, (_, index) => <div className="loading-row" key={index}><span /><span /><span /></div>)}</section> }

function Avatar({ src, name, large = false }: { src: string | null; name: string; large?: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const initial = name.slice(0, 1).toUpperCase()
  return <span className={`avatar ${large ? 'avatar-large' : ''}`} aria-hidden="true">{src && src !== failedSrc ? <img src={src} alt="" onError={() => setFailedSrc(src)} /> : initial}</span>
}

export default App
