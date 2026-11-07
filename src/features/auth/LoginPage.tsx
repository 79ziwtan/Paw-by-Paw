import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { Button, Field, inputClass } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { useAuth } from './AuthProvider'

export function LoginPage() {
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [error, setError] = useState<string | null>(null)

  if (session) return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const { error } =
      mode === 'signIn'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
    if (error) setError(error.message)
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-4">
      <h1 className="text-2xl font-semibold">Paw by Paw</h1>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Email">
          <input className={inputClass} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <input className={inputClass} type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-flag">{error}</p>}
        <Button type="submit">{mode === 'signIn' ? 'Sign in' : 'Create account'}</Button>
      </form>
      <button className="text-sm text-neutral-600 underline" onClick={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
        {mode === 'signIn' ? 'New here? Create an account' : 'Have an account? Sign in'}
      </button>
      {import.meta.env.DEV && <p className="text-xs text-neutral-500">Local demo: owner@pawbypaw.test / password123</p>}
    </main>
  )
}
