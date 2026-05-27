import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, X } from 'lucide-react'
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

export default function Following() {
  const [user] = useState(getStoredUser)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [following, setFollowing] = useState([])
  const [busyUserId, setBusyUserId] = useState(null)

  const loadFollowing = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await followRequest('/me')
      setFollowing(res.data?.following ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load following list')
      setFollowing([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadFollowing()
  }, [loadFollowing])

  async function handleUnfollow(otherUserId) {
    const id = userIdStr(otherUserId)
    setBusyUserId(id)
    try {
      await followRequest(`/${encodeURIComponent(id)}`, { method: 'DELETE' })
      await loadFollowing()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not unfollow user')
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
        title="Following"
        subtitle="People you can see"
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
                Following ({following.length})
              </p>
            </div>
            <Button asChild size="sm" variant="outline" className="h-7 text-xs">
              <Link to="/followers">View followers</Link>
            </Button>
          </div>

          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading following list…</p>
          ) : error ? (
            <p className="py-8 text-center text-sm text-red-600">{error}</p>
          ) : following.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">You are not following anyone yet.</p>
          ) : (
            <ul className="space-y-2">
              {following.map((item) => {
                const id = userIdStr(item.userId)
                return (
                  <li
                    key={id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-violet-200/70 bg-white/80 px-3 py-2 dark:border-violet-900/50 dark:bg-slate-900/50"
                  >
                    <Link
                      to={`/profile/${encodeURIComponent(id)}?source=following`}
                      className="min-w-0 flex-1 rounded-md px-1 py-0.5 transition hover:bg-violet-50/80 dark:hover:bg-violet-950/30"
                    >
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                        {displayUser(item)}
                      </p>
                      <p className="truncate text-xs text-slate-500">{item.email}</p>
                    </Link>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2 text-xs"
                      disabled={busyUserId === id}
                      onClick={() => void handleUnfollow(id)}
                    >
                      <X className="h-3.5 w-3.5" />
                      Unfollow
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
