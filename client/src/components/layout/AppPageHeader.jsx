import { ArrowLeft, Home, ListChecks, LogOut, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

/**
 * @param {'home' | 'tasks' | 'habits' | 'social'} navContext
 * - tasks: on Task Manager → show Habits link
 * - habits: on Habit Tracker → show Tasks link
 * - home | social: Home + Sign out only
 */
export default function AppPageHeader({
  title,
  subtitle,
  icon: Icon,
  onSignOut,
  backTo,
  navContext = 'social',
  maxWidthClass = 'max-w-5xl',
}) {
  const showHabitsLink = navContext === 'tasks'
  const showTasksLink = navContext === 'habits'

  return (
    <header className="shrink-0 border-b border-white/40 bg-white/60 backdrop-blur-md">
      <div className={`mx-auto flex items-center justify-between gap-2 px-5 py-2.5 ${maxWidthClass}`}>
        <div className="flex min-w-0 items-center gap-2">
          {backTo ? (
            <Button variant="outline" size="sm" asChild className="h-8 border-violet-300 bg-white/80 px-2">
              <Link to={backTo} title="Back">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          ) : null}
          <Link
            to="/"
            className="flex min-w-0 items-center gap-2 rounded-md transition hover:opacity-90"
            title="Go to home"
          >
            {Icon ? (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/30">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/30">
                <Sparkles className="h-4 w-4" aria-hidden />
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-violet-950">{title}</p>
              {subtitle ? <p className="truncate text-xs text-violet-800/70">{subtitle}</p> : null}
            </div>
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {showHabitsLink ? (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-8 gap-1 border-violet-300 bg-white/80 px-2"
            >
              <Link to="/habits" title="Habit Tracker">
                <ListChecks className="h-4 w-4" />
                <span className="hidden sm:inline">Habits</span>
              </Link>
            </Button>
          ) : null}
          {showTasksLink ? (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-8 gap-1 border-violet-300 bg-white/80 px-2"
            >
              <Link to="/tasks" title="Task Manager">
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">Tasks</span>
              </Link>
            </Button>
          ) : null}
          <Button variant="outline" size="sm" asChild className="h-8 border-violet-300 bg-white/80 px-2">
            <Link to="/" title="Home">
              <Home className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={onSignOut}
            className="h-8 border-violet-300 bg-white/80 px-2"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}
