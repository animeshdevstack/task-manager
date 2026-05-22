import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CalendarDays,
  ListChecks,
  LogOut,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PLANNER_HIGHLIGHTS } from '@/constants/planner-highlights'
import { clearSession, getStoredUser } from '@/lib/auth-api'
import { cn } from '@/lib/utils'

const QUICK_ACTIONS = [
  {
    key: 'tasks',
    title: 'Task Manager',
    description: 'Names for daily · weekly · monthly',
    href: '/tasks',
    icon: Sparkles,
    accent: 'from-violet-600 via-fuchsia-600 to-violet-500',
    ring: 'ring-violet-400/40',
  },
  {
    key: 'habits',
    title: 'Habit Tracker',
    description: 'Grids & check-offs',
    href: '/habits',
    icon: ListChecks,
    accent: 'from-emerald-600 via-teal-500 to-cyan-500',
    ring: 'ring-emerald-400/40',
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

export default function Home() {
  const navigate = useNavigate()
  const [user] = useState(getStoredUser)
  const today = useMemo(() => new Date(), [])
  const monthKey = useMemo(() => formatYearMonth(today), [today])
  const monthTitle = useMemo(() => formatMonthTitle(today), [today])
  const displayName = user?.email?.split('@')[0] ?? 'there'

  function signOut() {
    clearSession()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gradient-to-br from-violet-200/70 via-fuchsia-100/80 to-cyan-200/70">
      <header className="shrink-0 border-b border-white/40 bg-white/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/30">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-violet-950">Task Planner</p>
              <p className="truncate text-xs text-violet-800/70">Home</p>
            </div>
          </div>
          <div className="flex min-w-0 shrink-0 items-center gap-3">
            {user?.email ? (
              <span className="hidden max-w-[160px] truncate text-xs text-violet-900/80 lg:inline">
                {user.email}
              </span>
            ) : null}
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

      <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col justify-center overflow-hidden px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex w-full flex-col gap-4">
          <div className="overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 p-px shadow-md">
            <div className="flex items-center justify-between gap-4 rounded-[11px] bg-white/95 px-4 py-3 backdrop-blur dark:bg-slate-950/95">
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wide text-fuchsia-700">
                  Welcome back
                </p>
                <h1 className="truncate text-lg font-bold leading-tight text-slate-900 dark:text-white">
                  Hi,{' '}
                  <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                    {displayName}
                  </span>
                </h1>
              </div>
              <div className="flex shrink-0 items-center gap-2.5 rounded-lg bg-violet-50 px-3 py-2 ring-1 ring-violet-200/80 dark:bg-violet-950/50">
                <CalendarDays className="h-4 w-4 shrink-0 text-fuchsia-600" aria-hidden />
                <div className="min-w-0 text-right">
                  <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                    {monthTitle}
                  </p>
                  <p className="font-mono text-[10px] text-violet-800/80">{monthKey}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon
              return (
                <Link
                  key={action.key}
                  to={action.href}
                  className={cn(
                    'group rounded-xl bg-gradient-to-r p-px shadow-sm ring-1 transition hover:shadow-md',
                    action.ring,
                  )}
                >
                  <div className="flex items-center justify-between gap-3 rounded-[11px] bg-white/95 px-3.5 py-3 dark:bg-slate-950/95">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm',
                          action.accent,
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                          {action.title}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {action.description}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-violet-500 transition group-hover:translate-x-0.5" />
                  </div>
                </Link>
              )
            })}
          </div>

          <div className="rounded-2xl border border-white/70 bg-white/45 p-3 shadow-sm ring-1 ring-violet-200/50 backdrop-blur-sm dark:border-slate-800/50 dark:bg-slate-900/30 sm:p-4">
            <p className="mb-3 px-1 text-center text-xs font-medium text-violet-900/80 dark:text-violet-200/80">
              Plan by rhythm — daily habits, weekly milestones, monthly themes
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {PLANNER_HIGHLIGHTS.map((item) => {
                const Icon = item.icon
                return (
                  <section
                    key={item.key}
                    className={cn(
                      'flex flex-col overflow-hidden rounded-xl ring-1',
                      item.bg,
                      item.text,
                    )}
                  >
                    <div
                      className={cn(
                        'flex items-center gap-2.5 bg-gradient-to-r px-3.5 py-2.5 text-white',
                        item.gradient,
                      )}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/25">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-bold leading-tight">{item.title}</h2>
                        <p className="text-[10px] text-white/90">{item.hint}</p>
                      </div>
                    </div>
                    <div className="space-y-3 px-3.5 py-3">
                      <ul className="space-y-2 text-xs leading-relaxed opacity-90">
                        {item.body.map((line) => (
                          <li key={line} className="flex gap-2">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current opacity-50" />
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="flex flex-wrap gap-2 border-t border-current/10 pt-2.5">
                        <Link
                          to={item.primaryLink.to}
                          className="inline-flex items-center gap-1 rounded-md bg-white/80 px-2.5 py-1.5 text-[11px] font-semibold shadow-sm ring-1 ring-black/5 transition hover:bg-white dark:bg-slate-900/70"
                        >
                          {item.primaryLink.label}
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                        <Link
                          to={item.secondaryLink.to}
                          className="inline-flex items-center rounded-md px-2 py-1.5 text-[11px] font-medium underline-offset-2 opacity-85 hover:underline"
                        >
                          {item.secondaryLink.label}
                        </Link>
                      </div>
                    </div>
                  </section>
                )
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
