import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Lock,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Unlock,
} from 'lucide-react'
import AppPageHeader from '@/components/layout/AppPageHeader'
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

const TASKS_PER_PAGE_DESKTOP = 5
const TASKS_PER_PAGE_MOBILE = 10
const MOBILE_MAX_WIDTH_PX = 767

/** Scrollable task list (height comes from grid row minmax(0, 1fr)). */
const TASK_LIST_SCROLL_CLASS =
  'min-h-0 w-full min-w-0 overflow-y-auto overflow-x-hidden overscroll-y-contain scroll-smooth [scrollbar-gutter:stable]'

function useTasksPerPage() {
  const [perPage, setPerPage] = useState(() => {
    if (typeof window === 'undefined') return TASKS_PER_PAGE_DESKTOP
    return window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH_PX}px)`).matches
      ? TASKS_PER_PAGE_MOBILE
      : TASKS_PER_PAGE_DESKTOP
  })

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH_PX}px)`)
    const sync = () =>
      setPerPage(mq.matches ? TASKS_PER_PAGE_MOBILE : TASKS_PER_PAGE_DESKTOP)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return perPage
}

const TASK_MANAGER_TAB_KEY = 'task-manager-active-tab'
const TASK_MANAGER_PAGE_KEY = 'task-manager-list-pages'
const VALID_TASK_TABS = new Set(['daily', 'weekly', 'monthly'])
const DEFAULT_LIST_PAGE = { daily: 1, weekly: 1, monthly: 1 }

function getStoredTaskTab() {
  try {
    const stored = sessionStorage.getItem(TASK_MANAGER_TAB_KEY)
    if (stored && VALID_TASK_TABS.has(stored)) return stored
  } catch {
    /* ignore */
  }
  return 'daily'
}

/** Page numbers with ellipsis when total > 7 (always includes first & last page). */
function getPaginationItems(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages = new Set([1, total, current, current - 1, current + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  const items = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      items.push(`gap-${sorted[i - 1]}-${sorted[i]}`)
    }
    items.push(sorted[i])
  }
  return items
}

function getStoredListPages() {
  try {
    const raw = sessionStorage.getItem(TASK_MANAGER_PAGE_KEY)
    if (!raw) return { ...DEFAULT_LIST_PAGE }
    const parsed = JSON.parse(raw)
    const out = { ...DEFAULT_LIST_PAGE }
    for (const key of ['daily', 'weekly', 'monthly']) {
      const n = Number(parsed?.[key])
      if (Number.isFinite(n) && n >= 1) out[key] = Math.floor(n)
    }
    return out
  } catch {
    return { ...DEFAULT_LIST_PAGE }
  }
}

function PaginationNavButton({
  disabled,
  onClick,
  label,
  children,
  className,
  compact,
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn(
        'shrink-0 border-violet-300/90 bg-white text-violet-900 shadow-sm hover:bg-violet-50 hover:text-violet-950 disabled:border-violet-200/60 disabled:bg-violet-50/40 disabled:text-violet-400',
        compact ? 'h-11 w-11 rounded-xl' : 'h-8 w-8 rounded-lg p-0',
        className,
      )}
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
    >
      {children}
    </Button>
  )
}

