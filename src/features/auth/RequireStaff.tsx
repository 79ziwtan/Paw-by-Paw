import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { Button } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import type { StaffRole } from '../org/api'
import { useAuth } from './AuthProvider'

/** Signed in, belongs to an organization, still active, and (optionally) has one of `roles`. */
export function RequireStaff({ children, roles }: { children: ReactNode; roles?: StaffRole[] }) {
  const { session, staff, loading } = useAuth()
  if (loading) return <p className="p-6 text-neutral-500">Loading…</p>
  if (!session) return <Navigate to="/login" replace />
  if (!staff) return <Navigate to="/onboarding" replace />
  if (staff.deactivated_at) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-4 text-center">
        <h1 className="text-xl font-semibold">Your access has been removed</h1>
        <p className="text-neutral-600">Ask the business owner if you think this is a mistake.</p>
        <Button variant="secondary" onClick={() => supabase.auth.signOut()}>Sign out</Button>
      </main>
    )
  }
  if (roles && !roles.includes(staff.role)) return <Navigate to="/" replace />
  return children
}
