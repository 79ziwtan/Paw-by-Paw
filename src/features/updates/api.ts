import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

/** Sessions with For-owner notes or homework that haven't been sent to the owner (view: unsent_sessions). */
export function useUnsentSessions() {
  return useQuery({
    queryKey: ['unsent_sessions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('unsent_sessions').select('*').order('occurred_at', { ascending: false })
      if (error) throw error
      return data.map((s) => ({ ...s, homework: (s.homework ?? []) as { id: string; text: string; completed_at: string | null }[] }))
    },
  })
}
export type UnsentSession = NonNullable<ReturnType<typeof useUnsentSessions>['data']>[number]

export type SentItem = {
  id: string
  kind: 'profile' | 'session_update'
  householdId: string
  ownerName: string
  dogId: string | null
  dogName: string | null
  sentAt: string
  sentBy: string | null
  openedAt: string | null
  expired: boolean
}

/**
 * Everything sent to owners, newest first: profile links (current) plus older single-session
 * owner updates, so nothing that went out disappears from the list.
 */
export function useSentItems() {
  return useQuery({
    queryKey: ['owner_links', 'sent'],
    queryFn: async (): Promise<SentItem[]> => {
      const [links, updates] = await Promise.all([
        supabase
          .from('owner_links')
          .select('id, household_id, dog_id, created_at, expires_at, first_opened_at, households ( owner_name ), dogs ( name ), staff ( display_name )')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('owner_updates')
          .select('id, sent_at, expires_at, first_opened_at, dogs ( id, name, household_id, households ( owner_name ) ), staff ( display_name )')
          .not('sent_at', 'is', null)
          .order('sent_at', { ascending: false })
          .limit(50),
      ])
      if (links.error) throw links.error
      if (updates.error) throw updates.error
      const now = Date.now()
      const expired = (iso: string | null) => !!iso && Date.parse(iso) < now
      return [
        ...links.data.map((l) => ({
          id: l.id,
          kind: 'profile' as const,
          householdId: l.household_id,
          ownerName: l.households?.owner_name ?? 'Owner',
          dogId: l.dog_id,
          dogName: l.dogs?.name ?? null,
          sentAt: l.created_at,
          sentBy: l.staff?.display_name ?? null,
          openedAt: l.first_opened_at,
          expired: expired(l.expires_at),
        })),
        ...updates.data.map((u) => ({
          id: u.id,
          kind: 'session_update' as const,
          householdId: u.dogs?.household_id ?? '',
          ownerName: u.dogs?.households?.owner_name ?? 'Owner',
          dogId: u.dogs?.id ?? null,
          dogName: u.dogs?.name ?? null,
          sentAt: u.sent_at!,
          sentBy: u.staff?.display_name ?? null,
          openedAt: u.first_opened_at,
          expired: expired(u.expires_at),
        })),
      ].sort((a, b) => b.sentAt.localeCompare(a.sentAt))
    },
  })
}

/**
 * What "Send" does, set by VITE_OWNER_LINKS at build time (.env.local locally, Netlify env vars live):
 *   open (default) — make the link and open it in a new tab; nothing is texted
 *   text           — text the link through the send-owner-update function (Twilio)
 */
export const OWNER_LINK_MODE: 'open' | 'text' = import.meta.env.VITE_OWNER_LINKS === 'text' ? 'text' : 'open'

export type ShareResult = { sent: true; to: 'owner' | 'test number'; link: string } | { sent: false; link: string; reason?: string }

/**
 * Makes a fresh 14-day profile link for a household (opening on `dogId` if given) and texts it to
 * the household's phone via the send-owner-update function. If texting isn't set up, the link
 * comes back unsent so the app can open it instead.
 */
export function useShareProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ householdId, dogId }: { householdId: string; dogId?: string | null }): Promise<ShareResult> => {
      if (OWNER_LINK_MODE === 'open') {
        const { data, error } = await supabase.rpc('create_owner_link', { p_household_id: householdId, p_dog_id: dogId ?? undefined })
        if (error) throw error
        return { sent: false, link: `${window.location.origin}/o/${data}`, reason: 'open' }
      }
      const { data, error } = await supabase.functions.invoke('send-owner-update', { body: { household_id: householdId, dog_id: dogId ?? null } })
      if (error) {
        const body = await (error as { context?: Response }).context?.json?.().catch(() => null)
        throw new Error(body?.error ?? error.message)
      }
      return data as ShareResult
    },
    // ['unsent_sessions'] is refreshed by the button once its confirmation has been seen (see ShareProfileButton).
    onSettled: () => Promise.all([['owner_links'], ['activity']].map((queryKey) => qc.invalidateQueries({ queryKey }))),
  })
}
