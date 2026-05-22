import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { KeyRound, Sparkles } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { authRequest } from '@/lib/auth-api'

const inputClass =
  'border-violet-200/80 bg-white focus-visible:ring-violet-500'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams])

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const missingToken = !token

  async function onSubmit(e) {
    e.preventDefault()
    setError('')

    if (missingToken) {
      setError('Reset link is invalid or expired. Request a new link from forgot password.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    try {
      await authRequest('/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      })
      setSuccess(true)
      setTimeout(() => navigate('/login', { replace: true }), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-200/70 via-fuchsia-100/80 to-cyan-200/70">
      <header className="border-b border-white/40 bg-white/40 px-4 py-4 backdrop-blur-md sm:px-6">
        <Link
          to="/"
          className="mx-auto flex max-w-6xl items-center gap-2 text-violet-950 transition-opacity hover:opacity-90"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/30">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <span>
            <span className="block text-sm font-bold tracking-tight">Task Planner</span>
            <span className="block text-xs font-medium text-violet-800/70">
              Set a new password
            </span>
          </span>
        </Link>
      </header>

      <main className="mx-auto flex max-w-md flex-col justify-center px-4 py-12">
        <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 p-[1px] shadow-xl shadow-fuchsia-500/25">
          <Card className="rounded-2xl border-0 bg-white/95 shadow-none dark:bg-slate-950/95">
            <CardHeader className="space-y-1 text-center sm:text-left">
              <CardTitle className="flex items-center justify-center gap-2 text-2xl text-slate-900 sm:justify-start dark:text-white">
                <KeyRound className="h-6 w-6 text-violet-600" aria-hidden />
                Reset password
              </CardTitle>
              <CardDescription>
                Choose a new password for your account. The secure link from your email is
                applied automatically.
              </CardDescription>
            </CardHeader>
            <form onSubmit={onSubmit}>
              <CardContent className="space-y-4">
                {missingToken ? (
                  <Alert variant="destructive">
                    <AlertDescription>
                      This reset link is missing a token. Open the link from your email, or{' '}
                      <Link to="/forgot-password" className="font-medium underline">
                        request a new one
                      </Link>
                      .
                    </AlertDescription>
                  </Alert>
                ) : null}
                {success ? (
                  <Alert className="border-emerald-300 bg-emerald-50 text-emerald-900">
                    <AlertDescription>
                      Password updated. Redirecting to sign in…
                    </AlertDescription>
                  </Alert>
                ) : null}
                {error ? (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-700">
                    New password
                  </Label>
                  <PasswordInput
                    id="password"
                    autoComplete="new-password"
                    required
                    disabled={missingToken || success}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-slate-700">
                    Confirm password
                  </Label>
                  <PasswordInput
                    id="confirmPassword"
                    autoComplete="new-password"
                    required
                    disabled={missingToken || success}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/25 hover:from-violet-500 hover:to-fuchsia-500"
                  disabled={loading || success || missingToken}
                >
                  {loading ? 'Updating…' : 'Update password'}
                </Button>
                <p className="text-center text-sm text-slate-600">
                  <Link to="/login" className="font-semibold text-violet-700 hover:underline">
                    Back to sign in
                  </Link>
                </p>
              </CardFooter>
            </form>
          </Card>
        </div>
      </main>
    </div>
  )
}
