import { useState, type FormEvent } from 'react'
import { Button, Card, Field, PaymentDot, inputClass, actionClass, selectClass } from '../../components/ui'
import { formatPhone, toE164 } from '../../lib/format'
import type { Tables } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { useCan } from '../auth/permissions'
import { ShareProfileButton } from '../updates/ShareProfileButton'
import { useLocationName, useLocations, useTransferHousehold, useUpdateHousehold, type HouseholdInput } from './api'

type Household = Tables<'households'>
type Payment = Household['payment_status']
const PAYMENT: { value: Payment; label: string }[] = [
  { value: 'current', label: 'Paid up' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'none', label: 'No package' },
]

/** Owner (client) contact card: details, location, edit (edit_households) and move location (owner). */
export function HouseholdDetailsCard({ household: h, packageLine }: { household: Household; packageLine: string }) {
  const { staff } = useAuth()
  const canEdit = useCan()('edit_households')
  const canMove = staff?.role === 'owner'
  const locationName = useLocationName()
  const [mode, setMode] = useState<'view' | 'edit' | 'move'>('view')

  if (mode === 'edit') return <EditForm household={h} onDone={() => setMode('view')} />
  if (mode === 'move') return <MoveForm household={h} onDone={() => setMode('view')} />

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold">{h.owner_name}</div>
          <div className="text-sm text-neutral-500">{formatPhone(h.phone)}</div>
          {h.email && <div className="text-sm text-neutral-500">{h.email}</div>}
          {locationName(h.location_id) && <div className="text-sm text-neutral-500">📍 {locationName(h.location_id)}</div>}
          <div className="mt-1 flex items-center gap-2 text-sm">
            <PaymentDot status={h.payment_status} />
            {packageLine}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <ShareProfileButton householdId={h.id} label="Send profile" />
          <a href={`sms:${h.phone}`} className={actionClass}>Text</a>
        </div>
      </div>
      {h.internal_notes && (
        <div className="rounded-lg bg-neutral-100 p-2 text-sm">
          <div className="text-xs font-medium tracking-wide text-neutral-500 uppercase">Internal</div>
          <p className="whitespace-pre-wrap">{h.internal_notes}</p>
        </div>
      )}
      {(canEdit || canMove) && (
        <div className="flex flex-wrap gap-2">
          {canEdit && <button className={actionClass} onClick={() => setMode('edit')}>Edit details</button>}
          {canMove && <button className={actionClass} onClick={() => setMode('move')}>Move to another location</button>}
        </div>
      )}
    </Card>
  )
}

function EditForm({ household: h, onDone }: { household: Household; onDone: () => void }) {
  const update = useUpdateHousehold(h.id)
  const [form, setForm] = useState<HouseholdInput>({
    owner_name: h.owner_name,
    phone: formatPhone(h.phone),
    email: h.email,
    payment_status: h.payment_status,
    internal_notes: h.internal_notes,
  })
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const phone = toE164(form.phone)
    if (!phone) return setError('Enter a valid phone number, e.g. (555) 010-2299')
    setError(null)
    await update.mutateAsync({
      ...form,
      owner_name: form.owner_name.trim(),
      phone,
      email: form.email?.trim() || null,
      internal_notes: form.internal_notes?.trim() ?? '',
    })
    onDone()
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <h2 className="font-semibold">Edit household</h2>
        <Field label="Owner name">
          <input className={inputClass} required value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <input className={inputClass} type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <input className={inputClass} type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
        </div>
        <Field label="Payment">
          <select className={selectClass} value={form.payment_status} onChange={(e) => setForm({ ...form, payment_status: e.target.value as Payment })}>
            {PAYMENT.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </Field>
        <Field label="Internal notes">
          <textarea className={inputClass} rows={2} placeholder="Only your team sees these" value={form.internal_notes ?? ''} onChange={(e) => setForm({ ...form, internal_notes: e.target.value })} />
        </Field>
        {(error || update.error) && <p className="text-sm text-flag">{error ?? update.error?.message}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={update.isPending}>Save</Button>
          <Button type="button" variant="secondary" onClick={onDone}>Cancel</Button>
        </div>
      </form>
    </Card>
  )
}

function MoveForm({ household: h, onDone }: { household: Household; onDone: () => void }) {
  const { data: locations = [] } = useLocations()
  const move = useTransferHousehold(h.id)
  const others = locations.filter((l) => l.id !== h.location_id)
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('')
  const target = to || others[0]?.id || ''

  async function submit(e: FormEvent) {
    e.preventDefault()
    await move.mutateAsync({ locationId: target, reason })
    onDone()
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <h2 className="font-semibold">Move {h.owner_name} to another location</h2>
        {others.length === 0 ? (
          <p className="text-sm text-neutral-500">There's only one location. Add another in Org → Business.</p>
        ) : (
          <>
            <Field label="New location">
              <select className={selectClass} value={target} onChange={(e) => setTo(e.target.value)}>
                {others.map((l) => <option key={l.id} value={l.id}>{l.name}{l.city && ` — ${l.city}`}</option>)}
              </select>
            </Field>
            <Field label="Reason (optional)">
              <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Moved closer to Chattanooga" />
            </Field>
            <p className="text-xs text-neutral-500">
              All of this household's dogs move too, with their full history. Staff without access to the new location will stop seeing them.
            </p>
          </>
        )}
        {move.error && <p className="text-sm text-flag">{move.error.message}</p>}
        <div className="flex gap-2">
          {others.length > 0 && <Button type="submit" disabled={move.isPending}>Move</Button>}
          <Button type="button" variant="secondary" onClick={onDone}>Cancel</Button>
        </div>
      </form>
    </Card>
  )
}
