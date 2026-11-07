import { useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { BackLink, useGoBack } from '../../components/BackLink'
import { Button, Field, inputClass } from '../../components/ui'
import { ageToBirthDate } from '../../lib/format'
import { useAddDog, useHousehold } from '../households/api'

const empty = { name: '', breed: '', age: '', presenting_problem: '', goal: '', notes: '' }

/** Flow A, step 2: add a dog. "Save & Add Another" loops; "Save & Done" goes to the household. */
export function AddDogPage() {
  const { householdId = '' } = useParams()
  const navigate = useNavigate()
  // Arrived straight from New Household: finishing should land on the new household, not go back.
  const newHousehold = !!(useLocation().state as { newHousehold?: boolean } | null)?.newHousehold
  const goBack = useGoBack(`/households/${householdId}`)
  const finish = () => (newHousehold ? navigate(`/households/${householdId}`, { replace: true }) : goBack())
  const { data: household, isPending, error: loadError } = useHousehold(householdId)
  const addDog = useAddDog(household ?? { id: householdId, org_id: '', location_id: '' })
  const [form, setForm] = useState(empty)
  const [error, setError] = useState<string | null>(null)
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })

  if (isPending) return <p className="text-neutral-500">Loading…</p>
  if (loadError) return <p className="text-flag">{loadError.message}</p>

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const another = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'another'
    setError(null)
    const age = form.age.trim() ? Number(form.age) : null
    if (age != null && (Number.isNaN(age) || age < 0 || age > 30)) return setError('Age should be a number of years, e.g. 3 or 0.5')
    try {
      const dog = await addDog.mutateAsync({
        name: form.name.trim(),
        breed: form.breed.trim() || null,
        birth_date: age != null ? ageToBirthDate(age) : null,
        presenting_problem: form.presenting_problem.trim(),
        goal: form.goal.trim(),
        notes: form.notes.trim(),
      })
      if (another) {
        setJustAdded(dog.name)
        setForm(empty)
        nameRef.current?.focus()
      } else {
        finish()
      }
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const existing = household.dogs.filter((d) => !d.archived_at)

  return (
    <section className="flex flex-col gap-4">
      <header>
        <BackLink fallback={`/households/${householdId}`} fallbackLabel={household.owner_name} />
        <h1 className="text-xl font-semibold">Add Dog</h1>
        {existing.length > 0 && (
          <p className="text-sm text-neutral-500">Already in this household: {existing.map((d) => d.name).join(', ')}</p>
        )}
      </header>
      {justAdded && <p className="rounded-lg bg-neutral-100 p-3 text-sm">✓ {justAdded} added. Add the next dog below.</p>}
      <form onSubmit={save} className="flex flex-col gap-4">
        <Field label="Dog name">
          <input ref={nameRef} className={inputClass} required value={form.name} onChange={set('name')} autoComplete="off" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Breed">
            <input className={inputClass} value={form.breed} onChange={set('breed')} />
          </Field>
          <Field label="Age (years)">
            <input className={inputClass} inputMode="decimal" value={form.age} onChange={set('age')} placeholder="3" />
          </Field>
        </div>
        <Field label="Presenting problem">
          <input className={inputClass} value={form.presenting_problem} onChange={set('presenting_problem')} placeholder="e.g. Reactive toward dogs on leash" />
        </Field>
        <Field label="Goal">
          <input className={inputClass} value={form.goal} onChange={set('goal')} placeholder="e.g. Calm walks past dogs at 10 ft" />
        </Field>
        <Field label="Notes">
          <textarea className={inputClass} rows={3} value={form.notes} onChange={set('notes')} placeholder="Food motivated, front-clip harness…" />
        </Field>
        {error && <p className="text-sm text-flag">{error}</p>}
        <Button type="submit" value="another" variant="secondary" disabled={addDog.isPending}>Save & Add Another Dog</Button>
        <Button type="submit" value="done" disabled={addDog.isPending}>Save & Done</Button>
        <Link to={`/households/${householdId}`} replace={newHousehold} onClick={(e) => { if (!newHousehold && !e.metaKey && !e.ctrlKey) { e.preventDefault(); goBack() } }} className="text-center text-sm text-neutral-500">
          {existing.length ? 'Done — no more dogs' : 'Skip for now'}
        </Link>
      </form>
    </section>
  )
}
