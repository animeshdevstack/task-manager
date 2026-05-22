/**
 * Empty in dev: browser calls `/api/...` on the Vite origin; vite.config.js proxies to
 * `VITE_API_PROXY_TARGET` (see `.env.development`). Set `VITE_API_URL` (e.g.
 * `http://localhost:8000`) to hit the API directly (then enable CORS on the server).
 */
const API_BASE = import.meta.env.VITE_API_URL ?? ''

/** Leftover keys from older builds; app uses accessToken only. */
const LEGACY_STORAGE_KEYS = ['authToken']

function purgeLegacyAuthStorage() {
  for (const key of LEGACY_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }
}

function getErrorMessage(data, status) {
  if (data?.message && typeof data.message === 'string') return data.message
  const err = data?.error
  if (typeof err === 'string') return err
  if (err?.message) return err.message
  return `Request failed (${status})`
}

/**
 * @param {string} path - e.g. "/signin"
 * @param {RequestInit} [options]
 */
export async function authRequest(path, options = {}) {
  const url = `${API_BASE}/api/v1/auth${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.success === false) {
    throw new Error(getErrorMessage(data, res.status))
  }
  return data
}

export function saveSession(payload) {
  purgeLegacyAuthStorage()
  const { accessToken, refreshToken, user } = payload
  if (accessToken) localStorage.setItem('accessToken', accessToken)
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken)
  if (user) localStorage.setItem('user', JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('user')
  purgeLegacyAuthStorage()
}

purgeLegacyAuthStorage()

export function getStoredUser() {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
