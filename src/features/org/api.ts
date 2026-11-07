import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import type { Permission } from '../auth/permissions'

export type StaffRole = Database['public']['Enums']['staff_role']

export const ROLE_INFO: Record<StaffRole, { label: string; description: string }> = {
  owner: { label: 'Business owner', description: 'Everything, including team, locations and transfers. Sees all locations.' },
  admin: { label: 'Admin', description: 'Everything a trainer can do, plus the permissions below, in assigned locations.' },
  trainer: { label: 'Trainer', description: 'Dogs, plans, session logs and owner updates in assigned locations.' },
}

const teamKey = ['team']

export function useTeam() {
  return useQuery({
    queryKey: teamKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_team')
      if (error) throw error
      return data
    },
  })
}

function useTeamMutation<V>(fn: (v: V) => PromiseLike<{ error: { message: string } | null }>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: V) => {
      const { error } = await fn(v)
      if (error) throw new Error(error.message)
    },
    // ['staff'] too, in case the owner changed their own role.
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: teamKey }), qc.invalidateQueries({ queryKey: ['staff'] })]),
  })
}

/** What a newly promoted/invited admin can do until changed (same list as the invite-staff function). */
export const DEFAULT_ADMIN_PERMISSIONS: Permission[] = ['manage_tags', 'delete_tags', 'edit_households', 'delete_households', 'manage_packages']

/** Owner only. Becoming an admin starts with the default permissions; other roles have none. */
export const useUpdateRole = () =>
  useTeamMutation(({ staffId, role }: { staffId: string; role: StaffRole }) =>
    supabase.from('staff').update({ role, permissions: role === 'admin' ? DEFAULT_ADMIN_PERMISSIONS : [] }).eq('id', staffId),
  )

/** Owners can remove/restore anyone; admins with manage_team only trainers (via set_trainer_active). */
export const useSetDeactivated = () => {
  const { staff } = useAuth()
  return useTeamMutation(({ staffId, deactivated }: { staffId: string; deactivated: boolean }) =>
    staff?.role === 'owner'
      ? supabase.from('staff').update({ deactivated_at: deactivated ? new Date().toISOString() : null }).eq('id', staffId)
      : supabase.rpc('set_trainer_active', { p_staff_id: staffId, p_active: !deactivated }),
  )
}

/** Owners: anything. Admins with manage_admin_permissions: other admins, only permissions they hold (checked in the DB). */
export const useSetAdminPermissions = () =>
  useTeamMutation(({ staffId, permissions }: { staffId: string; permissions: Permission[] }) =>
    supabase.rpc('set_admin_permissions', { p_staff_id: staffId, p_permissions: permissions }),
  )

export const useSetLocationAccess = () =>
  useTeamMutation(({ staffId, locationId, allowed }: { staffId: string; locationId: string; allowed: boolean }) =>
    allowed
      ? supabase.from('staff_locations').insert({ staff_id: staffId, location_id: locationId })
      : supabase.from('staff_locations').delete().eq('staff_id', staffId).eq('location_id', locationId),
  )

export function useAddLocation() {
  const { staff } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, city }: { name: string; city: string }) => {
      const { error } = await supabase.from('locations').insert({ org_id: staff!.org_id, name, city: city || null })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locations'] }),
  })
}

export type Invite = { email: string; display_name: string; role: StaffRole; location_ids: string[] }

export function useInviteStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (invite: Invite) => {
      const { data, error } = await supabase.functions.invoke('invite-staff', { body: invite })
      if (error) {
        // Surface the function's own error message when there is one.
        const body = await (error as { context?: Response }).context?.json?.().catch(() => null)
        throw new Error(body?.error ?? error.message)
      }
      return data as { id: string }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKey }),
  })
}

// ─── Organization ────────────────────────────────────────────────────────

export function useOrganization() {
  const { staff } = useAuth()
  return useQuery({
    queryKey: ['organization', staff?.org_id],
    enabled: !!staff,
    queryFn: async () => {
      const { data, error } = await supabase.from('organizations').select('*').eq('id', staff!.org_id).single()
      if (error) throw error
      return data
    },
  })
}

export function useRenameOrganization() {
  const { staff } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('organizations').update({ name }).eq('id', staff!.org_id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organization'] }),
  })
}

// ─── Locations (with client + staff counts) ─────────────────────────────

export function useLocationsWithCounts() {
  return useQuery({
    queryKey: ['locations', 'counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*, households(count), staff_locations(count)')
        .order('name')
      if (error) throw error
      return data.map(({ households, staff_locations, ...l }) => ({
        ...l,
        householdCount: households[0]?.count ?? 0,
        staffCount: staff_locations[0]?.count ?? 0,
      }))
    },
  })
}

function useLocationMutation<V>(fn: (v: V) => PromiseLike<{ error: { message: string } | null }>, friendly?: (msg: string) => string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: V) => {
      const { error } = await fn(v)
      if (error) throw new Error(friendly ? friendly(error.message) : error.message)
    },
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: ['locations'] }), qc.invalidateQueries({ queryKey: teamKey })]),
  })
}

export const useUpdateLocation = () =>
  useLocationMutation(({ id, name, city }: { id: string; name: string; city: string | null }) =>
    supabase.from('locations').update({ name, city }).eq('id', id),
  )

export const useDeleteLocation = () =>
  useLocationMutation(
    (id: string) => supabase.from('locations').delete().eq('id', id),
    (msg) => (/foreign key/i.test(msg) ? 'This location still has clients. Move or delete them first.' : msg),
  )

// ─── Behavior tags ───────────────────────────────────────────────────────

export function useBehaviorTags() {
  return useQuery({
    queryKey: ['behavior_tags'],
    queryFn: async () => {
      const { data, error } = await supabase.from('behavior_tags').select('*').order('label')
      if (error) throw error
      return { presets: data.filter((t) => !t.org_id), custom: data.filter((t) => t.org_id) }
    },
  })
}

const tagError = (msg: string) =>
  /duplicate|unique/i.test(msg) ? 'A tag with that name already exists.'
  : /foreign key/i.test(msg) ? 'This tag is used in logged sessions, so it can’t be deleted. Rename it instead.'
  : msg

function useTagMutation<V>(fn: (v: V) => PromiseLike<{ error: { message: string } | null }>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: V) => {
      const { error } = await fn(v)
      if (error) throw new Error(tagError(error.message))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['behavior_tags'] }),
  })
}

export function useAddTag() {
  const { staff } = useAuth()
  return useTagMutation((label: string) => supabase.from('behavior_tags').insert({ org_id: staff!.org_id, label }))
}

export const useRenameTag = () =>
  useTagMutation(({ id, label }: { id: string; label: string }) => supabase.from('behavior_tags').update({ label }).eq('id', id))

export const useDeleteTag = () => useTagMutation((id: string) => supabase.from('behavior_tags').delete().eq('id', id))

/** Households (clients) at one location, for the Locations detail panel. */
export function useLocationClients(locationId: string | null) {
  return useQuery({
    queryKey: ['locations', 'clients', locationId],
    enabled: !!locationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('households')
        .select('id, owner_name, payment_status, dogs ( id, archived_at )')
        .eq('location_id', locationId!)
        .order('owner_name')
      if (error) throw error
      return data.map(({ dogs, ...h }) => ({ ...h, dogCount: dogs.filter((d) => !d.archived_at).length }))
    },
  })
}
