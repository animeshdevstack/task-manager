import { useCallback, useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
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

export default function Requests() {
  const [user] = useState(getStoredUser)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [requests, setRequests] = useState([])
  const [busyId, setBusyId] = useState(null)

  const loadRequests = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await followRequest('/me')
      setRequests(res.data?.incomingPending ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load follow requests')
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRequests()
  }, [loadRequests])

  async function handleDecision(followerUserId, action) {
    const id = userIdStr(followerUserId)
    setBusyId(id)
    setMessage(null)
    try {
      await followRequest(`/${action}/${encodeURIComponent(id)}`, { method: 'POST' })
      setMessage(action === 'accept' ? 'Request accepted' : 'Request rejected')
      await loadRequests()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update follow request')
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
        title="Follow requests"
        subtitle="Accept or reject requests"
        icon={Bell}
        onSignOut={signOut}
        navContext="social"
        backTo="/"
      />

      <main className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
        <section className="rounded-2xl border border-white/70 bg-white/45 p-4 shadow-sm ring-1 ring-violet-200/50 backdrop-blur-sm dark:border-slate-800/50 dark:bg-slate-900/30">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-violet-950 dark:text-violet-100">Pending requests</p>
            <span className="rounded-full bg-fuchsia-100 px-2.5 py-0.5 text-xs font-semibold text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-200">
              {requests.length}
            </span>
          </div>

          {message ? (
            <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
              {message}
            </p>
          ) : null}

          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading requests…</p>
          ) : error ? (
            <p className="py-8 text-center text-sm text-red-600">{error}</p>
          ) : requests.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No pending follow requests.</p>
          ) : (
            <ul className="space-y-2">
              {requests.map((req) => {
                const id = userIdStr(req.userId)
                const busy = busyId === id
                return (
                  <li
                    key={id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-violet-200/70 bg-white/80 px-3 py-2 dark:border-violet-900/50 dark:bg-slate-900/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                        {displayUser(req)}
                      </p>
                      <p className="truncate text-xs text-slate-500">{req.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={busy}
                        onClick={() => void handleDecision(id, 'accept')}
                      >
                        Accept
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={busy}
                        onClick={() => void handleDecision(id, 'reject')}
                      >
                        Reject
                      </Button>
                    </div>
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
