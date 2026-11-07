import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Button, Field, inputClass } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { useAuth } from './AuthProvider'

/** Invited staff land here from their email link and choose a password. */
export function WelcomePage() {
  const { session, staff, loading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (loading) return <p className="p-6 text-neutral-500">Loading…</p>
  if (!session) return <Navigate to="/login" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return setError(error.message)
    navigate('/', { replace: true })
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-4">
      <h1 className="text-2xl font-semibold">Welcome{staff ? `, ${staff.display_name.split(' ')[0]}` : ''}</h1>
      <p className="text-neutral-600">Choose a password so you can sign in next time.</p>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="New password">
          <input className={inputClass} type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </Field>
        {error && <p className="text-sm text-flag">{error}</p>}
        <Button type="submit">Save and continue</Button>
      </form>
    </main>
  )
}
