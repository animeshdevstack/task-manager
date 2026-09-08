/**
 * Authenticated calls to `/api/v1/support/*`
 */
import { authenticatedFetch, parseApiResponse } from '@/lib/auth-api'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

/**
 * @param {string} path
 * @param {RequestInit} [options]
 */
export async function supportRequest(path, options = {}) {
  const url = `${API_BASE}/api/v1/support${path}`
  const res = await authenticatedFetch(url, options)
  return parseApiResponse(res)
}
