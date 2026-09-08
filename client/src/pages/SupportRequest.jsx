import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LifeBuoy } from 'lucide-react'
import AppPageHeader from '@/components/layout/AppPageHeader'
import MonthNavBar, { addMonths } from '@/components/tasks/MonthNavBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Toast, TOAST_DURATION_MS } from '@/components/ui/toast'
import { clearSession, getStoredUser } from '@/lib/auth-api'
import {
  buildDatedSubTaskMap,
  dayYmdInMonth,
  formatDateYmd,
  matchesReviewSlotYmd,
  monthDateBounds,
  sundayYmdsInMonth,
} from '@/lib/dated-tasks'
import { reviewRequest } from '@/lib/review-api'
import { supportRequest } from '@/lib/support-api'
import { tasksRequest } from '@/lib/tasks-api'

function formatYearMonth(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function formatMonthTitle(d) {
  return d.toLocaleString(undefined, { month: 'long', year: 'numeric' })
}

function ticketTaskLabel(ticket) {
  if (Array.isArray(ticket?.tasks) && ticket.tasks.length > 0) {
    return ticket.tasks.map((x) => x.subTaskName).filter(Boolean).join(', ')
  }
  return ticket?.subTaskName || 'Task'
}

export default function SupportRequest() {
  const navigate = useNavigate()
  const [user] = useState(getStoredUser)
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const monthKey = useMemo(() => formatYearMonth(viewMonth), [viewMonth])
  const [plan, setPlan] = useState(null)
  const [review, setReview] = useState(null)
  const [myTickets, setMyTickets] = useState([])
  const [type, setType] = useState('daily')
  const [dayInput, setDayInput] = useState('1')
  const [sundayYmd, setSundayYmd] = useState('')
  const [selectedTaskIds, setSelectedTaskIds] = useState([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)

  const daysInMonth = useMemo(() => {
    const [y, m] = monthKey.split('-').map(Number)
    return new Date(y, m, 0).getDate()
  }, [monthKey])

  const day = useMemo(() => {
    const n = Number(dayInput)
    if (!Number.isFinite(n) || n < 1) return 1
    return Math.min(daysInMonth, Math.floor(n))
  }, [dayInput, daysInMonth])

  useEffect(() => {
    const n = Number(dayInput)
    if (Number.isFinite(n) && n > daysInMonth) {
      setDayInput(String(daysInMonth))
    }
  }, [daysInMonth, dayInput])

  const weeklySundayOptions = useMemo(
    () => sundayYmdsInMonth(monthKey),
    [monthKey],
  )

  useEffect(() => {
    setSundayYmd(weeklySundayOptions[0] ?? '')
  }, [weeklySundayOptions])

  const dateYmd = useMemo(() => {
    if (type === 'monthly') return monthDateBounds(monthKey).max
    if (type === 'weekly') return sundayYmd || weeklySundayOptions[0] || monthDateBounds(monthKey).min
    return dayYmdInMonth(monthKey, day)
  }, [type, monthKey, day, sundayYmd, weeklySundayOptions])

  function commitDayInput() {
    setDayInput(String(day))
  }

  function showToast(messageText, variant = 'success') {
    setToast({ message: messageText, variant })
    window.setTimeout(() => setToast(null), TOAST_DURATION_MS)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tasksRes, reviewRes, ticketsRes] = await Promise.all([
        tasksRequest(`/get-tasks?month=${monthKey}`),
        reviewRequest(`/get-user-review-task?month=${monthKey}`),
        supportRequest('/tickets/mine'),
      ])
      const planDoc = tasksRes.data?.task ?? tasksRes.data?.tasks?.[0] ?? null
      setPlan(planDoc)
      const reviewDoc =
        reviewRes.data?.task ?? reviewRes.data?.tasks?.[0] ?? null
      setReview(reviewDoc?._id ? reviewDoc : null)
      setMyTickets(Array.isArray(ticketsRes.data) ? ticketsRes.data : [])
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to load', 'error')
    } finally {
      setLoading(false)
    }
  }, [monthKey])

  useEffect(() => {
    void load()
  }, [load])

  const taskOptions = useMemo(() => {
    if (!review) return []

    const incompleteOnly = (list) =>
      (list ?? [])
        .filter((t) => !t.isCompleted)
        .map((t) => {
          const id = t.subTaskId?.toString?.() ?? String(t.subTaskId)
          return { id, name: t.subTaskName, raw: t }
        })

    if (type === 'monthly') {
      return incompleteOnly(review.MonthlyTasks?.Task).map(({ id, name }) => ({
        id,
        name,
      }))
    }
    if (type === 'weekly') {
      const sundays = sundayYmdsInMonth(monthKey)
      const slot = (review.WeeklyTasks ?? []).find((e) => {
        const ymd =
          sundays.find((s) => matchesReviewSlotYmd(new Date(e.sundayDate), s)) ??
          formatDateYmd(new Date(e.sundayDate))
        return ymd === dateYmd
      })
      return incompleteOnly(slot?.Task).map(({ id, name }) => ({ id, name }))
    }
    const slot = (review.DailyTasks ?? []).find((e) =>
      matchesReviewSlotYmd(new Date(e.todayDate), dateYmd),
    )
    const datedMap = buildDatedSubTaskMap(plan?.DatedTasks)
    return incompleteOnly(slot?.Task).map(({ id, name }) => {
      const dated = datedMap.get(id)
      return {
        id,
        name: dated ? `${name} (extra)` : name,
      }
    })
  }, [review, plan, type, dateYmd, monthKey])

  useEffect(() => {
    const valid = new Set(taskOptions.map((t) => t.id))
    setSelectedTaskIds((prev) => prev.filter((id) => valid.has(id)))
  }, [taskOptions])

  function toggleTaskId(id) {
    setSelectedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function toggleAllTasks() {
    if (selectedTaskIds.length === taskOptions.length) {
      setSelectedTaskIds([])
      return
    }
    setSelectedTaskIds(taskOptions.map((t) => t.id))
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (!review?._id || selectedTaskIds.length === 0 || !message.trim()) {
      showToast('Pick at least one task and enter a message', 'error')
      return
    }
    const selected = taskOptions.filter((t) => selectedTaskIds.includes(t.id))
    setSubmitting(true)
    try {
      await supportRequest('/tickets', {
        method: 'POST',
        body: JSON.stringify({
          reviewTaskId: review._id,
          type: type === 'dated' ? 'daily' : type,
          dateYmd,
          tasks: selected.map((t) => ({
            subTaskId: t.id,
            subTaskName: t.name ?? 'Task',
          })),
          message: message.trim(),
        }),
      })
      setMessage('')
      setSelectedTaskIds([])
      showToast('Support request submitted')
      const ticketsRes = await supportRequest('/tickets/mine')
      setMyTickets(Array.isArray(ticketsRes.data) ? ticketsRes.data : [])
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Submit failed', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function revokeTicket(ticketId) {
    if (!ticketId) return
    try {
      await supportRequest(`/tickets/${ticketId}/cancel`, {
        method: 'PATCH',
      })
      showToast('Request revoked')
      const ticketsRes = await supportRequest('/tickets/mine')
      setMyTickets(Array.isArray(ticketsRes.data) ? ticketsRes.data : [])
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Revoke failed', 'error')
    }
  }

  function signOut() {
    clearSession()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-100 via-white to-cyan-100">
      <AppPageHeader
        title="Contact support"
        subtitle={user?.email ?? ''}
        icon={LifeBuoy}
        onSignOut={signOut}
        backTo="/habits"
        maxWidthClass="max-w-3xl"
      />

      <main className="mx-auto max-w-3xl space-y-6 px-5 py-8">
        <p className="text-sm text-slate-600">
          Forgot to mark a habit? Send a request and the support team can mark
          it for you.
        </p>

        <MonthNavBar
          viewMonth={viewMonth}
          onPrev={() => setViewMonth((m) => addMonths(m, -1))}
          onNext={() => setViewMonth((m) => addMonths(m, 1))}
        >
          <span className="font-semibold text-slate-800">
            {formatMonthTitle(viewMonth)}
          </span>
        </MonthNavBar>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm"
        >
          <div className="space-y-1.5">
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {type === 'daily' ? (
            <div className="space-y-1.5">
              <Label htmlFor="day">Day of month</Label>
              <Input
                id="day"
                type="number"
                min={1}
                max={daysInMonth}
                inputMode="numeric"
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
              <p className="text-xs text-slate-500">{dateYmd}</p>
            </div>
          ) : null}

          {type === 'weekly' ? (
            <div className="space-y-1.5">
              <Label htmlFor="sunday">Sunday</Label>
              <select
                id="sunday"
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                value={sundayYmd}
                onChange={(e) => setSundayYmd(e.target.value)}
              >
                {weeklySundayOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {type === 'monthly' ? (
            <p className="text-xs text-slate-500">Date: {dateYmd}</p>
          ) : null}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label>Task</Label>
              {taskOptions.length > 0 ? (
                <button
                  type="button"
                  className="text-xs font-medium text-violet-700 hover:underline"
                  onClick={toggleAllTasks}
                >
                  {selectedTaskIds.length === taskOptions.length
                    ? 'Clear all'
                    : 'Select all'}
                </button>
              ) : null}
            </div>
            {taskOptions.length === 0 ? (
              <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                No incomplete tasks for this date
              </p>
            ) : (
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-slate-200 bg-white p-2">
                {taskOptions.map((t) => {
                  const checked = selectedTaskIds.includes(t.id)
                  return (
                    <li key={t.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-violet-50">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-violet-600"
                          checked={checked}
                          disabled={loading}
                          onChange={() => toggleTaskId(t.id)}
                        />
                        <span className="text-slate-800">{t.name}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
            <p className="text-xs text-slate-500">
              {selectedTaskIds.length === 0
                ? 'Select one or more tasks'
                : `${selectedTaskIds.length} selected`}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="message">Message</Label>
            <textarea
              id="message"
              className="min-h-[100px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="I completed this habit but forgot to mark it."
              required
              maxLength={2000}
            />
          </div>

          <Button type="submit" disabled={submitting || loading || !review}>
            {submitting ? 'Submitting…' : 'Submit request'}
          </Button>
        </form>

        <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            My requests
          </h2>
          {myTickets.length === 0 ? (
            <p className="text-sm text-slate-500">No requests yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {myTickets.map((t) => {
                const id = t.id ?? t._id
                const taskLabel = ticketTaskLabel(t)
                return (
                  <li
                    key={id}
                    className="flex flex-wrap items-start justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-medium text-slate-900">
                        {taskLabel} · {t.dateYmd}
                      </p>
                      <p className="text-xs text-slate-500">
                        {t.status} · {t.type}
                        {Array.isArray(t.tasks) && t.tasks.length > 1
                          ? ` · ${t.tasks.length} tasks`
                          : ''}
                      </p>
                      <p className="text-xs text-slate-600">{t.message}</p>
                    </div>
                    {t.status === 'open' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => revokeTicket(id)}
                      >
                        Revoke
                      </Button>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <Button variant="outline" size="sm" asChild>
          <Link to="/habits">Back to Habits</Link>
        </Button>
      </main>

      {toast ? <Toast message={toast.message} variant={toast.variant} /> : null}
    </div>
  )
}
