import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export const DATED_DATE_INPUT_CLASS =
  'min-w-0 flex-1 rounded-md border-white/80 bg-white/90 text-base transition-colors hover:border-violet-300/80 focus-visible:border-violet-400 focus-visible:ring-2 focus-visible:ring-violet-400/30 focus-visible:ring-inset focus-visible:ring-offset-0 dark:border-slate-700 dark:bg-slate-900/90 dark:hover:border-violet-600/60 md:h-8 md:text-sm h-9'

const NAV_BUTTON_CLASS =
  'h-9 w-9 shrink-0 border-white/80 bg-white/90 transition-colors hover:border-violet-300/80 hover:bg-violet-50/90 dark:border-slate-700 dark:bg-slate-900/90 dark:hover:border-violet-600/60 md:h-8 md:w-8'

export default function DatedDatePicker({
  id,
  label = 'Select date',
  value,
  min,
  max,
  disabled,
  onChange,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
}) {
  return (
    <div className="shrink-0 space-y-1">
      <label
        htmlFor={id}
        className="block text-center text-xs font-medium text-slate-600 dark:text-slate-400"
      >
        {label}
      </label>
      <div className="mx-auto flex w-full max-w-xs items-center justify-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={NAV_BUTTON_CLASS}
          disabled={disabled || prevDisabled}
          title="Previous day"
          onClick={onPrev}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Input
          id={id}
          type="date"
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          onChange={onChange}
          className={DATED_DATE_INPUT_CLASS}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={NAV_BUTTON_CLASS}
          disabled={disabled || nextDisabled}
          title="Next day"
          onClick={onNext}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
