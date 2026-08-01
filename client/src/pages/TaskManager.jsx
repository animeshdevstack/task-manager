import { useEffect, useMemo, useState } from 'react'
import { useToday } from '@/hooks/useToday'
import { Link, useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  Copy,
  Lock,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Unlock,
} from 'lucide-react'
import AppPageHeader from '@/components/layout/AppPageHeader'
import DatedDatePicker from '@/components/tasks/DatedDatePicker'
import MonthNavBar, { addMonths } from '@/components/tasks/MonthNavBar'
import TaskListPagination, {
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
import { Input } from '@/components/ui/input'
import { clearSession, getStoredUser } from '@/lib/auth-api'
import { tasksRequest } from '@/lib/tasks-api'
import { cn } from '@/lib/utils'

/** Scrollable task list (height comes from grid row minmax(0, 1fr)). */
const TASK_LIST_SCROLL_CLASS =
  'min-h-0 w-full min-w-0 overflow-y-auto overflow-x-hidden overscroll-y-contain scroll-smooth [scrollbar-gutter:stable]'

/** Inset focus ring + hover border so inputs do not overlap neighbors. */
const TASK_INPUT_CLASS =
  'min-w-0 rounded-md border-white/80 bg-white/90 text-base transition-colors hover:border-violet-300/80 focus-visible:border-violet-400 focus-visible:ring-2 focus-visible:ring-violet-400/30 focus-visible:ring-inset focus-visible:ring-offset-0 dark:border-slate-700 dark:bg-slate-900/90 dark:hover:border-violet-600/60 md:text-sm'

const TASK_ADD_INPUT_CLASS = cn(TASK_INPUT_CLASS, 'h-9 flex-1 md:h-8')

const TASK_EDIT_INPUT_CLASS = cn(TASK_INPUT_CLASS, 'h-9 flex-1 md:h-8')

const TASK_MANAGER_TAB_KEY = 'task-manager-active-tab'
const TASK_MANAGER_PAGE_KEY = 'task-manager-list-pages'
const VALID_TASK_TABS = new Set(['daily', 'weekly', 'monthly', 'dated'])
const DEFAULT_LIST_PAGE = { daily: 1, weekly: 1, monthly: 1, dated: 1 }

function getStoredTaskTab() {
  try {
    const stored = sessionStorage.getItem(TASK_MANAGER_TAB_KEY)
    if (stored && VALID_TASK_TABS.has(stored)) return stored
  } catch {
    /* ignore */
  }
  return 'daily'
}

function getStoredListPages() {
  try {
    const raw = sessionStorage.getItem(TASK_MANAGER_PAGE_KEY)
    if (!raw) return { ...DEFAULT_LIST_PAGE }
    const parsed = JSON.parse(raw)
    const out = { ...DEFAULT_LIST_PAGE }
    for (const key of ['daily', 'weekly', 'monthly', 'dated']) {
      const n = Number(parsed?.[key])
      if (Number.isFinite(n) && n >= 1) out[key] = Math.floor(n)
    }
    return out
  } catch {
    return { ...DEFAULT_LIST_PAGE }
  }
}

const TASK_SECTIONS = [
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
  {
    key: 'dated',
    title: 'Add-ons',
    description: 'Extra tasks for a chosen day · not copied from previous months',
    accent: 'from-sky-500 to-blue-500',
    ring: 'ring-sky-400/40',
    bg: 'bg-sky-50/80 dark:bg-sky-950/30',
    listBorder: 'border-sky-200/80',
  },
]

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

function editableDateBounds(monthKey, referenceDate) {
  const { min: monthStart, max } = monthDateBounds(monthKey)
  const todayStr = formatDateYmd(referenceDate)
  const min = todayStr >= monthStart && todayStr <= max ? todayStr : monthStart
  return { min, max }
}

function isAllowedDatedTaskDate(dateStr, monthKey, referenceDate) {
  const { min, max } = editableDateBounds(monthKey, referenceDate)
  return dateStr >= min && dateStr <= max
}

function defaultSelectedDate(monthKey, referenceDate) {
  return editableDateBounds(monthKey, referenceDate).min
}

function defaultViewSelectedDate(monthKey, referenceDate, isViewingCurrentMonth) {
  if (isViewingCurrentMonth) return defaultSelectedDate(monthKey, referenceDate)
  return monthDateBounds(monthKey).min
}

function isDateInViewMonth(dateStr, monthKey) {
  const { min, max } = monthDateBounds(monthKey)
  return dateStr >= min && dateStr <= max
}

function shiftDateYmd(ymd, deltaDays) {
  const [y, m, d] = ymd.split('-').map(Number)
  return formatDateYmd(new Date(y, m - 1, d + deltaDays))
}

function fromDocDatedTasks(arr) {
  if (!Array.isArray(arr)) return []
  return arr
    .map((entry) => {
      const date = typeof entry?.date === 'string' ? entry.date.trim() : ''
      if (!date) return null
      return { date, tasks: fromDocTasks(entry.tasks) }
    })
    .filter(Boolean)
}

function toDatedTasksPayload(datedGroups) {
  if (!Array.isArray(datedGroups)) return []
  return datedGroups
    .map((group) => ({
      date: group.date,
      tasks: toTaskPayload(group.tasks),
    }))
    .filter((group) => group.tasks.length > 0)
}

function getSelectedDateTasks(datedGroups, selectedDate) {
  const hit = datedGroups.find((g) => g.date === selectedDate)
  return hit?.tasks ?? []
}

function upsertSelectedDateTasks(datedGroups, selectedDate, tasks) {
  const rest = datedGroups.filter((g) => g.date !== selectedDate)
  if (!tasks.length) return rest
  return [...rest, { date: selectedDate, tasks }].sort((a, b) =>
    a.date.localeCompare(b.date),
  )
}

function countDatedTasks(datedGroups) {
  return (datedGroups ?? []).reduce((sum, g) => sum + (g.tasks?.length ?? 0), 0)
}

function formatYearMonth(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function formatMonthTitle(d) {
  return d.toLocaleString(undefined, { month: 'long', year: 'numeric' })
}

const CLONEABLE_SECTIONS = ['daily', 'weekly', 'monthly']

const CLONE_SECTION_LABELS = {
  daily: 'daily',
  weekly: 'weekly',
  monthly: 'monthly',
}

const PREV_PLAN_TASK_FIELDS = {
  daily: 'DailyTasks',
  weekly: 'WeeklyTasks',
  monthly: 'MonthlyTasks',
}

function previousMonthKey(monthKey) {
  const [year, monthNum] = monthKey.split('-').map(Number)
  return formatYearMonth(new Date(year, monthNum - 2, 1))
}

function previousMonthTitle(monthKey) {
  const [year, monthNum] = monthKey.split('-').map(Number)
  return formatMonthTitle(new Date(year, monthNum - 2, 1))
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
      const isPrivate = Boolean(
        typeof item === 'object' && item != null && item.isPrivate,
      )
      const base = { taskName, isPrivate }
      return id ? { _id: id, ...base } : base
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
      return { id, taskName, isPrivate: Boolean(x?.isPrivate) }
    })
    .filter(Boolean)
}

