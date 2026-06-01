import { useEffect, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const TASKS_PER_PAGE_DESKTOP = 5
export const TASKS_PER_PAGE_MOBILE = 10
const MOBILE_MAX_WIDTH_PX = 767

export function useTasksPerPage() {
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

export function totalPages(count, perPage) {
  return Math.max(1, Math.ceil(count / perPage))
}

export function paginateSlice(items, page, perPage) {
  const start = (page - 1) * perPage
  return items.slice(start, start + perPage)
}

/** Page numbers with ellipsis when total > 7 (always includes first & last page). */
export function getPaginationItems(current, total) {
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

export default function TaskListPagination({
  sectionKey,
  tasks,
  page,
  pages,
  disabled,
  onPageChange,
}) {
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