function TaskListPagination({ sectionKey, tasks, page, pages, disabled, onPageChange }) {
  if (tasks.length === 0) return null

  const pageItems = getPaginationItems(page, pages)
  const singlePage = pages <= 1
  const canGoBack = !disabled && !singlePage && page > 1
  const canGoForward = !disabled && !singlePage && page < pages

  return (
    <nav
      className="mt-1 w-full min-w-0 shrink-0 rounded-lg border-2 border-violet-300/70 bg-gradient-to-r from-violet-50 via-white to-fuchsia-50 p-2 shadow-md shadow-violet-200/50 ring-1 ring-violet-200/90 md:rounded-lg md:p-1.5 dark:from-violet-950/40 dark:via-slate-950 dark:to-fuchsia-950/30"
      aria-label={`${sectionKey} task pagination, page ${page} of ${pages}`}
    >
      {/* Mobile: large prev / page indicator / next */}
      <div className="flex items-center justify-between gap-2 md:hidden">
        <PaginationNavButton
          compact
          disabled={!canGoBack}
          onClick={() => onPageChange(page - 1)}
          label="Previous page"
        >
          <ChevronLeft className="h-5 w-5" />
        </PaginationNavButton>

        <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-center">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-700/80">
            Page
          </span>
          <span
            className={cn(
              'rounded-lg px-3 py-1 text-sm font-bold tabular-nums',
              singlePage
                ? 'bg-violet-100/80 text-violet-800/70'
                : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-sm',
            )}
          >
            {page}
            <span
              className={cn(
                'font-semibold',
                singlePage ? 'text-violet-600/60' : 'text-white/85',
              )}
            >
              {' '}
              /{' '}
            </span>
            {pages}
          </span>
        </div>

        <PaginationNavButton
          compact
          disabled={!canGoForward}
          onClick={() => onPageChange(page + 1)}
          label="Next page"
        >
          <ChevronRight className="h-5 w-5" />
        </PaginationNavButton>
      </div>

      {/* Desktop: compact icon nav + numbered pages */}
      <div className="hidden w-full min-w-0 items-center justify-between gap-1.5 md:flex">
        <div className="flex shrink-0 items-center gap-1">
          <PaginationNavButton
            disabled={!canGoBack}
            onClick={() => onPageChange(1)}
            label="First page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </PaginationNavButton>
          <PaginationNavButton
            disabled={!canGoBack}
            onClick={() => onPageChange(page - 1)}
            label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </PaginationNavButton>
        </div>

        <div
          className="flex min-w-0 flex-1 items-center justify-center gap-0.5 px-0.5"
          role="group"
          aria-label="Page numbers"
        >
          {pageItems.map((item) => {
            if (typeof item === 'string') {
              return (
                <span
                  key={item}
                  className="shrink-0 px-1 text-xs font-bold leading-none text-violet-600/50"
                  aria-hidden
                >
                  …
                </span>
              )
            }
            const isActive = item === page
            return (
              <button
                key={item}
                type="button"
                disabled={disabled || singlePage}
                onClick={() => onPageChange(item)}
                className={cn(
                  'flex h-8 min-w-8 shrink-0 items-center justify-center rounded-md px-1.5 text-xs font-bold tabular-nums transition',
                  isActive
                    ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-sm'
                    : 'border border-violet-200/80 bg-white text-violet-900 hover:border-violet-300 hover:bg-violet-50',
                  (disabled || singlePage) && !isActive && 'opacity-60',
                )}
                aria-label={`Page ${item}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {item}
              </button>
            )
          })}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <PaginationNavButton
            disabled={!canGoForward}
            onClick={() => onPageChange(page + 1)}
            label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </PaginationNavButton>
          <PaginationNavButton
            disabled={!canGoForward}
            onClick={() => onPageChange(pages)}
            label="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </PaginationNavButton>
        </div>
      </div>
    </nav>
  )
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
]

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

function totalPages(count, perPage) {
  return Math.max(1, Math.ceil(count / perPage))
}

export default function TaskManager() {
  const navigate = useNavigate()
  const tasksPerPage = useTasksPerPage()
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
    setListPage((prev) => ({
      daily: Math.min(prev.daily, totalPages(dailyTasks.length, tasksPerPage)),
      weekly: Math.min(prev.weekly, totalPages(weeklyTasks.length, tasksPerPage)),
      monthly: Math.min(prev.monthly, totalPages(monthlyTasks.length, tasksPerPage)),
    }))
  }, [tasksPerPage, dailyTasks.length, weeklyTasks.length, monthlyTasks.length])

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
        const res = await tasksRequest('/get-tasks?page=1&limit=50')
        if (cancelled) return
        const list = res.data?.tasks ?? []
        const hit = list.find((t) => t.currentMonthAndYear === monthKey)
        if (hit?._id) {
          setExistingId(hit._id)
          setDailyTasks(fromDocTasks(hit.DailyTasks))
          setWeeklyTasks(fromDocTasks(hit.WeeklyTasks))
          setMonthlyTasks(fromDocTasks(hit.MonthlyTasks))
          const counts = {
            daily: fromDocTasks(hit.DailyTasks).length,
            weekly: fromDocTasks(hit.WeeklyTasks).length,
            monthly: fromDocTasks(hit.MonthlyTasks).length,
          }
          setListPage((prev) => ({
            daily: Math.min(prev.daily, totalPages(counts.daily, tasksPerPage)),
            weekly: Math.min(prev.weekly, totalPages(counts.weekly, tasksPerPage)),
            monthly: Math.min(prev.monthly, totalPages(counts.monthly, tasksPerPage)),
          }))
        } else {
          setExistingId(null)
          setDailyTasks([])
          setWeeklyTasks([])
          setMonthlyTasks([])
          setListPage({ daily: 1, weekly: 1, monthly: 1 })
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

    const next = [...tasks, { taskName: name, isPrivate: false }]
    setTasks(next)
    setDraft('')
    setListPage((p) => ({
      ...p,
      [section]: totalPages(next.length, tasksPerPage),
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
      [section]: Math.min(p[section], totalPages(next.length, tasksPerPage)),
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

  async function onTogglePrivate(section, index) {
    const { tasks, setTasks } = getSectionState(section)
    const next = tasks.map((t, i) =>
      i === index ? { ...t, isPrivate: !t.isPrivate } : t,
    )
    setTasks(next)

    try {
      await persistLists({ ...currentLists(), [section]: next })
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

  const tabMeta = TASK_SECTIONS.find((t) => t.key === activeTab) ?? TASK_SECTIONS[0]
  const totalTaskCount =
    dailyTasks.length + weeklyTasks.length + monthlyTasks.length

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
          <CardTitle className="text-base leading-tight">{s.title}</CardTitle>
          <CardDescription className="text-xs leading-tight text-white/90">
            {s.description}
          </CardDescription>
        </CardHeader>
        <CardContent
          className={cn(
            'grid min-h-0 w-full min-w-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto] gap-2 overflow-hidden p-2.5 pb-3 pt-0',
            s.bg,
          )}
        >
          <div className="flex gap-1">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a task…"
              disabled={loading || saving}
              className="h-9 flex-1 border-white/80 bg-white/90 text-base md:h-8 md:text-sm"
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
              'min-h-0 space-y-1 rounded-lg border bg-white/70 p-2 pb-2 dark:bg-slate-900/40',
              TASK_LIST_SCROLL_CLASS,
              s.listBorder,
            )}
          >
            {loading ? (
              <li className="py-6 text-center text-xs text-slate-500">Loading…</li>
            ) : pageTasks.length === 0 ? (
              <li className="py-6 text-center text-xs text-slate-500">No tasks yet</li>
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
                        className="h-9 flex-1 text-base md:h-8 md:text-sm"
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
            disabled={loading || saving}
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
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                <span className="rounded-md bg-violet-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-violet-900 dark:bg-violet-950 dark:text-violet-100">
                  {monthKey}
                </span>
                <span className="rounded-md bg-fuchsia-50 px-2 py-0.5 text-[10px] font-medium text-fuchsia-900 ring-1 ring-fuchsia-200/80 dark:bg-fuchsia-950/50 dark:text-fuchsia-100">
                  {totalTaskCount} task{totalTaskCount === 1 ? '' : 's'} total
                </span>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2 pb-2 pt-1 md:pt-2">
            <div className="flex shrink-0 gap-1 rounded-lg bg-white/70 p-1 shadow-sm ring-1 ring-violet-200/60 dark:bg-slate-900/50">
              {TASK_SECTIONS.map((tab) => (
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
              {existingId
                ? `You already have a plan for ${monthTitle}. Trash deletes a task immediately; pencil edits save on blur.`
                : `No plan for ${monthTitle} yet. Add tasks and click Update this month to save.`}
            </p>
            <Button
              type="submit"
              size="sm"
              disabled={loading || saving || totalTaskCount === 0}
              className="h-9 shrink-0 px-5 text-sm bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-sm hover:from-violet-500 hover:to-fuchsia-500 md:h-8"
            >
              {saving ? 'Saving…' : 'Update this month'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
