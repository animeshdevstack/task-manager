import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  ListChecks,
} from 'lucide-react'
import AppPageHeader from '@/components/layout/AppPageHeader'
import DatedDatePicker from '@/components/tasks/DatedDatePicker'
import MonthNavBar, { addMonths } from '@/components/tasks/MonthNavBar'
import { Button } from '@/components/ui/button'
import { Toast, TOAST_DURATION_MS } from '@/components/ui/toast'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { clearSession, getStoredUser } from '@/lib/auth-api'
import { reviewRequest } from '@/lib/review-api'
import { tasksRequest } from '@/lib/tasks-api'
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

function isSameCalendarDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function formatDateYmd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function monthDateBounds(monthKey) {
  const [year, monthNum] = monthKey.split('-').map(Number)
  const lastDay = new Date(year, monthNum, 0).getDate()
  return {
    min: `${monthKey}-01`,
    max: `${monthKey}-${String(lastDay).padStart(2, '0')}`,
  }
}

function defaultHabitSelectedDate(monthKey, referenceDate) {
  const { min, max } = monthDateBounds(monthKey)
  const todayStr = formatDateYmd(referenceDate)
  if (todayStr >= min && todayStr <= max) return todayStr
  return min
}

function shiftDateYmd(ymd, deltaDays) {
  const [y, m, d] = ymd.split('-').map(Number)
  return formatDateYmd(new Date(y, m - 1, d + deltaDays))
}

function buildDatedSubTaskMap(datedTasks) {
  const map = new Map()
  for (const entry of datedTasks ?? []) {
    const date = typeof entry?.date === 'string' ? entry.date.trim() : ''
    if (!date) continue
    for (const t of entry?.tasks ?? []) {
      const id = t._id?.toString?.() ?? (t._id != null ? String(t._id) : null)
      if (id) map.set(id, date)
    }
  }
  return map
}

function isDateInMonth(date, viewMonth) {
  const d = new Date(date)
  return (
    d.getFullYear() === viewMonth.getFullYear() && d.getMonth() === viewMonth.getMonth()
  )
}

function planIdMatches(reviewTaskId, planId) {
  if (!reviewTaskId || !planId) return false
  const a = typeof reviewTaskId === 'string' ? reviewTaskId : reviewTaskId.toString?.()
  const b = typeof planId === 'string' ? planId : planId.toString?.()
  return a === b
}

const HABIT_TRACKER_TAB_KEY = 'habit-tracker-active-tab'
const VALID_TABS = new Set(['daily', 'weekly', 'monthly', 'dated'])

function getStoredHabitTab() {
  try {
    const stored = sessionStorage.getItem(HABIT_TRACKER_TAB_KEY)
    if (stored && VALID_TABS.has(stored)) return stored
  } catch {
    /* ignore */
  }
  return 'daily'
}

const TABS = [
  {
    key: 'daily',
    title: 'Daily habits',
    description: 'View the month · mark complete for today only',
    accent: 'from-rose-500 to-orange-500',
    ring: 'ring-rose-400/40',
    bg: 'bg-rose-50/80 dark:bg-rose-950/30',
  },
  {
    key: 'weekly',
    title: 'Weekly habits',
    description: 'All Sundays · check off next Sunday only',
    accent: 'from-emerald-500 to-teal-500',
    ring: 'ring-emerald-400/40',
    bg: 'bg-emerald-50/80 dark:bg-emerald-950/30',
  },
  {
    key: 'monthly',
    title: 'Monthly habits',
    description: 'End-of-month goals',
    accent: 'from-indigo-500 to-violet-500',
    ring: 'ring-indigo-400/40',
    bg: 'bg-indigo-50/80 dark:bg-indigo-950/30',
  },
  {
    key: 'dated',
    title: 'Daily extras habits',
    description: 'View any day · check off today only',
    accent: 'from-sky-500 to-blue-500',
    ring: 'ring-sky-400/40',
    bg: 'bg-sky-50/80 dark:bg-sky-950/30',
  },
]

