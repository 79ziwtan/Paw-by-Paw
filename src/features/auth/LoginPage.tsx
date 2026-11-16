import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { Button, Field, inputClass, Logo } from '../../components/ui'
import { HOME } from '../../lib/paths'
import { supabase } from '../../lib/supabase'
import { useAuth } from './AuthProvider'

export function LoginPage() {
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to={HOME} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error } =
      mode === 'signIn'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (error) setError(error.message)
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-gold-50 p-4">
      <div aria-hidden className="waffle-grid absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_50%_30%,#000_0%,transparent_70%)]" />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo size={52} />
          <h1 className="text-4xl font-bold">Train with Waffle</h1>
          <p className="text-neutral-600">{mode === 'signIn' ? 'Sign in to see today’s dogs.' : 'Create your trainer account.'}</p>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4 rounded-3xl border border-neutral-200 bg-white p-6 shadow-[0_30px_60px_-30px_rgba(100,61,20,.45)]">
          <Field label="Email">
            <input className={inputClass} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password">
            <input className={inputClass} type="password" required minLength={6} autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error && <p className="rounded-xl bg-flag-soft p-3 text-sm text-flag">{error}</p>}
          <Button type="submit" className="mt-1" disabled={busy}>{busy ? 'One moment…' : mode === 'signIn' ? 'Sign in' : 'Create account'}</Button>
        </form>
        <button className="mx-auto mt-5 block text-sm font-medium text-neutral-600 hover:underline" onClick={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
          {mode === 'signIn' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
      </div>
    </main>
  )
}
