import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToday } from '@/hooks/useToday'
import { Link, useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  ListChecks,
} from 'lucide-react'
import AppPageHeader from '@/components/layout/AppPageHeader'
import { HabitCompletionToggle } from '@/components/habits/HabitCompletionToggle'
import DatedDatePicker from '@/components/tasks/DatedDatePicker'
import MonthNavBar, { addMonths } from '@/components/tasks/MonthNavBar'
import TaskListPagination, {
  paginateSlice,
  totalPages,
  useTasksPerPage,
} from '@/components/tasks/TaskListPagination'
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
import {
  buildDatedSubTaskMap,
  dayYmdInMonth,
  defaultSelectedDateForMonth,
  formatDateYmd,
  matchesReviewSlotYmd,
  monthDateBounds,
  resolveYmdForInstant,
  shiftDateYmd,
  sundayYmdsInMonth,
} from '@/lib/dated-tasks'
import {
  getDailyColumnTheme,
  getWeekdayInitial,
  getWeeklySundayColumnTheme,
  DATED_ADDON_COLUMN_CELL_ACTIVE,
  DATED_ADDON_COLUMN_CELL_IDLE,
  DATED_ADDON_COLUMN_HEADER_ACTIVE,
  DATED_ADDON_COLUMN_HEADER_IDLE,
  MONTHLY_COLUMN_CELL_ACTIVE,
  MONTHLY_COLUMN_CELL_IDLE,
  MONTHLY_COLUMN_HEADER_ACTIVE,
  MONTHLY_COLUMN_HEADER_IDLE,
  TASK_COLUMN_CELL_CLASS,
  TASK_COLUMN_HEADER_CLASS,
  WEEKLY_HIGHLIGHT_CELL_CLASS,
  WEEKLY_HIGHLIGHT_HEADER_CLASS,
} from '@/lib/daily-grid-theme'
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

function isDateInMonth(date, viewMonth) {
  const d = new Date(date)
  return (
    d.getFullYear() === viewMonth.getFullYear() && d.getMonth() === viewMonth.getMonth()
  )
}

const HABIT_TRACKER_TAB_KEY = 'habit-tracker-active-tab'
const HABIT_TRACKER_PAGE_KEY = 'habit-tracker-list-pages'
const VALID_TABS = new Set(['daily', 'weekly', 'monthly', 'dated'])
const DEFAULT_LIST_PAGE = { monthly: 1, dated: 1 }

function getStoredHabitTab() {
  try {
    const stored = sessionStorage.getItem(HABIT_TRACKER_TAB_KEY)
    if (stored && VALID_TABS.has(stored)) return stored
  } catch {
    /* ignore */
  }
  return 'daily'
}

