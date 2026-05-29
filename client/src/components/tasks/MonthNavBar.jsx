import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function addMonths(date, delta) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

export function formatMonthTitle(d) {
  return d.toLocaleString(undefined, { month: 'long', year: 'numeric' })
}

export default function MonthNavBar({
  viewMonth,
  onPrev,
  onNext,
  children,
  disabled,
  nextDisabled,
  onJumpToCurrent,
  jumpToCurrentLabel,
  embedded = false,
}) {
  const prevLabel = formatMonthTitle(addMonths(viewMonth, -1))
  const nextLabel = formatMonthTitle(addMonths(viewMonth, 1))

  return (
    <div className={cn('flex flex-col', embedded ? 'gap-1' : 'gap-1.5')}>
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-2',
          embedded
            ? 'px-0 py-0'
            : 'rounded-lg border border-violet-200/80 bg-white/80 px-1.5 py-1.5 dark:border-violet-800/50 dark:bg-slate-900/50',
        )}
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1 px-2 text-xs"
          disabled={disabled}
          onClick={onPrev}
          title={prevLabel}
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
          disabled={disabled || nextDisabled}
          onClick={onNext}
          title={nextLabel}
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      {onJumpToCurrent ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            'w-full gap-1.5 text-xs font-medium text-violet-900 dark:text-violet-100',
            embedded ? 'h-7' : 'h-8',
          )}
          disabled={disabled}
          onClick={onJumpToCurrent}
          title={`Jump to ${jumpToCurrentLabel ?? 'current month'}`}
        >
          <CalendarDays className="h-3.5 w-3.5" aria-hidden />
          Back to {jumpToCurrentLabel ?? 'current month'}
        </Button>
      ) : null}
    </div>
  )
}
