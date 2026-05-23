import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { hasActiveSession } from '@/lib/auth-api'

export function ProtectedRoute({ children }) {
  const navigate = useNavigate()
  const hasSession =
    typeof window !== 'undefined' && hasActiveSession()

  useEffect(() => {
    if (!hasActiveSession()) {
      navigate('/login', { replace: true })
    }
  }, [navigate])

  if (!hasSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-100 via-white to-cyan-100">
        <p className="text-sm font-medium text-violet-900/70">Loading…</p>
      </div>
    )
  }

  return children
}
