import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ComponentProps } from 'react'
import { DogAvatar } from '../../components/ui'
import { supabase } from '../../lib/supabase'

/** Private Storage bucket (see 20261117150000_dog_photos.sql). Objects: "<dog_id>/<random>.jpg". */
const BUCKET = 'dog-photos'
const MAX_EDGE = 800 // px: plenty for an avatar or profile header, and keeps phone photos small

/** Short-lived signed URL for a photo path; cached so every avatar of the same dog shares it. */
export function useDogPhotoUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['dog-photo', path],
    enabled: !!path,
    staleTime: 50 * 60_000, // URLs live 60 min; refresh before they expire
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path!, 60 * 60)
      if (error) throw error
      return data.signedUrl
    },
  })
}

/** DogAvatar that resolves a stored photo path; shows the cartoon placeholder until (or unless) there's a photo. */
export function DogPhoto({ photoPath, ...props }: Omit<ComponentProps<typeof DogAvatar>, 'src'> & { photoPath: string | null | undefined }) {
  const { data: url } = useDogPhotoUrl(photoPath)
  return <DogAvatar {...props} src={url} />
}

/** Downscale to MAX_EDGE and re-encode as JPEG (phone photos are often 4-12 MB). */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("That file couldn't be read as an image. Try a JPEG or PNG.")
  })
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process that image.'))), 'image/jpeg', 0.85),
  )
}

const invalidate = (qc: ReturnType<typeof useQueryClient>, dogId: string) =>
  Promise.all([['dog_summary'], ['dog', dogId], ['household'], ['activity']].map((queryKey) => qc.invalidateQueries({ queryKey })))

/** Upload (or replace) a dog's photo; the previous file is removed afterwards. */
export function useUploadDogPhoto(dogId: string, currentPath: string | null | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      if (!file.type.startsWith('image/')) throw new Error('Choose an image file.')
      const blob = await shrink(file)
      const path = `${dogId}/${crypto.randomUUID()}.jpg`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
      if (upErr) throw upErr
      const { error } = await supabase.from('dogs').update({ photo_path: path }).eq('id', dogId)
      if (error) {
        await supabase.storage.from(BUCKET).remove([path])
        throw error
      }
      if (currentPath) await supabase.storage.from(BUCKET).remove([currentPath]) // best effort
    },
    onSettled: () => invalidate(qc, dogId),
  })
}

export function useRemoveDogPhoto(dogId: string, currentPath: string | null | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('dogs').update({ photo_path: null }).eq('id', dogId)
      if (error) throw error
      if (currentPath) await supabase.storage.from(BUCKET).remove([currentPath]) // best effort
    },
    onSettled: () => invalidate(qc, dogId),
  })
}
