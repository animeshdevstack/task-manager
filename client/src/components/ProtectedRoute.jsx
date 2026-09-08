import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStoredUser, hasActiveSession } from '@/lib/auth-api'
import { homePathForRole } from '@/lib/roles'

/**
 * @param {{ children: import('react').ReactNode, roles?: string[] }} props
 */
export function ProtectedRoute({ children, roles }) {
  const navigate = useNavigate()
  const hasSession =
    typeof window !== 'undefined' && hasActiveSession()
  const user = typeof window !== 'undefined' ? getStoredUser() : null
  const roleOk =
    !roles?.length || (user?.role && roles.includes(user.role))

  useEffect(() => {
    if (!hasActiveSession()) {
      navigate('/login', { replace: true })
      return
    }
    if (roles?.length) {
      const current = getStoredUser()
      if (!current?.role || !roles.includes(current.role)) {
        navigate(homePathForRole(current?.role), { replace: true })
      }
    }
  }, [navigate, roles])

  if (!hasSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-100 via-white to-cyan-100">
        <p className="text-sm font-medium text-violet-900/70">Loading…</p>
      </div>
    )
  }

  if (!roleOk) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-100 via-white to-cyan-100">
        <p className="text-sm font-medium text-violet-900/70">Redirecting…</p>
      </div>
    )
  }

  return children
}
