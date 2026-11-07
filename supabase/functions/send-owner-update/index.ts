// Texts an owner a link to their profile page (all their dogs; opens on `dog_id` if given).
// POST { household_id: string, dog_id?: string }  (called from the app with the user's JWT)
//
// Secrets (`supabase secrets set ...`, or supabase/functions/.env locally):
//   APP_URL                                   site address the link points to
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM
//   SMS_TEST_TO   every text goes to this number instead of the owner (test mode)
//   SMS_LIVE      "true" to text the household's real phone; anything else = test mode (fail-safe)
// Without Twilio secrets (or in test mode with no SMS_TEST_TO) nothing is texted and the link is
// returned instead, so the app can open it.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  const { household_id, dog_id } = await req.json().catch(() => ({}))
  if (!household_id) return json({ error: 'household_id required' }, 400)

  // Acting as the caller: RLS and create_owner_link decide whether they may send to this household.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })

  const { data: token, error: linkErr } = await supabase.rpc('create_owner_link', { p_household_id: household_id, p_dog_id: dog_id ?? null })
  if (linkErr || !token) return json({ error: linkErr?.message ?? 'Could not create link' }, 403)

  const { data: h, error: hErr } = await supabase
    .from('households')
    .select('owner_name, phone, organizations ( name ), dogs ( id, name, archived_at )')
    .eq('id', household_id)
    .single()
  if (hErr || !h) return json({ error: 'Household not found' }, 404)

  // deno-lint-ignore no-explicit-any
  const household = h as any
  const dogs = (household.dogs ?? []).filter((d: { archived_at: string | null }) => !d.archived_at)
  const dogName = dogs.find((d: { id: string }) => d.id === dog_id)?.name ?? (dogs.length === 1 ? dogs[0].name : null)
  const link = `${Deno.env.get('APP_URL') ?? 'http://localhost:5173'}/o/${token}`
  const business = household.organizations?.name ?? 'your trainer'
  const body = `Hi ${household.owner_name.split(' ')[0]}, here's ${dogName ? `${dogName}'s` : 'your dogs\''} training update from ${business}: ${link}`

  const sid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const auth = Deno.env.get('TWILIO_AUTH_TOKEN')
  const from = Deno.env.get('TWILIO_FROM')
  if (!sid || !auth || !from) return json({ sent: false, link, reason: 'Texting is not set up' })

  // Fail-safe: only text the household's own phone when SMS_LIVE=true is set explicitly.
  const live = Deno.env.get('SMS_LIVE') === 'true'
  const to = live ? household.phone : Deno.env.get('SMS_TEST_TO')
  if (!to) return json({ sent: false, link, reason: 'Test mode with no SMS_TEST_TO' })

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${sid}:${auth}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: from, Body: live ? body : `[TEST, for ${household.phone}] ${body}` }),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    return json({ error: `Text failed: ${detail.message ?? res.statusText}${detail.code ? ` (Twilio ${detail.code})` : ''}`, link }, 502)
  }
  return json({ sent: true, to: live ? 'owner' : 'test number', link })
})
