import { getStoredUser } from '@/lib/auth-api'

/** @param {string | undefined} role */
export function homePathForRole(role) {
  if (role === 'admin') return '/admin'
  if (role === 'support') return '/support'
  return '/'
}

export function getSessionRole() {
  return getStoredUser()?.role ?? 'user'
}
