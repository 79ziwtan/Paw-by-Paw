import { useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

const PAGE = 50

/** Org activity log (owners: everything; admins: their locations), newest first. Written by DB triggers. */
export function useActivity(tables?: string[] | null) {
  return useInfiniteQuery({
    queryKey: ['activity', tables ?? 'all'],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let q = supabase
        .from('activity_log')
        .select('id, table_name, action, record_id, label, dog_id, dog_name, changes, created_at, actor_label, actor:staff ( display_name )')
        .order('created_at', { ascending: false })
        .range(pageParam, pageParam + PAGE - 1)
      if (tables) q = q.in('table_name', tables)
      const { data, error } = await q
      if (error) throw error
      return data
    },
    getNextPageParam: (last, all) => (last.length === PAGE ? all.length * PAGE : undefined),
  })
}
export type ActivityRow = NonNullable<ReturnType<typeof useActivity>['data']>['pages'][number][number]

/**
 * How each audited table reads in the feed. ⚠ Add an entry here when you attach the
 * activity trigger (log_activity) to a new table; unknown tables fall back to the raw name.
 */
export const ACTIVITY_TABLES: Record<string, { noun: string; filter?: string }> = {
  sessions: { noun: 'session log', filter: 'Session logs' },
  behavior_tags: { noun: 'tag', filter: 'Tags' },
  homework_tasks: { noun: 'homework', filter: 'Homework' },
  plan_stages: { noun: 'plan stage', filter: 'Plans' },
  plan_templates: { noun: 'plan template', filter: 'Plans' },
  flags: { noun: 'safety flag', filter: 'Flags' },
  dogs: { noun: 'dog', filter: 'Dogs & clients' },
  households: { noun: 'household', filter: 'Dogs & clients' },
  packages: { noun: 'package', filter: 'Dogs & clients' },
  dog_transfers: { noun: 'transfer', filter: 'Dogs & clients' },
  owner_updates: { noun: 'owner update', filter: 'Owner updates' },
  owner_links: { noun: 'owner profile link', filter: 'Owner updates' },
  staff: { noun: 'team member', filter: 'Team & org' },
  staff_locations: { noun: 'location access', filter: 'Team & org' },
  locations: { noun: 'location', filter: 'Team & org' },
  organizations: { noun: 'business settings', filter: 'Team & org' },
}

/** Friendlier names for changed columns. Anything not listed shows as the column name with spaces. */
const FIELD_LABELS: Record<string, string> = {
  completed_at: 'done',
  completed_by: 'done',
  resolved_at: 'resolved',
  archived_at: 'archived',
  deactivated_at: 'access',
  assigned_trainer_id: 'trainer',
  location_id: 'location',
  payment_status: 'payment',
  sent_at: 'sent',
  token_hash: 'link',
  expires_at: 'link',
  link_requested_at: 'new link requested',
  update_id: 'added to owner update',
}

export function describeChanges(changes: string[] | null) {
  if (!changes?.length) return ''
  return [...new Set(changes.map((c) => FIELD_LABELS[c] ?? c.replace(/_id$/, '').replace(/_/g, ' ')))].join(', ')
}
