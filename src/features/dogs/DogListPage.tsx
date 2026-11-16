import { useState } from 'react'
import { Link } from 'react-router'
import { inputClass, primaryLinkClass, WaffleLoader } from '../../components/ui'
import { useDogSummaries } from './api'
import { DogCard } from './DogCard'

export function DogListPage() {
  const [search, setSearch] = useState('')
  const { data: dogs, isPending, error } = useDogSummaries(search.trim())

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-4xl font-bold">Dogs</h1>
        <Link to="/households/new" className={`${primaryLinkClass} min-h-10 px-4 text-sm`}>
          + New household
        </Link>
      </header>
      <input className={inputClass} placeholder="Search client or dog" value={search} onChange={(e) => setSearch(e.target.value)} />
      {isPending && <WaffleLoader className="self-center py-10" />}
      {error && <p className="text-flag">{error.message}</p>}
      {dogs?.length === 0 && (
        <p className="py-8 text-center text-neutral-500">
          No household found. <Link to="/households/new" className="underline">Create one</Link>
        </p>
      )}
      <div className="flex flex-col gap-2.5">
        {dogs?.map((d) => <DogCard key={d.id} dog={d} />)}
      </div>
    </section>
  )
}