export default function HabitTracker() {
  const navigate = useNavigate()
  const [user] = useState(getStoredUser)
  const [loading, setLoading] = useState(true)
  const [patching, setPatching] = useState(false)
  const [toast, setToast] = useState(null)
  const [review, setReview] = useState(null)
  const [plan, setPlan] = useState(null)
  const [hasPlan, setHasPlan] = useState(false)
  const [activeTab, setActiveTab] = useState(getStoredHabitTab)

  useEffect(() => {
    try {
      sessionStorage.setItem(HABIT_TRACKER_TAB_KEY, activeTab)
    } catch {
      /* ignore */
    }
  }, [activeTab])
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const todayColumnRef = useRef(null)
  const weeklyColumnRef = useRef(null)

  const today = useMemo(() => new Date(), [])
  const monthKey = useMemo(() => formatYearMonth(viewMonth), [viewMonth])
  const monthTitle = useMemo(() => formatMonthTitle(viewMonth), [viewMonth])
  const currentMonthTitle = useMemo(() => formatMonthTitle(today), [today])
  const isViewingCurrentMonth = monthKey === formatYearMonth(today)
  const startOfToday = useMemo(() => startOfDay(today), [today])
  const todayYmd = useMemo(() => formatDateYmd(today), [today])
  const viewMonthBounds = useMemo(() => monthDateBounds(monthKey), [monthKey])
  const [selectedHabitDate, setSelectedHabitDate] = useState(() =>
    defaultHabitSelectedDate(formatYearMonth(new Date()), new Date()),
  )

  const datedSubTaskMap = useMemo(
    () => buildDatedSubTaskMap(plan?.DatedTasks),
    [plan?.DatedTasks],
  )

  useEffect(() => {
    setSelectedHabitDate((prev) => {
      const { min, max } = monthDateBounds(monthKey)
      if (prev >= min && prev <= max) return prev
      return defaultHabitSelectedDate(monthKey, today)
    })
  }, [monthKey, today])

  const canUpdateDailyExtrasToday =
    isViewingCurrentMonth && selectedHabitDate === todayYmd

  const goPrevMonth = () => {
    setViewMonth((m) => addMonths(m, -1))
  }

  const goNextMonth = () => {
    if (isViewingCurrentMonth) return
    setViewMonth((m) => addMonths(m, 1))
  }

  const goToCurrentMonth = () => {
    setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1))
  }

  const showToast = (message, variant = 'success') => {
    setToast({ message, variant })
  }

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(null), TOAST_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  const loadReview = useCallback(async () => {
    setLoading(true)
    try {
      const planRes = await tasksRequest('/get-tasks?page=1&limit=50')
      const plans = planRes.data?.tasks ?? []
      const plan = plans.find((t) => t.currentMonthAndYear === monthKey)

      if (!plan?._id) {
        setHasPlan(false)
        setPlan(null)
        setReview(null)
        return
      }

      setHasPlan(true)
      setPlan(plan)

      const listRes = await reviewRequest('/get-user-review-task?page=1&limit=50')
      const reviews = listRes.data?.tasks ?? []
      const summary = reviews.find((r) => planIdMatches(r.TaskId, plan._id))

      if (!summary?._id) {
        setReview(null)
        return
      }

      const detailRes = await reviewRequest(
        `/get-user-review-task-by-id/${summary._id}`,
      )
      const doc = detailRes.data
      setReview(doc)

    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not load habits', 'error')
      setReview(null)
      setPlan(null)
      setHasPlan(false)
    } finally {
      setLoading(false)
    }
  }, [monthKey, today])

  useEffect(() => {
    void loadReview()
  }, [loadReview])

  function signOut() {
    clearSession()
    navigate('/login', { replace: true })
  }

  function tryToggleDailyExtra(type, slotDate, subTaskId, nextCompleted) {
    const slotYmd = formatDateYmd(new Date(slotDate))
    if (!isViewingCurrentMonth || slotYmd !== todayYmd) {
      showToast('You can only update daily extras for today', 'error')
      return
    }
    void toggleTask(type, slotDate, subTaskId, nextCompleted)
  }

  async function toggleTask(type, slotDate, subTaskId, nextCompleted) {
    if (!review?._id) return
    setPatching(true)
    try {
      await reviewRequest(`/update-user-review-task/${review._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          type,
          date: new Date(slotDate).toISOString(),
          subTaskId: typeof subTaskId === 'string' ? subTaskId : subTaskId.toString(),
          isCompleted: nextCompleted,
        }),
      })
      const detailRes = await reviewRequest(
        `/get-user-review-task-by-id/${review._id}`,
      )
      setReview(detailRes.data)
      showToast(nextCompleted ? 'Marked complete' : 'Marked incomplete', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not update', 'error')
    } finally {
      setPatching(false)
    }
  }

  const dailyGrid = useMemo(() => {
    if (!review?.DailyTasks?.length) {
      return {
        days: [],
        tasks: [],
        getCell: () => null,
        todayDay: isViewingCurrentMonth ? today.getDate() : null,
        todayTasks: [],
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
        if (!taskMap.has(id)) {
          taskMap.set(id, t.subTaskName)
        }
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
      return {
        isCompleted: match.isCompleted,
        date: slot.todayDate,
      }
    }

    const todayDay = isViewingCurrentMonth ? today.getDate() : null
    const todaySlot = todayDay != null ? slotByDay.get(todayDay) : null
    const todayTasks = (todaySlot?.Task ?? []).filter((t) => {
      const id = t.subTaskId?.toString?.() ?? String(t.subTaskId)
      return !datedSubTaskMap.has(id)
    })

    return {
      days,
      tasks,
      getCell,
      todayDay,
      todaySlot,
      todayTasks,
      isViewingCurrentMonth,
    }
  }, [review, monthKey, today, isViewingCurrentMonth, datedSubTaskMap])

  const filteredWeeklySlots = useMemo(() => {
    const slots = review?.WeeklyTasks ?? []
    return slots
      .filter((entry) => isDateInMonth(entry.sundayDate, viewMonth))
      .sort(
        (a, b) => new Date(a.sundayDate).getTime() - new Date(b.sundayDate).getTime(),
      )
  }, [review, viewMonth])

  /** First Sunday in this month that is today or still ahead (only this column is editable). */
  const nextSundayIndex = useMemo(() => {
    return filteredWeeklySlots.findIndex(
      (entry) => startOfDay(new Date(entry.sundayDate)) >= startOfToday,
    )
  }, [filteredWeeklySlots, startOfToday])

  const weeklyGrid = useMemo(() => {
    if (!filteredWeeklySlots.length) {
      return {
        sundays: [],
        tasks: [],
        getCell: () => null,
        highlightIndex: null,
        focusTasks: [],
      }
    }

    const editableIndex = nextSundayIndex >= 0 ? nextSundayIndex : null

    const sundays = filteredWeeklySlots.map((entry, index) => {
      const d = startOfDay(new Date(entry.sundayDate))
      return {
        index,
        date: entry.sundayDate,
        label: formatDateLabel(d),
        canEdit: index === editableIndex,
      }
    })

    const taskMap = new Map()
    for (const entry of filteredWeeklySlots) {
      for (const t of entry.Task ?? []) {
        const id = t.subTaskId?.toString?.() ?? String(t.subTaskId)
        if (!taskMap.has(id)) {
          taskMap.set(id, t.subTaskName)
        }
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
      return {
        isCompleted: match.isCompleted,
        date: slot.sundayDate,
        canEdit: sundays[sundayIndex]?.canEdit ?? false,
      }
    }

    const highlightIndex = editableIndex
    const focusSlot =
      highlightIndex != null ? filteredWeeklySlots[highlightIndex] : null

    return {
      sundays,
      tasks,
      getCell,
      highlightIndex,
      focusTasks: focusSlot?.Task ?? [],
      nextSundayLabel:
        highlightIndex != null ? sundays[highlightIndex]?.label : null,
    }
  }, [filteredWeeklySlots, startOfToday, nextSundayIndex])

  const monthlySlot = review?.MonthlyTasks

  const activeTasks = useMemo(() => {
    if (activeTab === 'daily') {
      return {
        type: 'daily',
        tasks: dailyGrid.todayTasks ?? [],
      }
    }
    if (activeTab === 'weekly') {
      return {
        type: 'weekly',
        tasks: weeklyGrid.focusTasks ?? [],
      }
    }
    if (activeTab === 'monthly' && monthlySlot) {
      const monthEnd = startOfDay(new Date(monthlySlot.monthEndDate))
      return {
        type: 'monthly',
        date: monthlySlot.monthEndDate,
        label: formatDateLabel(new Date(monthlySlot.monthEndDate)),
        tasks: monthlySlot.Task ?? [],
        canEdit: monthEnd >= startOfToday,
      }
    }
    if (activeTab === 'dated' && review) {
      const slot = review.DailyTasks?.find((entry) => {
        const d = new Date(entry.todayDate)
        return formatDateYmd(d) === selectedHabitDate
      })
      const datedIdsForDay = new Set(
        [...datedSubTaskMap.entries()]
          .filter(([, dateYmd]) => dateYmd === selectedHabitDate)
          .map(([id]) => id),
      )
      const tasks = (slot?.Task ?? []).filter((t) => {
        const id = t.subTaskId?.toString?.() ?? String(t.subTaskId)
        return datedIdsForDay.has(id)
      })
      return {
        type: 'daily',
        date: slot?.todayDate ?? new Date(`${selectedHabitDate}T12:00:00`),
        label: formatDateLabel(new Date(`${selectedHabitDate}T12:00:00`)),
        tasks,
        canEdit: canUpdateDailyExtrasToday && Boolean(slot),
      }
    }
    return null
  }, [
    activeTab,
    dailyGrid,
    weeklyGrid,
    monthlySlot,
    startOfToday,
    review,
    datedSubTaskMap,
    isViewingCurrentMonth,
    todayYmd,
    selectedHabitDate,
    canUpdateDailyExtrasToday,
  ])

  const progress = useMemo(() => {
    const tasks = activeTasks?.tasks ?? []
    if (tasks.length === 0) return { done: 0, total: 0, pct: 0 }
    const done = tasks.filter((t) => t.isCompleted).length
    return { done, total: tasks.length, pct: Math.round((done / tasks.length) * 100) }
  }, [activeTasks])

  useEffect(() => {
    if (activeTab !== 'daily' || loading || !review || !dailyGrid.isViewingCurrentMonth) return
    todayColumnRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [activeTab, loading, review, dailyGrid.todayDay, dailyGrid.isViewingCurrentMonth])

  useEffect(() => {
    if (activeTab !== 'weekly' || loading || !review || weeklyGrid.highlightIndex == null) return
    weeklyColumnRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [activeTab, loading, review, weeklyGrid.highlightIndex])

  const monthNavHint = useMemo(() => {
    if (activeTab === 'daily') {
      if (isViewingCurrentMonth) {
        return (
          <>
            Today:{' '}
            <span className="font-semibold text-rose-700 dark:text-rose-400">
              {formatDateLabel(today)}
            </span>
            {' · '}
            Only today&apos;s column can be checked
          </>
        )
      }
      return (
        <>
          Viewing <span className="font-semibold text-slate-800 dark:text-slate-200">{monthTitle}</span>
          {' · '}
          Read-only — use current month to check off today
        </>
      )
    }
    if (activeTab === 'dated') {
      if (isViewingCurrentMonth) {
        return (
          <>
            Viewing{' '}
            <span className="font-semibold text-sky-700 dark:text-sky-400">
              {formatDateLabel(new Date(`${selectedHabitDate}T12:00:00`))}
            </span>
            {' · '}
            Only today&apos;s daily extras can be checked off
          </>
        )
      }
      return (
        <>
          Viewing <span className="font-semibold text-slate-800 dark:text-slate-200">{monthTitle}</span>
          {' · '}
          Browse past or future days — switch to the current month to update today
        </>
      )
    }
    if (activeTab === 'weekly') {
      return (
        <>
          <span className="font-semibold text-slate-800 dark:text-slate-200">{monthTitle}</span>
          {' · '}
          {weeklyGrid.nextSundayLabel ? (
            <>
              Next Sunday:{' '}
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {weeklyGrid.nextSundayLabel}
              </span>
              {' · '}
              Only that column can be checked
            </>
          ) : (
            'All Sundays this month are read-only'
          )}
        </>
      )
    }
    return (
      <>
        <span className="font-semibold text-slate-800 dark:text-slate-200">{monthTitle}</span>
        {' · '}
        Month-end goals
      </>
    )
  }, [
    activeTab,
    isViewingCurrentMonth,
    monthTitle,
    today,
    weeklyGrid.nextSundayLabel,
    selectedHabitDate,
  ])

  const tabMeta = TABS.find((t) => t.key === activeTab) ?? TABS[0]

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gradient-to-br from-violet-200/70 via-fuchsia-100/80 to-cyan-200/70">
      <AppPageHeader
        title="Habit Tracker"
        subtitle="Complete your daily review"
        icon={ListChecks}
        onSignOut={signOut}
        navContext="habits"
        maxWidthClass="max-w-6xl"
      />

      <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-hidden px-4 py-2">
        {toast ? <Toast message={toast.message} variant={toast.variant} /> : null}

        <div
          className={cn(
            'mx-auto flex min-h-0 w-full flex-1 flex-col overflow-hidden',
            activeTab === 'daily' || activeTab === 'weekly' ? 'max-w-6xl' : 'max-w-[840px]',
          )}
        >
          <div className="mb-2 shrink-0 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 p-px shadow-md">
            <div className="flex flex-col rounded-[11px] bg-white/95 backdrop-blur dark:bg-slate-950/95">
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                <div className="flex min-w-0 items-center gap-2">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0 text-teal-600" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-teal-700">
                      {isViewingCurrentMonth ? 'Current month' : 'Viewing month — read only'}
                    </p>
                    <h1 className="truncate text-base font-bold leading-tight text-slate-900 dark:text-white">
                      {monthTitle}
                    </h1>
                  </div>
                </div>
                <span className="shrink-0 rounded-md bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                  {monthKey}
                </span>
              </div>

              <div className="border-t border-teal-100 px-2.5 py-1.5 dark:border-teal-900/50">
                <MonthNavBar
                  embedded
                  viewMonth={viewMonth}
                  onPrev={goPrevMonth}
                  onNext={goNextMonth}
                  disabled={loading || patching}
                  nextDisabled={isViewingCurrentMonth}
                >
                  {!isViewingCurrentMonth ? (
                    <button
                      type="button"
                      onClick={goToCurrentMonth}
                      disabled={loading || patching}
                      className="font-medium text-violet-700 hover:underline disabled:opacity-50 dark:text-violet-300"
                    >
                      Back to {currentMonthTitle}
                    </button>
                  ) : null}
                </MonthNavBar>
              </div>

              {!isViewingCurrentMonth ? (
                <p className="border-t border-amber-200/80 bg-amber-50/90 px-2.5 py-1 text-[11px] leading-snug text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                  This month is view-only. Use{' '}
                  <span className="font-semibold">Back to {currentMonthTitle}</span> above to return
                  to current habits.
                </p>
              ) : null}
            </div>
          </div>

          <div className="mb-2 flex shrink-0 gap-1 rounded-lg bg-white/70 p-1 shadow-sm ring-1 ring-violet-200/60 dark:bg-slate-900/50">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition sm:text-sm',
                  activeTab === tab.key
                    ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-sm'
                    : 'text-violet-900/70 hover:bg-violet-50 dark:text-violet-100/80',
                )}
              >
                {tab.title.replace(' habits', '')}
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
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base leading-tight">{tabMeta.title}</CardTitle>
                  <CardDescription className="text-xs leading-tight text-white/90">
                    {tabMeta.description}
                  </CardDescription>
                </div>
                {(activeTasks?.tasks?.length ?? 0) > 0 ? (
                  <span className="shrink-0 rounded-md bg-white/20 px-2 py-0.5 text-xs font-semibold">
                    {progress.done}/{progress.total} ({progress.pct}%)
                  </span>
                ) : null}
              </div>
            </CardHeader>

            <CardContent className={cn('flex min-h-0 flex-1 flex-col gap-2 p-3', tabMeta.bg)}>
              {loading ? (
                <p className="py-12 text-center text-sm text-slate-500">Loading habits…</p>
              ) : (
                <>
                  <p className="shrink-0 text-center text-xs text-slate-600 dark:text-slate-400">
                    {monthNavHint}
                  </p>

              {!hasPlan ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    No task plan for {monthTitle} yet.
                  </p>
                  <Button asChild size="sm">
                    <Link to="/tasks">Create tasks in Task Manager</Link>
                  </Button>
                </div>
              ) : !review ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Review data not found. Save your plan in Task Manager first.
                  </p>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/tasks">Open Task Manager</Link>
                  </Button>
                </div>
              ) : activeTab === 'weekly' ? (
                <>
                  {weeklyGrid.tasks.length === 0 ? (
                    <p className="py-8 text-center text-xs text-slate-500">
                      No weekly habits yet
                    </p>
                  ) : weeklyGrid.sundays.length === 0 ? (
                    <p className="py-8 text-center text-xs text-slate-500">
                      No Sundays in {monthTitle}
                    </p>
                  ) : (
                    <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-emerald-200/80 bg-white/80 dark:bg-slate-900/50">
                      <table className="w-max min-w-full border-collapse text-[11px]">
                        <thead>
                          <tr className="border-b border-emerald-200/60 bg-emerald-50/90 dark:bg-emerald-950/40">
                            <th className="sticky left-0 z-20 min-w-[7.5rem] border-r border-emerald-200/60 bg-emerald-50/95 px-2 py-1.5 text-left font-semibold text-slate-800 dark:bg-emerald-950/90 dark:text-slate-100">
                              Task
                            </th>
                            {weeklyGrid.sundays.map((sunday, colIdx) => {
                              const isNext = colIdx === weeklyGrid.highlightIndex
                              return (
                                <th
                                  key={`${sunday.date}-${colIdx}`}
                                  ref={isNext ? weeklyColumnRef : undefined}
                                  className={cn(
                                    'min-w-[3.25rem] px-1 py-1.5 text-center font-semibold leading-tight',
                                    isNext
                                      ? 'bg-emerald-200 text-emerald-900 ring-1 ring-inset ring-emerald-400 dark:bg-emerald-800 dark:text-emerald-50'
                                      : 'text-slate-600 dark:text-slate-400',
                                  )}
                                >
                                  <span className="block text-[9px] font-medium uppercase opacity-80">
                                    Sun
                                  </span>
                                  <span className="block text-[10px]">{sunday.label}</span>
                                </th>
                              )
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {weeklyGrid.tasks.map((task) => (
                            <tr
                              key={task.id}
                              className="border-b border-emerald-100/80 last:border-0 dark:border-emerald-900/50"
                            >
                              <td className="sticky left-0 z-10 max-w-[9rem] truncate border-r border-emerald-100/80 bg-white/95 px-2 py-1.5 text-left font-medium text-slate-800 dark:bg-slate-900/90 dark:text-slate-100">
                                {task.name}
                              </td>
                              {weeklyGrid.sundays.map((sunday, colIdx) => {
                                const cell = weeklyGrid.getCell(task.id, colIdx)
                                const canEdit = cell?.canEdit

                                return (
                                  <td
                                    key={`${task.id}-${colIdx}`}
                                    className={cn(
                                      'p-0.5 text-center align-middle',
                                      colIdx === weeklyGrid.highlightIndex &&
                                        'bg-emerald-50/70 dark:bg-emerald-950/30',
                                    )}
                                  >
                                    {!cell ? (
                                      <span className="inline-block h-5 w-5" aria-hidden />
                                    ) : canEdit ? (
                                      <button
                                        type="button"
                                        disabled={patching}
                                        title={`${task.name} — ${sunday.label}`}
                                        onClick={() =>
                                          void toggleTask(
                                            'weekly',
                                            cell.date,
                                            task.id,
                                            !cell.isCompleted,
                                          )
                                        }
                                        className={cn(
                                          'inline-flex h-6 w-6 items-center justify-center rounded-full transition',
                                          cell.isCompleted
                                            ? 'text-emerald-600 hover:bg-emerald-100'
                                            : 'text-violet-400 hover:bg-violet-100',
                                          patching && 'opacity-50',
                                        )}
                                      >
                                        {cell.isCompleted ? (
                                          <CheckCircle2 className="h-4 w-4" />
                                        ) : (
                                          <Circle className="h-4 w-4" />
                                        )}
                                      </button>
                                    ) : (
                                      <span
                                        className="inline-flex h-6 w-6 items-center justify-center"
                                        title="View only — check off on next Sunday"
                                      >
                                        {cell.isCompleted ? (
                                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/80" />
                                        ) : (
                                          <Circle className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
                                        )}
                                      </span>
                                    )}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : activeTab === 'daily' ? (
                <>
                  {dailyGrid.tasks.length === 0 ? (
                    <p className="py-8 text-center text-xs text-slate-500">
                      No daily habits yet
                    </p>
                  ) : (
                    <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-rose-200/80 bg-white/80 dark:bg-slate-900/50">
                      <table className="w-max min-w-full border-collapse text-[11px]">
                        <thead>
                          <tr className="border-b border-rose-200/60 bg-rose-50/90 dark:bg-rose-950/40">
                            <th className="sticky left-0 z-20 min-w-[7.5rem] border-r border-rose-200/60 bg-rose-50/95 px-2 py-1.5 text-left font-semibold text-slate-800 dark:bg-rose-950/90 dark:text-slate-100">
                              Task
                            </th>
                            {dailyGrid.days.map((day) => {
                              const isToday =
                                dailyGrid.isViewingCurrentMonth && day === dailyGrid.todayDay
                              return (
                                <th
                                  key={day}
                                  ref={isToday ? todayColumnRef : undefined}
                                  className={cn(
                                    'min-w-[1.75rem] px-0.5 py-1.5 text-center font-semibold',
                                    isToday
                                      ? 'bg-rose-200 text-rose-900 ring-1 ring-inset ring-rose-400 dark:bg-rose-800 dark:text-rose-50'
                                      : 'text-slate-600 dark:text-slate-400',
                                  )}
                                >
                                  {day}
                                </th>
                              )
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {dailyGrid.tasks.map((task) => (
                            <tr
                              key={task.id}
                              className="border-b border-rose-100/80 last:border-0 dark:border-rose-900/50"
                            >
                              <td className="sticky left-0 z-10 max-w-[9rem] truncate border-r border-rose-100/80 bg-white/95 px-2 py-1.5 text-left font-medium text-slate-800 dark:bg-slate-900/90 dark:text-slate-100">
                                {task.name}
                              </td>
                              {dailyGrid.days.map((day) => {
                                const cell = dailyGrid.getCell(task.id, day)
                                const isToday =
                                  dailyGrid.isViewingCurrentMonth && day === dailyGrid.todayDay
                                const canEdit = isToday && cell?.date

                                return (
                                  <td
                                    key={day}
                                    className={cn(
                                      'p-0.5 text-center align-middle',
                                      isToday && 'bg-rose-50/70 dark:bg-rose-950/30',
                                    )}
                                  >
                                    {!cell ? (
                                      <span className="inline-block h-5 w-5" aria-hidden />
                                    ) : canEdit ? (
                                      <button
                                        type="button"
                                        disabled={patching}
                                        title={`${task.name} — today`}
                                        onClick={() =>
                                          void toggleTask(
                                            'daily',
                                            cell.date,
                                            task.id,
                                            !cell.isCompleted,
                                          )
                                        }
                                        className={cn(
                                          'inline-flex h-6 w-6 items-center justify-center rounded-full transition',
                                          cell.isCompleted
                                            ? 'text-emerald-600 hover:bg-emerald-100'
                                            : 'text-violet-400 hover:bg-violet-100',
                                          patching && 'opacity-50',
                                        )}
                                      >
                                        {cell.isCompleted ? (
                                          <CheckCircle2 className="h-4 w-4" />
                                        ) : (
                                          <Circle className="h-4 w-4" />
                                        )}
                                      </button>
                                    ) : (
                                      <span
                                        className="inline-flex h-6 w-6 items-center justify-center"
                                        title={
                                          isToday
                                            ? undefined
                                            : 'View only — edit today’s column'
                                        }
                                      >
                                        {cell.isCompleted ? (
                                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/80" />
                                        ) : (
                                          <Circle className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
                                        )}
                                      </span>
                                    )}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : activeTab === 'dated' ? (
                <>
                  <DatedDatePicker
                    id="habit-dated-date"
                    value={selectedHabitDate}
                    min={viewMonthBounds.min}
                    max={viewMonthBounds.max}
                    disabled={loading || patching}
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
                      if (value < viewMonthBounds.min || value > viewMonthBounds.max) {
                        showToast('Choose a date in this month', 'error')
                        return
                      }
                      setSelectedHabitDate(value)
                    }}
                  />

                  <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg border border-white/80 bg-white/70 p-2 dark:bg-slate-900/40">
                    {!activeTasks?.tasks?.length ? (
                      <li className="py-8 text-center text-xs text-slate-500">
                        No daily extras for this day
                      </li>
                    ) : (
                      activeTasks.tasks.map((task) => {
                        const id = task.subTaskId?.toString?.() ?? String(task.subTaskId)
                        const canEdit = activeTasks.canEdit !== false

                        return (
                          <li key={id}>
                            {canEdit ? (
                              <button
                                type="button"
                                disabled={patching}
                                onClick={() =>
                                  tryToggleDailyExtra(
                                    activeTasks.type,
                                    activeTasks.date,
                                    id,
                                    !task.isCompleted,
                                  )
                                }
                                className={cn(
                                  'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition',
                                  task.isCompleted
                                    ? 'border-emerald-300/80 bg-emerald-50/90 dark:bg-emerald-950/40'
                                    : 'border-transparent bg-white/60 hover:border-violet-200 dark:bg-slate-800/60',
                                  patching && 'opacity-60',
                                )}
                              >
                                {task.isCompleted ? (
                                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                                ) : (
                                  <Circle className="h-5 w-5 shrink-0 text-violet-400" />
                                )}
                                <span
                                  className={cn(
                                    'flex-1 text-sm',
                                    task.isCompleted
                                      ? 'text-emerald-900 line-through decoration-emerald-600/50 dark:text-emerald-100'
                                      : 'text-slate-800 dark:text-slate-100',
                                  )}
                                >
                                  {task.subTaskName}
                                </span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={patching}
                                onClick={() =>
                                  tryToggleDailyExtra(
                                    activeTasks.type,
                                    activeTasks.date,
                                    id,
                                    !task.isCompleted,
                                  )
                                }
                                className="flex w-full items-center gap-3 rounded-lg border border-transparent bg-white/60 px-3 py-2.5 text-left dark:bg-slate-800/60"
                              >
                                {task.isCompleted ? (
                                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500/80" />
                                ) : (
                                  <Circle className="h-5 w-5 shrink-0 text-slate-300 dark:text-slate-600" />
                                )}
                                <span
                                  className={cn(
                                    'flex-1 text-sm',
                                    task.isCompleted
                                      ? 'text-emerald-800/80 line-through dark:text-emerald-200/80'
                                      : 'text-slate-600 dark:text-slate-400',
                                  )}
                                >
                                  {task.subTaskName}
                                </span>
                              </button>
                            )}
                          </li>
                        )
                      })
                    )}
                  </ul>
                </>
              ) : (
                <>
                  {monthlySlot ? (
                    <p className="shrink-0 text-center text-sm font-medium text-slate-800 dark:text-slate-100">
                      Due {activeTasks?.label}
                    </p>
                  ) : null}

                  <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg border border-white/80 bg-white/70 p-2 dark:bg-slate-900/40">
                    {!activeTasks?.tasks?.length ? (
                      <li className="py-8 text-center text-xs text-slate-500">
                        No habits in this section yet
                      </li>
                    ) : (
                      activeTasks.tasks.map((task) => {
                        const id = task.subTaskId?.toString?.() ?? String(task.subTaskId)
                        const canEdit = activeTasks.canEdit !== false

                        return (
                          <li key={id}>
                            {canEdit ? (
                              <button
                                type="button"
                                disabled={patching}
                                onClick={() =>
                                  void toggleTask(
                                    activeTasks.type,
                                    activeTasks.date,
                                    id,
                                    !task.isCompleted,
                                  )
                                }
                                className={cn(
                                  'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition',
                                  task.isCompleted
                                    ? 'border-emerald-300/80 bg-emerald-50/90 dark:bg-emerald-950/40'
                                    : 'border-transparent bg-white/60 hover:border-violet-200 dark:bg-slate-800/60',
                                  patching && 'opacity-60',
                                )}
                              >
                                {task.isCompleted ? (
                                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                                ) : (
                                  <Circle className="h-5 w-5 shrink-0 text-violet-400" />
                                )}
                                <span
                                  className={cn(
                                    'flex-1 text-sm',
                                    task.isCompleted
                                      ? 'text-emerald-900 line-through decoration-emerald-600/50 dark:text-emerald-100'
                                      : 'text-slate-800 dark:text-slate-100',
                                  )}
                                >
                                  {task.subTaskName}
                                </span>
                              </button>
                            ) : (
                              <div className="flex w-full items-center gap-3 rounded-lg border border-transparent bg-white/60 px-3 py-2.5 dark:bg-slate-800/60">
                                {task.isCompleted ? (
                                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500/80" />
                                ) : (
                                  <Circle className="h-5 w-5 shrink-0 text-slate-300 dark:text-slate-600" />
                                )}
                                <span
                                  className={cn(
                                    'flex-1 text-sm',
                                    task.isCompleted
                                      ? 'text-emerald-800/80 line-through dark:text-emerald-200/80'
                                      : 'text-slate-600 dark:text-slate-400',
                                  )}
                                >
                                  {task.subTaskName}
                                </span>
                              </div>
                            )}
                          </li>
                        )
                      })
                    )}
                  </ul>
                </>
              )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
