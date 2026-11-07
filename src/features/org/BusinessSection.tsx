import { useState, type FormEvent } from 'react'
import { Button, Card, Field, inputClass } from '../../components/ui'
import { useOrganization, useRenameOrganization } from './api'
import { LocationsSection } from './LocationsSection'

export function BusinessSection() {
  const { data: org } = useOrganization()
  const rename = useRenameOrganization()
  const [name, setName] = useState<string | null>(null)
  const value = name ?? org?.name ?? ''

  async function submit(e: FormEvent) {
    e.preventDefault()
    await rename.mutateAsync(value.trim())
    setName(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Field label="Business name">
            <input className={inputClass} required value={value} onChange={(e) => setName(e.target.value)} />
            <span className="text-xs font-normal text-neutral-500">Shown to dog owners on update links.</span>
          </Field>
          {rename.error && <p className="text-sm text-flag">{rename.error.message}</p>}
          <Button type="submit" disabled={rename.isPending || name === null || !value.trim()}>{rename.isSuccess && name === null ? 'Saved ✓' : 'Save'}</Button>
        </form>
      </Card>

      <div className="flex flex-col gap-3 border-t border-neutral-200 pt-5">
        <h2 className="font-semibold">Locations</h2>
        <LocationsSection />
      </div>
    </div>
  )
}
