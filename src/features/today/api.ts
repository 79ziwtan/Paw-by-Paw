import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { SESSION_SELECT } from '../sessions/api'

/** Local midnight today and tomorrow, as ISO strings. */
export function todayRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

/** Sessions that happened today, across every dog you can see, newest first. */
export function useTodaySessions() {
  const { start, end } = todayRange()
  return useQuery({
    queryKey: ['sessions', 'today', start],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select(SESSION_SELECT)
        .gte('occurred_at', start)
        .lt('occurred_at', end)
        .order('occurred_at', { ascending: false })
        .order('position', { referencedTable: 'homework_tasks' })
      if (error) throw error
      return data
    },
  })
}

const HOMEWORK_SELECT =
  'id, text, position, created_at, completed_at, completed_by, session_id, update_id, dogs ( id, name ), assigned_by:staff!homework_tasks_created_by_fkey ( display_name ), completer:staff!homework_tasks_completed_by_fkey ( display_name )' as const

/** Tasks given together: one session, one owner update, or one "Assign homework" batch. */
const groupKey = (t: { update_id: string | null; session_id: string | null; created_at: string; dogs: { id: string } | null }) =>
  t.update_id ?? t.session_id ?? `${t.dogs?.id}|${t.created_at}`

/**
 * Homework blocks for today: every assignment given today, plus earlier assignments
 * with a task completed today. Each block holds all of that assignment's tasks.
 */
export function useTodayHomework() {
  const { start } = todayRange()
  return useQuery({
    queryKey: ['homework', 'today', 'blocks', start],
    queryFn: async () => {
      const { data: hits, error } = await supabase
        .from('homework_tasks')
        .select(HOMEWORK_SELECT)
        .or(`created_at.gte."${start}",completed_at.gte."${start}"`)
      if (error) throw error

      // Pull in the rest of each session's / update's tasks so the blocks are complete.
      const sessionIds = [...new Set(hits.flatMap((t) => (!t.update_id && t.session_id ? [t.session_id] : [])))]
      const updateIds = [...new Set(hits.flatMap((t) => (t.update_id ? [t.update_id] : [])))]
      const filters = [sessionIds.length && `session_id.in.(${sessionIds})`, updateIds.length && `update_id.in.(${updateIds})`].filter(Boolean)
      let tasks = hits
      if (filters.length) {
        const { data: rest, error: e2 } = await supabase.from('homework_tasks').select(HOMEWORK_SELECT).or(filters.join(','))
        if (e2) throw e2
        const seen = new Set(hits.map((t) => t.id))
        tasks = [...hits, ...rest.filter((t) => !seen.has(t.id))]
      }

      const since = Date.parse(start)
      const groups = new Map<string, typeof tasks>()
      for (const t of tasks) groups.set(groupKey(t), [...(groups.get(groupKey(t)) ?? []), t])
      return [...groups.values()]
        .map((ts) => {
          ts.sort((a, b) => a.position - b.position)
          const first = ts[0]
          const doneToday = ts.filter((t) => t.completed_at && Date.parse(t.completed_at) >= since).length
          return {
            key: groupKey(first),
            dog: first.dogs,
            source: first.update_id ? 'Owner update' : first.session_id ? 'Session' : 'Assigned',
            assignedAt: first.created_at,
            assignedToday: Date.parse(first.created_at) >= since,
            assignedBy: first.assigned_by?.display_name ?? null,
            doneToday,
            tasks: ts,
          }
        })
        .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt))
    },
  })
}
export type TodayHomeworkBlock = NonNullable<ReturnType<typeof useTodayHomework>['data']>[number]
