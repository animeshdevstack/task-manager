/**
 * Authenticated calls to `/api/v1/add-tasks/*` (Vite proxies `/api` in dev).
 */
import { authenticatedFetch, parseApiResponse } from '@/lib/auth-api'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

/**
 * @param {string} path - e.g. "/add-tasks", "/get-tasks?page=1"
 * @param {RequestInit} [options]
 */
export async function tasksRequest(path, options = {}) {
  const url = `${API_BASE}/api/v1/add-tasks${path}`
  const res = await authenticatedFetch(url, options)
  return parseApiResponse(res)
}
