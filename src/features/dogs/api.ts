import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, type Tables } from '../../lib/supabase'

/** One row per dog with stage, flags, payment and last 2 sessions (view: dog_summary). */
export function useDogSummaries(search = '') {
  return useQuery({
    queryKey: ['dog_summary', { search }],
    queryFn: async () => {
      let q = supabase.from('dog_summary').select('*').is('archived_at', null).order('name')
      if (search) q = q.or(`name.ilike.%${search}%,owner_name.ilike.%${search}%`)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function useDogSummary(dogId: string) {
  return useQuery({
    queryKey: ['dog_summary', dogId],
    queryFn: async () => {
      const { data, error } = await supabase.from('dog_summary').select('*').eq('id', dogId).single()
      if (error) throw error
      return data
    },
  })
}

export function useActiveFlags(dogId: string) {
  return useQuery({
    queryKey: ['flags', dogId, 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flags')
        .select('*')
        .eq('dog_id', dogId)
        .is('resolved_at', null)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

/** Full dog row (fields the summary view doesn't carry: presenting problem, notes, trainer). */
export function useDog(dogId: string) {
  return useQuery({
    queryKey: ['dog', dogId],
    queryFn: async () => {
      const { data, error } = await supabase.from('dogs').select('*, trainer:staff ( display_name )').eq('id', dogId).single()
      if (error) throw error
      return data
    },
  })
}

/** Active staff in the org, for the "assigned trainer" picker. */
export function useActiveStaff() {
  return useQuery({
    queryKey: ['staff_list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('staff').select('id, display_name, role').is('deactivated_at', null).order('display_name')
      if (error) throw error
      return data
    },
  })
}

export type DogInput = Pick<Tables<'dogs'>, 'name' | 'breed' | 'birth_date' | 'presenting_problem' | 'goal' | 'notes' | 'assigned_trainer_id'>

export function useUpdateDog(dogId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (d: DogInput) => {
      const { error } = await supabase.from('dogs').update(d).eq('id', dogId)
      if (error) throw error
    },
    onSettled: () =>
      Promise.all([['dog', dogId], ['dog_summary'], ['household'], ['unsent_sessions'], ['activity']].map((queryKey) => qc.invalidateQueries({ queryKey }))),
  })
}
