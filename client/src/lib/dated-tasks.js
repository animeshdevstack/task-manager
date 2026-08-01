export function formatDateYmd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDateYmdUtc(d) {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function ymdToInstantRange(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  const dayStartUtc = Date.UTC(y, m - 1, d, 0, 0, 0, 0)
  const nextDayStartUtc = Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0)
  return {
    startMs: dayStartUtc - 14 * 60 * 60 * 1000,
    endMs: nextDayStartUtc + 12 * 60 * 60 * 1000,
  }
}

export function matchesCalendarYmd(d, ymd) {
  if (formatDateYmd(d) === ymd || formatDateYmdUtc(d) === ymd) return true
  const { startMs, endMs } = ymdToInstantRange(ymd)
  const t = d.getTime()
  return t >= startMs && t < endMs
}

export function isUtcNoonCalendarSlot(d) {
  return (
    d.getUTCHours() === 12 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  )
}

/** UTC-noon slots match one day exactly; legacy slots use wide matching. */
export function matchesReviewSlotYmd(d, ymd) {
  if (isUtcNoonCalendarSlot(d)) {
    return formatDateYmdUtc(d) === ymd
  }
  return matchesCalendarYmd(d, ymd)
}

export function ymdFromParts(year, monthIndex, day) {
  const m = String(monthIndex + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}`
}

export function dayYmdInMonth(monthKey, day) {
  return `${monthKey}-${String(day).padStart(2, '0')}`
}

export function sundayYmdsInMonth(monthKey) {
  const [year, monthNum] = monthKey.split('-').map(Number)
  const monthIndex = monthNum - 1
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const sundays = []
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(year, monthIndex, d).getDay() === 0) {
      sundays.push(ymdFromParts(year, monthIndex, d))
    }
  }
  return sundays
}

export function resolveYmdForInstant(instant, candidateYmds) {
  const d = instant instanceof Date ? instant : new Date(instant)
  if (Number.isNaN(d.getTime())) return undefined
  return candidateYmds.find((ymd) => matchesCalendarYmd(d, ymd))
}

export function monthDateBounds(monthKey) {
  const [year, monthNum] = monthKey.split('-').map(Number)
  const lastDay = new Date(year, monthNum, 0).getDate()
  return {
    min: `${monthKey}-01`,
    max: `${monthKey}-${String(lastDay).padStart(2, '0')}`,
  }
}

export function defaultSelectedDateForMonth(monthKey, referenceDate) {
  const { min, max } = monthDateBounds(monthKey)
  const todayStr = formatDateYmd(referenceDate)
  if (todayStr >= min && todayStr <= max) return todayStr
  return min
}

export function shiftDateYmd(ymd, deltaDays) {
  const [y, m, d] = ymd.split('-').map(Number)
  return formatDateYmd(new Date(y, m - 1, d + deltaDays))
}

export function buildDatedSubTaskMap(datedTasks) {
  const map = new Map()
  for (const entry of datedTasks ?? []) {
    const date = typeof entry?.date === 'string' ? entry.date.trim() : ''
    if (!date) continue
    for (const t of entry?.tasks ?? []) {
      const id = t._id?.toString?.() ?? (t._id != null ? String(t._id) : null)
      if (id) map.set(id, date)
    }
  }
  return map
}
