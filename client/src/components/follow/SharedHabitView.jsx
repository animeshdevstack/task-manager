import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { followRequest } from '@/lib/follow-api'
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

function addMonths(date, delta) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

function isDateInMonth(date, viewMonth) {
  const d = new Date(date)
  return (
    d.getFullYear() === viewMonth.getFullYear() && d.getMonth() === viewMonth.getMonth()
  )
}

function MonthNavBar({ viewMonth, onPrev, onNext, children, disabled }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 rounded-lg border border-violet-200/80 bg-white/80 px-1.5 py-1.5 dark:border-violet-800/50 dark:bg-slate-900/50">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 shrink-0 gap-1 px-2 text-xs"
        disabled={disabled}
        onClick={onPrev}
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Prev</span>
      </Button>
      <div className="min-w-0 flex-1 px-1 text-center text-xs text-slate-600 dark:text-slate-400">
        {children}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 shrink-0 gap-1 px-2 text-xs"
        disabled={disabled}
        onClick={onNext}
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

const TABS = [
  {
    key: 'daily',
    title: 'Daily habits',
    description: 'Read-only view',
    accent: 'from-rose-500 to-orange-500',
    ring: 'ring-rose-400/40',
    bg: 'bg-rose-50/80 dark:bg-rose-950/30',
  },
  {
    key: 'weekly',
    title: 'Weekly habits',
    description: 'Read-only view',
    accent: 'from-emerald-500 to-teal-500',
    ring: 'ring-emerald-400/40',
    bg: 'bg-emerald-50/80 dark:bg-emerald-950/30',
  },
  {
    key: 'monthly',
    title: 'Monthly habits',
    description: 'Read-only view',
    accent: 'from-indigo-500 to-violet-500',
    ring: 'ring-indigo-400/40',
    bg: 'bg-indigo-50/80 dark:bg-indigo-950/30',
  },
]

function userIdStr(id) {
  return typeof id === 'string' ? id : id?.toString?.() ?? String(id)
}

export default function SharedHabitView({ targetUserId, userLabel }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [review, setReview] = useState(null)
  const [hasPlan, setHasPlan] = useState(false)
  const [activeTab, setActiveTab] = useState('daily')
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const today = useMemo(() => new Date(), [])
  const monthKey = useMemo(() => formatYearMonth(viewMonth), [viewMonth])
  const monthTitle = useMemo(() => formatMonthTitle(viewMonth), [viewMonth])
  const isViewingCurrentMonth = monthKey === formatYearMonth(today)

  const loadShared = useCallback(async () => {
    if (!targetUserId) return
    setLoading(true)
    setError(null)
    try {
      const uid = userIdStr(targetUserId)
      const planRes = await followRequest(
        `/${encodeURIComponent(uid)}/add-tasks?month=${encodeURIComponent(monthKey)}`,
      )
      const plan = planRes.data
      if (!plan?._id) {
        setHasPlan(false)
        setReview(null)
        return
      }
      setHasPlan(true)

      const reviewRes = await followRequest(
        `/${encodeURIComponent(uid)}/review-tasks?month=${encodeURIComponent(monthKey)}`,
      )
      setReview(reviewRes.data ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load shared habits')
      setHasPlan(false)
      setReview(null)
    } finally {
      setLoading(false)
    }
  }, [targetUserId, monthKey])

  useEffect(() => {
    void loadShared()
  }, [loadShared])

  const dailyGrid = useMemo(() => {
    if (!review?.DailyTasks?.length) {
      return { days: [], tasks: [], getCell: () => null, todayDay: null, isViewingCurrentMonth }
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
  }, [review, monthKey, today, isViewingCurrentMonth])

  const filteredWeeklySlots = useMemo(() => {
    return (review?.WeeklyTasks ?? [])
      .filter((entry) => isDateInMonth(entry.sundayDate, viewMonth))
      .sort(
        (a, b) => new Date(a.sundayDate).getTime() - new Date(b.sundayDate).getTime(),
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

  if (!targetUserId) return null

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-medium text-violet-900/90 dark:text-violet-200/90">
        Viewing habits for <span className="font-semibold">{userLabel}</span> (read-only)
      </p>

      <div className="flex gap-1 rounded-lg bg-white/70 p-1 shadow-sm ring-1 ring-violet-200/60 dark:bg-slate-900/50">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition',
              activeTab === tab.key
                ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-sm'
                : 'text-violet-900/70 hover:bg-violet-50 dark:text-violet-100/80',
            )}
          >
            {tab.title.replace(' habits', '')}
          </button>
        ))}
      </div>

      <Card className={cn('border-0 shadow-md ring-1', tabMeta.ring)}>
        <CardHeader
          className={cn(
            'space-y-0.5 bg-gradient-to-r px-3 py-2.5 text-white',
            tabMeta.accent,
          )}
        >
          <CardTitle className="text-sm leading-tight">{tabMeta.title}</CardTitle>
          <CardDescription className="text-xs text-white/90">
            {monthTitle} · {tabMeta.description}
          </CardDescription>
        </CardHeader>
        <CardContent className={cn('space-y-2 p-3', tabMeta.bg)}>
          <MonthNavBar
            viewMonth={viewMonth}
            onPrev={() => setViewMonth((m) => addMonths(m, -1))}
            onNext={() => setViewMonth((m) => addMonths(m, 1))}
            disabled={loading}
          >
            <span className="inline-flex items-center justify-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {monthTitle}
            </span>
          </MonthNavBar>

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
              <p className="py-6 text-center text-xs text-slate-500">No daily habits</p>
            ) : (
              <div className="max-h-48 overflow-auto rounded-lg border border-rose-200/80 bg-white/80 dark:bg-slate-900/50">
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
                    {dailyGrid.tasks.map((task) => (
                      <tr key={task.id} className="border-b border-rose-100/80">
                        <td className="sticky left-0 z-10 max-w-[8rem] truncate border-r bg-white/95 px-2 py-1 font-medium">
                          {task.name}
                        </td>
                        {dailyGrid.days.map((day) => {
                          const cell = dailyGrid.getCell(task.id, day)
                          return (
                            <td key={day} className="p-0.5 text-center">
                              {cell ? (
                                cell.isCompleted ? (
                                  <CheckCircle2 className="mx-auto h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <Circle className="mx-auto h-3.5 w-3.5 text-slate-300" />
                                )
                              ) : null}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : activeTab === 'weekly' ? (
            weeklyGrid.tasks.length === 0 || weeklyGrid.sundays.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">No weekly habits</p>
            ) : (
              <div className="max-h-48 overflow-auto rounded-lg border border-emerald-200/80 bg-white/80 dark:bg-slate-900/50">
                <table className="w-max min-w-full border-collapse text-[10px]">
                  <thead>
                    <tr className="border-b border-emerald-200/60 bg-emerald-50/90">
                      <th className="sticky left-0 z-10 min-w-[6rem] border-r px-2 py-1 text-left font-semibold">
                        Task
                      </th>
                      {weeklyGrid.sundays.map((s) => (
                        <th key={s.index} className="min-w-[3rem] px-1 py-1 text-center font-semibold">
                          {s.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyGrid.tasks.map((task) => (
                      <tr key={task.id} className="border-b border-emerald-100/80">
                        <td className="sticky left-0 z-10 max-w-[8rem] truncate border-r bg-white/95 px-2 py-1 font-medium">
                          {task.name}
                        </td>
                        {weeklyGrid.sundays.map((s) => {
                          const cell = weeklyGrid.getCell(task.id, s.index)
                          return (
                            <td key={s.index} className="p-0.5 text-center">
                              {cell ? (
                                cell.isCompleted ? (
                                  <CheckCircle2 className="mx-auto h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <Circle className="mx-auto h-3.5 w-3.5 text-slate-300" />
                                )
                              ) : null}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : monthlySlot?.Task?.length ? (
            <ul className="space-y-1.5 rounded-lg border border-white/80 bg-white/70 p-2 dark:bg-slate-900/40">
              {monthlySlot.Task.map((task) => {
                const id = task.subTaskId?.toString?.() ?? String(task.subTaskId)
                return (
                  <li
                    key={id}
                    className="flex items-center gap-2 rounded-md bg-white/60 px-2 py-1.5 text-sm dark:bg-slate-800/60"
                  >
                    {task.isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-slate-300" />
                    )}
                    <span
                      className={cn(
                        task.isCompleted && 'line-through text-emerald-800/80',
                      )}
                    >
                      {task.subTaskName}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="py-6 text-center text-xs text-slate-500">No monthly habits</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
