import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Headphones, Search, Ticket } from 'lucide-react'
import AppPageHeader from '@/components/layout/AppPageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Toast, TOAST_DURATION_MS } from '@/components/ui/toast'
import { clearSession, getStoredUser } from '@/lib/auth-api'
import { supportRequest } from '@/lib/support-api'

function displayName(user) {
  const name = [user?.Fname, user?.Lname].filter(Boolean).join(' ').trim()
  return name || user?.email || 'User'
}

function ticketTaskLabel(ticket) {
  if (Array.isArray(ticket?.tasks) && ticket.tasks.length > 0) {
    return ticket.tasks.map((x) => x.subTaskName).filter(Boolean).join(', ')
  }
  return ticket?.subTaskName || 'Task'
}

export default function SupportDashboard() {
  const navigate = useNavigate()
  const [user] = useState(getStoredUser)
  const [tab, setTab] = useState('tickets')
  const [tickets, setTickets] = useState([])
  const [ticketStatus, setTicketStatus] = useState('open')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)

  function showToast(message, variant = 'success') {
    setToast({ message, variant })
    window.setTimeout(() => setToast(null), TOAST_DURATION_MS)
  }

  const loadTickets = useCallback(async () => {
    setLoading(true)
    try {
      const qs = ticketStatus ? `?status=${encodeURIComponent(ticketStatus)}` : ''
      const res = await supportRequest(`/tickets${qs}`)
      setTickets(Array.isArray(res.data) ? res.data : [])
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to load tickets', 'error')
    } finally {
      setLoading(false)
    }
  }, [ticketStatus])

  useEffect(() => {
    if (tab === 'tickets') {
      void loadTickets()
    }
  }, [tab, loadTickets])

  function signOut() {
    clearSession()
    navigate('/login', { replace: true })
  }

  async function onSearch(e) {
    e.preventDefault()
    if (query.trim().length < 2) {
      showToast('Enter at least 2 characters', 'error')
      return
    }
    setLoading(true)
    try {
      const res = await supportRequest(
        `/users/search?q=${encodeURIComponent(query.trim())}`,
      )
      setResults(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Search failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function resolveTicket(id, status, markComplete = true) {
    try {
      await supportRequest(`/tickets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, markComplete }),
      })
      showToast(status === 'resolved' ? 'Ticket resolved' : 'Ticket rejected')
      await loadTickets()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed', 'error')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-slate-100">
      <AppPageHeader
        title="Support"
        subtitle={user?.email ?? 'Help desk'}
        icon={Headphones}
        onSignOut={signOut}
        maxWidthClass="max-w-5xl"
      />

      <main className="mx-auto max-w-5xl space-y-6 px-5 py-8">
        {user?.role === 'admin' ? (
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin">Back to Admin</Link>
          </Button>
        ) : null}

        <div className="flex gap-2">
          <Button
            type="button"
            variant={tab === 'tickets' ? 'default' : 'outline'}
            size="sm"
            className="gap-1"
            onClick={() => setTab('tickets')}
          >
            <Ticket className="h-4 w-4" />
            Tickets
          </Button>
          <Button
            type="button"
            variant={tab === 'browse' ? 'default' : 'outline'}
            size="sm"
            className="gap-1"
            onClick={() => setTab('browse')}
          >
            <Search className="h-4 w-4" />
            Browse users
          </Button>
        </div>

        {tab === 'tickets' ? (
          <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <label className="text-sm text-slate-600" htmlFor="ticket-status">
                Status
              </label>
              <select
                id="ticket-status"
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
                value={ticketStatus}
                onChange={(e) => setTicketStatus(e.target.value)}
              >
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
                <option value="">All</option>
              </select>
            </div>

            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : tickets.length === 0 ? (
              <p className="text-sm text-slate-500">No tickets.</p>
            ) : (
              <ul className="space-y-4">
                {tickets.map((t) => {
                  const taskLabel = ticketTaskLabel(t)
                  return (
                  <li
                    key={t.id}
                    className="rounded-xl border border-slate-100 bg-slate-50/80 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold text-slate-900">
                          {displayName(t.user)} · {taskLabel}
                        </p>
                        <p className="text-xs text-slate-500">
                          {t.user?.email} · {t.type} · {t.dateYmd} · {t.status}
                          {Array.isArray(t.tasks) && t.tasks.length > 1
                            ? ` · ${t.tasks.length} tasks`
                            : ''}
                        </p>
                        <p className="text-sm text-slate-700">{t.message}</p>
                      </div>
                      {t.status === 'open' ? (
                        <div className="flex flex-col items-stretch gap-2 sm:items-end">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() =>
                                resolveTicket(t.id, 'resolved', true)
                              }
                            >
                              Mark complete & resolve
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                resolveTicket(t.id, 'resolved', false)
                              }
                            >
                              Resolve
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                resolveTicket(t.id, 'rejected', false)
                              }
                            >
                              Reject
                            </Button>
                            {t.user?.id ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                asChild
                              >
                                <Link
                                  to={`/support/users/${t.user.id}?ticketId=${encodeURIComponent(t.id)}`}
                                >
                                  Open habits
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                          <p className="max-w-sm text-xs text-slate-500">
                            Mark complete &amp; resolve updates habits; Resolve
                            only closes the ticket.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </li>
                  )
                })}
              </ul>
            )}
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
            <form onSubmit={onSearch} className="mb-4 flex gap-2">
              <Input
                placeholder="Search users by email or name"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <Button type="submit" disabled={loading}>
                Search
              </Button>
            </form>
            {results.length === 0 ? (
              <p className="text-sm text-slate-500">
                Search for a user to open their habit tracker.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {results.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {displayName(u)}
                      </p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </div>
                    <Button size="sm" asChild>
                      <Link to={`/support/users/${u.id}`}>Open habits</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>

      {toast ? <Toast message={toast.message} variant={toast.variant} /> : null}
    </div>
  )
}
