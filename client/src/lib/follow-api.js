/**
 * Authenticated calls to `/api/v1/follow/*`.
 */
import { authenticatedFetch, parseApiResponse } from '@/lib/auth-api'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

/**
 * @param {string} path - e.g. "/me", "/users/search?q=foo"
 * @param {RequestInit} [options]
 */
export async function followRequest(path, options = {}) {
  const url = `${API_BASE}/api/v1/follow${path}`
  const res = await authenticatedFetch(url, options)
  return parseApiResponse(res)
}
