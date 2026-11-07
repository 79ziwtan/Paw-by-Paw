import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Button, Field, inputClass } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { useAuth } from './AuthProvider'

/** First sign-in: create the organization; the caller becomes its owner. */
export function OnboardingPage() {
  const { session, staff, loading } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [orgName, setOrgName] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  if (staff) return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.rpc('create_organization', { org_name: orgName, owner_display_name: name })
    if (error) return setError(error.message)
    await qc.invalidateQueries({ queryKey: ['staff'] })
    navigate('/')
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-4">
      <h1 className="text-2xl font-semibold">Set up your business</h1>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Business name">
          <input className={inputClass} required value={orgName} onChange={(e) => setOrgName(e.target.value)} />
        </Field>
        <Field label="Your name">
          <input className={inputClass} required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-flag">{error}</p>}
        <Button type="submit">Continue</Button>
      </form>
    </main>
  )
}
