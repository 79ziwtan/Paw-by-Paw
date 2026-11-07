import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import { supabase, type Tables } from '../../lib/supabase'
import type { StageStatus } from '../sessions/api'

export type Stage = Tables<'plan_stages'>
type TemplateStage = { name: string; description?: string }

export function usePlanTemplates() {
  return useQuery({
    queryKey: ['plan_templates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('plan_templates').select('*').order('name')
      if (error) throw error
      return data.map((t) => ({ ...t, stages: (t.stages ?? []) as TemplateStage[] }))
    },
  })
}

/** Every status change for this dog's stages, newest first. */
export function useStageHistory(dogId: string) {
  return useQuery({
    queryKey: ['stage_events', dogId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stage_events')
        .select('id, from_status, to_status, reason, created_at, session_id, plan_stages ( name ), staff ( display_name )')
        .eq('dog_id', dogId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data
    },
  })
}

/** Runs a plan change, then refreshes everything that shows the plan. */
function usePlanMutation<V>(dogId: string, fn: (v: V) => Promise<void>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () =>
      Promise.all(
        [['plan_stages', dogId], ['stage_events', dogId], ['dog_summary'], ['sessions', dogId], ['activity']].map((queryKey) =>
          qc.invalidateQueries({ queryKey }),
        ),
      ),
  })
}

const check = ({ error }: { error: { message: string } | null }) => {
  if (error) throw new Error(error.message)
}

export const useApplyTemplate = (dogId: string) =>
  usePlanMutation(dogId, async ({ templateId, stages, startAt }: { templateId: string; stages: TemplateStage[]; startAt: number }) =>
    check(
      await supabase.from('plan_stages').insert(
        stages.map((s, i) => ({
          dog_id: dogId,
          position: startAt + i,
          name: s.name,
          description: s.description || null,
          source_template_id: templateId,
        })),
      ),
    ),
  )

export const useAddStage = (dogId: string) =>
  usePlanMutation(dogId, async ({ name, position }: { name: string; position: number }) =>
    check(await supabase.from('plan_stages').insert({ dog_id: dogId, name, position })),
  )

export const useUpdateStage = (dogId: string) =>
  usePlanMutation(dogId, async ({ id, ...patch }: { id: string; name?: string; description?: string | null }) =>
    check(await supabase.from('plan_stages').update(patch).eq('id', id)),
  )

export const useDeleteStage = (dogId: string) =>
  usePlanMutation(dogId, async (id: string) => check(await supabase.from('plan_stages').delete().eq('id', id)))

/** Writes new positions for the stages in the given order (only the ones that moved). */
export const useReorderStages = (dogId: string) =>
  usePlanMutation(dogId, async (ordered: Stage[]) => {
    const moved = ordered.map((s, i) => ({ id: s.id, position: i + 1, was: s.position })).filter((s) => s.position !== s.was)
    const results = await Promise.all(moved.map((s) => supabase.from('plan_stages').update({ position: s.position }).eq('id', s.id)))
    results.forEach(check)
  })

/** The status trigger writes the stage_event; the reason is attached to that event afterwards. */
export const useSetStageStatus = (dogId: string) =>
  usePlanMutation(dogId, async ({ id, status, reason }: { id: string; status: StageStatus; reason: string }) => {
    check(await supabase.from('plan_stages').update({ status }).eq('id', id))
    if (!reason.trim()) return
    const { data, error } = await supabase
      .from('stage_events')
      .select('id')
      .eq('stage_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (error) throw error
    check(await supabase.from('stage_events').update({ reason: reason.trim() }).eq('id', data.id))
  })

export type TemplateStageInput = { name: string; description?: string }

/** Org → Tags & templates. Pass `id` to edit an existing template. */
export function useSaveTemplate() {
  const qc = useQueryClient()
  const { staff } = useAuth()
  return useMutation({
    mutationFn: async ({ id, name, stages }: { id?: string; name: string; stages: TemplateStageInput[] }) => {
      const { error } = id
        ? await supabase.from('plan_templates').update({ name, stages }).eq('id', id)
        : await supabase.from('plan_templates').insert({ org_id: staff!.org_id, name, stages })
      if (error) throw error
    },
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: ['plan_templates'] }), qc.invalidateQueries({ queryKey: ['activity'] })]),
  })
}

export function useDeleteTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('plan_templates').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: ['plan_templates'] }), qc.invalidateQueries({ queryKey: ['activity'] })]),
  })
}
