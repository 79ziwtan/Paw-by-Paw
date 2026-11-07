import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Json } from '../../lib/database.types'
import { supabase, type Tables } from '../../lib/supabase'
import type { Measures } from './measures'

const PAGE = 10

/** Columns for a session card. Shared so every list of sessions has the same shape. */
export const SESSION_SELECT = `
          id, dog_id, occurred_at, rating, takes_food, internal_notes, external_notes, package_id,
          dogs ( id, name, household_id ),
          staff ( display_name ),
          session_behaviors ( id, measures, note, behavior_tags ( label ) ),
          flags ( id, severity, note, resolved_at ),
          stage_events ( id, from_status, to_status, reason, plan_stages ( name ) ),
          homework_tasks ( id, position, text, completed_at )
        ` as const

/** All sessions for a dog, newest first, with behaviors, trainer, flags raised and stage changes. */
export function useDogSessions(dogId: string) {
  return useInfiniteQuery({
    queryKey: ['sessions', dogId],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase
        .from('sessions')
        .select(SESSION_SELECT)
        .eq('dog_id', dogId)
        .order('occurred_at', { ascending: false })
        .order('position', { referencedTable: 'homework_tasks' })
        .range(pageParam, pageParam + PAGE - 1)
      if (error) throw error
      return data
    },
    getNextPageParam: (last, all) => (last.length === PAGE ? all.length * PAGE : undefined),
  })
}
export type SessionRow = NonNullable<ReturnType<typeof useDogSessions>['data']>['pages'][number][number]

export function usePlanStages(dogId: string) {
  return useQuery({
    queryKey: ['plan_stages', dogId],
    queryFn: async () => {
      const { data, error } = await supabase.from('plan_stages').select('*').eq('dog_id', dogId).order('position')
      if (error) throw error
      return data
    },
  })
}

/** Newest package of the dog's household that still has sessions left (or null). */
export function useOpenPackage(dogId: string) {
  return useQuery({
    queryKey: ['open_package', dogId],
    queryFn: async () => {
      const { data: dog, error: e1 } = await supabase.from('dogs').select('household_id').eq('id', dogId).single()
      if (e1) throw e1
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .eq('household_id', dog.household_id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data.find((p) => p.sessions_used < p.sessions_total) ?? null
    },
  })
}

export function useAddCustomTag(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (label: string) => {
      const { data, error } = await supabase.from('behavior_tags').insert({ org_id: orgId, label }).select().single()
      if (error) throw new Error(/duplicate|unique/i.test(error.message) ? 'That tag already exists.' : error.message)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['behavior_tags'] }),
  })
}

export type StageStatus = Tables<'plan_stages'>['status']
export type StageAction =
  | { action: 'advance'; reason?: string }
  | { action: 'set'; target_stage_id: string; status: StageStatus; reason: string }

export type LogSessionInput = {
  dogId: string
  occurredAt: string
  rating: number | null
  takesFood: boolean | null
  internalNotes: string
  externalNotes: string
  behaviors: { tag_id: string; measures: Measures; note?: string }[]
  flag: { severity: 'low' | 'med' | 'high'; note: string } | null
  stage: StageAction | null
  countPackage: boolean
  homework: string[]
}

export function useLogSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: LogSessionInput) => {
      const { data, error } = await supabase.rpc('log_session', {
        p_dog_id: i.dogId,
        p_occurred_at: i.occurredAt,
        p_rating: i.rating ?? undefined,
        p_takes_food: i.takesFood ?? undefined,
        p_internal_notes: i.internalNotes,
        p_external_notes: i.externalNotes,
        p_behaviors: i.behaviors as unknown as Json,
        p_flag: (i.flag ?? undefined) as Json | undefined,
        p_stage: (i.stage ?? undefined) as Json | undefined,
        p_count_package: i.countPackage,
        p_homework: i.homework,
      })
      if (error) throw error
      return data
    },
    onSuccess: (_id, i) =>
      Promise.all(
        [['sessions'], ['dog_summary'], ['flags', i.dogId], ['plan_stages', i.dogId], ['open_package', i.dogId], ['household'], ['homework'], ['activity']].map(
          (queryKey) => qc.invalidateQueries({ queryKey }),
        ),
      ),
  })
}

/** Needs the delete_sessions permission (owners always). Its homework is deleted with it. */
export function useDeleteSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error: e1 } = await supabase.from('homework_tasks').delete().eq('session_id', id)
      if (e1) throw e1
      const { data, error } = await supabase.from('sessions').delete().eq('id', id).select('id')
      if (error) throw error
      if (!data.length) throw new Error("You don't have permission to delete sessions.")
    },
    onSettled: () =>
      Promise.all([['sessions'], ['homework'], ['unsent_sessions'], ['dog_summary'], ['open_package'], ['activity']].map((queryKey) => qc.invalidateQueries({ queryKey }))),
  })
}

/** One session with what the edit screen needs. */
export function useSession(sessionId: string) {
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, dog_id, occurred_at, rating, takes_food, internal_notes, external_notes, session_behaviors ( tag_id, measures, note ), homework_tasks ( id, position, text, created_by, completed_at )')
        .eq('id', sessionId)
        .order('position', { referencedTable: 'homework_tasks' })
        .single()
      if (error) throw error
      return data
    },
  })
}

export type UpdateSessionInput = {
  sessionId: string
  dogId: string
  occurredAt: string
  rating: number | null
  takesFood: boolean | null
  internalNotes: string
  externalNotes: string
  behaviors: { tag_id: string; measures: Measures; note?: string }[]
  newHomework: string[]
}

export function useUpdateSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: UpdateSessionInput) => {
      const { error } = await supabase.rpc('update_session', {
        p_session_id: i.sessionId,
        p_occurred_at: i.occurredAt,
        p_rating: i.rating as number,
        p_takes_food: i.takesFood as boolean,
        p_internal_notes: i.internalNotes,
        p_external_notes: i.externalNotes,
        p_behaviors: i.behaviors as unknown as Json,
      })
      if (error) throw error
      if (i.newHomework.length) {
        const { data: last } = await supabase.from('homework_tasks').select('position').eq('session_id', i.sessionId).order('position', { ascending: false }).limit(1)
        const start = last?.[0]?.position ?? 0
        const { error: e2 } = await supabase
          .from('homework_tasks')
          .insert(i.newHomework.map((text, n) => ({ dog_id: i.dogId, session_id: i.sessionId, position: start + n + 1, text })))
        if (e2) throw e2
      }
    },
    onSettled: (_d, _e, i) =>
      Promise.all([['session', i.sessionId], ['sessions'], ['homework'], ['unsent_sessions'], ['dog_summary'], ['activity']].map((queryKey) => qc.invalidateQueries({ queryKey }))),
  })
}
