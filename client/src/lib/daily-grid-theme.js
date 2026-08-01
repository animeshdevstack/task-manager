/** Mon–Fri colors by week band (days 1–7, 8–14, …). Hues spaced so adjacent bands stay distinct. */
const WEEKDAY_PALETTE = [
  {
    headerClass:
      'bg-sky-200 text-sky-900 dark:bg-sky-950/50 dark:text-sky-100',
    cellClass: 'bg-sky-100/80 dark:bg-sky-950/25',
  },
  {
    headerClass:
      'bg-emerald-200 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100',
    cellClass: 'bg-emerald-100/80 dark:bg-emerald-950/25',
  },
  {
    headerClass:
      'bg-orange-200 text-orange-900 dark:bg-orange-950/50 dark:text-orange-100',
    cellClass: 'bg-orange-100/80 dark:bg-orange-950/25',
  },
  {
    headerClass:
      'bg-fuchsia-200 text-fuchsia-900 dark:bg-fuchsia-950/50 dark:text-fuchsia-100',
    cellClass: 'bg-fuchsia-100/80 dark:bg-fuchsia-950/25',
  },
  {
    headerClass:
      'bg-violet-200 text-violet-900 dark:bg-violet-950/50 dark:text-violet-100',
    cellClass: 'bg-violet-100/80 dark:bg-violet-950/25',
  },
  {
    headerClass:
      'bg-lime-200 text-lime-900 dark:bg-lime-950/50 dark:text-lime-100',
    cellClass: 'bg-lime-100/80 dark:bg-lime-950/25',
  },
]

const WEEKEND_THEME = {
  headerClass:
    'bg-red-200 text-red-900 dark:bg-red-950/50 dark:text-red-100',
  cellClass: 'bg-red-100/80 dark:bg-red-950/25',
  isWeekend: true,
}

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** Sticky task label column — same header/cell weight as date columns. */
export const TASK_COLUMN_HEADER_CLASS =
  'bg-slate-300 text-slate-900 dark:bg-slate-800/90 dark:text-slate-100'

export const TASK_COLUMN_CELL_CLASS =
  'bg-slate-200/80 text-slate-800 dark:bg-slate-900/90 dark:text-slate-100'

export const HABIT_LIST_ROW_COMPLETE =
  'border-emerald-300/80 bg-emerald-50/90 dark:bg-emerald-950/40'

export const HABIT_LIST_ROW_IDLE =
  'border-transparent bg-white/60 hover:border-emerald-200/80 dark:bg-slate-800/60 dark:hover:border-emerald-800/50'

export const WEEKLY_HIGHLIGHT_HEADER_CLASS =
  'bg-emerald-200 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100'

export const WEEKLY_HIGHLIGHT_CELL_CLASS =
  'bg-emerald-100/80 dark:bg-emerald-950/25'

export const WEEKLY_IDLE_HEADER_CLASS =
  'bg-slate-100/60 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300'

export const WEEKLY_IDLE_CELL_CLASS =
  'bg-slate-50/50 dark:bg-slate-900/20'

export const MONTHLY_COLUMN_HEADER_ACTIVE =
  'bg-violet-200 text-violet-900 dark:bg-violet-950/50 dark:text-violet-100'

export const MONTHLY_COLUMN_CELL_ACTIVE =
  'bg-violet-100/80 dark:bg-violet-950/25'

export const MONTHLY_COLUMN_HEADER_IDLE = WEEKLY_IDLE_HEADER_CLASS

export const MONTHLY_COLUMN_CELL_IDLE = WEEKLY_IDLE_CELL_CLASS

/** add-ons tab — sky tint (distinct from monthly violet). */
export const DATED_ADDON_COLUMN_HEADER_ACTIVE =
  'bg-sky-200 text-sky-900 dark:bg-sky-950/50 dark:text-sky-100'

export const DATED_ADDON_COLUMN_CELL_ACTIVE =
  'bg-sky-100/80 dark:bg-sky-950/25'

export const DATED_ADDON_COLUMN_HEADER_IDLE = WEEKLY_IDLE_HEADER_CLASS

export const DATED_ADDON_COLUMN_CELL_IDLE = WEEKLY_IDLE_CELL_CLASS

/** Rotating band color per Sunday column in the weekly grid. */
export function getWeeklySundayColumnTheme(colIdx) {
  return WEEKDAY_PALETTE[colIdx % WEEKDAY_PALETTE.length]
}

/** Distinct tint per task row (cycles through the daily palette). */
export function getHabitRowTheme(rowIdx) {
  return WEEKDAY_PALETTE[rowIdx % WEEKDAY_PALETTE.length]
}

function getWeekBandIndex(day) {
  return Math.floor((day - 1) / 7)
}

/** Sat/Sun = red; Mon–Fri get a unique palette entry per week band in the month. */
export function getDailyColumnTheme(day, monthKey) {
  const [year, monthNum] = monthKey.split('-').map(Number)
  const dow = new Date(year, monthNum - 1, day).getDay()
  const weekBand = getWeekBandIndex(day)

  if (dow === 0 || dow === 6) {
    return { ...WEEKEND_THEME, weekBand }
  }

  return {
    ...WEEKDAY_PALETTE[weekBand % WEEKDAY_PALETTE.length],
    isWeekend: false,
    weekBand,
  }
}

export function getWeekdayInitial(day, monthKey) {
  const [year, monthNum] = monthKey.split('-').map(Number)
  const dow = new Date(year, monthNum - 1, day).getDay()
  return WEEKDAY_INITIALS[dow]
}
