import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, type Tables } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'

export function useLocations() {
  return useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data, error } = await supabase.from('locations').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

/** Household with all its dogs (including archived) and latest package. */
export function useHousehold(householdId: string) {
  return useQuery({
    queryKey: ['household', householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('households')
        .select('*, dogs(*), packages(*)')
        .eq('id', householdId)
        .order('created_at', { referencedTable: 'dogs' })
        .order('created_at', { referencedTable: 'packages', ascending: false })
        .single()
      if (error) throw error
      return data
    },
  })
}

function useInvalidateHousehold() {
  const qc = useQueryClient()
  return (householdId: string) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['household', householdId] }),
      qc.invalidateQueries({ queryKey: ['dog_summary'] }),
    ])
}

export type NewHousehold = Pick<Tables<'households'>, 'owner_name' | 'phone' | 'location_id'> & { email?: string | null }

export function useCreateHousehold() {
  const { staff } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (h: NewHousehold) => {
      const { data, error } = await supabase
        .from('households')
        .insert({ ...h, org_id: staff!.org_id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dog_summary'] }),
  })
}

export function useDeleteHousehold() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (householdId: string) => {
      const { error } = await supabase.from('households').delete().eq('id', householdId)
      if (error) throw error
    },
    onSuccess: (_d, householdId) => {
      qc.removeQueries({ queryKey: ['household', householdId] })
      return qc.invalidateQueries({ queryKey: ['dog_summary'] })
    },
  })
}

export type NewDog = Pick<Tables<'dogs'>, 'name'> &
  Partial<Pick<Tables<'dogs'>, 'breed' | 'birth_date' | 'presenting_problem' | 'goal' | 'notes'>>

/** Adds a dog under a household; org + location are inherited from the household. */
export function useAddDog(household: Pick<Tables<'households'>, 'id' | 'org_id' | 'location_id'>) {
  const { staff } = useAuth()
  const invalidate = useInvalidateHousehold()
  return useMutation({
    mutationFn: async (dog: NewDog) => {
      const { data, error } = await supabase
        .from('dogs')
        .insert({
          ...dog,
          household_id: household.id,
          org_id: household.org_id,
          location_id: household.location_id,
          assigned_trainer_id: staff?.id,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => invalidate(household.id),
  })
}

/** "Remove" = archive: hidden from lists, history kept, restorable. */
export function useSetDogArchived(householdId: string) {
  const invalidate = useInvalidateHousehold()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ dogId, archived }: { dogId: string; archived: boolean }) => {
      const { error } = await supabase
        .from('dogs')
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq('id', dogId)
      if (error) throw error
    },
    onSuccess: (_d, { dogId }) => {
      qc.invalidateQueries({ queryKey: ['dog_summary', dogId] })
      return invalidate(householdId)
    },
  })
}

export type PackageInput = { name: string; sessions_total: number; sessions_used: number; paid: boolean }

/** Owner/admin only (enforced by the packages_guard trigger). Pass `id` to edit, omit to add. */
export function useSavePackage(householdId: string) {
  const invalidate = useInvalidateHousehold()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...p }: PackageInput & { id?: string }) => {
      const { error } = id
        ? await supabase.from('packages').update(p).eq('id', id)
        : await supabase.from('packages').insert({ ...p, household_id: householdId })
      if (error) throw new Error(/packages_used_in_range/.test(error.message) ? 'Sessions used must be between 0 and the total.' : error.message)
    },
    onSettled: () => Promise.all([invalidate(householdId), qc.invalidateQueries({ queryKey: ['open_package'] }), qc.invalidateQueries({ queryKey: ['activity'] })]),
  })
}

export function useDeletePackage(householdId: string) {
  const invalidate = useInvalidateHousehold()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('packages').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: () => invalidate(householdId),
  })
}

/** Location id → name (e.g. for "📍 Main" labels). Shares the cached locations list. */
export function useLocationName() {
  const { data } = useLocations()
  return (id: string | null | undefined) => data?.find((l) => l.id === id)?.name ?? null
}

export type HouseholdInput = Pick<Tables<'households'>, 'owner_name' | 'phone' | 'email' | 'payment_status' | 'internal_notes'>

/** Needs edit_households (owners always). */
export function useUpdateHousehold(householdId: string) {
  const invalidate = useInvalidateHousehold()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (h: HouseholdInput) => {
      const { data, error } = await supabase.from('households').update(h).eq('id', householdId).select('id')
      if (error) throw error
      if (!data.length) throw new Error("You don't have permission to edit households.")
    },
    onSettled: () => Promise.all([invalidate(householdId), qc.invalidateQueries({ queryKey: ['unsent_sessions'] }), qc.invalidateQueries({ queryKey: ['activity'] })]),
  })
}

/** Owner only: moves the household and all its dogs, recording a transfer per dog. */
export function useTransferHousehold(householdId: string) {
  const invalidate = useInvalidateHousehold()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ locationId, reason }: { locationId: string; reason: string }) => {
      const { error } = await supabase.rpc('transfer_household', { p_household_id: householdId, p_location_id: locationId, p_reason: reason })
      if (error) throw error
    },
    onSettled: () => Promise.all([invalidate(householdId), qc.invalidateQueries({ queryKey: ['locations'] }), qc.invalidateQueries({ queryKey: ['activity'] })]),
  })
}
