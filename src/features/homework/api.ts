import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'

/** Every homework task for a dog (assigned directly, in a session, or in an owner update), newest first. */
export function useDogHomework(dogId: string) {
  return useQuery({
    queryKey: ['homework', dogId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('homework_tasks')
        .select(`
          id, text, position, created_at, created_by, completed_at, completed_by, session_id, update_id,
          sessions ( occurred_at ),
          owner_updates ( sent_at ),
          assigned_by:staff!homework_tasks_created_by_fkey ( display_name ),
          completer:staff!homework_tasks_completed_by_fkey ( display_name )
        `)
        .eq('dog_id', dogId)
        .order('created_at', { ascending: false })
        .order('position')
        .limit(200)
      if (error) throw error
      return data
    },
  })
}
export type HomeworkRow = NonNullable<ReturnType<typeof useDogHomework>['data']>[number]

function useHomeworkMutation<V>(fn: (v: V) => PromiseLike<{ error: { message: string } | null }>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: V) => {
      const { error } = await fn(v)
      if (error) throw new Error(error.message)
    },
    onSettled: () =>
      Promise.all([['homework'], ['sessions'], ['owner_updates'], ['activity']].map((queryKey) => qc.invalidateQueries({ queryKey }))),
  })
}

export const useAssignHomework = (dogId: string) =>
  useHomeworkMutation((tasks: string[]) =>
    supabase.from('homework_tasks').insert(tasks.map((text, i) => ({ dog_id: dogId, position: i + 1, text }))),
  )

/** Trainer checks a task off (e.g. the owner said they did it). */
export function useSetHomeworkDone() {
  const { staff } = useAuth()
  return useHomeworkMutation(({ id, done }: { id: string; done: boolean }) =>
    supabase
      .from('homework_tasks')
      .update(done ? { completed_at: new Date().toISOString(), completed_by: staff!.id } : { completed_at: null, completed_by: null })
      .eq('id', id),
  )
}

export const useDeleteHomework = () =>
  useHomeworkMutation((id: string) => supabase.from('homework_tasks').delete().eq('id', id))

/** Fix a task's wording (anyone who can see the dog). */
export const useEditHomework = () =>
  useHomeworkMutation(({ id, text }: { id: string; text: string }) => supabase.from('homework_tasks').update({ text }).eq('id', id))
