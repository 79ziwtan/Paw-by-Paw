import { Link, NavLink, Outlet } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import { ORG_PERMISSIONS, useCan } from '../features/auth/permissions'
import { HOME } from '../lib/paths'
import { supabase } from '../lib/supabase'
import { CalendarIcon, ChatIcon, DogIcon, Logo, TeamIcon } from './ui'

const tabs = [
  { to: HOME, label: 'Calendar', end: true, Icon: CalendarIcon },
  { to: '/dogs', label: 'Dogs', end: false, Icon: DogIcon },
  { to: '/updates', label: 'Updates', end: false, Icon: ChatIcon },
  { to: '/org', label: 'Team', end: false, org: true, Icon: TeamIcon },
]

export function AppShell() {
  const { staff } = useAuth()
  const can = useCan()
  const visible = tabs.filter((t) => !t.org || ORG_PERMISSIONS.some(can))

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col">
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-neutral-50/90 backdrop-blur">
        <div className="flex h-15 items-center justify-between px-4">
          <Link to={HOME} className="flex items-center gap-2.5">
            <Logo size={28} />
            <span className="font-display text-xl font-bold">Waffle</span>
          </Link>
          <span className="flex items-center gap-3 text-sm">
            <span className="hidden text-neutral-500 sm:inline">{staff?.display_name}</span>
            <button className="min-h-9 rounded-full border border-neutral-200 bg-white px-3.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100" onClick={() => supabase.auth.signOut()}>
              Sign out
            </button>
          </span>
        </div>
      </header>
      <main className="flex-1 px-4 pt-5 pb-28">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <ul className="mx-auto flex max-w-3xl">
          {visible.map(({ to, label, end, Icon }) => (
            <li key={to} className="flex-1">
              <NavLink to={to} end={end} className="group flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-neutral-500 aria-[current=page]:text-neutral-900">
                <span className="flex h-7 w-14 items-center justify-center rounded-full transition-colors group-aria-[current=page]:bg-gold-400">
                  <Icon className="size-5" />
                </span>
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
