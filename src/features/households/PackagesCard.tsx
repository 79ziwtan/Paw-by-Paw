import { useState, type FormEvent } from 'react'
import { Button, Card, Field, inputClass, actionClass } from '../../components/ui'
import type { Tables } from '../../lib/supabase'
import { useDeletePackage, useSavePackage, type PackageInput } from './api'

type Pkg = Tables<'packages'>

/** Household → Packages. Owners and admins can add packages and edit session counts. */
export function PackagesCard({ householdId, packages, canEdit }: { householdId: string; packages: Pkg[]; canEdit: boolean }) {
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const del = useDeletePackage(householdId)

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Packages</h2>
        {canEdit && editing === null && (
          <button className={actionClass} onClick={() => setEditing('new')}>+ New package</button>
        )}
      </div>

      {packages.length === 0 && editing !== 'new' && <p className="text-sm text-neutral-500">No package yet.</p>}
      {editing === 'new' && <PackageForm householdId={householdId} onDone={() => setEditing(null)} />}

      <ul className="flex flex-col gap-2">
        {packages.map((p, i) =>
          editing === p.id ? (
            <li key={p.id}>
              <PackageForm householdId={householdId} pkg={p} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={p.id} className="flex items-center justify-between gap-2 rounded-md bg-neutral-50 p-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium">
                  {p.name}
                  {i === 0 && packages.length > 1 && <span className="font-normal text-neutral-500"> · latest</span>}
                </div>
                <div className="text-neutral-600">
                  {p.sessions_used} of {p.sessions_total} used · {p.sessions_total - p.sessions_used} left · {p.paid ? 'Paid' : 'Unpaid'}
                </div>
                <Meter used={p.sessions_used} total={p.sessions_total} />
              </div>
              {canEdit && (
                <div className="flex shrink-0 gap-2">
                  <button className={actionClass} onClick={() => setEditing(p.id)}>Edit</button>
                  <button
                    className={actionClass}
                    onClick={() => confirm(`Delete "${p.name}"? Sessions already counted keep their history.`) && del.mutate(p.id)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ),
        )}
      </ul>
      {del.error && <p className="text-sm text-flag">{del.error.message}</p>}
    </Card>
  )
}

function Meter({ used, total }: { used: number; total: number }) {
  return (
    <div className="mt-1.5 flex gap-0.5" aria-hidden>
      {Array.from({ length: Math.min(total, 30) }, (_, i) => (
        <span key={i} className={`h-1.5 flex-1 rounded-full ${i < used ? 'bg-gold-500' : 'bg-neutral-200'}`} />
      ))}
    </div>
  )
}

function PackageForm({ householdId, pkg, onDone }: { householdId: string; pkg?: Pkg; onDone: () => void }) {
  const save = useSavePackage(householdId)
  const [form, setForm] = useState<PackageInput>({
    name: pkg?.name ?? '',
    sessions_total: pkg?.sessions_total ?? 6,
    sessions_used: pkg?.sessions_used ?? 0,
    paid: pkg?.paid ?? false,
  })

  async function submit(e: FormEvent) {
    e.preventDefault()
    await save.mutateAsync({ ...form, name: form.name.trim() || `${form.sessions_total}-session package`, id: pkg?.id })
    onDone()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-md border border-neutral-300 p-3">
      <Field label="Name">
        <input className={inputClass} placeholder={`${form.sessions_total}-session package`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Stepper label="Total sessions" value={form.sessions_total} min={Math.max(1, form.sessions_used)} onChange={(v) => setForm({ ...form, sessions_total: v })} />
        <Stepper label="Used" value={form.sessions_used} min={0} max={form.sessions_total} onChange={(v) => setForm({ ...form, sessions_used: v })} />
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" className="size-5" checked={form.paid} onChange={(e) => setForm({ ...form, paid: e.target.checked })} />
        Paid
      </label>
      {save.error && <p className="text-sm text-flag">{save.error.message}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={save.isPending}>{pkg ? 'Save' : 'Add package'}</Button>
        <Button type="button" variant="secondary" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  )
}

function Stepper({ label, value, min, max = 999, onChange }: { label: string; value: number; min: number; max?: number; onChange: (v: number) => void }) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  return (
    <div className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
      {label}
      <div className="flex items-center gap-1">
        <button type="button" className="size-11 rounded-md border border-neutral-300 bg-white text-lg disabled:opacity-40" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(clamp(value - 1))}>−</button>
        <input
          type="number"
          inputMode="numeric"
          className={`${inputClass} text-center`}
          aria-label={label}
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
        />
        <button type="button" className="size-11 rounded-md border border-neutral-300 bg-white text-lg disabled:opacity-40" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(clamp(value + 1))}>+</button>
      </div>
    </div>
  )
}