function getStoredListPages() {
  try {
    const raw = sessionStorage.getItem(HABIT_TRACKER_PAGE_KEY)
    if (!raw) return { ...DEFAULT_LIST_PAGE }
    const parsed = JSON.parse(raw)
    const out = { ...DEFAULT_LIST_PAGE }
    for (const key of ['monthly', 'dated']) {
      const n = Number(parsed?.[key])
      if (Number.isFinite(n) && n >= 1) out[key] = Math.floor(n)
    }
    return out
  } catch {
    return { ...DEFAULT_LIST_PAGE }
  }
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
    title: 'add-ons',
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
  const [listPage, setListPage] = useState(getStoredListPages)
  const tasksPerPage = useTasksPerPage()

  useEffect(() => {
    try {
      sessionStorage.setItem(HABIT_TRACKER_TAB_KEY, activeTab)
    } catch {
      /* ignore */
    }
  }, [activeTab])

  useEffect(() => {
    try {
      sessionStorage.setItem(HABIT_TRACKER_PAGE_KEY, JSON.stringify(listPage))
    } catch {
      /* ignore */
    }
  }, [listPage])
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const todayColumnRef = useRef(null)
  const weeklyColumnRef = useRef(null)

  const today = useToday()
  const monthKey = useMemo(() => formatYearMonth(viewMonth), [viewMonth])
  const monthTitle = useMemo(() => formatMonthTitle(viewMonth), [viewMonth])
  const currentMonthTitle = useMemo(() => formatMonthTitle(today), [today])
  const isViewingCurrentMonth = monthKey === formatYearMonth(today)
  const startOfToday = useMemo(() => startOfDay(today), [today])
  const todayYmd = useMemo(() => formatDateYmd(today), [today])
  const viewMonthBounds = useMemo(() => monthDateBounds(monthKey), [monthKey])
  const [selectedHabitDate, setSelectedHabitDate] = useState(() =>
    defaultSelectedDateForMonth(formatYearMonth(new Date()), new Date()),
  )

  const datedSubTaskMap = useMemo(
    () => buildDatedSubTaskMap(plan?.DatedTasks),
    [plan?.DatedTasks],
  )

  useEffect(() => {
    setSelectedHabitDate((prev) => {
      const { min, max } = monthDateBounds(monthKey)
      if (prev >= min && prev <= max) return prev
      return defaultSelectedDateForMonth(monthKey, today)
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
      const planRes = await tasksRequest(
        `/get-tasks?month=${encodeURIComponent(monthKey)}`,
      )
      const plan = planRes.data?.task ?? planRes.data?.tasks?.[0] ?? null

      if (!plan?._id) {
        setHasPlan(false)
        setPlan(null)
        setReview(null)
        return
      }

      setHasPlan(true)
      setPlan(plan)

      const reviewRes = await reviewRequest(
        `/get-user-review-task?month=${encodeURIComponent(monthKey)}`,
      )
      const summary = reviewRes.data?.task ?? reviewRes.data?.tasks?.[0] ?? null

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

  function tryToggleDailyExtra(type, dateYmd, subTaskId, nextCompleted) {
    if (!isViewingCurrentMonth || dateYmd !== todayYmd) {
      showToast('You can only update daily extras for today', 'error')
      return
    }
    void toggleTask(type, subTaskId, nextCompleted, dateYmd)
  }

  async function toggleTask(type, subTaskId, nextCompleted, dateYmd) {
    if (!review?._id || !dateYmd) return
    setPatching(true)
    try {
      await reviewRequest(`/update-user-review-task/${review._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          type,
          dateYmd,
          // Legacy servers require `date`; noon local keeps slot matching stable.
          date: `${dateYmd}T12:00:00`,
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
    for (let day = 1; day <= daysInMonth; day++) {
      const ymd = dayYmdInMonth(monthKey, day)
      const entry = review.DailyTasks.find((e) =>
        matchesReviewSlotYmd(new Date(e.todayDate), ymd),
      )
      if (entry) slotByDay.set(day, entry)
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

    const todayDay = isViewingCurrentMonth
      ? Number(todayYmd.split('-')[2]) || null
      : null
    const todaySlot = isViewingCurrentMonth
      ? review.DailyTasks.find((e) =>
          matchesReviewSlotYmd(new Date(e.todayDate), todayYmd),
        ) ?? null
      : null
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
  }, [review, monthKey, today, todayYmd, isViewingCurrentMonth, datedSubTaskMap])

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

    const sundayYmds = sundayYmdsInMonth(monthKey)
    const sundays = filteredWeeklySlots.map((entry, index) => {
      const d = startOfDay(new Date(entry.sundayDate))
      const dateYmd =
        resolveYmdForInstant(entry.sundayDate, sundayYmds) ?? formatDateYmd(d)
      return {
        index,
        date: entry.sundayDate,
        dateYmd,
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
        dateYmd: sundays[sundayIndex]?.dateYmd,
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
  }, [filteredWeeklySlots, monthKey, startOfToday, nextSundayIndex])

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
      const monthEndYmd = monthDateBounds(monthKey).max
      const monthEnd = startOfDay(new Date(`${monthEndYmd}T12:00:00`))
      return {
        type: 'monthly',
        date: monthlySlot.monthEndDate,
        dateYmd: monthEndYmd,
        label: formatDateLabel(new Date(monthlySlot.monthEndDate)),
        tasks: monthlySlot.Task ?? [],
        canEdit: monthEnd >= startOfToday,
      }
    }
    if (activeTab === 'dated' && review) {
      const slot = review.DailyTasks?.find((entry) =>
        matchesReviewSlotYmd(new Date(entry.todayDate), selectedHabitDate),
      )
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
        dateYmd: selectedHabitDate,
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

  const datedHabitTaskCount = useMemo(() => {
    if (!review) return 0
    const slot = review.DailyTasks?.find((entry) =>
      matchesReviewSlotYmd(new Date(entry.todayDate), selectedHabitDate),
    )
    const datedIdsForDay = new Set(
      [...datedSubTaskMap.entries()]
        .filter(([, dateYmd]) => dateYmd === selectedHabitDate)
        .map(([id]) => id),
    )
    return (slot?.Task ?? []).filter((t) => {
      const id = t.subTaskId?.toString?.() ?? String(t.subTaskId)
      return datedIdsForDay.has(id)
    }).length
  }, [review, selectedHabitDate, datedSubTaskMap])

  const tabTaskCounts = useMemo(
    () => ({
      monthly: monthlySlot?.Task?.length ?? 0,
      dated: datedHabitTaskCount,
    }),
    [monthlySlot?.Task?.length, datedHabitTaskCount],
  )

  useEffect(() => {
    setListPage((prev) => ({
      monthly: Math.min(prev.monthly, totalPages(tabTaskCounts.monthly, tasksPerPage)),
      dated: Math.min(prev.dated, totalPages(tabTaskCounts.dated, tasksPerPage)),
    }))
  }, [tasksPerPage, tabTaskCounts])

  function goToPage(section, nextPage) {
    const max = totalPages(tabTaskCounts[section] ?? 0, tasksPerPage)
    setListPage((p) => ({
      ...p,
      [section]: Math.max(1, Math.min(max, nextPage)),
    }))
  }

  const paginatedListTasks = useMemo(() => {
    const tasks = activeTasks?.tasks ?? []
    if (activeTab === 'monthly') {
      return paginateSlice(tasks, listPage.monthly, tasksPerPage)
    }
    if (activeTab === 'dated') {
      return paginateSlice(tasks, listPage.dated, tasksPerPage)
    }
    return tasks
  }, [activeTasks, activeTab, listPage.monthly, listPage.dated, tasksPerPage])

  useEffect(() => {
    if (activeTab !== 'daily' || loading || !review || !dailyGrid.isViewingCurrentMonth) return
    todayColumnRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [activeTab, loading, monthKey, dailyGrid.todayDay, dailyGrid.isViewingCurrentMonth])

  useEffect(() => {
    if (activeTab !== 'weekly' || loading || !review || weeklyGrid.highlightIndex == null) return
    weeklyColumnRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [activeTab, loading, monthKey, weeklyGrid.highlightIndex])

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
                  {activeTab === 'daily' && !loading && hasPlan && review ? (
                    <p className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-[10px] text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-sm bg-red-200 dark:bg-red-900/60"
                          aria-hidden
                        />
                        Weekend
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-flex gap-0.5" aria-hidden>
                          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-200 dark:bg-sky-900/60" />
                          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-200 dark:bg-emerald-900/60" />
                          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-orange-200 dark:bg-orange-900/60" />
                        </span>
                        Weekdays (unique per week)
                      </span>
                    </p>
                  ) : null}

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
                    <div className="min-h-0 flex-1 overflow-auto rounded-lg bg-white/80 dark:bg-slate-900/50">
                      <table className="w-max min-w-full border-collapse text-[11px]">
                        <thead>
                          <tr>
                            <th
                              className={cn(
                                'sticky left-0 z-20 min-w-[7.5rem] px-2 py-1.5 text-left font-semibold',
                                TASK_COLUMN_HEADER_CLASS,
                              )}
                            >
                              Task
                            </th>
                            {weeklyGrid.sundays.map((sunday, colIdx) => {
                              const isNext = colIdx === weeklyGrid.highlightIndex
                              const theme = getWeeklySundayColumnTheme(colIdx)
                              return (
                                <th
                                  key={`${sunday.date}-${colIdx}`}
                                  ref={isNext ? weeklyColumnRef : undefined}
                                  className={cn(
                                    'min-w-[3.25rem] px-1 py-1.5 text-center font-semibold leading-tight',
                                    isNext
                                      ? WEEKLY_HIGHLIGHT_HEADER_CLASS
                                      : theme.headerClass,
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
                            <tr key={task.id}>
                              <td
                                className={cn(
                                  'sticky left-0 z-10 max-w-[9rem] truncate px-2 py-1.5 text-left font-medium',
                                  TASK_COLUMN_CELL_CLASS,
                                )}
                              >
                                {task.name}
                              </td>
                              {weeklyGrid.sundays.map((sunday, colIdx) => {
                                const cell = weeklyGrid.getCell(task.id, colIdx)
                                const canEdit = cell?.canEdit
                                const isNext = colIdx === weeklyGrid.highlightIndex
                                const theme = getWeeklySundayColumnTheme(colIdx)

                                return (
                                  <td
                                    key={`${task.id}-${colIdx}`}
                                    className={cn(
                                      'p-0.5 text-center align-middle',
                                      isNext
                                        ? WEEKLY_HIGHLIGHT_CELL_CLASS
                                        : theme.cellClass,
                                    )}
                                  >
                                    {!cell ? (
                                      <span className="inline-block h-5 w-5" aria-hidden />
                                    ) : canEdit ? (
                                      <HabitCompletionToggle
                                        size="sm"
                                        checked={cell.isCompleted}
                                        disabled={patching}
                                        title={`${task.name} — ${sunday.label}`}
                                        onChange={(next) =>
                                          void toggleTask(
                                            'weekly',
                                            task.id,
                                            next,
                                            cell.dateYmd,
                                          )
                                        }
                                      />
                                    ) : (
                                      <HabitCompletionToggle
                                        size="sm"
                                        readOnly
                                        checked={cell.isCompleted}
                                        title="View only — check off on next Sunday"
                                      />
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
                    <div className="min-h-0 flex-1 overflow-auto rounded-lg bg-white/80 dark:bg-slate-900/50">
                      <table className="w-max min-w-full border-collapse text-[11px]">
                        <thead>
                          <tr>
                            <th
                              className={cn(
                                'sticky left-0 z-20 min-w-[7.5rem] px-2 py-1.5 text-left font-semibold',
                                TASK_COLUMN_HEADER_CLASS,
                              )}
                            >
                              Task
                            </th>
                            {dailyGrid.days.map((day) => {
                              const isToday =
                                dailyGrid.isViewingCurrentMonth && day === dailyGrid.todayDay
                              const theme = getDailyColumnTheme(day, monthKey)
                              return (
                                <th
                                  key={day}
                                  ref={isToday ? todayColumnRef : undefined}
                                  className={cn(
                                    'min-w-[1.75rem] px-0.5 py-1 text-center font-semibold leading-tight',
                                    theme.headerClass,
                                  )}
                                >
                                  <span className="block text-[11px]">{day}</span>
                                  <span className="block text-[8px] font-medium uppercase opacity-70">
                                    {getWeekdayInitial(day, monthKey)}
                                  </span>
                                </th>
                              )
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {dailyGrid.tasks.map((task) => (
                            <tr key={task.id}>
                              <td
                                className={cn(
                                  'sticky left-0 z-10 max-w-[9rem] truncate px-2 py-1.5 text-left font-medium',
                                  TASK_COLUMN_CELL_CLASS,
                                )}
                              >
                                {task.name}
                              </td>
                              {dailyGrid.days.map((day) => {
                                const cell = dailyGrid.getCell(task.id, day)
                                const isToday =
                                  dailyGrid.isViewingCurrentMonth && day === dailyGrid.todayDay
                                const canEdit = isToday && cell?.date
                                const theme = getDailyColumnTheme(day, monthKey)

                                return (
                                  <td
                                    key={day}
                                    className={cn(
                                      'p-0.5 text-center align-middle',
                                      theme.cellClass,
                                    )}
                                  >
                                    {!cell ? (
                                      <span className="inline-block h-5 w-5" aria-hidden />
                                    ) : canEdit ? (
                                      <HabitCompletionToggle
                                        size="sm"
                                        checked={cell.isCompleted}
                                        disabled={patching}
                                        title={`${task.name} — today`}
                                        onChange={(next) =>
                                          void toggleTask(
                                            'daily',
                                            task.id,
                                            next,
                                            todayYmd,
                                          )
                                        }
                                      />
                                    ) : (
                                      <HabitCompletionToggle
                                        size="sm"
                                        readOnly
                                        checked={cell.isCompleted}
                                        title={
                                          isToday
                                            ? undefined
                                            : 'View only — edit today’s column'
                                        }
                                      />
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

                  {!activeTasks?.tasks?.length ? (
                    <p className="py-8 text-center text-xs text-slate-500">
                      No daily extras for this day
                    </p>
                  ) : (
                    <div className="min-h-0 flex-1 overflow-auto rounded-lg bg-white/80 dark:bg-slate-900/50">
                      <table className="w-full border-collapse text-[11px]">
                        <thead>
                          <tr>
                            <th
                              className={cn(
                                'min-w-[7.5rem] px-2 py-1.5 text-left font-semibold',
                                TASK_COLUMN_HEADER_CLASS,
                              )}
                            >
                              Task
                            </th>
                            <th
                              className={cn(
                                'px-2 py-1.5 text-center font-semibold',
                                activeTasks.canEdit !== false
                                  ? DATED_ADDON_COLUMN_HEADER_ACTIVE
                                  : DATED_ADDON_COLUMN_HEADER_IDLE,
                              )}
                            >
                              {activeTasks?.label ?? 'Date'}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedListTasks.map((task) => {
                            const id = task.subTaskId?.toString?.() ?? String(task.subTaskId)
                            const canEdit = activeTasks.canEdit !== false
                            const cellClass = canEdit
                              ? DATED_ADDON_COLUMN_CELL_ACTIVE
                              : DATED_ADDON_COLUMN_CELL_IDLE

                            return (
                              <tr key={id}>
                                <td
                                  className={cn(
                                    'max-w-[9rem] truncate px-2 py-1.5 text-left font-medium',
                                    TASK_COLUMN_CELL_CLASS,
                                    task.isCompleted &&
                                      'text-emerald-900 line-through decoration-emerald-600/50 dark:text-emerald-100',
                                  )}
                                >
                                  {task.subTaskName}
                                </td>
                                <td
                                  className={cn(
                                    'p-0.5 text-center align-middle',
                                    cellClass,
                                  )}
                                >
                                  {canEdit ? (
                                    <HabitCompletionToggle
                                      size="sm"
                                      checked={task.isCompleted}
                                      disabled={patching}
                                      title={task.subTaskName}
                                      onChange={(next) =>
                                        tryToggleDailyExtra(
                                          activeTasks.type,
                                          activeTasks.dateYmd,
                                          id,
                                          next,
                                        )
                                      }
                                    />
                                  ) : (
                                    <HabitCompletionToggle
                                      size="sm"
                                      readOnly
                                      checked={task.isCompleted}
                                      title="View only — check off today only"
                                    />
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <TaskListPagination
                    sectionKey="Add-ons"
                    tasks={activeTasks?.tasks ?? []}
                    page={listPage.dated}
                    pages={totalPages(datedHabitTaskCount, tasksPerPage)}
                    disabled={loading || patching}
                    onPageChange={(p) => goToPage('dated', p)}
                  />
                </>
              ) : (
                <>
                  {!activeTasks?.tasks?.length ? (
                    <p className="py-8 text-center text-xs text-slate-500">
                      No habits in this section yet
                    </p>
                  ) : (
                    <div className="min-h-0 flex-1 overflow-auto rounded-lg bg-white/80 dark:bg-slate-900/50">
                      <table className="w-full border-collapse text-[11px]">
                        <thead>
                          <tr>
                            <th
                              className={cn(
                                'min-w-[7.5rem] px-2 py-1.5 text-left font-semibold',
                                TASK_COLUMN_HEADER_CLASS,
                              )}
                            >
                              Task
                            </th>
                            <th
                              className={cn(
                                'px-2 py-1.5 text-center font-semibold',
                                activeTasks.canEdit !== false
                                  ? MONTHLY_COLUMN_HEADER_ACTIVE
                                  : MONTHLY_COLUMN_HEADER_IDLE,
                              )}
                            >
                              {monthlySlot ? `Due ${activeTasks?.label}` : 'Due'}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedListTasks.map((task) => {
                            const id = task.subTaskId?.toString?.() ?? String(task.subTaskId)
                            const canEdit = activeTasks.canEdit !== false
                            const cellClass = canEdit
                              ? MONTHLY_COLUMN_CELL_ACTIVE
                              : MONTHLY_COLUMN_CELL_IDLE

                            return (
                              <tr key={id}>
                                <td
                                  className={cn(
                                    'max-w-[9rem] truncate px-2 py-1.5 text-left font-medium',
                                    TASK_COLUMN_CELL_CLASS,
                                    task.isCompleted &&
                                      'text-emerald-900 line-through decoration-emerald-600/50 dark:text-emerald-100',
                                  )}
                                >
                                  {task.subTaskName}
                                </td>
                                <td
                                  className={cn(
                                    'p-0.5 text-center align-middle',
                                    cellClass,
                                  )}
                                >
                                  {canEdit ? (
                                    <HabitCompletionToggle
                                      size="sm"
                                      checked={task.isCompleted}
                                      disabled={patching}
                                      title={task.subTaskName}
                                      onChange={(next) =>
                                        void toggleTask(
                                          activeTasks.type,
                                          id,
                                          next,
                                          activeTasks.dateYmd,
                                        )
                                      }
                                    />
                                  ) : (
                                    <HabitCompletionToggle
                                      size="sm"
                                      readOnly
                                      checked={task.isCompleted}
                                      title="View only — check off at month end"
                                    />
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <TaskListPagination
                    sectionKey="Monthly habits"
                    tasks={activeTasks?.tasks ?? []}
                    page={listPage.monthly}
                    pages={totalPages(tabTaskCounts.monthly, tasksPerPage)}
                    disabled={loading || patching}
                    onPageChange={(p) => goToPage('monthly', p)}
                  />
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
