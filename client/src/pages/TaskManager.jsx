import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Home,
  ListChecks,
  LogOut,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Toast, TOAST_DURATION_MS } from '@/components/ui/toast'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { clearSession, getStoredUser } from '@/lib/auth-api'
import { tasksRequest } from '@/lib/tasks-api'
import { cn } from '@/lib/utils'

const TASKS_PER_PAGE = 5

function formatYearMonth(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function formatMonthTitle(d) {
  return d.toLocaleString(undefined, { month: 'long', year: 'numeric' })
}

function toTaskPayload(names) {
  return names
    .map((s) => s.trim())
    .filter(Boolean)
    .map((taskName) => ({ taskName }))
}

function fromDocTasks(arr) {
  if (!Array.isArray(arr)) return []
  return arr
    .map((x) => (typeof x?.taskName === 'string' ? x.taskName : ''))
    .filter(Boolean)
}

function totalPages(count) {
  return Math.max(1, Math.ceil(count / TASKS_PER_PAGE))
}

export default function TaskManager() {
  const navigate = useNavigate()
  const [user] = useState(getStoredUser)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [editing, setEditing] = useState(null)

  const showToast = (message, variant = 'success') => {
    setToast({ message, variant })
  }

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(null), TOAST_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  const today = useMemo(() => new Date(), [])
  const monthKey = useMemo(() => formatYearMonth(today), [today])
  const monthTitle = useMemo(() => formatMonthTitle(today), [today])

  const [existingId, setExistingId] = useState(null)
  const [dailyTasks, setDailyTasks] = useState([])
  const [weeklyTasks, setWeeklyTasks] = useState([])
  const [monthlyTasks, setMonthlyTasks] = useState([])
  const [dailyDraft, setDailyDraft] = useState('')
  const [weeklyDraft, setWeeklyDraft] = useState('')
  const [monthlyDraft, setMonthlyDraft] = useState('')
  const [listPage, setListPage] = useState({ daily: 1, weekly: 1, monthly: 1 })

  useEffect(() => {
    let cancelled = false

    async function loadMonthPlan() {
      setLoading(true)
      try {
        const res = await tasksRequest('/get-tasks?page=1&limit=50')
        if (cancelled) return
        const list = res.data?.tasks ?? []
        const hit = list.find((t) => t.currentMonthAndYear === monthKey)
        if (hit?._id) {
          setExistingId(hit._id)
          setDailyTasks(fromDocTasks(hit.DailyTasks))
          setWeeklyTasks(fromDocTasks(hit.WeeklyTasks))
          setMonthlyTasks(fromDocTasks(hit.MonthlyTasks))
        } else {
          setExistingId(null)
          setDailyTasks([])
          setWeeklyTasks([])
          setMonthlyTasks([])
        }
        setListPage({ daily: 1, weekly: 1, monthly: 1 })
      } catch (e) {
        if (!cancelled) {
          showToast(e instanceof Error ? e.message : 'Could not load tasks', 'error')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadMonthPlan()
    return () => {
      cancelled = true
    }
  }, [monthKey])

  function signOut() {
    clearSession()
    navigate('/login', { replace: true })
  }

  function applyPlanFromHit(hit, options = {}) {
    const { lastPageSection } = options

    if (hit?._id) {
      setExistingId(hit._id)
      setDailyTasks(fromDocTasks(hit.DailyTasks))
      setWeeklyTasks(fromDocTasks(hit.WeeklyTasks))
      setMonthlyTasks(fromDocTasks(hit.MonthlyTasks))
    } else {
      setExistingId(null)
      setDailyTasks([])
      setWeeklyTasks([])
      setMonthlyTasks([])
    }

    const counts = {
      daily: hit?._id ? fromDocTasks(hit.DailyTasks).length : 0,
      weekly: hit?._id ? fromDocTasks(hit.WeeklyTasks).length : 0,
      monthly: hit?._id ? fromDocTasks(hit.MonthlyTasks).length : 0,
    }

    setListPage((prev) => ({
      daily:
        lastPageSection === 'daily'
          ? totalPages(counts.daily)
          : Math.min(prev.daily, totalPages(counts.daily)),
      weekly:
        lastPageSection === 'weekly'
          ? totalPages(counts.weekly)
          : Math.min(prev.weekly, totalPages(counts.weekly)),
      monthly:
        lastPageSection === 'monthly'
          ? totalPages(counts.monthly)
          : Math.min(prev.monthly, totalPages(counts.monthly)),
    }))
  }

  async function refetchMonthPlan(options = {}) {
    const res = await tasksRequest('/get-tasks?page=1&limit=50')
    const list = res.data?.tasks ?? []
    const hit = list.find((t) => t.currentMonthAndYear === monthKey)
    applyPlanFromHit(hit, options)
    return hit
  }

  function buildPayload(lists) {
    return {
      DailyTasks: toTaskPayload(lists.daily),
      WeeklyTasks: toTaskPayload(lists.weekly),
      MonthlyTasks: toTaskPayload(lists.monthly),
    }
  }

  function isPayloadEmpty(body) {
    return (
      body.DailyTasks.length === 0 &&
      body.WeeklyTasks.length === 0 &&
      body.MonthlyTasks.length === 0
    )
  }

  async function persistLists(lists, options = {}) {
    const body = buildPayload(lists)
    if (isPayloadEmpty(body)) {
      throw new Error('Add at least one task somewhere.')
    }

    setSaving(true)
    try {
      if (existingId) {
        await tasksRequest(`/update-task/${existingId}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      } else {
        await tasksRequest('/add-tasks', {
          method: 'POST',
          body: JSON.stringify(body),
        })
      }
      await refetchMonthPlan(options)
    } finally {
      setSaving(false)
    }
  }

  function getSectionState(section) {
    if (section === 'daily') {
      return {
        tasks: dailyTasks,
        setTasks: setDailyTasks,
        draft: dailyDraft,
        setDraft: setDailyDraft,
      }
    }
    if (section === 'weekly') {
      return {
        tasks: weeklyTasks,
        setTasks: setWeeklyTasks,
        draft: weeklyDraft,
        setDraft: setWeeklyDraft,
      }
    }
    return {
      tasks: monthlyTasks,
      setTasks: setMonthlyTasks,
      draft: monthlyDraft,
      setDraft: setMonthlyDraft,
    }
  }

  function currentLists() {
    return { daily: dailyTasks, weekly: weeklyTasks, monthly: monthlyTasks }
  }

  async function onAdd(section) {
    const { tasks, setTasks, draft, setDraft } = getSectionState(section)
    const name = draft.trim()
    if (!name) return

    const next = [...tasks, name]
    setTasks(next)
    setDraft('')
    setListPage((p) => ({
      ...p,
      [section]: totalPages(next.length),
    }))

    try {
      await persistLists({ ...currentLists(), [section]: next }, { lastPageSection: section })
      showToast('Task added', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save', 'error')
      await refetchMonthPlan({ lastPageSection: section })
    }
  }

  async function onRemove(section, index) {
    const { tasks, setTasks } = getSectionState(section)
    const next = tasks.filter((_, i) => i !== index)
    setTasks(next)
    setListPage((p) => ({
      ...p,
      [section]: Math.min(p[section], totalPages(next.length)),
    }))
    setEditing((e) => (e?.section === section && e?.index === index ? null : e))

    if (!existingId && next.length === 0) {
      const lists = { ...currentLists(), [section]: next }
      if (
        lists.daily.length === 0 &&
        lists.weekly.length === 0 &&
        lists.monthly.length === 0
      ) {
        return
      }
    }

    try {
      await persistLists({ ...currentLists(), [section]: next })
      showToast('Task removed', 'remove')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save', 'error')
      await refetchMonthPlan()
    }
  }

  async function onSaveEdit(section, index, value) {
    const trimmed = value.trim()
    if (!trimmed) {
      showToast('Task name cannot be empty', 'error')
      return
    }
    const { tasks, setTasks } = getSectionState(section)
    if (tasks[index] === trimmed) {
      setEditing(null)
      return
    }
    const next = tasks.map((t, i) => (i === index ? trimmed : t))
    setTasks(next)
    setEditing(null)

    try {
      await persistLists({ ...currentLists(), [section]: next })
      showToast('Task updated', 'warning')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save', 'error')
      await refetchMonthPlan()
    }
  }

  async function onSave(e) {
    e.preventDefault()
    const wasNewPlan = !existingId
    try {
      await persistLists(currentLists())
      showToast(
        wasNewPlan ? 'Plan saved for this month' : 'Month plan updated',
        'info',
      )
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save plan', 'error')
    }
  }

  const sections = [
    {
      key: 'daily',
      title: 'Daily tasks',
      description: 'Small wins every day',
      accent: 'from-rose-500 to-orange-500',
      ring: 'ring-rose-400/40',
      bg: 'bg-rose-50/80 dark:bg-rose-950/30',
      listBorder: 'border-rose-200/80',
    },
    {
      key: 'weekly',
      title: 'Weekly tasks',
      description: 'Milestones for the week',
      accent: 'from-emerald-500 to-teal-500',
      ring: 'ring-emerald-400/40',
      bg: 'bg-emerald-50/80 dark:bg-emerald-950/30',
      listBorder: 'border-emerald-200/80',
    },
    {
      key: 'monthly',
      title: 'Monthly tasks',
      description: 'Big-picture goals',
      accent: 'from-indigo-500 to-violet-500',
      ring: 'ring-indigo-400/40',
      bg: 'bg-indigo-50/80 dark:bg-indigo-950/30',
      listBorder: 'border-indigo-200/80',
    },
  ]

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gradient-to-br from-violet-200/70 via-fuchsia-100/80 to-cyan-200/70">
      <header className="shrink-0 border-b border-white/40 bg-white/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/30">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-violet-950">Task Planner</p>
              <p className="truncate text-xs text-violet-800/70">Your colorful command center</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {user?.email ? (
              <span className="hidden max-w-[140px] truncate text-xs text-violet-900/80 lg:inline">
                {user.email}
              </span>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-8 border-violet-300 bg-white/80 px-2"
            >
              <Link to="/habits" title="Habit Tracker">
                <ListChecks className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">Habits</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="h-8 border-violet-300 bg-white/80 px-2">
              <Link to="/">
                <Home className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={signOut}
              className="h-8 gap-1 bg-violet-100 px-2 text-violet-900 hover:bg-violet-200"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-hidden px-4 py-2">
        {toast ? <Toast message={toast.message} variant={toast.variant} /> : null}

        <form
          onSubmit={onSave}
          className="mx-auto flex min-h-0 w-full max-w-[840px] flex-1 flex-col overflow-hidden"
        >
          <div className="mb-2 shrink-0 overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 p-px shadow-md">
            <div className="flex items-center justify-between gap-2 rounded-[11px] bg-white/95 px-2.5 py-1.5 backdrop-blur dark:bg-slate-950/95">
              <div className="flex min-w-0 items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-fuchsia-600" aria-hidden />
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-fuchsia-700">
                    Current month
                  </p>
                  <h1 className="truncate text-base font-bold leading-tight text-slate-900 dark:text-white">
                    {monthTitle}
                  </h1>
                </div>
              </div>
              <span className="shrink-0 rounded-md bg-violet-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-violet-900 dark:bg-violet-950 dark:text-violet-100">
                {monthKey}
              </span>
            </div>
          </div>

          <div className="flex min-h-2 flex-1 flex-col overflow-hidden pb-2 pt-10">
            <div className="grid w-full grid-cols-3 gap-3">
              {sections.map((s) => {
                const { tasks, draft, setDraft } = getSectionState(s.key)
                const page = listPage[s.key]
                const pages = totalPages(tasks.length)
                const start = (page - 1) * TASKS_PER_PAGE
                const pageTasks = tasks.slice(start, start + TASKS_PER_PAGE)

                return (
                  <Card
                    key={s.key}
                    className={cn(
                      'flex h-[320px] min-w-0 flex-col overflow-hidden border-0 shadow-md ring-1',
                      s.ring,
                    )}
                  >
                    <CardHeader
                      className={cn(
                        'shrink-0 space-y-0.5 bg-gradient-to-r px-3 py-2.5 text-white',
                        s.accent,
                      )}
                    >
                      <CardTitle className="text-base leading-tight">{s.title}</CardTitle>
                      <CardDescription className="text-xs leading-tight text-white/90">
                        {s.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent
                      className={cn('flex min-h-0 flex-1 flex-col gap-2 p-2.5', s.bg)}
                    >
                      <div className="flex shrink-0 gap-1">
                        <Input
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          placeholder="Add a task…"
                          disabled={loading || saving}
                          className="h-8 flex-1 border-white/80 bg-white/90 text-sm"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              void onAdd(s.key)
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 shrink-0 px-2"
                          disabled={loading || saving || !draft.trim()}
                          onClick={() => void onAdd(s.key)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>

                      <ul
                        className={cn(
                          'min-h-0 flex-1 space-y-1.5 overflow-y-auto rounded-lg border bg-white/70 p-2 dark:bg-slate-900/40',
                          s.listBorder,
                        )}
                      >
                        {loading ? (
                          <li className="py-6 text-center text-xs text-slate-500">Loading…</li>
                        ) : pageTasks.length === 0 ? (
                          <li className="py-6 text-center text-xs text-slate-500">
                            No tasks yet
                          </li>
                        ) : (
                          pageTasks.map((task, i) => {
                            const index = start + i
                            const isEditing =
                              editing?.section === s.key && editing?.index === index

                            return (
                              <li
                                key={`${s.key}-${index}-${task}`}
                                className="flex items-center gap-1 rounded-md border border-transparent bg-white/60 px-2 py-1.5 dark:bg-slate-800/60"
                              >
                                {isEditing ? (
                                  <Input
                                    autoFocus
                                    defaultValue={task}
                                    className="h-7 flex-1 text-sm"
                                    disabled={saving}
                                    onBlur={(e) =>
                                      void onSaveEdit(s.key, index, e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault()
                                        void onSaveEdit(s.key, index, e.currentTarget.value)
                                      }
                                      if (e.key === 'Escape') setEditing(null)
                                    }}
                                  />
                                ) : (
                                  <span className="flex-1 truncate text-sm text-slate-800 dark:text-slate-100">
                                    {task}
                                  </span>
                                )}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 shrink-0 p-0 text-violet-700"
                                  disabled={loading || saving}
                                  onClick={() => setEditing({ section: s.key, index })}
                                  aria-label="Edit task"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 shrink-0 p-0 text-red-600 hover:text-red-700"
                                  disabled={loading || saving}
                                  onClick={() => void onRemove(s.key, index)}
                                  aria-label="Delete task"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </li>
                            )
                          })
                        )}
                      </ul>

                      {tasks.length > TASKS_PER_PAGE ? (
                        <div className="flex shrink-0 items-center justify-between gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2"
                            disabled={page <= 1}
                            onClick={() =>
                              setListPage((p) => ({
                                ...p,
                                [s.key]: Math.max(1, page - 1),
                              }))
                            }
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-xs text-violet-900/80">
                            {page} / {pages}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2"
                            disabled={page >= pages}
                            onClick={() =>
                              setListPage((p) => ({
                                ...p,
                                [s.key]: Math.min(pages, page + 1),
                              }))
                            }
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          <div className="mt-2 shrink-0 space-y-1.5 pb-1">
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={loading || saving}
                className="h-8 px-5 text-sm bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-sm hover:from-violet-500 hover:to-fuchsia-500"
              >
                {saving ? 'Saving…' : 'Update this month'}
              </Button>
            </div>
            <p className="text-right text-[11px] leading-snug text-violet-900/70">
              {existingId
                ? `You already have a plan for ${monthTitle}. Trash deletes a task immediately; pencil edits save on blur.`
                : `No plan for ${monthTitle} yet. Add tasks and click Update this month to save.`}
            </p>
          </div>
        </form>
      </main>
    </div>
  )
}
