import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Home,
  ListChecks,
  LogOut,
  Pencil,
  CirclePlus,
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
/** Five compact rows (2rem each + gaps + list padding). */
const TASK_LIST_H = 'h-[10.75rem]'

function formatYearMonth(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function formatMonthTitle(d) {
  return d.toLocaleString(undefined, { month: 'long', year: 'numeric' })
}

function toTaskPayload(items) {
  if (!Array.isArray(items)) return []
  return items
    .map((item) => {
      const taskName = (
        typeof item === 'string' ? item : (item?.taskName ?? '')
      ).trim()
      if (!taskName) return null
      const id =
        typeof item === 'object' && item?.id ? String(item.id) : undefined
      return id ? { _id: id, taskName } : { taskName }
    })
    .filter(Boolean)
}

function fromDocTasks(arr) {
  if (!Array.isArray(arr)) return []
  return arr
    .map((x) => {
      const taskName = typeof x?.taskName === 'string' ? x.taskName.trim() : ''
      if (!taskName) return null
      const id = x?._id != null ? String(x._id) : undefined
      return { id, taskName }
    })
    .filter(Boolean)
}

function totalPages(count) {
  return Math.max(1, Math.ceil(count / TASKS_PER_PAGE))
}

function TaskListPagination({ page, pages, disabled, onPageChange, accentClass }) {
  const atFirst = page <= 1
  const atLast = page >= pages
  const btnClass = 'h-7 w-7 shrink-0 p-0'

  return (
    <div
      className={cn(
        'flex h-9 shrink-0 items-center justify-between gap-1 rounded-lg border px-1.5 py-1 shadow-md',
        accentClass ??
          'border-slate-200/80 bg-white shadow-slate-200/50 dark:border-slate-600 dark:bg-slate-900',
      )}
      aria-label="Task list pagination"
    >
      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={btnClass}
          disabled={disabled || atFirst}
          onClick={() => onPageChange(1)}
          aria-label="First page"
          title="First page"
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={btnClass}
          disabled={disabled || atFirst}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
          title="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
      </div>
      <span className="min-w-[4.5rem] text-center text-[10px] font-semibold tabular-nums text-slate-700 dark:text-slate-200">
        {page} / {pages}
      </span>
      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={btnClass}
          disabled={disabled || atLast}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
          title="Next page"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={btnClass}
          disabled={disabled || atLast}
          onClick={() => onPageChange(pages)}
          aria-label="Last page"
          title="Last page"
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
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

    const next = [...tasks, { taskName: name }]
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
    if (tasks[index]?.taskName === trimmed) {
      setEditing(null)
      return
    }
    const next = tasks.map((t, i) =>
      i === index ? { ...t, taskName: trimmed } : t,
    )
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
      title: 'Daily',
      description: 'Every day',
      accent: 'from-rose-500 to-orange-500',
      ring: 'ring-rose-300/60',
      bg: 'bg-rose-50/90 dark:bg-rose-950/40',
      listBorder: 'border-rose-200/70',
      btn: 'bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-400 hover:to-orange-400',
      inputRing: 'focus-visible:ring-rose-400',
      paginationBar:
        'border-rose-300/80 bg-rose-50 ring-1 ring-rose-200/60 dark:border-rose-800 dark:bg-rose-950/90',
    },
    {
      key: 'weekly',
      title: 'Weekly',
      description: 'Each week',
      accent: 'from-emerald-500 to-teal-500',
      ring: 'ring-emerald-300/60',
      bg: 'bg-emerald-50/90 dark:bg-emerald-950/40',
      listBorder: 'border-emerald-200/70',
      btn: 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400',
      inputRing: 'focus-visible:ring-emerald-400',
      paginationBar:
        'border-emerald-300/80 bg-emerald-50 ring-1 ring-emerald-200/60 dark:border-emerald-800 dark:bg-emerald-950/90',
    },
    {
      key: 'monthly',
      title: 'Monthly',
      description: 'Month-end',
      accent: 'from-indigo-500 to-violet-500',
      ring: 'ring-indigo-300/60',
      bg: 'bg-indigo-50/90 dark:bg-indigo-950/40',
      listBorder: 'border-indigo-200/70',
      btn: 'bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400',
      inputRing: 'focus-visible:ring-indigo-400',
      paginationBar:
        'border-indigo-300/80 bg-indigo-50 ring-1 ring-indigo-200/60 dark:border-indigo-800 dark:bg-indigo-950/90',
    },
  ]

  const totalTaskCount = dailyTasks.length + weeklyTasks.length + monthlyTasks.length

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gradient-to-br from-violet-200/70 via-fuchsia-100/80 to-cyan-200/70">
      <header className="shrink-0 border-b border-white/40 bg-white/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/30">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-violet-950">Task Planner</p>
              <p className="truncate text-xs text-violet-800/70">Task Manager</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {user?.email ? (
              <span className="hidden max-w-[160px] truncate text-xs text-violet-900/80 lg:inline">
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
                <span className="ml-1 hidden sm:inline">Habits</span>
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-8 border-violet-300 bg-white/80 px-2"
            >
              <Link to="/" title="Home">
                <Home className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={signOut}
              className="h-8 gap-1 bg-violet-100 px-3 text-violet-900 hover:bg-violet-200"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-hidden px-5 py-4">
        {toast ? <Toast message={toast.message} variant={toast.variant} /> : null}

        <form
          onSubmit={onSave}
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden"
        >
          <div className="shrink-0 overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 p-px shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[11px] bg-white/95 px-4 py-3 backdrop-blur dark:bg-slate-950/95">
              <div className="flex min-w-0 items-center gap-2.5">
                <CalendarDays className="h-4 w-4 shrink-0 text-fuchsia-600" aria-hidden />
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-fuchsia-700">
                    Planning for
                  </p>
                  <h1 className="truncate text-lg font-bold leading-tight text-slate-900 dark:text-white">
                    {monthTitle}
                  </h1>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-violet-100 px-2.5 py-1 font-mono text-[11px] font-semibold text-violet-900 dark:bg-violet-950 dark:text-violet-100">
                  {monthKey}
                </span>
                <span className="rounded-lg bg-fuchsia-50 px-2.5 py-1 text-[11px] font-medium text-fuchsia-900 ring-1 ring-fuchsia-200/80 dark:bg-fuchsia-950/50 dark:text-fuchsia-100">
                  {totalTaskCount} task{totalTaskCount === 1 ? '' : 's'} total
                </span>
              </div>
            </div>
          </div>

          <p className="shrink-0 px-1 text-center text-xs text-violet-900/75 dark:text-violet-200/75">
            Add task names for each rhythm — saves automatically when you add, edit, or remove
          </p>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/70 bg-white/40 p-3 shadow-sm ring-1 ring-violet-200/50 backdrop-blur-sm dark:border-slate-800/50 dark:bg-slate-900/25">
            <div className="grid grid-cols-3 items-start gap-3">
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
                      'relative flex min-w-0 flex-col border-0 shadow-sm ring-1',
                      s.ring,
                    )}
                  >
                    <CardHeader
                      className={cn(
                        'shrink-0 space-y-0 bg-gradient-to-r px-3.5 py-2.5 text-white',
                        s.accent,
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <CardTitle className="text-sm font-bold leading-tight">
                            {s.title}
                          </CardTitle>
                          <CardDescription className="text-[11px] text-white/90">
                            {s.description}
                          </CardDescription>
                        </div>
                        <span className="rounded-md bg-white/25 px-2 py-0.5 text-xs font-semibold tabular-nums">
                          {tasks.length}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent
                      className={cn('flex flex-col gap-2 p-3 pb-12', s.bg)}
                    >
                      <div className="flex shrink-0 gap-2">
                        <Input
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          placeholder="Task name…"
                          disabled={loading || saving}
                          className={cn(
                            'h-9 flex-1 border-white/90 bg-white text-sm shadow-sm',
                            s.inputRing,
                          )}
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
                          disabled={loading || saving || !draft.trim()}
                          onClick={() => void onAdd(s.key)}
                          title="Add task"
                          aria-label="Add task"
                          className={cn(
                            'h-9 shrink-0 px-3 text-white shadow-sm',
                            s.btn,
                          )}
                        >
                          <CirclePlus className="h-[1.15rem] w-[1.15rem]" strokeWidth={2} />
                        </Button>
                      </div>

                      <ul
                        className={cn(
                          'shrink-0 space-y-0.5 overflow-hidden rounded-xl border bg-white/80 p-1.5 shadow-inner',
                          TASK_LIST_H,
                          s.listBorder,
                        )}
                      >
                        {loading ? (
                          <li
                            className={cn(
                              'flex h-full items-center justify-center text-xs text-slate-500',
                              TASK_LIST_H,
                            )}
                          >
                            Loading…
                          </li>
                        ) : pageTasks.length === 0 ? (
                          <li
                            className={cn(
                              'flex h-full flex-col items-center justify-center gap-1 px-2 text-center text-xs text-slate-500',
                              TASK_LIST_H,
                            )}
                          >
                            <span>No tasks yet</span>
                            <span className="text-[10px] opacity-80">Type above and press +</span>
                          </li>
                        ) : (
                          <>
                          {pageTasks.map((task, i) => {
                            const index = start + i
                            const isEditing =
                              editing?.section === s.key && editing?.index === index

                            return (
                              <li
                                key={`${s.key}-${task.id ?? index}-${task.taskName}`}
                                className="flex h-8 shrink-0 items-center gap-1 rounded-md border border-slate-200/60 bg-white px-1.5 py-0 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/80"
                              >
                                {isEditing ? (
                                  <Input
                                    autoFocus
                                    defaultValue={task.taskName}
                                    className={cn('h-7 flex-1 text-xs', s.inputRing)}
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
                                  <span className="flex-1 truncate text-xs font-medium text-slate-800 dark:text-slate-100">
                                    {task.taskName}
                                  </span>
                                )}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 shrink-0 p-0 text-violet-600 hover:bg-violet-50"
                                  disabled={loading || saving}
                                  onClick={() => setEditing({ section: s.key, index })}
                                  aria-label="Edit task"
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 shrink-0 p-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                                  disabled={loading || saving}
                                  onClick={() => void onRemove(s.key, index)}
                                  aria-label="Delete task"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </li>
                            )
                          })}
                          {pageTasks.length < TASKS_PER_PAGE &&
                            Array.from({
                              length: TASKS_PER_PAGE - pageTasks.length,
                            }).map((_, padIdx) => (
                              <li
                                key={`${s.key}-pad-${padIdx}`}
                                className="h-8 shrink-0 rounded-md border border-transparent"
                                aria-hidden
                              />
                            ))}
                          </>
                        )}
                      </ul>
                    </CardContent>

                    {tasks.length > 0 ? (
                      <div className="absolute inset-x-3 bottom-3 z-10">
                        <TaskListPagination
                          page={page}
                          pages={pages}
                          disabled={loading || saving}
                          accentClass={s.paginationBar}
                          onPageChange={(nextPage) =>
                            setListPage((p) => ({
                              ...p,
                              [s.key]: Math.min(
                                pages,
                                Math.max(1, nextPage),
                              ),
                            }))
                          }
                        />
                      </div>
                    ) : null}
                  </Card>
                )
              })}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-white/60 bg-white/55 px-4 py-3 ring-1 ring-violet-200/40 backdrop-blur-sm">
            <p className="max-w-xl text-xs leading-relaxed text-violet-900/80 dark:text-violet-100/80">
              {existingId
                ? `Plan active for ${monthTitle}. Edits save on blur; trash removes immediately.`
                : `No saved plan for ${monthTitle} yet — add tasks, then sync below.`}
            </p>
            <Button
              type="submit"
              size="sm"
              disabled={loading || saving || totalTaskCount === 0}
              className="h-9 shrink-0 px-5 text-sm bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-sm hover:from-violet-500 hover:to-fuchsia-500"
            >
              {saving ? 'Saving…' : existingId ? 'Sync month plan' : 'Save month plan'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
