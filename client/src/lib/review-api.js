/**
 * Authenticated calls to `/api/v1/review-tasks/*` (Vite proxies `/api` in dev).
 */
import { authenticatedFetch, parseApiResponse } from '@/lib/auth-api'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

/**
 * @param {string} path - e.g. "/get-user-review-task?page=1"
 * @param {RequestInit} [options]
 */
export async function reviewRequest(path, options = {}) {
  const url = `${API_BASE}/api/v1/review-tasks${path}`
  const res = await authenticatedFetch(url, options)
  return parseApiResponse(res)
}
