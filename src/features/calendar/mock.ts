import type { Views } from '../../lib/supabase'

/**
 * MOCKUP: there is no real calendar sync yet (DESIGN.md "Calendar sync" is deferred).
 * Appointments are generated deterministically from the org's dogs so the schedule is
 * stable across reloads and every appointment opens a real dog's summary card.
 */
export type Appointment = {
  id: string
  dog: Views<'dog_summary'>
  start: Date
  minutes: number
  kind: string
  place: string
}

const SLOTS = [
  [8, 30],
  [9, 45],
  [11, 0],
  [13, 0],
  [14, 15],
  [15, 30],
  [16, 45],
] as const
const KINDS = [
  { kind: 'Private lesson', minutes: 60 },
  { kind: 'Private lesson', minutes: 60 },
  { kind: 'Board & train check-in', minutes: 45 },
  { kind: 'Follow-up', minutes: 45 },
]
const PLACES = ['Client home', 'Main facility', 'Piedmont Park', 'Client home']

const dayNumber = (d: Date) => Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 864e5)

export function mockAppointments(dogs: Views<'dog_summary'>[], day: Date): Appointment[] {
  const active = [...dogs].filter((d) => !d.archived_at && d.id).sort((a, b) => a.id!.localeCompare(b.id!))
  if (!active.length) return []
  const n = dayNumber(day)
  const weekday = day.getDay()
  // Lighter weekends, but never empty, so the demo always has something to tap.
  const count = Math.min(active.length, weekday === 0 || weekday === 6 ? 3 : 3 + (n % 3))
  const firstSlot = n % 2 // some days start at 9:45

  return Array.from({ length: count }, (_, i) => {
    const dog = active[(n + i) % active.length]
    const [h, m] = SLOTS[(firstSlot + i) % SLOTS.length]
    const start = new Date(day)
    start.setHours(h, m, 0, 0)
    const k = KINDS[(n + i * 3) % KINDS.length]
    return { id: `${n}-${i}`, dog, start, minutes: k.minutes, kind: k.kind, place: PLACES[(n + i) % PLACES.length] }
  })
}

export const timeLabel = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
