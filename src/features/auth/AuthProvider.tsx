import type { Session } from '@supabase/supabase-js'
import { useQuery } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase, type Tables } from '../../lib/supabase'

type AuthState = {
  session: Session | null
  staff: Tables<'staff'> | null
  loading: boolean
}

const AuthContext = createContext<AuthState>({ session: null, staff: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  const staffQuery = useQuery({
    queryKey: ['staff', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('staff').select('*').eq('id', userId!).maybeSingle()
      if (error) throw error
      return data
    },
  })

  const loading = sessionLoading || (!!userId && staffQuery.isPending)
  return (
    <AuthContext.Provider value={{ session, staff: staffQuery.data ?? null, loading }}>{children}</AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
