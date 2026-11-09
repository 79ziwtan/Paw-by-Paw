import { Link, NavLink, Outlet } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import { ORG_PERMISSIONS, useCan } from '../features/auth/permissions'
import { supabase } from '../lib/supabase'

const tabs = [
  { to: '/', label: 'Calendar', end: true },
  { to: '/dogs', label: 'Dogs', end: false },
  { to: '/updates', label: 'Updates', end: false },
  { to: '/org', label: 'Org', end: false, org: true },
]

export function AppShell() {
  const { staff } = useAuth()
  const can = useCan()
  const visible = tabs.filter((t) => !t.org || ORG_PERMISSIONS.some(can))

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 text-sm">
        <Link to="/" className="font-semibold">Waffle</Link>
        <span className="flex items-center gap-3 text-neutral-500">
          <span className="hidden sm:inline">{staff?.display_name}</span>
          <button className="underline" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </span>
      </div>
      <main className="flex-1 px-4 pt-4 pb-24">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-300 bg-white">
        <ul className="mx-auto flex max-w-3xl">
          {visible.map((t) => (
            <li key={t.to} className="flex-1">
              <NavLink
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `flex min-h-14 items-center justify-center border-t-4 text-sm ${isActive ? 'border-gold-400 font-semibold text-neutral-900' : 'border-transparent text-neutral-500'}`
                }
              >
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
