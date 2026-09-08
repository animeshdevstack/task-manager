import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import ForgotPassword from '@/pages/ForgotPassword'
import Login from '@/pages/Login'
import ResetPassword from '@/pages/ResetPassword'
import Signup from '@/pages/Signup'
import TaskManager from '@/pages/TaskManager'
import HabitTracker from '@/pages/HabitTracker'
import Home from '@/pages/Home'
import Followers from '@/pages/Followers'
import Following from '@/pages/Following'
import Pending from '@/pages/Pending'
import Requests from '@/pages/Requests'
import UserProfile from '@/pages/UserProfile'
import AdminDashboard from '@/pages/admin/AdminDashboard'
import AdminUserHabits from '@/pages/admin/AdminUserHabits'
import SupportDashboard from '@/pages/support/SupportDashboard'
import SupportUserHabits from '@/pages/support/SupportUserHabits'
import SupportRequest from '@/pages/SupportRequest'
import { getStoredUser, hasActiveSession } from '@/lib/auth-api'
import { homePathForRole } from '@/lib/roles'

function RoleHomeRedirect() {
  if (!hasActiveSession()) {
    return <Navigate to="/login" replace />
  }
  const role = getStoredUser()?.role
  if (role === 'admin' || role === 'support') {
    return <Navigate to={homePathForRole(role)} replace />
  }
  return <Home />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <RoleHomeRedirect />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users/:userId/habits"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminUserHabits />
            </ProtectedRoute>
          }
        />
        <Route
          path="/support"
          element={
            <ProtectedRoute roles={['support', 'admin']}>
              <SupportDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/support/users/:userId"
          element={
            <ProtectedRoute roles={['support', 'admin']}>
              <SupportUserHabits />
            </ProtectedRoute>
          }
        />
        <Route
          path="/support-request"
          element={
            <ProtectedRoute roles={['user']}>
              <SupportRequest />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tasks"
          element={
            <ProtectedRoute roles={['user']}>
              <TaskManager />
            </ProtectedRoute>
          }
        />
        <Route
          path="/habits"
          element={
            <ProtectedRoute roles={['user']}>
              <HabitTracker />
            </ProtectedRoute>
          }
        />
        <Route
          path="/requests"
          element={
            <ProtectedRoute roles={['user']}>
              <Requests />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pending"
          element={
            <ProtectedRoute roles={['user']}>
              <Pending />
            </ProtectedRoute>
          }
        />
        <Route
          path="/followers"
          element={
            <ProtectedRoute roles={['user']}>
              <Followers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/following"
          element={
            <ProtectedRoute roles={['user']}>
              <Following />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/:userId"
          element={
            <ProtectedRoute roles={['user']}>
              <UserProfile />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
