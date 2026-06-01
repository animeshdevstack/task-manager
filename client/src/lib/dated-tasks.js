export function formatDateYmd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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
