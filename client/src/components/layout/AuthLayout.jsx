import { Link } from 'react-router-dom'

export function AuthLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <div className="mb-8">
        <Link
          to="/"
          className="text-lg font-semibold text-primary hover:underline"
        >
          Task Planner
        </Link>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
