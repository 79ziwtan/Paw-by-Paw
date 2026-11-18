import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { BackLink } from '../../components/BackLink'
import { Button, chipClass, chipOff, chipOn, Field, inputClass, selectClass } from '../../components/ui'
import { HOME } from '../../lib/paths'
import { useAuth } from '../auth/AuthProvider'
import { useActiveStaff, useDog, useDogSummaries } from '../dogs/api'
import { fromDateParam, toDateParam, useCreateAppointment } from './api'

const DURATIONS = [30, 45, 60, 90]
const PLACES = ['Client home', 'Main facility', 'Park']

/** The next half hour from now, as HH:MM. */
function nextHalfHour() {
  const d = new Date()
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Book a training appointment: dog, trainer, date, time (plus length, place and notes). */
export function NewAppointmentPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { staff } = useAuth()
  const { data: dogs = [] } = useDogSummaries()
  const { data: team = [] } = useActiveStaff()
  const create = useCreateAppointment()

  const [dogId, setDogId] = useState(params.get('dog') ?? '')
  const [pickedTrainer, setPickedTrainer] = useState<string | null>(null)
  const [date, setDate] = useState(() => toDateParam(fromDateParam(params.get('date')) ?? new Date()))
  const [time, setTime] = useState(nextHalfHour)
  const [minutes, setMinutes] = useState(60)
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Trainer defaults to the dog's assigned trainer, else whoever is booking.
  const { data: dog } = useDog(dogId)
  const assigned = dog?.assigned_trainer_id && team.some((t) => t.id === dog.assigned_trainer_id) ? dog.assigned_trainer_id : null
  const trainerId = pickedTrainer ?? assigned ?? staff?.id ?? ''

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!dogId) return setError('Choose a dog.')
    const start = new Date(`${date}T${time}`)
    if (isNaN(start.getTime())) return setError('Enter a valid date and time.')
    try {
      await create.mutateAsync({
        dog_id: dogId,
        trainer_id: trainerId || null,
        starts_at: start.toISOString(),
        duration_minutes: minutes,
        location: location.trim(),
        notes: notes.trim(),
      })
      navigate(`${HOME}?date=${date}`, { replace: true })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <header>
        <BackLink fallback={HOME} fallbackLabel="Calendar" />
        <h1 className="text-xl font-semibold">New appointment</h1>
        <p className="text-sm text-neutral-500">Book a training session. It shows up on the calendar right away.</p>
      </header>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Dog">
          <select className={selectClass} required value={dogId} onChange={(e) => { setDogId(e.target.value); setPickedTrainer(null) }}>
            <option value="" disabled>Choose a dog</option>
            {dogs.map((d) => (
              <option key={d.id} value={d.id!}>{d.name} ({d.owner_name})</option>
            ))}
          </select>
        </Field>
        <Field label="Trainer">
          <select className={selectClass} required value={trainerId} onChange={(e) => setPickedTrainer(e.target.value)}>
            <option value="" disabled>Choose a trainer</option>
            {team.map((t) => (
              <option key={t.id} value={t.id}>{t.display_name}{t.id === staff?.id ? ' (you)' : ''}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input className={inputClass} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Time">
            <input className={inputClass} type="time" required step={300} value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-semibold text-neutral-800">Length</legend>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((m) => (
              <button key={m} type="button" aria-pressed={minutes === m} onClick={() => setMinutes(m)} className={`${chipClass} ${minutes === m ? chipOn : chipOff}`}>
                {m} min
              </button>
            ))}
          </div>
        </fieldset>
        <Field label="Location">
          <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Client home, park, facility…" autoComplete="off" />
        </Field>
        <div className="-mt-2 flex flex-wrap gap-2">
          {PLACES.map((p) => (
            <button key={p} type="button" aria-pressed={location === p} onClick={() => setLocation(p)} className={`${chipClass} min-h-9 ${location === p ? chipOn : chipOff}`}>
              {p}
            </button>
          ))}
        </div>
        <Field label="Notes (optional)">
          <textarea className={inputClass} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What to bring, what the owner asked about…" />
        </Field>
        {error && <p className="text-sm text-flag">{error}</p>}
        <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Booking…' : 'Book appointment'}</Button>
        <BackLink fallback={HOME} fallbackLabel="Calendar" className="text-center text-sm text-neutral-500">Cancel</BackLink>
      </form>
    </section>
  )
}
