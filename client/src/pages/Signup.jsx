import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Mail, Sparkles } from 'lucide-react'
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
import { cn } from '@/lib/utils'

const inputClass =
  'border-violet-200/80 bg-white focus-visible:ring-violet-500'

export default function Signup() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const verifyFailed = searchParams.get('verify') === 'error'
  const [Fname, setFname] = useState('')
  const [Lname, setLname] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const role = 'user'
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const body = {
        Fname,
        Lname,
        email,
        password,
        role,
      }
      if (phone.trim()) body.phone = phone.trim()

      const res = await authRequest('/signup', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      saveSession(res.data)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account')
    } finally {
      setLoading(false)
    }
  }

  function dismissVerifyError() {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('verify')
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
              <Sparkles className="h-4 w-4 text-violet-600" aria-hidden />
              Start planning in color
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Create your{' '}
              <span className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-600 bg-clip-text text-transparent">
                task planner
              </span>
            </h1>
            <p className="mx-auto max-w-lg text-base text-slate-600 lg:mx-0">
              Sign up to organize daily habits, weekly milestones, and monthly themes on
              bright boards built for todo-style planning.
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
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold text-violet-700 underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </section>

        <section className="mx-auto w-full max-w-lg shrink-0 lg:mx-0">
          <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 p-[1px] shadow-xl shadow-fuchsia-500/25">
            <Card className="rounded-2xl border-0 bg-white/95 shadow-none dark:bg-slate-950/95">
              <CardHeader className="space-y-1 pb-2 text-center sm:text-left">
                <CardTitle className="text-2xl text-slate-900 dark:text-white">
                  Create account
                </CardTitle>
                <CardDescription className="flex items-start gap-2 sm:items-center">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 sm:mt-0" aria-hidden />
                  <span>
                    You&apos;ll get a verification email after registering — then you can
                    open your planner.
                  </span>
                </CardDescription>
              </CardHeader>
              <form onSubmit={onSubmit}>
                <CardContent className="space-y-4">
                  {verifyFailed ? (
                    <Alert variant="destructive">
                      <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          Email verification failed or the link is invalid. Try signing
                          up again.
                        </span>
                        <button
                          type="button"
                          onClick={dismissVerifyError}
                          className="shrink-0 text-sm font-medium underline"
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
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="Fname" className="text-slate-700">
                        First name
                      </Label>
                      <Input
                        id="Fname"
                        autoComplete="given-name"
                        required
                        value={Fname}
                        onChange={(e) => setFname(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="Lname" className="text-slate-700">
                        Last name
                      </Label>
                      <Input
                        id="Lname"
                        autoComplete="family-name"
                        required
                        value={Lname}
                        onChange={(e) => setLname(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>
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
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-slate-700">
                      Phone <span className="text-slate-400">(optional)</span>
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-slate-700">
                      Password
                    </Label>
                    <PasswordInput
                      id="password"
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <p className="flex items-start gap-2 rounded-lg bg-violet-50/80 px-3 py-2 text-xs text-violet-900/80 ring-1 ring-violet-200/60">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                    After signup you can jump straight into your monthly task boards.
                  </p>
                </CardContent>
                <CardFooter className="flex flex-col gap-4">
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/25 hover:from-violet-500 hover:to-fuchsia-500"
                    disabled={loading}
                  >
                    {loading ? 'Creating account…' : 'Create account & open planner'}
                  </Button>
                  <p className="text-center text-sm text-slate-600">
                    Already have an account?{' '}
                    <Link
                      to="/login"
                      className="font-semibold text-violet-700 hover:underline"
                    >
                      Sign in
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
