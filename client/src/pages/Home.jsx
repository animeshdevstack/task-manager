import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToday } from '@/hooks/useToday'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Bell,
  CalendarDays,
  ListChecks,
  Search,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react'
import AppPageHeader from '@/components/layout/AppPageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PLANNER_HIGHLIGHTS } from '@/constants/planner-highlights'
import { clearSession, getStoredUser } from '@/lib/auth-api'
import { followRequest } from '@/lib/follow-api'
import { cn } from '@/lib/utils'

const QUICK_ACTIONS = [
  {
    key: 'tasks',
    title: 'Task Manager',
    description: 'Names for daily · weekly · monthly',
    href: '/tasks',
    icon: Sparkles,
    accent: 'from-violet-600 via-fuchsia-600 to-violet-500',
    ring: 'ring-violet-400/40',
  },
  {
    key: 'habits',
    title: 'Habit Tracker',
    description: 'Grids & check-offs',
    href: '/habits',
    icon: ListChecks,
    accent: 'from-emerald-600 via-teal-500 to-cyan-500',
    ring: 'ring-emerald-400/40',
  },
]

function formatYearMonth(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function formatMonthTitle(d) {
  return d.toLocaleString(undefined, { month: 'long', year: 'numeric' })
}

function userIdStr(id) {
  return typeof id === 'string' ? id : id?.toString?.() ?? String(id)
}

function displayUser(u) {
  const name = [u.Fname, u.Lname].filter(Boolean).join(' ').trim()
  return name || u.email || 'User'
}

function getFollowStateForUser(userId, followData) {
  const id = userIdStr(userId)
  if (followData.following?.some((u) => userIdStr(u.userId) === id)) {
    return 'accepted'
  }
  if (followData.followingPending?.some((u) => userIdStr(u.userId) === id)) {
    return 'pending'
  }
  return 'none'
}

export default function Home() {
  const navigate = useNavigate()
  const [user] = useState(getStoredUser)
  const today = useToday()
  const monthKey = useMemo(() => formatYearMonth(today), [today])
  const monthTitle = useMemo(() => formatMonthTitle(today), [today])
  const displayName = user?.email?.split('@')[0] ?? 'there'

  const [followData, setFollowData] = useState({
    incomingPending: [],
    following: [],
    followers: [],
    followingPending: [],
  })
  const [followLoading, setFollowLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [actionUserId, setActionUserId] = useState(null)
  const [followMessage, setFollowMessage] = useState(null)

  function signOut() {
    clearSession()
    navigate('/login', { replace: true })
  }

  const loadFollowMe = useCallback(async () => {
    setFollowLoading(true)
    try {
      const res = await followRequest('/me')
      const data = res.data ?? {}
      setFollowData({
        incomingPending: data.incomingPending ?? [],
        following: data.following ?? [],
        followers: data.followers ?? [],
        followingPending: data.followingPending ?? [],
      })
    } catch {
      setFollowMessage('Could not load follow data')
    } finally {
      setFollowLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadFollowMe()
  }, [loadFollowMe])

  useEffect(() => {
    const q = searchQuery.trim()
    if (q.length < 2) {
      setSearchResults([])
      return undefined
    }

    const timer = window.setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await followRequest(`/users/search?q=${encodeURIComponent(q)}`)
        setSearchResults(res.data ?? [])
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 300)

    return () => window.clearTimeout(timer)
  }, [searchQuery])

  async function handleFollow(targetUserId) {
    setActionUserId(userIdStr(targetUserId))
    setFollowMessage(null)
    try {
      await followRequest(`/request/${encodeURIComponent(userIdStr(targetUserId))}`, {
        method: 'POST',
      })
      setFollowMessage('Follow request sent')
      await loadFollowMe()
    } catch (e) {
      setFollowMessage(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setActionUserId(null)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-violet-200/70 via-fuchsia-100/80 to-cyan-200/70">
      <AppPageHeader
        title="Task Planner"
        subtitle="Home"
        icon={Sparkles}
        onSignOut={signOut}
        navContext="home"
      />

      <main className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex w-full flex-col gap-4">
          <div className="overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 p-px shadow-md">
            <div className="flex items-center justify-between gap-4 rounded-[11px] bg-white/95 px-4 py-3 backdrop-blur dark:bg-slate-950/95">
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wide text-fuchsia-700">
                  Welcome back
                </p>
                <h1 className="truncate text-lg font-bold leading-tight text-slate-900 dark:text-white">
                  Hi,{' '}
                  <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                    {displayName}
                  </span>
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Link
                    to="/followers"
                    className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-800 transition hover:bg-violet-200 dark:bg-violet-950 dark:text-violet-200 dark:hover:bg-violet-900"
                  >
                    Followers
                    <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] dark:bg-slate-900/70">
                      {followLoading ? '...' : followData.followers.length}
                    </span>
                  </Link>
                  <Link
                    to="/following"
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 transition hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:hover:bg-emerald-900"
                  >
                    Following
                    <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] dark:bg-slate-900/70">
                      {followLoading ? '...' : followData.following.length}
                    </span>
                  </Link>
                  <Link
                    to="/pending"
                    className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900"
                  >
                    Pending
                    <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] dark:bg-slate-900/70">
                      {followLoading ? '...' : followData.followingPending.length}
                    </span>
                  </Link>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="relative h-10 w-10 border-violet-300 bg-white/80 p-0 dark:bg-slate-900/60"
                  title="Follow requests"
                >
                  <Link to="/requests">
                    <Bell className="h-4 w-4 text-violet-700" />
                    <span className="absolute -right-1 -top-1 rounded-full bg-fuchsia-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {followLoading ? '…' : followData.incomingPending.length}
                    </span>
                  </Link>
                </Button>
                <div className="flex items-center gap-2.5 rounded-lg bg-violet-50 px-3 py-2 ring-1 ring-violet-200/80 dark:bg-violet-950/50">
                  <CalendarDays className="h-4 w-4 shrink-0 text-fuchsia-600" aria-hidden />
                  <div className="min-w-0 text-right">
                    <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                      {monthTitle}
                    </p>
                    <p className="font-mono text-[10px] text-violet-800/80">{monthKey}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon
              return (
                <Link
                  key={action.key}
                  to={action.href}
                  className={cn(
                    'group rounded-xl bg-gradient-to-r p-px shadow-sm ring-1 transition hover:shadow-md',
                    action.ring,
                  )}
                >
                  <div className="flex items-center justify-between gap-3 rounded-[11px] bg-white/95 px-3.5 py-3 dark:bg-slate-950/95">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm',
                          action.accent,
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                          {action.title}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {action.description}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-violet-500 transition group-hover:translate-x-0.5" />
                  </div>
                </Link>
              )
            })}
          </div>

          <section className="rounded-2xl border border-white/70 bg-white/45 p-4 shadow-sm ring-1 ring-violet-200/50 backdrop-blur-sm dark:border-slate-800/50 dark:bg-slate-900/30">
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-violet-600" />
              <h2 className="text-sm font-bold text-violet-950 dark:text-violet-100">
                Follow & share progress
              </h2>
            </div>

            {followMessage ? (
              <p className="mb-2 text-xs text-violet-800 dark:text-violet-200">{followMessage}</p>
            ) : null}

            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-400" />
              <Input
                type="search"
                placeholder="Search people by email (min 2 characters)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 bg-white/90 pl-9 text-sm dark:bg-slate-900/80"
              />
            </div>

            {searchQuery.trim().length >= 2 ? (
              <ul className="mb-4 max-h-36 space-y-1 overflow-y-auto rounded-lg border border-violet-100 bg-white/80 p-2 dark:border-violet-900/50 dark:bg-slate-900/50">
                {searchLoading ? (
                  <li className="py-2 text-center text-xs text-slate-500">Searching…</li>
                ) : searchResults.length === 0 ? (
                  <li className="py-2 text-center text-xs text-slate-500">No users found</li>
                ) : (
                  searchResults.map((u) => {
                    const id = userIdStr(u._id)
                    const state = getFollowStateForUser(id, followData)
                    const busy = actionUserId === id
                    return (
                      <li
                        key={id}
                        className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-violet-50/80 dark:hover:bg-violet-950/30"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900 dark:text-white">
                            {displayUser(u)}
                          </p>
                          <p className="truncate text-xs text-slate-500">{u.email}</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 shrink-0 gap-1 px-2 text-xs"
                          disabled={busy || state !== 'none'}
                          onClick={() => void handleFollow(id)}
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          {state === 'accepted'
                            ? 'Following'
                            : state === 'pending'
                              ? 'Requested'
                              : 'Follow'}
                        </Button>
                      </li>
                    )
                  })
                )}
              </ul>
            ) : null}

            {followLoading ? (
              <p className="text-xs text-slate-500">Loading follow data…</p>
            ) : (
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Use notification for incoming requests and the Pending chip for sent requests.
              </p>
            )}
          </section>

          <div className="rounded-2xl border border-white/70 bg-white/45 p-3 shadow-sm ring-1 ring-violet-200/50 backdrop-blur-sm dark:border-slate-800/50 dark:bg-slate-900/30 sm:p-4">
            <p className="mb-3 px-1 text-center text-xs font-medium text-violet-900/80 dark:text-violet-200/80">
              Plan by rhythm — daily habits, weekly milestones, monthly themes
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {PLANNER_HIGHLIGHTS.map((item) => {
                const Icon = item.icon
                return (
                  <section
                    key={item.key}
                    className={cn(
                      'flex flex-col overflow-hidden rounded-xl ring-1',
                      item.bg,
                      item.text,
                    )}
                  >
                    <div
                      className={cn(
                        'flex items-center gap-2.5 bg-gradient-to-r px-3.5 py-2.5 text-white',
                        item.gradient,
                      )}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/25">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-bold leading-tight">{item.title}</h2>
                        <p className="text-[10px] text-white/90">{item.hint}</p>
                      </div>
                    </div>
                    <div className="space-y-3 px-3.5 py-3">
                      <ul className="space-y-2 text-xs leading-relaxed opacity-90">
                        {item.body.map((line) => (
                          <li key={line} className="flex gap-2">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current opacity-50" />
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="flex flex-wrap gap-2 border-t border-current/10 pt-2.5">
                        <Link
                          to={item.primaryLink.to}
                          className="inline-flex items-center gap-1 rounded-md bg-white/80 px-2.5 py-1.5 text-[11px] font-semibold shadow-sm ring-1 ring-black/5 transition hover:bg-white dark:bg-slate-900/70"
                        >
                          {item.primaryLink.label}
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                        <Link
                          to={item.secondaryLink.to}
                          className="inline-flex rounded-md px-2 py-1.5 text-[11px] font-medium underline-offset-2 opacity-85 hover:underline"
                        >
                          {item.secondaryLink.label}
                        </Link>
                      </div>
                    </div>
                  </section>
                )
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
