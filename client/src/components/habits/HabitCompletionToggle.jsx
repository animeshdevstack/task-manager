import { cn } from '@/lib/utils'

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        d="M20 6L9 17L4 12"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function HabitCompletionToggle({
  checked,
  onChange,
  disabled = false,
  readOnly = false,
  size = 'md',
  title,
  className,
  children,
}) {
  const rootClass = cn(
    'habit-neon-checkbox',
    size === 'sm' && 'habit-neon-checkbox-sm',
    readOnly && 'habit-neon-checkbox-readonly',
    disabled && 'opacity-50',
    children ? 'habit-neon-checkbox-row' : 'habit-neon-checkbox-inline',
    !readOnly && !disabled && 'cursor-pointer',
    readOnly && 'cursor-default',
    className,
  )

  const control = (
    <>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled || readOnly}
        readOnly={readOnly}
        tabIndex={readOnly ? -1 : undefined}
        aria-label={title}
        onChange={
          readOnly
            ? undefined
            : (e) => {
                e.stopPropagation()
                onChange?.(e.target.checked)
              }
        }
      />
      <span className="habit-neon-checkmark">
        <CheckIcon />
      </span>
    </>
  )

  if (readOnly) {
    return (
      <span className={rootClass} title={title}>
        {control}
        {children}
      </span>
    )
  }

  return (
    <label className={rootClass} title={title}>
      {control}
      {children}
    </label>
  )
}
