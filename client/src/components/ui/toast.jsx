import { cn } from '@/lib/utils'

export const TOAST_DURATION_MS = 2500

const VARIANT_STYLES = {
  success: 'bg-emerald-600 text-white ring-emerald-500/30',
  warning: 'bg-amber-500 text-white ring-amber-400/30',
  remove: 'bg-red-600 text-white ring-red-500/30',
  info: 'bg-sky-600 text-white ring-sky-500/30',
  error: 'bg-red-700 text-white ring-red-600/30',
}

/**
 * @param {{ message: string; variant?: keyof typeof VARIANT_STYLES }} props
 */
export function Toast({ message, variant = 'success' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-none fixed bottom-24 left-1/2 z-50 max-w-sm -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ring-1 backdrop-blur-sm sm:left-auto sm:right-6 sm:translate-x-0',
        VARIANT_STYLES[variant] ?? VARIANT_STYLES.success,
      )}
    >
      {message}
    </div>
  )
}
