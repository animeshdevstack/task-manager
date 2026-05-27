import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Lock, UserPlus } from 'lucide-react'
import AppPageHeader from '@/components/layout/AppPageHeader'
import { Button } from '@/components/ui/button'
import SharedHabitView from '@/components/follow/SharedHabitView'
import { clearSession, getStoredUser } from '@/lib/auth-api'
import { followRequest } from '@/lib/follow-api'

function formatYearMonth(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function userIdStr(id) {
  return typeof id === 'string' ? id : id?.toString?.() ?? String(id)
}

function displayUser(u) {
  const name = [u?.Fname, u?.Lname].filter(Boolean).join(' ').trim()
  return name || u?.email || 'User'
}

function isAuthzErrorMessage(message) {
  return /not authorized|forbidden|cannot view/i.test(message)
}

export default function UserProfile() {
  const { userId = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [user] = useState(getStoredUser)
  const monthKey = useMemo(() => formatYearMonth(new Date()), [])

  const [loading, setLoading] = useState(true)
  const [checkingAccess, setCheckingAccess] = useState(true)
  const [error, setError] = useState(null)
  const [statusMessage, setStatusMessage] = useState(null)
  const [profileUser, setProfileUser] = useState(null)
  const [relationship, setRelationship] = useState('none')
  const [canViewTasks, setCanViewTasks] = useState(false)
  const [sendingRequest, setSendingRequest] = useState(false)

  const loadProfileData = useCallback(async () => {
    setLoading(true)
    setCheckingAccess(true)
    setError(null)
    setStatusMessage(null)
    try {
      const meRes = await followRequest('/me')
      const data = meRes.data ?? {}
      const allKnown = [
        ...(data.followers ?? []),
        ...(data.following ?? []),
        ...(data.incomingPending ?? []),
        ...(data.followingPending ?? []),
      ]
      const match = allKnown.find((item) => userIdStr(item.userId) === userId)
      setProfileUser(match ?? { userId, email: `User ${userId}` })

      const isFollowing = (data.following ?? []).some((item) => userIdStr(item.userId) === userId)
      const isPending = (data.followingPending ?? []).some((item) => userIdStr(item.userId) === userId)
      setRelationship(isFollowing ? 'accepted' : isPending ? 'pending' : 'none')

      try {
        await followRequest(`/${encodeURIComponent(userId)}/add-tasks?month=${encodeURIComponent(monthKey)}`)
        setCanViewTasks(true)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Could not verify access'
        if (isAuthzErrorMessage(message)) {
          setCanViewTasks(false)
        } else {
          setError(message)
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load profile')
    } finally {
      setCheckingAccess(false)
      setLoading(false)
    }
  }, [userId, monthKey])

  useEffect(() => {
    if (!userId) return
    void loadProfileData()
  }, [userId, loadProfileData])

  async function handleFollowRequest() {
    if (!userId) return
    setSendingRequest(true)
    setStatusMessage(null)
    try {
      await followRequest(`/request/${encodeURIComponent(userId)}`, { method: 'POST' })
      setRelationship('pending')
      setStatusMessage('Follow request sent')
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : 'Could not send follow request')
    } finally {
      setSendingRequest(false)
    }
  }

  function signOut() {
    clearSession()
    window.location.assign('/login')
  }

  const userLabel = displayUser(profileUser)
  const userEmail = profileUser?.email
  const source = new URLSearchParams(location.search).get('source')
  const backHref = source === 'following' ? '/following' : '/followers'

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-violet-200/70 via-fuchsia-100/80 to-cyan-200/70">
      <AppPageHeader
        title="Profile"
        subtitle="Follower and following details"
        onSignOut={signOut}
        navContext="social"
        backTo={backHref}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-5 sm:px-6 sm:py-6">
        <section className="rounded-2xl border border-white/70 bg-white/45 p-4 shadow-sm ring-1 ring-violet-200/50 backdrop-blur-sm dark:border-slate-800/50 dark:bg-slate-900/30">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading profile…</p>
          ) : error ? (
            <p className="py-8 text-center text-sm text-red-600">{error}</p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-violet-200/70 bg-white/80 px-4 py-3 dark:border-violet-900/50 dark:bg-slate-900/50">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-slate-900 dark:text-white">
                    {userLabel}
                  </p>
                  {userEmail ? (
                    <p className="truncate text-xs text-slate-500">{userEmail}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {relationship === 'accepted' ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                      Following
                    </span>
                  ) : relationship === 'pending' ? (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                      Request pending
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      Not following
                    </span>
                  )}
                </div>
              </div>

              {statusMessage ? (
                <p className="mb-3 text-xs text-violet-700 dark:text-violet-200">{statusMessage}</p>
              ) : null}

              {checkingAccess ? (
                <p className="py-8 text-center text-sm text-slate-500">Checking access…</p>
              ) : canViewTasks ? (
                <SharedHabitView targetUserId={userId} userLabel={userLabel} />
              ) : (
                <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 p-5 text-center dark:border-amber-900/60 dark:bg-amber-950/20">
                  <Lock className="mx-auto mb-2 h-5 w-5 text-amber-700" />
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                    Tasks are private until your follow request is accepted.
                  </p>
                  <p className="mt-1 text-xs text-amber-800/90 dark:text-amber-200/90">
                    You can still open this profile now.
                  </p>
                  {relationship === 'none' ? (
                    <Button
                      type="button"
                      size="sm"
                      className="mt-4 gap-1"
                      disabled={sendingRequest}
                      onClick={() => void handleFollowRequest()}
                    >
                      <UserPlus className="h-4 w-4" />
                      Send follow request
                    </Button>
                  ) : null}
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  )
}
