// Business owners invite a trainer/admin/owner by email. Admins with the manage_team permission
// can invite trainers only, to locations they can access themselves.
// POST { email, display_name, role: 'owner'|'admin'|'trainer', location_ids: string[] }
//
// Sends a Supabase Auth invite email (locally: Mailpit at http://127.0.0.1:54324),
// then creates the staff row + location access. The invitee lands on /welcome to set a password.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const ROLES = ['owner', 'admin', 'trainer']
// What a newly invited admin can do until the owner changes it (Org → Team).
const DEFAULT_ADMIN_PERMISSIONS = ['manage_tags', 'delete_tags', 'edit_households', 'delete_households', 'manage_packages']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // 1. Caller must be an active business owner, or an admin with manage_team.
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '')
  const { data: caller } = await admin.auth.getUser(jwt)
  if (!caller.user) return json({ error: 'Not signed in' }, 401)
  const { data: me } = await admin.from('staff').select('org_id, role, deactivated_at, permissions').eq('id', caller.user.id).single()
  const isOwner = me?.role === 'owner'
  const canManageTeam = isOwner || (me?.role === 'admin' && (me.permissions ?? []).includes('manage_team'))
  if (!me || me.deactivated_at || !canManageTeam) return json({ error: "You don't have permission to invite staff" }, 403)

  // 2. Validate input.
  const body = await req.json().catch(() => ({}))
  const email = String(body.email ?? '').trim().toLowerCase()
  const display_name = String(body.display_name ?? '').trim()
  const role = String(body.role ?? 'trainer')
  const location_ids: string[] = Array.isArray(body.location_ids) ? body.location_ids : []
  if (!email.includes('@') || !display_name) return json({ error: 'Name and a valid email are required' }, 400)
  if (!ROLES.includes(role)) return json({ error: 'Invalid role' }, 400)
  if (!isOwner && role !== 'trainer') return json({ error: 'Admins can only invite trainers' }, 403)
  if (!isOwner) {
    const { data: mine } = await admin.from('staff_locations').select('location_id').eq('staff_id', caller.user.id)
    const allowed = new Set((mine ?? []).map((r) => r.location_id))
    if (!location_ids.every((id) => allowed.has(id))) return json({ error: 'You can only give access to your own locations' }, 403)
  }
  if (location_ids.length) {
    const { count } = await admin.from('locations').select('id', { count: 'exact', head: true }).eq('org_id', me.org_id).in('id', location_ids)
    if (count !== location_ids.length) return json({ error: 'Unknown location' }, 400)
  }

  // 3. Invite (creates the auth user and emails a sign-in link).
  const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173'
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${appUrl}/welcome`,
    data: { display_name },
  })
  if (inviteErr || !invited.user) {
    const exists = /already|registered|exists/i.test(inviteErr?.message ?? '')
    return json({ error: exists ? 'That email already has an account.' : (inviteErr?.message ?? 'Invite failed') }, exists ? 409 : 500)
  }

  // Re-inviting a pending user returns the same user instead of an error, so
  // check for an existing staff row before touching anything (never delete it).
  const { data: existing } = await admin.from('staff').select('org_id').eq('id', invited.user.id).maybeSingle()
  if (existing) {
    const msg = existing.org_id === me.org_id ? 'Already on your team — invite email re-sent.' : 'That email already belongs to another business.'
    return json({ error: msg }, 409)
  }

  // 4. Staff row + location access. Roll back the (new) auth user if this fails.
  const { error: staffErr } = await admin
    .from('staff')
    .insert({ id: invited.user.id, org_id: me.org_id, role, display_name, permissions: role === 'admin' ? DEFAULT_ADMIN_PERMISSIONS : [] })
  if (!staffErr && role !== 'owner' && location_ids.length) {
    const { error } = await admin.from('staff_locations').insert(location_ids.map((location_id) => ({ staff_id: invited.user.id, location_id })))
    if (error) return json({ error: error.message }, 500)
  }
  if (staffErr) {
    await admin.auth.admin.deleteUser(invited.user.id)
    return json({ error: staffErr.message }, 500)
  }

  return json({ id: invited.user.id })
})