function clonePlanTasks(arr) {
  return fromDocTasks(arr).map(({ taskName, isPrivate }) => ({
    taskName,
    isPrivate,
  }))
}

function planFromTasksResponse(data) {
  return data?.task ?? data?.tasks?.[0] ?? null
}

async function fetchPlanForMonth(monthKey) {
  const res = await tasksRequest(
    `/get-tasks?month=${encodeURIComponent(monthKey)}`,
  )
  return planFromTasksResponse(res.data)
}

export default function TaskManager() {
  const navigate = useNavigate()
  const tasksPerPage = useTasksPerPage()
  const [user] = useState(getStoredUser)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [cloning, setCloning] = useState(false)
  const [toast, setToast] = useState(null)
  const [editing, setEditing] = useState(null)
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const showToast = (message, variant = 'success') => {
    setToast({ message, variant })
  }

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(null), TOAST_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  const today = useToday()
  const currentMonthKey = useMemo(() => formatYearMonth(today), [today])
  const currentMonthTitle = useMemo(() => formatMonthTitle(today), [today])
  const monthKey = useMemo(() => formatYearMonth(viewMonth), [viewMonth])
  const monthTitle = useMemo(() => formatMonthTitle(viewMonth), [viewMonth])
  const isViewingCurrentMonth = monthKey === currentMonthKey
  const canEdit = isViewingCurrentMonth
  const prevMonthTitle = useMemo(
    () => previousMonthTitle(currentMonthKey),
    [currentMonthKey],
  )
  const viewMonthBounds = useMemo(() => monthDateBounds(monthKey), [monthKey])
  const datedPickerBounds = useMemo(
    () => (isViewingCurrentMonth ? editableDateBounds(monthKey, today) : viewMonthBounds),
    [isViewingCurrentMonth, monthKey, today, viewMonthBounds],
  )

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

  const [existingId, setExistingId] = useState(null)
  const [dailyTasks, setDailyTasks] = useState([])
  const [weeklyTasks, setWeeklyTasks] = useState([])
  const [monthlyTasks, setMonthlyTasks] = useState([])
  const [datedTasks, setDatedTasks] = useState([])
  const [selectedDate, setSelectedDate] = useState(() =>
    defaultSelectedDate(formatYearMonth(new Date()), new Date()),
  )
  const [dailyDraft, setDailyDraft] = useState('')
  const [weeklyDraft, setWeeklyDraft] = useState('')
  const [monthlyDraft, setMonthlyDraft] = useState('')
  const [datedDraft, setDatedDraft] = useState('')
  const [listPage, setListPage] = useState(getStoredListPages)
  const [activeTab, setActiveTab] = useState(getStoredTaskTab)

  useEffect(() => {
    try {
      sessionStorage.setItem(TASK_MANAGER_TAB_KEY, activeTab)
    } catch {
      /* ignore */
    }
  }, [activeTab])

  useEffect(() => {
    try {
      sessionStorage.setItem(TASK_MANAGER_PAGE_KEY, JSON.stringify(listPage))
    } catch {
      /* ignore */
    }
  }, [listPage])

  useEffect(() => {
    setSelectedDate((prev) => {
      const { min, max } = datedPickerBounds
      if (prev >= min && prev <= max) return prev
      return defaultViewSelectedDate(monthKey, today, isViewingCurrentMonth)
    })
    if (!isViewingCurrentMonth) setEditing(null)
  }, [monthKey, isViewingCurrentMonth, datedPickerBounds.min, datedPickerBounds.max, today])

  const selectedDateTaskCount = useMemo(
    () => getSelectedDateTasks(datedTasks, selectedDate).length,
    [datedTasks, selectedDate],
  )

  useEffect(() => {
    setListPage((prev) => ({
      daily: Math.min(prev.daily, totalPages(dailyTasks.length, tasksPerPage)),
      weekly: Math.min(prev.weekly, totalPages(weeklyTasks.length, tasksPerPage)),
      monthly: Math.min(prev.monthly, totalPages(monthlyTasks.length, tasksPerPage)),
      dated: Math.min(prev.dated, totalPages(selectedDateTaskCount, tasksPerPage)),
    }))
  }, [
    tasksPerPage,
    dailyTasks.length,
    weeklyTasks.length,
    monthlyTasks.length,
    selectedDateTaskCount,
  ])

  function goToPage(section, nextPage) {
    const { tasks } = getSectionState(section)
    const max = totalPages(tasks.length, tasksPerPage)
    setListPage((p) => ({
      ...p,
      [section]: Math.max(1, Math.min(max, nextPage)),
    }))
  }

  useEffect(() => {
    let cancelled = false

    async function loadMonthPlan() {
      setLoading(true)
      try {
        const hit = await fetchPlanForMonth(monthKey)
        if (cancelled) return
        if (hit?._id) {
          setExistingId(hit._id)
          setDailyTasks(fromDocTasks(hit.DailyTasks))
          setWeeklyTasks(fromDocTasks(hit.WeeklyTasks))
          setMonthlyTasks(fromDocTasks(hit.MonthlyTasks))
          setDatedTasks(fromDocDatedTasks(hit.DatedTasks))
          const counts = {
            daily: fromDocTasks(hit.DailyTasks).length,
            weekly: fromDocTasks(hit.WeeklyTasks).length,
            monthly: fromDocTasks(hit.MonthlyTasks).length,
            dated: getSelectedDateTasks(
              fromDocDatedTasks(hit.DatedTasks),
              selectedDate,
            ).length,
          }
          setListPage((prev) => ({
            daily: Math.min(prev.daily, totalPages(counts.daily, tasksPerPage)),
            weekly: Math.min(prev.weekly, totalPages(counts.weekly, tasksPerPage)),
            monthly: Math.min(prev.monthly, totalPages(counts.monthly, tasksPerPage)),
            dated: Math.min(prev.dated, totalPages(counts.dated, tasksPerPage)),
          }))
        } else {
          setExistingId(null)
          setDailyTasks([])
          setWeeklyTasks([])
          setMonthlyTasks([])
          setDatedTasks([])
          setListPage({ daily: 1, weekly: 1, monthly: 1, dated: 1 })
        }
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
      setDatedTasks(fromDocDatedTasks(hit.DatedTasks))
    } else {
      setExistingId(null)
      setDailyTasks([])
      setWeeklyTasks([])
      setMonthlyTasks([])
      setDatedTasks([])
    }

    const datedFromHit = hit?._id ? fromDocDatedTasks(hit.DatedTasks) : []
    const counts = {
      daily: hit?._id ? fromDocTasks(hit.DailyTasks).length : 0,
      weekly: hit?._id ? fromDocTasks(hit.WeeklyTasks).length : 0,
      monthly: hit?._id ? fromDocTasks(hit.MonthlyTasks).length : 0,
      dated: getSelectedDateTasks(datedFromHit, selectedDate).length,
    }

    setListPage((prev) => ({
      daily:
        lastPageSection === 'daily'
          ? totalPages(counts.daily, tasksPerPage)
          : Math.min(prev.daily, totalPages(counts.daily, tasksPerPage)),
      weekly:
        lastPageSection === 'weekly'
          ? totalPages(counts.weekly, tasksPerPage)
          : Math.min(prev.weekly, totalPages(counts.weekly, tasksPerPage)),
      monthly:
        lastPageSection === 'monthly'
          ? totalPages(counts.monthly, tasksPerPage)
          : Math.min(prev.monthly, totalPages(counts.monthly, tasksPerPage)),
      dated:
        lastPageSection === 'dated'
          ? totalPages(counts.dated, tasksPerPage)
          : Math.min(prev.dated, totalPages(counts.dated, tasksPerPage)),
    }))
  }

  async function refetchMonthPlan(options = {}) {
    const hit = await fetchPlanForMonth(monthKey)
    applyPlanFromHit(hit, options)
    return hit
  }

  function buildPayload(lists) {
    return {
      DailyTasks: toTaskPayload(lists.daily),
      WeeklyTasks: toTaskPayload(lists.weekly),
      MonthlyTasks: toTaskPayload(lists.monthly),
      DatedTasks: toDatedTasksPayload(lists.dated),
    }
  }

  function isPayloadEmpty(body) {
    return (
      body.DailyTasks.length === 0 &&
      body.WeeklyTasks.length === 0 &&
      body.MonthlyTasks.length === 0 &&
      (body.DatedTasks?.length ?? 0) === 0
    )
  }

  async function persistLists(lists, options = {}) {
    if (!canEdit) {
      throw new Error('Tasks can only be modified for the current month')
    }
    if (loading) {
      throw new Error('Still loading your plan. Please try again.')
    }

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
          body: JSON.stringify({
            ...body,
            currentMonthAndYear: currentMonthKey,
          }),
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
    if (section === 'monthly') {
      return {
        tasks: monthlyTasks,
        setTasks: setMonthlyTasks,
        draft: monthlyDraft,
        setDraft: setMonthlyDraft,
      }
    }
    const tasks = getSelectedDateTasks(datedTasks, selectedDate)
    return {
      tasks,
      setTasks: (next) => setDatedTasks(upsertSelectedDateTasks(datedTasks, selectedDate, next)),
      draft: datedDraft,
      setDraft: setDatedDraft,
    }
  }

  function currentLists() {
    return { daily: dailyTasks, weekly: weeklyTasks, monthly: monthlyTasks, dated: datedTasks }
  }

  function listsWithSectionUpdate(section, nextTasks) {
    if (section === 'dated') {
      return {
        ...currentLists(),
        dated: upsertSelectedDateTasks(datedTasks, selectedDate, nextTasks),
      }
    }
    return { ...currentLists(), [section]: nextTasks }
  }

  async function onAdd(section) {
    if (!canEdit) {
      showToast('Tasks can only be modified for the current month', 'error')
      return
    }
    const { tasks, setTasks, draft, setDraft } = getSectionState(section)
    const name = draft.trim()
    if (!name) return

    if (section === 'dated' && !isAllowedDatedTaskDate(selectedDate, currentMonthKey, today)) {
      showToast('Choose today or a future date in this month', 'error')
      return
    }

    const next = [...tasks, { taskName: name, isPrivate: false }]
    setTasks(next)
    setDraft('')
    setListPage((p) => ({
      ...p,
      [section]: totalPages(next.length, tasksPerPage),
    }))

    try {
      await persistLists(listsWithSectionUpdate(section, next), { lastPageSection: section })
      showToast('Task added', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save', 'error')
      await refetchMonthPlan({ lastPageSection: section })
    }
  }

  async function onRemove(section, index) {
    if (!canEdit) {
      showToast('Tasks can only be modified for the current month', 'error')
      return
    }
    const { tasks, setTasks } = getSectionState(section)
    const next = tasks.filter((_, i) => i !== index)
    setTasks(next)
    setListPage((p) => ({
      ...p,
      [section]: Math.min(p[section], totalPages(next.length, tasksPerPage)),
    }))
    setEditing((e) => (e?.section === section && e?.index === index ? null : e))

    if (!existingId && next.length === 0) {
      const lists = listsWithSectionUpdate(section, next)
      if (
        lists.daily.length === 0 &&
        lists.weekly.length === 0 &&
        lists.monthly.length === 0 &&
        countDatedTasks(lists.dated) === 0
      ) {
        return
      }
    }

    try {
      await persistLists(listsWithSectionUpdate(section, next))
      showToast('Task removed', 'remove')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save', 'error')
      await refetchMonthPlan()
    }
  }

  async function onTogglePrivate(section, index) {
    if (!canEdit) {
      showToast('Tasks can only be modified for the current month', 'error')
      return
    }
    const { tasks, setTasks } = getSectionState(section)
    const next = tasks.map((t, i) =>
      i === index ? { ...t, isPrivate: !t.isPrivate } : t,
    )
    setTasks(next)

    try {
      await persistLists(listsWithSectionUpdate(section, next))
      showToast(
        next[index]?.isPrivate ? 'Task marked private' : 'Task visible to followers',
        'info',
      )
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save', 'error')
      await refetchMonthPlan()
    }
  }

  async function onSaveEdit(section, index, value) {
    if (!canEdit) {
      showToast('Tasks can only be modified for the current month', 'error')
      return
    }
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
      await persistLists(listsWithSectionUpdate(section, next))
      showToast('Task updated', 'warning')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save', 'error')
      await refetchMonthPlan()
    }
  }

  async function onSave(e) {
    e.preventDefault()
    if (!canEdit) {
      showToast('Tasks can only be modified for the current month', 'error')
      return
    }
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

  async function cloneFromPreviousMonth(sections = CLONEABLE_SECTIONS) {
    if (!canEdit) {
      showToast('Tasks can only be modified for the current month', 'error')
      return
    }
    if (loading) {
      showToast('Still loading your plan. Please try again.', 'error')
      return
    }
    setCloning(true)
    try {
      const prevHit = await fetchPlanForMonth(previousMonthKey(currentMonthKey))

      if (!prevHit) {
        showToast(`No plan found for ${prevMonthTitle}.`, 'error')
        return
      }

      const currentBySection = {
        daily: dailyTasks,
        weekly: weeklyTasks,
        monthly: monthlyTasks,
      }
      const copied = []
      const skipped = []
      const emptySource = []
      const nextLists = currentLists()

      for (const section of sections) {
        if (!CLONEABLE_SECTIONS.includes(section)) continue

        const currentTasks = currentBySection[section]
        const field = PREV_PLAN_TASK_FIELDS[section]
        const prevTasks = clonePlanTasks(prevHit[field] ?? [])

        if (currentTasks.length > 0) {
          skipped.push(CLONE_SECTION_LABELS[section])
          continue
        }
        if (prevTasks.length === 0) {
          emptySource.push(CLONE_SECTION_LABELS[section])
          continue
        }

        nextLists[section] = prevTasks
        copied.push(CLONE_SECTION_LABELS[section])
      }

      if (copied.length === 0) {
        const parts = []
        if (skipped.length > 0) {
          parts.push(`${skipped.join(', ')} already have tasks — skipped`)
        }
        if (emptySource.length > 0) {
          parts.push(`no ${emptySource.join(', ')} tasks in ${prevMonthTitle}`)
        }
        showToast(parts.length > 0 ? `${parts.join('; ')}.` : 'Nothing to copy.', 'info')
        return
      }

      if (copied.includes('daily')) setDailyTasks(nextLists.daily)
      if (copied.includes('weekly')) setWeeklyTasks(nextLists.weekly)
      if (copied.includes('monthly')) setMonthlyTasks(nextLists.monthly)

      setListPage((p) => ({
        ...p,
        ...(copied.includes('daily') && {
          daily: totalPages(nextLists.daily.length, tasksPerPage),
        }),
        ...(copied.includes('weekly') && {
          weekly: totalPages(nextLists.weekly.length, tasksPerPage),
        }),
        ...(copied.includes('monthly') && {
          monthly: totalPages(nextLists.monthly.length, tasksPerPage),
        }),
      }))

      await persistLists(nextLists)

      let msg = `Copied ${copied.join(', ')} tasks from ${prevMonthTitle}.`
      if (skipped.length > 0) {
        const skippedLabel = skipped
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(', ')
        msg += ` ${skippedLabel} already had tasks — skipped.`
      }
      showToast(msg, 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not copy from last month', 'error')
      await refetchMonthPlan()
    } finally {
      setCloning(false)
    }
  }

  const tabMeta = TASK_SECTIONS.find((t) => t.key === activeTab) ?? TASK_SECTIONS[0]
  const totalTaskCount =
    dailyTasks.length +
    weeklyTasks.length +
    monthlyTasks.length +
    countDatedTasks(datedTasks)

  function renderSectionCard(s, cardClassName) {
    const { tasks, draft, setDraft } = getSectionState(s.key)
    const page = listPage[s.key]
    const pages = totalPages(tasks.length, tasksPerPage)
    const start = (page - 1) * tasksPerPage
    const pageTasks = tasks.slice(start, start + tasksPerPage)

    return (
      <Card
        key={s.key}
        className={cn(
          'flex min-h-0 flex-col overflow-hidden border-0 shadow-md ring-1',
          s.ring,
          cardClassName,
        )}
      >
        <CardHeader
          className={cn(
            'shrink-0 space-y-0.5 bg-gradient-to-r px-3 py-2.5 text-white',
            s.accent,
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="text-base leading-tight">{s.title}</CardTitle>
              <CardDescription className="text-xs leading-tight text-white/90">
                {s.description}
              </CardDescription>
            </div>
            {CLONEABLE_SECTIONS.includes(s.key) && canEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 shrink-0 gap-1 border-white/40 bg-white/15 px-2 text-[10px] text-white hover:bg-white/25 hover:text-white"
                disabled={loading || saving || cloning}
                title={`Copy ${s.title.toLowerCase()} from ${prevMonthTitle} (only if empty)`}
                onClick={() => void cloneFromPreviousMonth([s.key])}
              >
                <Copy className="h-3 w-3" aria-hidden />
                <span className="hidden sm:inline">Copy from last month</span>
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent
          className={cn(
            'grid min-h-0 w-full min-w-0 flex-1 gap-2.5 overflow-hidden p-2.5 pb-3 pt-1.5',
            s.key === 'dated'
              ? canEdit
                ? 'grid-rows-[auto_auto_minmax(0,1fr)_auto]'
                : 'grid-rows-[auto_minmax(0,1fr)_auto]'
              : canEdit
                ? 'grid-rows-[auto_minmax(0,1fr)_auto]'
                : 'grid-rows-[minmax(0,1fr)_auto]',
            s.bg,
          )}
        >
          {s.key === 'dated' ? (
            <DatedDatePicker
              id="dated-task-date"
              value={selectedDate}
              min={datedPickerBounds.min}
              max={datedPickerBounds.max}
              disabled={loading || saving || cloning}
              prevDisabled={selectedDate <= datedPickerBounds.min}
              nextDisabled={selectedDate >= datedPickerBounds.max}
              onPrev={() => setSelectedDate(shiftDateYmd(selectedDate, -1))}
              onNext={() => setSelectedDate(shiftDateYmd(selectedDate, 1))}
              onChange={(e) => {
                const value = e.target.value
                if (!value) return
                if (canEdit && !isAllowedDatedTaskDate(value, currentMonthKey, today)) {
                  showToast('Choose today or a future date in this month', 'error')
                  return
                }
                if (!canEdit && !isDateInViewMonth(value, monthKey)) return
                setSelectedDate(value)
                setListPage((p) => ({ ...p, dated: 1 }))
              }}
            />
          ) : null}
          {canEdit ? (
          <div className="flex items-center gap-1.5">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={s.key === 'dated' ? 'Add a daily extra…' : 'Add a task…'}
              disabled={loading || saving || cloning}
              className={TASK_ADD_INPUT_CLASS}
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
              className="h-9 shrink-0 px-2 md:h-8"
              disabled={loading || saving || cloning || !draft.trim()}
              onClick={() => void onAdd(s.key)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          ) : null}

          <ul
            className={cn(
              'min-h-0 space-y-1 rounded-lg border bg-white/70 p-2 pb-2 dark:bg-slate-900/40',
              TASK_LIST_SCROLL_CLASS,
              s.listBorder,
            )}
          >
            {loading ? (
              <li className="py-6 text-center text-xs text-slate-500">Loading…</li>
            ) : pageTasks.length === 0 ? (
              <li className="px-2 py-6 text-center text-xs leading-relaxed text-slate-500">
                {s.key === 'dated' ? (
                  canEdit ? 'No tasks yet' : 'No daily extras on this date'
                ) : canEdit ? (
                  <>
                    No tasks yet. Use{' '}
                    <span className="font-semibold text-slate-600 dark:text-slate-400">
                      Copy from last month
                    </span>{' '}
                    above, or add one below.
                  </>
                ) : (
                  `No ${s.title.toLowerCase()} in ${monthTitle}.`
                )}
              </li>
            ) : (
              pageTasks.map((task, i) => {
                const index = start + i
                const isEditing = editing?.section === s.key && editing?.index === index

                return (
                  <li
                    key={`${s.key}-${task.id ?? index}-${task.taskName}`}
                    className="flex min-h-11 min-w-0 items-center gap-1.5 rounded-md border border-transparent bg-white/60 px-2.5 py-2 dark:bg-slate-800/60 md:min-h-[2.5rem] md:gap-1 md:px-2 md:py-1"
                  >
                    {isEditing ? (
                      <Input
                        autoFocus
                        defaultValue={task.taskName}
                        className={TASK_EDIT_INPUT_CLASS}
                        disabled={saving}
                        onBlur={(e) => void onSaveEdit(s.key, index, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            void onSaveEdit(s.key, index, e.currentTarget.value)
                          }
                          if (e.key === 'Escape') setEditing(null)
                        }}
                      />
                    ) : (
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate text-lg font-medium leading-snug md:text-sm md:font-normal',
                          task.isPrivate
                            ? 'text-violet-700 dark:text-violet-300'
                            : 'text-slate-800 dark:text-slate-100',
                        )}
                      >
                        {task.taskName}
                        {task.isPrivate ? (
                          <span className="ml-1 text-[10px] font-normal text-violet-500">
                            (private)
                          </span>
                        ) : null}
                      </span>
                    )}
                    {canEdit ? (
                      <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'h-8 w-8 shrink-0 p-0 md:h-7 md:w-7',
                        task.isPrivate
                          ? 'text-amber-700 hover:text-amber-800'
                          : 'text-slate-400 hover:text-violet-700',
                      )}
                      disabled={loading || saving || isEditing}
                      onClick={() => void onTogglePrivate(s.key, index)}
                      aria-label={task.isPrivate ? 'Make visible to followers' : 'Mark private'}
                      title={task.isPrivate ? 'Visible to followers' : 'Private from followers'}
                    >
                      {task.isPrivate ? (
                        <Lock className="h-4 w-4 md:h-3.5 md:w-3.5" />
                      ) : (
                        <Unlock className="h-4 w-4 md:h-3.5 md:w-3.5" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 shrink-0 p-0 text-violet-700 md:h-7 md:w-7"
                      disabled={loading || saving}
                      onClick={() => setEditing({ section: s.key, index })}
                      aria-label="Edit task"
                    >
                      <Pencil className="h-4 w-4 md:h-3.5 md:w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 shrink-0 p-0 text-red-600 hover:text-red-700 md:h-7 md:w-7"
                      disabled={loading || saving}
                      onClick={() => void onRemove(s.key, index)}
                      aria-label="Delete task"
                    >
                      <Trash2 className="h-4 w-4 md:h-3.5 md:w-3.5" />
                    </Button>
                      </>
                    ) : null}
                  </li>
                )
              })
            )}
          </ul>

          <TaskListPagination
            sectionKey={s.key}
            tasks={tasks}
            page={page}
            pages={pages}
            disabled={loading || saving || cloning}
            onPageChange={(next) => goToPage(s.key, next)}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gradient-to-br from-violet-200/70 via-fuchsia-100/80 to-cyan-200/70">
      <AppPageHeader
        title="Task Planner"
        subtitle="Your colorful command center"
        icon={Sparkles}
        onSignOut={signOut}
        navContext="tasks"
        maxWidthClass="max-w-4xl"
      />

      <main className="flex min-h-0 w-full flex-1 flex-col overflow-hidden px-6 py-2 sm:px-10 md:px-14 lg:px-20">
        {toast ? <Toast message={toast.message} variant={toast.variant} /> : null}

        <form
          onSubmit={onSave}
          className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col overflow-hidden"
        >
          <div className="mb-2 shrink-0 overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 p-px shadow-md">
            <div className="flex flex-col rounded-[11px] bg-white/95 backdrop-blur dark:bg-slate-950/95">
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                <div className="flex min-w-0 items-center gap-2">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0 text-fuchsia-600" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-fuchsia-700">
                      {isViewingCurrentMonth ? 'Current month' : 'Viewing month — read only'}
                    </p>
                    <h1 className="truncate text-base font-bold leading-tight text-slate-900 dark:text-white">
                      {monthTitle}
                    </h1>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  {canEdit ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="hidden h-7 gap-1 border-fuchsia-200/80 bg-white/80 px-2 text-[10px] font-medium text-fuchsia-900 hover:bg-fuchsia-50 md:inline-flex dark:border-fuchsia-800 dark:bg-slate-900/80 dark:text-fuchsia-100"
                    disabled={loading || saving || cloning}
                    title={`Copy daily, weekly, and monthly tasks from ${prevMonthTitle} (empty sections only)`}
                    onClick={() => void cloneFromPreviousMonth()}
                  >
                    <Copy className="h-3 w-3" aria-hidden />
                    Copy from last month
                  </Button>
                  ) : null}
                  <span className="rounded-md bg-violet-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-violet-900 dark:bg-violet-950 dark:text-violet-100">
                    {monthKey}
                  </span>
                  <span className="rounded-md bg-fuchsia-50 px-2 py-0.5 text-[10px] font-medium text-fuchsia-900 ring-1 ring-fuchsia-200/80 dark:bg-fuchsia-950/50 dark:text-fuchsia-100">
                    {totalTaskCount} task{totalTaskCount === 1 ? '' : 's'} total
                  </span>
                </div>
              </div>

              <div className="border-t border-violet-100 px-2.5 py-1.5 dark:border-violet-900/50">
                <MonthNavBar
                  embedded
                  viewMonth={viewMonth}
                  onPrev={goPrevMonth}
                  onNext={goNextMonth}
                  disabled={loading || saving || cloning}
                  nextDisabled={isViewingCurrentMonth}
                >
                  {!isViewingCurrentMonth ? (
                    <button
                      type="button"
                      onClick={goToCurrentMonth}
                      disabled={loading || saving || cloning}
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
                  <span className="font-semibold">Back to {currentMonthTitle}</span> above to edit
                  tasks.
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2 pb-2 pt-1 md:pt-2">
            <div className="flex shrink-0 gap-1.5 rounded-lg bg-white/70 p-1.5 shadow-sm ring-1 ring-violet-200/60 dark:bg-slate-900/50">
              {TASK_SECTIONS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex-1 min-w-0 rounded-md px-2 py-2 text-xs font-semibold transition-colors sm:text-sm',
                    activeTab === tab.key
                      ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white'
                      : 'text-violet-900/70 hover:bg-violet-100/90 dark:text-violet-100/80 dark:hover:bg-violet-900/50',
                  )}
                >
                  {tab.title.replace(' tasks', '')}
                </button>
              ))}
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {renderSectionCard(tabMeta, 'flex min-h-0 w-full flex-1 flex-col')}
            </div>
          </div>

          <div className="mt-2 flex shrink-0 items-center justify-between gap-3 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
            <p className="min-w-0 flex-1 text-left text-[11px] leading-snug text-violet-900/70">
              {!canEdit
                ? 'Past plans cannot be changed here.'
                : existingId
                  ? `You already have a plan for ${monthTitle}. Trash deletes a task immediately; pencil edits save on blur.`
                  : `No plan for ${monthTitle} yet. Copy from last month, add tasks, or click Update this month to save.`}
            </p>
            {canEdit ? (
            <Button
              type="submit"
              size="sm"
              disabled={loading || saving || cloning || totalTaskCount === 0}
              className="h-9 shrink-0 px-5 text-sm bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-sm hover:from-violet-500 hover:to-fuchsia-500 md:h-8"
            >
              {saving ? 'Saving…' : 'Update this month'}
            </Button>
            ) : null}
          </div>
        </form>
      </main>
    </div>
  )
}
