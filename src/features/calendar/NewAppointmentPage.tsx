import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { BackLink, useGoBack } from '../../components/BackLink'
import { Button, chipClass, chipOff, chipOn, Field, inputClass, PageLoader, selectClass } from '../../components/ui'
import { HOME } from '../../lib/paths'
import { useAuth } from '../auth/AuthProvider'
import { useActiveStaff, useDog, useDogSummaries } from '../dogs/api'
import { fromDateParam, toDateParam, useAppointment, useCancelAppointment, useCreateAppointment, useUpdateAppointment, type AppointmentInput, type AppointmentRow } from './api'

const DURATIONS = [30, 45, 60, 90]
const PLACES = ['Client home', 'Main facility', 'Park']

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

/** The next half hour from now, as HH:MM. */
function nextHalfHour() {
  const d = new Date()
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0)
  return hhmm(d)
}

/** Book a training appointment: dog, trainer, date, time (plus length, place and notes). */
export function NewAppointmentPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const create = useCreateAppointment()
  const [initial] = useState<Initial>(() => ({
    dogId: params.get('dog') ?? '',
    trainerId: null,
    date: toDateParam(fromDateParam(params.get('date')) ?? new Date()),
    time: nextHalfHour(),
    minutes: 60,
    location: '',
    notes: '',
  }))
  return (
    <AppointmentForm
      title="New appointment"
      subtitle="Book a training session. It shows up on the calendar right away."
      submitLabel="Book appointment"
      pendingLabel="Booking…"
      initial={initial}
      pending={create.isPending}
      onSubmit={async (a) => {
        await create.mutateAsync(a)
        navigate(`${HOME}?date=${toDateParam(new Date(a.starts_at))}`, { replace: true })
      }}
    />
  )
}

/** Change or cancel an appointment. Once a session is logged it can't be cancelled or moved to another dog. */
export function EditAppointmentPage() {
  const { appointmentId = '' } = useParams()
  const { data: appt, isPending, error } = useAppointment(appointmentId)
  if (isPending) return <PageLoader />
  if (error) return <p className="text-flag">{error.message}</p>
  return <EditAppointment appt={appt} />
}

function EditAppointment({ appt }: { appt: AppointmentRow }) {
  const navigate = useNavigate()
  const update = useUpdateAppointment(appt.id)
  const cancel = useCancelAppointment()
  const start = new Date(appt.starts_at)
  const logged = !!appt.sessions
  const day = toDateParam(start)
  const goBack = useGoBack(`${HOME}?date=${day}`)

  async function cancelAppointment() {
    if (!confirm(`Cancel this appointment on ${start.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}? This can't be undone.`)) return
    await cancel.mutateAsync(appt.id)
    navigate(`${HOME}?date=${day}`, { replace: true })
  }

  return (
    <AppointmentForm
      title="Edit appointment"
      subtitle={logged ? 'A session is logged for this appointment, so the dog stays the same.' : 'Change the time, place, trainer or notes.'}
      submitLabel="Save changes"
      pendingLabel="Saving…"
      initial={{
        dogId: appt.dog_id,
        trainerId: appt.trainer_id ?? '',
        date: day,
        time: hhmm(start),
        minutes: appt.duration_minutes,
        location: appt.location,
        notes: appt.notes,
      }}
      lockDog={logged}
      pending={update.isPending}
      onSubmit={async (a) => {
        await update.mutateAsync(a)
        goBack()
      }}
      footer={
        <div className="mt-2 flex flex-col gap-1.5 border-t border-neutral-200 pt-4">
          <Button type="button" variant="secondary" className="text-flag" disabled={logged || cancel.isPending} onClick={() => cancelAppointment().catch(() => {})}>
            {cancel.isPending ? 'Cancelling…' : 'Cancel appointment'}
          </Button>
          {logged && <p className="text-center text-xs text-neutral-500">A session is logged for this appointment. Delete that session first to cancel it.</p>}
          {cancel.error && <p className="text-center text-sm text-flag">{cancel.error.message}</p>}
        </div>
      }
    />
  )
}

type Initial = { dogId: string; trainerId: string | null; date: string; time: string; minutes: number; location: string; notes: string }

function AppointmentForm({ title, subtitle, submitLabel, pendingLabel, initial, lockDog = false, pending, onSubmit, footer }: {
  title: string
  subtitle: string
  submitLabel: string
  pendingLabel: string
  initial: Initial
  lockDog?: boolean
  pending: boolean
  onSubmit: (a: AppointmentInput) => Promise<void>
  footer?: ReactNode
}) {
  const { staff } = useAuth()
  const { data: dogs = [] } = useDogSummaries()
  const { data: team = [] } = useActiveStaff()

  const [dogId, setDogId] = useState(initial.dogId)
  // null = not chosen yet: fall back to the dog's assigned trainer, else whoever is booking.
  const [pickedTrainer, setPickedTrainer] = useState<string | null>(initial.trainerId)
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(initial.time)
  const [minutes, setMinutes] = useState(initial.minutes)
  const [location, setLocation] = useState(initial.location)
  const [notes, setNotes] = useState(initial.notes)
  const [error, setError] = useState<string | null>(null)

  const { data: dog } = useDog(dogId)
  const assigned = dog?.assigned_trainer_id && team.some((t) => t.id === dog.assigned_trainer_id) ? dog.assigned_trainer_id : null
  const trainerId = pickedTrainer ?? assigned ?? staff?.id ?? ''
  const durations = DURATIONS.includes(minutes) ? DURATIONS : [...DURATIONS, minutes].sort((a, b) => a - b)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!dogId) return setError('Choose a dog.')
    const start = new Date(`${date}T${time}`)
    if (isNaN(start.getTime())) return setError('Enter a valid date and time.')
    try {
      await onSubmit({
        dog_id: dogId,
        trainer_id: trainerId || null,
        starts_at: start.toISOString(),
        duration_minutes: minutes,
        location: location.trim(),
        notes: notes.trim(),
      })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <header>
        <BackLink fallback={HOME} fallbackLabel="Calendar" />
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-neutral-500">{subtitle}</p>
      </header>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Dog">
          <select className={selectClass} required disabled={lockDog} value={dogId} onChange={(e) => { setDogId(e.target.value); setPickedTrainer(null) }}>
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
            {durations.map((m) => (
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
        <Button type="submit" disabled={pending}>{pending ? pendingLabel : submitLabel}</Button>
        <BackLink fallback={HOME} fallbackLabel="Calendar" className="text-center text-sm text-neutral-500">Back</BackLink>
        {footer}
      </form>
    </section>
  )
}
