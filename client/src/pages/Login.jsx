import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Sparkles } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { PLANNER_HIGHLIGHTS } from '@/constants/planner-highlights'
import { authRequest, saveSession } from '@/lib/auth-api'
import { homePathForRole } from '@/lib/roles'
import { cn } from '@/lib/utils'

export default function Login() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const showVerified = searchParams.get('verified') === '1'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await authRequest('/signin', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      saveSession(res.data)
      navigate(homePathForRole(res.data?.user?.role), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  function dismissVerifiedBanner() {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('verified')
    setSearchParams(next, { replace: true })
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
              Your colorful todo command center
            </span>
          </span>
        </Link>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10 lg:flex-row lg:items-center lg:gap-16 lg:py-16">
        <section className="flex-1 space-y-8 text-center lg:text-left">
          <div className="space-y-4">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-1.5 text-sm font-medium text-fuchsia-800 shadow-sm ring-1 ring-fuchsia-200/80">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
              Plan daily · weekly · monthly
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Welcome back to your{' '}
              <span className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-600 bg-clip-text text-transparent">
                planner
              </span>
            </h1>
            <p className="mx-auto max-w-lg text-base text-slate-600 lg:mx-0">
              Sign in to manage this month&apos;s tasks — colorful boards for habits,
              milestones, and themes, all in one place.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:max-w-xl">
            {PLANNER_HIGHLIGHTS.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.key}
                  className={cn(
                    'rounded-xl p-4 text-left shadow-md ring-1 backdrop-blur-sm',
                    item.bg,
                  )}
                >
                  <div
                    className={cn(
                      'mb-3 inline-flex rounded-lg bg-gradient-to-br p-2 text-white shadow-sm',
                      item.gradient,
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </div>
                  <p className={cn('text-sm font-semibold', item.text)}>{item.title}</p>
                  <p className="mt-0.5 text-xs text-slate-600">{item.hint}</p>
                </div>
              )
            })}
          </div>

          <p className="hidden text-sm text-violet-900/60 lg:block">
            New here?{' '}
            <Link to="/signup" className="font-semibold text-violet-700 underline-offset-4 hover:underline">
              Create a free account
            </Link>
          </p>
        </section>

        <section className="mx-auto w-full max-w-md shrink-0 lg:mx-0">
          <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 p-[1px] shadow-xl shadow-fuchsia-500/25">
            <Card className="rounded-2xl border-0 bg-white/95 shadow-none dark:bg-slate-950/95">
              <CardHeader className="space-y-1 pb-2 text-center sm:text-left">
                <CardTitle className="text-2xl text-slate-900 dark:text-white">
                  Sign in
                </CardTitle>
                <CardDescription>
                  Pick up where you left off with this month&apos;s plan.
                </CardDescription>
              </CardHeader>
              <form onSubmit={onSubmit}>
                <CardContent className="space-y-4">
                  {showVerified ? (
                    <Alert className="border-emerald-300 bg-emerald-50 text-emerald-900">
                      <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                        <span>Your email is verified. You can sign in.</span>
                        <button
                          type="button"
                          onClick={dismissVerifiedBanner}
                          className="text-sm font-medium text-emerald-800 underline"
                        >
                          Dismiss
                        </button>
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  {error ? (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : null}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-slate-700">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="border-violet-200/80 bg-white focus-visible:ring-violet-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-slate-700">
                        Password
                      </Label>
                      <Link
                        to="/forgot-password"
                        className="text-xs font-medium text-violet-700 hover:underline"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <PasswordInput
                      id="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="border-violet-200/80 bg-white focus-visible:ring-violet-500"
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-4">
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/25 hover:from-violet-500 hover:to-fuchsia-500"
                    disabled={loading}
                  >
                    {loading ? 'Signing in…' : 'Sign in & open planner'}
                  </Button>
                  <p className="text-center text-sm text-slate-600">
                    No account?{' '}
                    <Link
                      to="/signup"
                      className="font-semibold text-violet-700 hover:underline"
                    >
                      Sign up
                    </Link>
                  </p>
                </CardFooter>
              </form>
            </Card>
          </div>
        </section>
      </main>
    </div>
  )
}
