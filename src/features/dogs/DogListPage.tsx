import { useState } from 'react'
import { Link } from 'react-router'
import { inputClass } from '../../components/ui'
import { useDogSummaries } from './api'
import { DogCard } from './DogCard'

export function DogListPage() {
  const [search, setSearch] = useState('')
  const { data: dogs, isPending, error } = useDogSummaries(search.trim())

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dogs</h1>
        <Link to="/households/new" className="rounded-lg border border-neutral-900 bg-neutral-900 px-3 py-2 text-sm font-medium text-white shadow-sm">
          + New Household
        </Link>
      </header>
      <input className={inputClass} placeholder="Search client or dog" value={search} onChange={(e) => setSearch(e.target.value)} />
      {isPending && <p className="text-neutral-500">Loading…</p>}
      {error && <p className="text-flag">{error.message}</p>}
      {dogs?.length === 0 && (
        <p className="py-8 text-center text-neutral-500">
          No household found. <Link to="/households/new" className="underline">Create one</Link>
        </p>
      )}
      <div className="flex flex-col gap-2">
        {dogs?.map((d) => <DogCard key={d.id} dog={d} />)}
      </div>
    </section>
  )
}
