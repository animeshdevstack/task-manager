import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, Shield } from 'lucide-react'
import AppPageHeader from '@/components/layout/AppPageHeader'
import { HabitCompletionToggle } from '@/components/habits/HabitCompletionToggle'
import DatedDatePicker from '@/components/tasks/DatedDatePicker'
import MonthNavBar, { addMonths } from '@/components/tasks/MonthNavBar'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useToday } from '@/hooks/useToday'
import {
  buildDatedSubTaskMap,
  defaultSelectedDateForMonth,
  formatDateYmd,
  monthDateBounds,
  shiftDateYmd,
} from '@/lib/dated-tasks'
import { getHabitRowTheme } from '@/lib/daily-grid-theme'
import { clearSession } from '@/lib/auth-api'
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

function formatDateLabel(d) {
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function isDateInMonth(date, viewMonth) {
  const d = new Date(date)
  return (
    d.getFullYear() === viewMonth.getFullYear() &&
    d.getMonth() === viewMonth.getMonth()
  )
}

function displayName(u) {
  const name = [u?.Fname, u?.Lname].filter(Boolean).join(' ').trim()
  return name || u?.email || 'User'
}

function collectPrivateIds(plan) {
  const ids = new Set()
  if (!plan) return ids
  for (const list of [plan.DailyTasks, plan.WeeklyTasks, plan.MonthlyTasks]) {
    for (const item of list ?? []) {
      if (item.isPrivate && item._id) {
        ids.add(item._id.toString?.() ?? String(item._id))
      }
    }
  }
  for (const group of plan.DatedTasks ?? []) {
    for (const item of group.tasks ?? []) {
      if (item.isPrivate && item._id) {
        ids.add(item._id.toString?.() ?? String(item._id))
      }
    }
  }
  return ids
}

const TABS = [
  {
    key: 'daily',
    title: 'Daily habits',
    description: 'Read-only · full month grid',
    accent: 'from-rose-500 to-orange-500',
    ring: 'ring-rose-400/40',
    bg: 'bg-rose-50/80 dark:bg-rose-950/30',
  },
  {
    key: 'weekly',
    title: 'Weekly habits',
    description: 'Read-only · Sundays in month',
    accent: 'from-emerald-500 to-teal-500',
    ring: 'ring-emerald-400/40',
    bg: 'bg-emerald-50/80 dark:bg-emerald-950/30',
  },
  {
    key: 'monthly',
    title: 'Monthly habits',
    description: 'Read-only · end-of-month goals',
    accent: 'from-indigo-500 to-violet-500',
    ring: 'ring-indigo-400/40',
    bg: 'bg-indigo-50/80 dark:bg-indigo-950/30',
  },
  {
    key: 'dated',
    title: 'Add-ons',
    description: 'Read-only · day-specific tasks',
    accent: 'from-sky-500 to-blue-500',
    ring: 'ring-sky-400/40',
    bg: 'bg-sky-50/80 dark:bg-sky-950/30',
  },
]

function PrivateBadge({ show }) {
  if (!show) return null
  return (
    <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800">
      Private
    </span>
  )
}

export default function AdminUserHabits() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [target, setTarget] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [review, setReview] = useState(null)
  const [plan, setPlan] = useState(null)
  const [hasPlan, setHasPlan] = useState(false)
  const [includePrivate, setIncludePrivate] = useState(false)
  const [activeTab, setActiveTab] = useState('daily')
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedHabitDate, setSelectedHabitDate] = useState(() =>
    defaultSelectedDateForMonth(formatYearMonth(new Date()), new Date()),
  )

  const today = useToday()
  const monthKey = useMemo(() => formatYearMonth(viewMonth), [viewMonth])
  const monthTitle = useMemo(() => formatMonthTitle(viewMonth), [viewMonth])
  const isViewingCurrentMonth = monthKey === formatYearMonth(today)
  const viewMonthBounds = useMemo(() => monthDateBounds(monthKey), [monthKey])
  const privateIds = useMemo(
    () => (includePrivate ? collectPrivateIds(plan) : new Set()),
    [includePrivate, plan],
  )

  const datedSubTaskMap = useMemo(
    () => buildDatedSubTaskMap(plan?.DatedTasks),
    [plan],
  )

  useEffect(() => {
    setSelectedHabitDate((prev) => {
      const { min, max } = viewMonthBounds
      if (prev >= min && prev <= max) return prev
      return defaultSelectedDateForMonth(monthKey, today)
    })
  }, [monthKey, today, viewMonthBounds])

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const privateQs = includePrivate ? 'true' : 'false'
      const [userRes, tasksRes, reviewRes] = await Promise.all([
        supportRequest(`/users/${userId}`),
        supportRequest(
          `/users/${userId}/add-tasks?month=${encodeURIComponent(monthKey)}&includePrivate=${privateQs}`,
        ),
        supportRequest(
          `/users/${userId}/review-tasks?month=${encodeURIComponent(monthKey)}&includePrivate=${privateQs}`,
        ),
      ])
      setTarget(userRes.data)
      const planDoc = tasksRes.data?.task ?? tasksRes.data?.tasks?.[0] ?? null
      if (!planDoc?._id) {
        setHasPlan(false)
        setPlan(null)
        setReview(null)
        return
      }
      setHasPlan(true)
      setPlan(planDoc)
      const reviewDoc =
        reviewRes.data?.task ?? reviewRes.data?.tasks?.[0] ?? null
      setReview(reviewDoc?._id ? reviewDoc : null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load habits')
      setHasPlan(false)
      setPlan(null)
      setReview(null)
    } finally {
      setLoading(false)
    }
  }, [userId, monthKey, includePrivate])

  useEffect(() => {
    void load()
  }, [load])

  const dailyGrid = useMemo(() => {
    if (!review?.DailyTasks?.length) {
      return {
        days: [],
        tasks: [],
        getCell: () => null,
        todayDay: null,
        isViewingCurrentMonth,
      }
    }
    const [year, monthNum] = monthKey.split('-').map(Number)
    const monthIndex = monthNum - 1
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

    const slotByDay = new Map()
    for (const entry of review.DailyTasks) {
      const d = new Date(entry.todayDate)
      if (d.getFullYear() === year && d.getMonth() === monthIndex) {
        slotByDay.set(d.getDate(), entry)
      }
    }

    const taskMap = new Map()
    for (const entry of review.DailyTasks) {
      for (const t of entry.Task ?? []) {
        const id = t.subTaskId?.toString?.() ?? String(t.subTaskId)
        if (datedSubTaskMap.has(id)) continue
        if (!taskMap.has(id)) taskMap.set(id, t.subTaskName)
      }
    }
    const tasks = [...taskMap.entries()].map(([id, name]) => ({ id, name }))

    const getCell = (taskId, day) => {
      const slot = slotByDay.get(day)
      if (!slot) return null
      const match = (slot.Task ?? []).find(
        (t) => (t.subTaskId?.toString?.() ?? String(t.subTaskId)) === taskId,
      )
      if (!match) return null
      return { isCompleted: match.isCompleted }
    }

    const todayDay = isViewingCurrentMonth ? today.getDate() : null
    return { days, tasks, getCell, todayDay, isViewingCurrentMonth }
  }, [review, monthKey, today, isViewingCurrentMonth, datedSubTaskMap])

  const datedTasksForSelectedDate = useMemo(() => {
    if (!review?.DailyTasks?.length) return []
    const slot = review.DailyTasks.find((entry) => {
      const d = new Date(entry.todayDate)
      return formatDateYmd(d) === selectedHabitDate
    })
    const datedIdsForDay = new Set(
      [...datedSubTaskMap.entries()]
        .filter(([, dateYmd]) => dateYmd === selectedHabitDate)
        .map(([id]) => id),
    )
    return (slot?.Task ?? []).filter((t) => {
      const id = t.subTaskId?.toString?.() ?? String(t.subTaskId)
      return datedIdsForDay.has(id)
    })
  }, [review, selectedHabitDate, datedSubTaskMap])

  const filteredWeeklySlots = useMemo(() => {
    return (review?.WeeklyTasks ?? [])
      .filter((entry) => isDateInMonth(entry.sundayDate, viewMonth))
      .sort(
        (a, b) =>
          new Date(a.sundayDate).getTime() - new Date(b.sundayDate).getTime(),
      )
  }, [review, viewMonth])

  const weeklyGrid = useMemo(() => {
    if (!filteredWeeklySlots.length) {
      return { sundays: [], tasks: [], getCell: () => null }
    }
    const sundays = filteredWeeklySlots.map((entry, index) => ({
      index,
      date: entry.sundayDate,
      label: formatDateLabel(startOfDay(new Date(entry.sundayDate))),
    }))
    const taskMap = new Map()
    for (const entry of filteredWeeklySlots) {
      for (const t of entry.Task ?? []) {
        const id = t.subTaskId?.toString?.() ?? String(t.subTaskId)
        if (!taskMap.has(id)) taskMap.set(id, t.subTaskName)
      }
    }
    const tasks = [...taskMap.entries()].map(([id, name]) => ({ id, name }))
    const getCell = (taskId, sundayIndex) => {
      const slot = filteredWeeklySlots[sundayIndex]
      if (!slot) return null
      const match = (slot.Task ?? []).find(
        (t) => (t.subTaskId?.toString?.() ?? String(t.subTaskId)) === taskId,
      )
      if (!match) return null
      return { isCompleted: match.isCompleted }
    }
    return { sundays, tasks, getCell }
  }, [filteredWeeklySlots])

  const monthlySlot = review?.MonthlyTasks
  const tabMeta = TABS.find((t) => t.key === activeTab) ?? TABS[0]
  const userLabel = displayName(target)

  function signOut() {
    clearSession()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-100 via-white to-cyan-50">
      <AppPageHeader
        title="User habits"
        subtitle={
          target
            ? `${userLabel}${target.email ? ` · ${target.email}` : ''}`
            : 'Admin oversight'
        }
        icon={Shield}
        onSignOut={signOut}
        maxWidthClass="max-w-6xl"
      />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 px-5 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin">← Back to Admin</Link>
          </Button>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm shadow-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={includePrivate}
              onChange={(e) => setIncludePrivate(e.target.checked)}
            />
            <Label className="cursor-pointer font-medium text-slate-800">
              Show private tasks
            </Label>
          </label>
        </div>

        <p className="text-xs text-slate-600">
          Read-only view. Use Support tools to mark completions.
          {!includePrivate ? ' Private tasks are hidden.' : null}
        </p>

        <div className="flex shrink-0 gap-1 rounded-lg bg-white/70 p-1 shadow-sm ring-1 ring-slate-200/80">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition',
                activeTab === tab.key
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-50',
              )}
            >
              {tab.key === 'dated' ? 'Add-ons' : tab.title.replace(' habits', '')}
            </button>
          ))}
        </div>

        <Card
          className={cn(
            'flex min-h-0 flex-1 flex-col overflow-hidden border-0 shadow-md ring-1',
            tabMeta.ring,
          )}
        >
          <CardHeader
            className={cn(
              'shrink-0 space-y-0.5 bg-gradient-to-r px-3 py-2.5 text-white',
              tabMeta.accent,
            )}
          >
            <CardTitle className="text-sm leading-tight">{tabMeta.title}</CardTitle>
            <CardDescription className="text-xs text-white/90">
              {monthTitle} · {tabMeta.description}
            </CardDescription>
          </CardHeader>
          <CardContent
            className={cn(
              'flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-3',
              tabMeta.bg,
            )}
          >
            <div className="shrink-0">
              <MonthNavBar
                viewMonth={viewMonth}
                onPrev={() => setViewMonth((m) => addMonths(m, -1))}
                onNext={() => {
                  if (isViewingCurrentMonth) return
                  setViewMonth((m) => addMonths(m, 1))
                }}
                disabled={loading}
                nextDisabled={isViewingCurrentMonth}
              >
                <span className="inline-flex items-center justify-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {monthTitle}
                </span>
              </MonthNavBar>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {loading ? (
                <p className="py-8 text-center text-xs text-slate-500">Loading…</p>
              ) : error ? (
                <p className="py-8 text-center text-xs text-red-600">{error}</p>
              ) : !hasPlan ? (
                <p className="py-8 text-center text-xs text-slate-500">
                  No plan for {monthTitle}
                </p>
              ) : !review ? (
                <p className="py-8 text-center text-xs text-slate-500">
                  No habit data for {monthTitle}
                </p>
              ) : activeTab === 'daily' ? (
                dailyGrid.tasks.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500">
                    No daily habits
                  </p>
                ) : (
                  <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-rose-200/80 bg-white/80 dark:bg-slate-900/50">
                    <table className="w-max min-w-full border-collapse text-[10px]">
                      <thead>
                        <tr className="border-b border-rose-200/60 bg-rose-50/90">
                          <th className="sticky left-0 z-10 min-w-[6rem] border-r px-2 py-1 text-left font-semibold">
                            Task
                          </th>
                          {dailyGrid.days.map((day) => (
                            <th
                              key={day}
                              className={cn(
                                'min-w-[1.5rem] px-0.5 py-1 text-center font-semibold',
                                dailyGrid.isViewingCurrentMonth &&
                                  day === dailyGrid.todayDay &&
                                  'bg-rose-200 text-rose-900',
                              )}
                            >
                              {day}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dailyGrid.tasks.map((task, rowIdx) => {
                          const rowTheme = getHabitRowTheme(rowIdx)
                          return (
                            <tr
                              key={task.id}
                              className="border-b border-rose-100/80"
                            >
                              <td
                                className={cn(
                                  'sticky left-0 z-10 max-w-[10rem] truncate border-r px-2 py-1 font-medium',
                                  rowTheme.headerClass,
                                )}
                              >
                                {task.name}
                                <PrivateBadge show={privateIds.has(task.id)} />
                              </td>
                              {dailyGrid.days.map((day) => {
                                const cell = dailyGrid.getCell(task.id, day)
                                return (
                                  <td key={day} className="p-0.5 text-center">
                                    {cell ? (
                                      <HabitCompletionToggle
                                        size="sm"
                                        readOnly
                                        checked={cell.isCompleted}
                                        className="mx-auto"
                                      />
                                    ) : null}
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              ) : activeTab === 'weekly' ? (
                weeklyGrid.tasks.length === 0 ||
                weeklyGrid.sundays.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500">
                    No weekly habits
                  </p>
                ) : (
                  <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-emerald-200/80 bg-white/80 dark:bg-slate-900/50">
                    <table className="w-max min-w-full border-collapse text-[10px]">
                      <thead>
                        <tr className="border-b border-emerald-200/60 bg-emerald-50/90">
                          <th className="sticky left-0 z-10 min-w-[6rem] border-r px-2 py-1 text-left font-semibold">
                            Task
                          </th>
                          {weeklyGrid.sundays.map((s) => (
                            <th
                              key={s.index}
                              className="min-w-[3rem] px-1 py-1 text-center font-semibold"
                            >
                              {s.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {weeklyGrid.tasks.map((task, rowIdx) => {
                          const rowTheme = getHabitRowTheme(rowIdx)
                          return (
                            <tr
                              key={task.id}
                              className="border-b border-emerald-100/80"
                            >
                              <td
                                className={cn(
                                  'sticky left-0 z-10 max-w-[10rem] truncate border-r px-2 py-1 font-medium',
                                  rowTheme.headerClass,
                                )}
                              >
                                {task.name}
                                <PrivateBadge show={privateIds.has(task.id)} />
                              </td>
                              {weeklyGrid.sundays.map((s) => {
                                const cell = weeklyGrid.getCell(task.id, s.index)
                                return (
                                  <td key={s.index} className="p-0.5 text-center">
                                    {cell ? (
                                      <HabitCompletionToggle
                                        size="sm"
                                        readOnly
                                        checked={cell.isCompleted}
                                        className="mx-auto"
                                      />
                                    ) : null}
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              ) : activeTab === 'dated' ? (
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                  <div className="shrink-0">
                    <DatedDatePicker
                      id="admin-habit-dated-date"
                      value={selectedHabitDate}
                      min={viewMonthBounds.min}
                      max={viewMonthBounds.max}
                      disabled={loading}
                      prevDisabled={selectedHabitDate <= viewMonthBounds.min}
                      nextDisabled={selectedHabitDate >= viewMonthBounds.max}
                      onPrev={() =>
                        setSelectedHabitDate(shiftDateYmd(selectedHabitDate, -1))
                      }
                      onNext={() =>
                        setSelectedHabitDate(shiftDateYmd(selectedHabitDate, 1))
                      }
                      onChange={(e) => {
                        const value = e.target.value
                        if (!value) return
                        if (
                          value < viewMonthBounds.min ||
                          value > viewMonthBounds.max
                        )
                          return
                        setSelectedHabitDate(value)
                      }}
                    />
                  </div>
                  {!datedTasksForSelectedDate.length ? (
                    <p className="py-6 text-center text-xs text-slate-500">
                      No add-ons for this day
                    </p>
                  ) : (
                    <ul className="min-h-0 flex-1 space-y-1.5 overflow-auto rounded-lg border border-white/80 bg-white/70 p-2 dark:bg-slate-900/40">
                      {datedTasksForSelectedDate.map((task, rowIdx) => {
                        const id =
                          task.subTaskId?.toString?.() ?? String(task.subTaskId)
                        const rowTheme = getHabitRowTheme(rowIdx)
                        return (
                          <li
                            key={id}
                            className={cn(
                              'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                              rowTheme.cellClass,
                            )}
                          >
                            <HabitCompletionToggle
                              readOnly
                              checked={task.isCompleted}
                              className="shrink-0"
                            />
                            <span
                              className={cn(
                                task.isCompleted &&
                                  'line-through text-emerald-800/80',
                              )}
                            >
                              {task.subTaskName}
                              <PrivateBadge show={privateIds.has(id)} />
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              ) : activeTab === 'monthly' && monthlySlot?.Task?.length ? (
                <ul className="min-h-0 flex-1 space-y-1.5 overflow-auto rounded-lg border border-white/80 bg-white/70 p-2 dark:bg-slate-900/40">
                  {monthlySlot.Task.map((task, rowIdx) => {
                    const id =
                      task.subTaskId?.toString?.() ?? String(task.subTaskId)
                    const rowTheme = getHabitRowTheme(rowIdx)
                    return (
                      <li
                        key={id}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                          rowTheme.cellClass,
                        )}
                      >
                        <HabitCompletionToggle
                          readOnly
                          checked={task.isCompleted}
                          className="shrink-0"
                        />
                        <span
                          className={cn(
                            task.isCompleted &&
                              'line-through text-emerald-800/80',
                          )}
                        >
                          {task.subTaskName}
                          <PrivateBadge show={privateIds.has(id)} />
                        </span>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="py-6 text-center text-xs text-slate-500">
                  No monthly habits
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
