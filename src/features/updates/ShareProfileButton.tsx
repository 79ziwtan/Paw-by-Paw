import { useQueryClient } from '@tanstack/react-query'
import { useShareProfile } from './api'

/**
 * "Send": makes a fresh owner profile link for the household and opens it in a new tab, ready to
 * share with the owner. With `dogId`, the page opens on that dog; the owner's other dogs are
 * still there, collapsed.
 */
export function ShareProfileButton({ householdId, dogId, label = 'Send', className }: { householdId: string; dogId?: string | null; label?: string; className?: string }) {
  const share = useShareProfile()
  const qc = useQueryClient()

  function send() {
    // Open the tab inside the click so it isn't blocked as a pop-up, then point it at the link.
    const tab = window.open('', '_blank')
    share.mutate(
      { householdId, dogId },
      {
        onSuccess: (link) => {
          if (tab) tab.location.href = link
          else window.location.href = link
          // Sending moves the session off "Not sent yet"; refresh after the tab has opened.
          setTimeout(() => qc.invalidateQueries({ queryKey: ['unsent_sessions'] }), 500)
        },
        onError: () => tab?.close(),
      },
    )
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={send}
        disabled={share.isPending}
        className={className ?? 'flex min-h-9 items-center rounded-lg border border-neutral-900 bg-neutral-900 px-3 text-sm font-medium text-white shadow-sm disabled:opacity-50'}
      >
        {share.isPending ? 'Opening…' : label}
      </button>
      {share.error && <span className="max-w-56 text-right text-xs text-flag">{share.error.message}</span>}
    </span>
  )
}
