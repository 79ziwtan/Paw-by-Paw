import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { BackLink } from '../../components/BackLink'
import { Button, Field, inputClass, selectClass } from '../../components/ui'
import { toE164 } from '../../lib/format'
import { useCreateHousehold, useLocations } from './api'

/** Flow A, step 1: owner details. Next step is Add Dog. */
export function NewHouseholdPage() {
  const navigate = useNavigate()
  const { data: locations } = useLocations()
  const create = useCreateHousehold()
  const [ownerName, setOwnerName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [pickedLocation, setLocationId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const locationId = pickedLocation || locations?.[0]?.id || ''

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const e164 = toE164(phone)
    if (!e164) return setError('Enter a valid phone number, e.g. (555) 010-2299')
    try {
      const h = await create.mutateAsync({ owner_name: ownerName.trim(), phone: e164, email: email.trim() || null, location_id: locationId })
      navigate(`/households/${h.id}/dogs/new`, { replace: true, state: { newHousehold: true } })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <header>
        <BackLink fallback="/dogs" fallbackLabel="Dogs" />
        <h1 className="text-xl font-semibold">Create Household</h1>
        <p className="text-sm text-neutral-500">Start with the person who will receive training updates.</p>
      </header>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Owner name">
          <input className={inputClass} required value={ownerName} onChange={(e) => setOwnerName(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Phone number">
          <input className={inputClass} type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 010-2299" />
          <span className="text-xs font-normal text-neutral-500">Used to send update links by SMS.</span>
        </Field>
        <Field label="Email (optional)">
          <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {locations && locations.length > 1 && (
          <Field label="Location">
            <select className={selectClass} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}{l.city && ` — ${l.city}`}</option>
              ))}
            </select>
          </Field>
        )}
        {error && <p className="text-sm text-flag">{error}</p>}
        <Button type="submit" disabled={create.isPending || !locationId}>Continue: Add Dog</Button>
        <BackLink fallback="/dogs" fallbackLabel="Dogs" className="text-center text-sm text-neutral-500">Cancel</BackLink>
      </form>
    </section>
  )
}
