import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Headphones } from 'lucide-react'
import AppPageHeader from '@/components/layout/AppPageHeader'
import { HabitCompletionToggle } from '@/components/habits/HabitCompletionToggle'
import MonthNavBar, { addMonths } from '@/components/tasks/MonthNavBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Toast, TOAST_DURATION_MS } from '@/components/ui/toast'
import { clearSession } from '@/lib/auth-api'
import {
  buildDatedSubTaskMap,
  dayYmdInMonth,
  formatDateYmd,
  matchesReviewSlotYmd,
  monthDateBounds,
  sundayYmdsInMonth,
} from '@/lib/dated-tasks'
import { supportRequest } from '@/lib/support-api'
import { cn } from '@/lib/utils'

function formatYearMonth(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function formatMonthTitle(d) {
  return d.toLocaleString(undefined, { month: 'long', year: 'numeric' })
}

function displayName(u) {
  const name = [u?.Fname, u?.Lname].filter(Boolean).join(' ').trim()
  return name || u?.email || 'User'
}

function ticketTaskLabel(ticket) {
  if (Array.isArray(ticket?.tasks) && ticket.tasks.length > 0) {
    return ticket.tasks.map((x) => x.subTaskName).filter(Boolean).join(', ')
  }
  return ticket?.subTaskName || 'Task'
}

const TABS = ['daily', 'weekly', 'monthly', 'dated']

export default function SupportUserHabits() {
  const { userId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const ticketId = searchParams.get('ticketId') || ''
  const navigate = useNavigate()
  const [target, setTarget] = useState(null)
  const [ticket, setTicket] = useState(null)
  const [focusTaskIds, setFocusTaskIds] = useState(() => new Set())
  const [resolving, setResolving] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const monthKey = useMemo(() => formatYearMonth(viewMonth), [viewMonth])
  const [plan, setPlan] = useState(null)
  const [review, setReview] = useState(null)
  const [activeTab, setActiveTab] = useState('daily')
  const [dayInput, setDayInput] = useState('1')
  const [loading, setLoading] = useState(true)
  const [patching, setPatching] = useState(false)
  const [toast, setToast] = useState(null)

  const daysInMonth = useMemo(() => {
    const [y, m] = monthKey.split('-').map(Number)
    return new Date(y, m, 0).getDate()
  }, [monthKey])

  const selectedDay = useMemo(() => {
    const n = Number(dayInput)
    if (!Number.isFinite(n) || n < 1) return 1
    return Math.min(daysInMonth, Math.floor(n))
  }, [dayInput, daysInMonth])

  const selectedYmd = useMemo(
    () => dayYmdInMonth(monthKey, selectedDay),
    [monthKey, selectedDay],
  )

  function commitDayInput() {
    setDayInput(String(selectedDay))
  }

  function showToast(message, variant = 'success') {
    setToast({ message, variant })
    window.setTimeout(() => setToast(null), TOAST_DURATION_MS)
  }

  function applyTicketPrefill(data) {
    if (!data?.dateYmd || !/^\d{4}-\d{2}-\d{2}$/.test(data.dateYmd)) return
    const [y, m, d] = data.dateYmd.split('-').map(Number)
    setViewMonth(new Date(y, m - 1, 1))
    setDayInput(String(d))
    const tab =
      data.type === 'weekly'
        ? 'weekly'
        : data.type === 'monthly'
          ? 'monthly'
          : 'daily'
    setActiveTab(tab)
    setFocusTaskIds(
      new Set(
        (Array.isArray(data.tasks) ? data.tasks : [])
          .map((t) => t.subTaskId?.toString?.() ?? String(t.subTaskId ?? ''))
          .filter(Boolean),
      ),
    )
  }

  useEffect(() => {
    let cancelled = false
    if (!ticketId) {
      setTicket(null)
      setFocusTaskIds(new Set())
      return undefined
    }
    ;(async () => {
      try {
        const res = await supportRequest(`/tickets/${ticketId}`)
        if (cancelled) return
        const data = res.data
        if (data?.user?.id && data.user.id !== userId) {
          showToast('Ticket does not belong to this user', 'error')
          setTicket(null)
          setFocusTaskIds(new Set())
          return
        }
        setTicket(data)
        applyTicketPrefill(data)
      } catch (e) {
        if (!cancelled) {
          showToast(e instanceof Error ? e.message : 'Could not load ticket', 'error')
          setTicket(null)
          setFocusTaskIds(new Set())
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ticketId, userId])

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const [userRes, tasksRes, reviewRes] = await Promise.all([
        supportRequest(`/users/${userId}`),
        supportRequest(
          `/users/${userId}/add-tasks?month=${monthKey}&includePrivate=true`,
        ),
        supportRequest(
          `/users/${userId}/review-tasks?month=${monthKey}&includePrivate=true`,
        ),
      ])
      setTarget(userRes.data)
      const planDoc = tasksRes.data?.task ?? tasksRes.data?.tasks?.[0] ?? null
      setPlan(planDoc)
      const reviewDoc =
        reviewRes.data?.task ?? reviewRes.data?.tasks?.[0] ?? null
      setReview(reviewDoc?._id ? reviewDoc : null)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to load', 'error')
      setReview(null)
      setPlan(null)
    } finally {
      setLoading(false)
    }
  }, [userId, monthKey])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const n = Number(dayInput)
    if (Number.isFinite(n) && n > daysInMonth) {
      setDayInput(String(daysInMonth))
    }
  }, [daysInMonth, dayInput])

  const datedSubTaskMap = useMemo(
    () => buildDatedSubTaskMap(plan?.DatedTasks),
    [plan],
  )

  async function toggleTask(type, subTaskId, nextCompleted, dateYmd) {
    if (!review?._id || !dateYmd || !userId) return
    setPatching(true)
    try {
      await supportRequest(`/users/${userId}/review-tasks/${review._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          type,
          dateYmd,
          date: `${dateYmd}T12:00:00`,
          subTaskId:
            typeof subTaskId === 'string' ? subTaskId : subTaskId.toString(),
          isCompleted: nextCompleted,
        }),
      })
      const detail = await supportRequest(
        `/users/${userId}/review-tasks/${review._id}?includePrivate=true`,
      )
      setReview(detail.data)
      showToast(nextCompleted ? 'Marked complete' : 'Marked incomplete')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not update', 'error')
    } finally {
      setPatching(false)
    }
  }

  async function resolveTicketFromBanner() {
    if (!ticket?.id || ticket.status !== 'open') return
    setResolving(true)
    try {
      await supportRequest(`/tickets/${ticket.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'resolved', markComplete: true }),
      })
      showToast('Ticket resolved and habits marked complete')
      navigate('/support', { replace: true })
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Resolve failed', 'error')
    } finally {
      setResolving(false)
    }
  }

  function clearTicketContext() {
    setTicket(null)
    setFocusTaskIds(new Set())
    const next = new URLSearchParams(searchParams)
    next.delete('ticketId')
    setSearchParams(next, { replace: true })
  }

  function goPrevMonth() {
    setViewMonth((m) => addMonths(m, -1))
    setDayInput('1')
  }

  function goNextMonth() {
    setViewMonth((m) => addMonths(m, 1))
    setDayInput('1')
  }

  const dailyTasks = useMemo(() => {
    if (!review?.DailyTasks) return []
    const slot = review.DailyTasks.find((e) =>
      matchesReviewSlotYmd(new Date(e.todayDate), selectedYmd),
    )
    const datedIds = new Set(
      [...datedSubTaskMap.entries()]
        .filter(([, ymd]) => ymd === selectedYmd)
        .map(([id]) => id),
    )
    return (slot?.Task ?? []).filter((t) => {
      const id = t.subTaskId?.toString?.() ?? String(t.subTaskId)
      return !datedIds.has(id)
    })
  }, [review, selectedYmd, datedSubTaskMap])

  const datedTasks = useMemo(() => {
    if (!review?.DailyTasks) return []
    const slot = review.DailyTasks.find((e) =>
      matchesReviewSlotYmd(new Date(e.todayDate), selectedYmd),
    )
    const datedIds = new Set(
      [...datedSubTaskMap.entries()]
        .filter(([, ymd]) => ymd === selectedYmd)
        .map(([id]) => id),
    )
    return (slot?.Task ?? []).filter((t) => {
      const id = t.subTaskId?.toString?.() ?? String(t.subTaskId)
      return datedIds.has(id)
    })
  }, [review, selectedYmd, datedSubTaskMap])

  const weeklySlots = useMemo(() => {
    const sundays = sundayYmdsInMonth(monthKey)
    return (review?.WeeklyTasks ?? [])
      .map((entry) => {
        const d = new Date(entry.sundayDate)
        const ymd =
          sundays.find((s) => matchesReviewSlotYmd(d, s)) ?? formatDateYmd(d)
        return { ...entry, dateYmd: ymd }
      })
      .filter((e) => e.dateYmd.startsWith(`${monthKey}-`))
      .sort((a, b) => a.dateYmd.localeCompare(b.dateYmd))
  }, [review, monthKey])

  const monthlyTasks = review?.MonthlyTasks?.Task ?? []
  const monthEndYmd = monthDateBounds(monthKey).max

  function signOut() {
    clearSession()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-slate-100">
      <AppPageHeader
        title="Support · Habits"
        subtitle={target ? displayName(target) : 'Loading…'}
        icon={Headphones}
        onSignOut={signOut}
        backTo="/support"
        maxWidthClass="max-w-5xl"
      />

      <main className="mx-auto max-w-5xl space-y-5 px-5 py-6">
        {target ? (
          <div className="rounded-xl border border-teal-200 bg-teal-50/80 px-4 py-3 text-sm text-teal-950">
            Acting on behalf of <strong>{displayName(target)}</strong> (
            {target.email}). You can mark any date in this month.
          </div>
        ) : null}

        {ticket ? (
          <div className="sticky top-2 z-10 space-y-3 rounded-xl border border-amber-300 bg-amber-50/95 px-4 py-3 shadow-sm backdrop-blur">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-950">
                Ticket · {ticket.type} · {ticket.dateYmd} · {ticket.status}
              </p>
              <p className="text-sm text-amber-900">{ticketTaskLabel(ticket)}</p>
              <p className="text-sm text-amber-900/80">{ticket.message}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {ticket.status === 'open' ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={resolving || patching}
                  onClick={() => void resolveTicketFromBanner()}
                >
                  {resolving ? 'Resolving…' : 'Mark complete & resolve'}
                </Button>
              ) : null}
              <Button type="button" size="sm" variant="outline" asChild>
                <Link to="/support">Back to tickets</Link>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={clearTicketContext}
              >
                Clear ticket focus
              </Button>
            </div>
            <p className="text-xs text-amber-800/80">
              Highlighted tasks are from this ticket. Mark complete &amp; resolve
              updates those habits and closes the ticket.
            </p>
          </div>
        ) : null}

        <MonthNavBar
          viewMonth={viewMonth}
          onPrev={goPrevMonth}
          onNext={goNextMonth}
        >
          <span className="font-semibold text-slate-800">
            {formatMonthTitle(viewMonth)}
          </span>
        </MonthNavBar>

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Button
              key={t}
              type="button"
              size="sm"
              variant={activeTab === t ? 'default' : 'outline'}
              onClick={() => setActiveTab(t)}
              className="capitalize"
            >
              {t}
            </Button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : !review ? (
          <p className="text-sm text-slate-500">
            No habit review for {formatMonthTitle(viewMonth)}.
          </p>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
            {(activeTab === 'daily' || activeTab === 'dated') && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <label className="text-sm text-slate-600" htmlFor="day">
                  Day
                </label>
                <Input
                  id="day"
                  type="number"
                  min={1}
                  max={daysInMonth}
                  inputMode="numeric"
                  className="w-24"
                  value={dayInput}
                  onChange={(e) => setDayInput(e.target.value)}
                  onBlur={commitDayInput}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      commitDayInput()
                    }
                  }}
                />
                <span className="text-xs text-slate-500">{selectedYmd}</span>
              </div>
            )}

            {activeTab === 'daily' && (
              <TaskList
                tasks={dailyTasks}
                disabled={patching}
                focusTaskIds={focusTaskIds}
                onToggle={(id, next) =>
                  void toggleTask('daily', id, next, selectedYmd)
                }
              />
            )}

            {activeTab === 'dated' && (
              <TaskList
                tasks={datedTasks}
                disabled={patching}
                focusTaskIds={focusTaskIds}
                empty="No dated extras for this day."
                onToggle={(id, next) =>
                  void toggleTask('daily', id, next, selectedYmd)
                }
              />
            )}

            {activeTab === 'weekly' && (
              <div className="space-y-6">
                {weeklySlots.length === 0 ? (
                  <p className="text-sm text-slate-500">No weekly slots.</p>
                ) : (
                  weeklySlots.map((slot) => (
                    <div
                      key={slot.dateYmd}
                      className={cn(
                        ticket?.dateYmd === slot.dateYmd &&
                          'rounded-lg ring-2 ring-amber-300 ring-offset-2',
                      )}
                    >
                      <p className="mb-2 text-sm font-medium text-slate-800">
                        Week of {slot.dateYmd}
                        {ticket?.dateYmd === slot.dateYmd ? (
                          <span className="ml-2 text-xs font-normal text-amber-700">
                            (ticket date)
                          </span>
                        ) : null}
                      </p>
                      <TaskList
                        tasks={slot.Task ?? []}
                        disabled={patching}
                        focusTaskIds={focusTaskIds}
                        onToggle={(id, next) =>
                          void toggleTask('weekly', id, next, slot.dateYmd)
                        }
                      />
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'monthly' && (
              <div>
                <p className="mb-2 text-sm text-slate-600">
                  Month end · {monthEndYmd}
                </p>
                <TaskList
                  tasks={monthlyTasks}
                  disabled={patching}
                  focusTaskIds={focusTaskIds}
                  onToggle={(id, next) =>
                    void toggleTask('monthly', id, next, monthEndYmd)
                  }
                />
              </div>
            )}
          </section>
        )}

        <Button variant="outline" size="sm" asChild>
          <Link to="/support">Back to Support</Link>
        </Button>
      </main>

      {toast ? <Toast message={toast.message} variant={toast.variant} /> : null}
    </div>
  )
}

function TaskList({
  tasks,
  onToggle,
  disabled,
  focusTaskIds,
  empty = 'No tasks.',
}) {
  if (!tasks?.length) {
    return <p className="text-sm text-slate-500">{empty}</p>
  }
  return (
    <ul className="space-y-2">
      {tasks.map((t) => {
        const id = t.subTaskId?.toString?.() ?? String(t.subTaskId)
        const fromTicket = focusTaskIds?.has?.(id)
        return (
          <li
            key={id}
            className={cn(
              'flex items-center gap-3 rounded-lg border px-3 py-2',
              fromTicket
                ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-300'
                : 'border-slate-100',
              t.isCompleted && !fromTicket && 'bg-emerald-50/60',
              t.isCompleted && fromTicket && 'bg-amber-100/80',
            )}
          >
            <HabitCompletionToggle
              checked={Boolean(t.isCompleted)}
              disabled={disabled}
              onChange={(next) => onToggle(id, next)}
              title={t.subTaskName}
            >
              <span className="text-sm text-slate-800">
                {t.subTaskName}
                {fromTicket ? (
                  <span className="ml-2 text-xs font-medium text-amber-800">
                    From ticket
                  </span>
                ) : null}
              </span>
            </HabitCompletionToggle>
          </li>
        )
      })}
    </ul>
  )
}
