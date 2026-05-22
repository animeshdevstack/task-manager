import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { clearSession, getStoredUser } from '@/lib/auth-api'

export default function Home() {
  const [user, setUser] = useState(getStoredUser)

  function signOut() {
    clearSession()
    setUser(null)
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-12">
      <Card>
        <CardHeader className="text-center">
          <CardTitle>Task Planner</CardTitle>
          <CardDescription>
            Plan work, stay organized. Sign in to continue or create an
            account.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          {user ? (
            <>
              <p className="text-center text-sm text-muted-foreground sm:flex sm:flex-1 sm:items-center sm:justify-center">
                Signed in as{' '}
                <span className="font-medium text-foreground">
                  {user.email}
                </span>
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild>
                  <Link to="/tasks">Task manager</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/login">Account</Link>
                </Button>
                <Button variant="secondary" type="button" onClick={signOut}>
                  Sign out
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button asChild>
                <Link to="/login">Sign in</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/signup">Create account</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
