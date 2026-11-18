import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, type Tables } from '../../lib/supabase'

/** Columns for an appointment row. `sessions` holds the session logged for it, if any (at most one). */
const APPOINTMENT_SELECT = `
  id, dog_id, trainer_id, starts_at, duration_minutes, location, notes,
  trainer:staff!appointments_trainer_id_fkey ( display_name ),
  sessions ( id )
` as const

/** Appointments starting in [from, to), earliest first. */
export function useAppointments(from: Date, to: Date) {
  const range = [from.toISOString(), to.toISOString()] as const
  return useQuery({
    queryKey: ['appointments', ...range],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select(APPOINTMENT_SELECT)
        .gte('starts_at', range[0])
        .lt('starts_at', range[1])
        .order('starts_at')
      if (error) throw error
      return data
    },
  })
}
export type AppointmentRow = NonNullable<ReturnType<typeof useAppointments>['data']>[number]

export function useAppointment(id: string | null) {
  return useQuery({
    queryKey: ['appointments', 'one', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('appointments').select(APPOINTMENT_SELECT).eq('id', id!).single()
      if (error) throw error
      return data
    },
  })
}

export type AppointmentInput = Pick<Tables<'appointments'>, 'dog_id' | 'trainer_id' | 'starts_at' | 'duration_minutes' | 'location' | 'notes'>

export function useCreateAppointment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (a: AppointmentInput) => {
      const { data, error } = await supabase.from('appointments').insert(a).select('id').single()
      if (error) throw error
      return data
    },
    onSuccess: () => Promise.all([['appointments'], ['activity']].map((queryKey) => qc.invalidateQueries({ queryKey }))),
  })
}

export const timeLabel = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

/** yyyy-mm-dd in local time (for <input type="date"> and the calendar's ?date=). */
export const toDateParam = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Parses a local yyyy-mm-dd; null if missing or malformed. */
export function fromDateParam(s: string | null) {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const d = new Date(+m[1], +m[2] - 1, +m[3])
  return isNaN(d.getTime()) ? null : d
}
