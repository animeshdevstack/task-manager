import { useCallback, useEffect, useState } from 'react'
import { Clock3 } from 'lucide-react'
import AppPageHeader from '@/components/layout/AppPageHeader'
import { Button } from '@/components/ui/button'
import { clearSession, getStoredUser } from '@/lib/auth-api'
import { followRequest } from '@/lib/follow-api'

function userIdStr(id) {
  return typeof id === 'string' ? id : id?.toString?.() ?? String(id)
}

function displayUser(user) {
  const name = [user?.Fname, user?.Lname].filter(Boolean).join(' ').trim()
  return name || user?.email || 'User'
}

export default function Pending() {
  const [user] = useState(getStoredUser)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [pendingList, setPendingList] = useState([])
  const [busyId, setBusyId] = useState(null)

  const loadPending = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await followRequest('/me')
      setPendingList(res.data?.followingPending ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load pending requests')
      setPendingList([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPending()
  }, [loadPending])

  async function handleWithdraw(targetUserId) {
    const id = userIdStr(targetUserId)
    setBusyId(id)
    setMessage(null)
    try {
      await followRequest(`/${encodeURIComponent(id)}`, { method: 'DELETE' })
      setMessage('Request withdrawn')
      await loadPending()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not withdraw request')
    } finally {
      setBusyId(null)
    }
  }

  function signOut() {
    clearSession()
    window.location.assign('/login')
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-violet-200/70 via-fuchsia-100/80 to-cyan-200/70">
      <AppPageHeader
        title="Pending requests"
        subtitle="Withdraw sent follow requests"
        icon={Clock3}
        onSignOut={signOut}
        navContext="social"
        backTo="/"
      />

      <main className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
        <section className="rounded-2xl border border-white/70 bg-white/45 p-4 shadow-sm ring-1 ring-violet-200/50 backdrop-blur-sm dark:border-slate-800/50 dark:bg-slate-900/30">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-violet-950 dark:text-violet-100">Sent requests</p>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              {pendingList.length}
            </span>
          </div>

          {message ? (
            <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
              {message}
            </p>
          ) : null}

          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading pending requests…</p>
          ) : error ? (
            <p className="py-8 text-center text-sm text-red-600">{error}</p>
          ) : pendingList.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No pending follow requests.</p>
          ) : (
            <ul className="space-y-2">
              {pendingList.map((item) => {
                const id = userIdStr(item.userId)
                const busy = busyId === id
                return (
                  <li
                    key={id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-violet-200/70 bg-white/80 px-3 py-2 dark:border-violet-900/50 dark:bg-slate-900/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                        {displayUser(item)}
                      </p>
                      <p className="truncate text-xs text-slate-500">{item.email}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2 text-xs"
                      disabled={busy}
                      onClick={() => void handleWithdraw(id)}
                    >
                      Withdraw
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
