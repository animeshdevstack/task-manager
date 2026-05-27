import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserMinus, Users } from 'lucide-react'
import AppPageHeader from '@/components/layout/AppPageHeader'
import { Button } from '@/components/ui/button'
import { clearSession, getStoredUser } from '@/lib/auth-api'
import { followRequest } from '@/lib/follow-api'

function userIdStr(id) {
  return typeof id === 'string' ? id : id?.toString?.() ?? String(id)
}

function displayUser(u) {
  const name = [u.Fname, u.Lname].filter(Boolean).join(' ').trim()
  return name || u.email || 'User'
}

export default function Followers() {
  const [user] = useState(getStoredUser)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [followers, setFollowers] = useState([])
  const [busyUserId, setBusyUserId] = useState(null)

  const loadFollowers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await followRequest('/me')
      setFollowers(res.data?.followers ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load followers')
      setFollowers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadFollowers()
  }, [loadFollowers])

  async function handleRemoveFollower(followerUserId) {
    const id = userIdStr(followerUserId)
    setBusyUserId(id)
    setMessage(null)
    try {
      await followRequest(`/follower/${encodeURIComponent(id)}`, { method: 'DELETE' })
      setMessage('Follower removed')
      await loadFollowers()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove follower')
    } finally {
      setBusyUserId(null)
    }
  }

  function signOut() {
    clearSession()
    window.location.assign('/login')
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-violet-200/70 via-fuchsia-100/80 to-cyan-200/70">
      <AppPageHeader
        title="Followers"
        subtitle="People who follow you"
        icon={Users}
        onSignOut={signOut}
        navContext="social"
        backTo="/"
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-5 sm:px-6 sm:py-6">
        <section className="rounded-2xl border border-white/70 bg-white/45 p-4 shadow-sm ring-1 ring-violet-200/50 backdrop-blur-sm dark:border-slate-800/50 dark:bg-slate-900/30">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-violet-700" />
              <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">
                Followers ({followers.length})
              </p>
            </div>
            <Button asChild size="sm" variant="outline" className="h-7 text-xs">
              <Link to="/following">View following</Link>
            </Button>
          </div>

          {message ? (
            <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
              {message}
            </p>
          ) : null}

          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading followers…</p>
          ) : error ? (
            <p className="py-8 text-center text-sm text-red-600">{error}</p>
          ) : followers.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No followers yet.</p>
          ) : (
            <ul className="space-y-2">
              {followers.map((item) => {
                const id = userIdStr(item.userId)
                const busy = busyUserId === id
                return (
                  <li
                    key={id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-violet-200/70 bg-white/80 px-3 py-2 dark:border-violet-900/50 dark:bg-slate-900/50"
                  >
                    <Link
                      to={`/profile/${encodeURIComponent(id)}?source=followers`}
                      className="min-w-0 flex-1 rounded-md px-1 py-0.5 transition hover:bg-violet-50/80 dark:hover:bg-violet-950/30"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                          {displayUser(item)}
                        </p>
                        <p className="truncate text-xs text-slate-500">{item.email}</p>
                      </div>
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                        Open profile
                      </span>
                    </Link>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2 text-xs"
                      disabled={busy}
                      onClick={() => void handleRemoveFollower(id)}
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
