import { useEffect, useState } from 'react'

/**
 * Calendar "today" in the user's local timezone.
 * Updates on visibility change and every minute so midnight crossings
 * refresh without a full page reload.
 */
export function useToday() {
  const [today, setToday] = useState(() => new Date())

  useEffect(() => {
    const refresh = () => setToday(new Date())

    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    document.addEventListener('visibilitychange', onVisibility)
    const interval = window.setInterval(refresh, 60_000)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(interval)
    }
  }, [])

  return today
}
