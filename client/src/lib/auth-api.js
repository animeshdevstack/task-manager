/**
 * Empty in dev: browser calls `/api/...` on the Vite origin; vite.config.js proxies to
 * `VITE_API_PROXY_TARGET` (see `.env.development`). Set `VITE_API_URL` (e.g.
 * `http://localhost:8000`) to hit the API directly (then enable CORS on the server).
 */
const API_BASE = import.meta.env.VITE_API_URL ?? ''

/** Leftover keys from older builds; app uses accessToken only. */
const LEGACY_STORAGE_KEYS = ['authToken']

let refreshPromise = null

function purgeLegacyAuthStorage() {
  for (const key of LEGACY_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }
}

export function getErrorMessage(data, status) {
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

export function hasActiveSession() {
  return !!(
    localStorage.getItem('refreshToken') || localStorage.getItem('accessToken')
  )
}

export function redirectToLogin() {
  clearSession()
  if (
    typeof window !== 'undefined' &&
    !window.location.pathname.startsWith('/login') &&
    !window.location.pathname.startsWith('/signup')
  ) {
    window.location.assign('/login')
  }
}

/**
 * Exchange refresh token for a new access token (keeps existing refresh in storage).
 */
export async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refreshToken')
  if (!refreshToken) {
    throw new Error('No refresh token')
  }
  const res = await authRequest('/refresh-token', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  })
  const existingRefresh = localStorage.getItem('refreshToken')
  saveSession({
    ...res.data,
    refreshToken: res.data.refreshToken ?? existingRefresh,
  })
  return res.data.accessToken
}

function runRefresh() {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

/**
 * Authenticated fetch: attaches access token, refreshes on 401, retries once.
 * @param {string} url
 * @param {RequestInit} [options]
 */
function getUserTimezoneHeader() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export async function authenticatedFetch(url, options = {}) {
  const buildInit = () => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      throw new Error('Not signed in')
    }
    return {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-User-Timezone': getUserTimezoneHeader(),
        ...options.headers,
      },
    }
  }

  const ensureAccessToken = async () => {
    if (localStorage.getItem('accessToken')) return
    if (localStorage.getItem('refreshToken')) {
      await runRefresh()
      return
    }
    throw new Error('Not signed in')
  }

  await ensureAccessToken()

  let res
  try {
    res = await fetch(url, buildInit())
  } catch (err) {
    if (err instanceof Error && err.message === 'Not signed in') {
      redirectToLogin()
    }
    throw err
  }

  if (res.status === 401) {
    try {
      await runRefresh()
      res = await fetch(url, buildInit())
    } catch {
      redirectToLogin()
      throw new Error('Session expired')
    }
    if (res.status === 401) {
      redirectToLogin()
      throw new Error('Session expired')
    }
  }

  return res
}

/**
 * @param {Response} res
 */
export async function parseApiResponse(res) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.success === false) {
    if (res.status === 401) {
      redirectToLogin()
    }
    throw new Error(getErrorMessage(data, res.status))
  }
  return data
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
