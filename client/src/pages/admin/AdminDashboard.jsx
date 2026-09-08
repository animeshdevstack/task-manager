import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Users } from 'lucide-react'
import AppPageHeader from '@/components/layout/AppPageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { Toast, TOAST_DURATION_MS } from '@/components/ui/toast'
import { adminRequest } from '@/lib/admin-api'
import { clearSession, getStoredUser } from '@/lib/auth-api'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [user] = useState(getStoredUser)
  const [supportUsers, setSupportUsers] = useState([])
  const [appUsers, setAppUsers] = useState([])
  const [userQuery, setUserQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [form, setForm] = useState({
    Fname: '',
    Lname: '',
    email: '',
    password: '',
  })

  function showToast(message, variant = 'success') {
    setToast({ message, variant })
    window.setTimeout(() => setToast(null), TOAST_DURATION_MS)
  }

  const loadSupport = useCallback(async () => {
    const res = await adminRequest('/support-users')
    setSupportUsers(Array.isArray(res.data) ? res.data : [])
  }, [])

  const loadUsers = useCallback(async (q = '') => {
    const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''
    const res = await adminRequest(`/users${qs}`)
    setAppUsers(Array.isArray(res.data) ? res.data : [])
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        await Promise.all([loadSupport(), loadUsers()])
      } catch (e) {
        if (!cancelled) {
          showToast(e instanceof Error ? e.message : 'Failed to load', 'error')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadSupport, loadUsers])

  function signOut() {
    clearSession()
    navigate('/login', { replace: true })
  }

  async function onCreateSupport(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await adminRequest('/support-users', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      setForm({ Fname: '', Lname: '', email: '', password: '' })
      await loadSupport()
      showToast('Support user created')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Create failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(id, isActive) {
    try {
      await adminRequest(`/support-users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !isActive }),
      })
      await loadSupport()
      showToast(isActive ? 'Support user deactivated' : 'Support user activated')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed', 'error')
    }
  }

  async function onSearchUsers(e) {
    e.preventDefault()
    try {
      await loadUsers(userQuery)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Search failed', 'error')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-cyan-50">
      <AppPageHeader
        title="Admin"
        subtitle={user?.email ?? 'Control panel'}
        icon={Shield}
        onSignOut={signOut}
        maxWidthClass="max-w-5xl"
      />

      <main className="mx-auto max-w-5xl space-y-8 px-5 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Create support staff and oversee app users.
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link to="/support">Open Support tools</Link>
          </Button>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
            <Users className="h-4 w-4" />
            Create support user
          </h2>
          <form
            onSubmit={onCreateSupport}
            className="grid gap-3 sm:grid-cols-2"
          >
            <div className="space-y-1.5">
              <Label htmlFor="fname">First name</Label>
              <Input
                id="fname"
                value={form.Fname}
                onChange={(e) => setForm((f) => ({ ...f, Fname: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lname">Last name</Label>
              <Input
                id="lname"
                value={form.Lname}
                onChange={(e) => setForm((f) => ({ ...f, Lname: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
                required
                minLength={6}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'Creating…' : 'Create support account'}
              </Button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-900">
            Support team
          </h2>
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : supportUsers.length === 0 ? (
            <p className="text-sm text-slate-500">No support users yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {supportUsers.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {[s.Fname, s.Lname].filter(Boolean).join(' ')}
                    </p>
                    <p className="text-xs text-slate-500">{s.email}</p>
                    <p className="text-xs text-slate-400">
                      {s.isActive ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggleActive(s.id, s.isActive)}
                  >
                    {s.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-900">
            App users
          </h2>
          <form onSubmit={onSearchUsers} className="mb-4 flex gap-2">
            <Input
              placeholder="Search by name or email"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
            />
            <Button type="submit" variant="outline">
              Search
            </Button>
          </form>
          {appUsers.length === 0 ? (
            <p className="text-sm text-slate-500">No users found.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {appUsers.map((u) => (
                <li
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {[u.Fname, u.Lname].filter(Boolean).join(' ')}
                    </p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/admin/users/${u.id}/habits`}>View habits</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {toast ? <Toast message={toast.message} variant={toast.variant} /> : null}
    </div>
  )
}
