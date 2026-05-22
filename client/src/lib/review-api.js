/**
 * Authenticated calls to `/api/v1/review-tasks/*` (Vite proxies `/api` in dev).
 */
const API_BASE = import.meta.env.VITE_API_URL ?? ''

function getErrorMessage(data, status) {
  if (data?.message && typeof data.message === 'string') return data.message
  const err = data?.error
  if (typeof err === 'string') return err
  if (err?.message) return err.message
  return `Request failed (${status})`
}

/**
 * @param {string} path - e.g. "/get-user-review-task?page=1"
 * @param {RequestInit} [options]
 */
export async function reviewRequest(path, options = {}) {
  const token = localStorage.getItem('accessToken')
  if (!token) {
    throw new Error('Not signed in')
  }
  const url = `${API_BASE}/api/v1/review-tasks${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.success === false) {
    throw new Error(getErrorMessage(data, res.status))
  }
  return data
}
