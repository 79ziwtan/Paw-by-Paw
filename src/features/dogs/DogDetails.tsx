import { useState, type FormEvent } from 'react'
import { Button, Card, Field, inputClass, actionClass, selectClass } from '../../components/ui'
import { useActiveStaff, useDog, useUpdateDog, type DogInput } from './api'

/** Dog profile → presenting problem, notes, assigned trainer, with an editor (any staff with access). */
export function DogDetails({ dogId, readOnly }: { dogId: string; readOnly: boolean }) {
  const { data: dog } = useDog(dogId)
  const [editing, setEditing] = useState(false)
  if (!dog) return null

  if (editing) return <EditDog dog={dog} onDone={() => setEditing(false)} />

  const rows = [
    ['Presenting problem', dog.presenting_problem],
    ['Notes', dog.notes],
    ['Assigned trainer', dog.trainer?.display_name],
  ].filter(([, v]) => v)

  return (
    <Card className="flex flex-col gap-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label}>
          <div className="text-neutral-500">{label}</div>
          <div className="whitespace-pre-wrap">{value}</div>
        </div>
      ))}
      {rows.length === 0 && <p className="text-neutral-500">No details yet.</p>}
      {!readOnly && (
        <button className={`${actionClass} self-start`} onClick={() => setEditing(true)}>Edit details</button>
      )}
    </Card>
  )
}

function EditDog({ dog, onDone }: { dog: NonNullable<ReturnType<typeof useDog>['data']>; onDone: () => void }) {
  const update = useUpdateDog(dog.id)
  const { data: staff = [] } = useActiveStaff()
  const [form, setForm] = useState<DogInput>({
    name: dog.name,
    breed: dog.breed,
    birth_date: dog.birth_date,
    presenting_problem: dog.presenting_problem,
    goal: dog.goal,
    notes: dog.notes,
    assigned_trainer_id: dog.assigned_trainer_id,
  })
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const set = (k: keyof DogInput) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })

  async function submit(e: FormEvent) {
    e.preventDefault()
    await update.mutateAsync({
      ...form,
      name: form.name.trim(),
      breed: form.breed?.trim() || null,
      birth_date: form.birth_date || null,
      presenting_problem: form.presenting_problem.trim(),
      goal: form.goal.trim(),
      notes: form.notes.trim(),
      assigned_trainer_id: form.assigned_trainer_id || null,
    })
    onDone()
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <h2 className="font-semibold">Edit {dog.name}</h2>
        <Field label="Name">
          <input className={inputClass} required value={form.name} onChange={set('name')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Breed">
            <input className={inputClass} value={form.breed ?? ''} onChange={set('breed')} />
          </Field>
          <Field label="Birth date">
            <input className={inputClass} type="date" max={today} value={form.birth_date ?? ''} onChange={set('birth_date')} />
          </Field>
        </div>
        <Field label="Presenting problem">
          <input className={inputClass} value={form.presenting_problem} onChange={set('presenting_problem')} />
        </Field>
        <Field label="Goal">
          <input className={inputClass} value={form.goal} onChange={set('goal')} />
        </Field>
        <Field label="Notes">
          <textarea className={inputClass} rows={3} value={form.notes} onChange={set('notes')} />
        </Field>
        <Field label="Assigned trainer">
          <select className={selectClass} value={form.assigned_trainer_id ?? ''} onChange={set('assigned_trainer_id')}>
            <option value="">Nobody</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.display_name}</option>)}
          </select>
        </Field>
        {update.error && <p className="text-sm text-flag">{update.error.message}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={update.isPending}>Save</Button>
          <Button type="button" variant="secondary" onClick={onDone}>Cancel</Button>
        </div>
      </form>
    </Card>
  )
}
