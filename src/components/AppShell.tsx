import { actionClass } from './ui'
import { NavLink, Outlet } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import { ORG_PERMISSIONS, useCan } from '../features/auth/permissions'
import { supabase } from '../lib/supabase'

const tabs = [
  { to: '/', label: 'Today', end: true },
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
      <div className="flex justify-end px-4 pt-3 text-xs text-neutral-500">
        <span>{staff?.display_name}</span>
        <button className={`${actionClass} ml-3 min-h-7 px-2 text-xs`} onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
      <main className="flex-1 px-4 pt-2 pb-24">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white">
        <ul className="mx-auto flex max-w-3xl">
          {visible.map((t) => (
            <li key={t.to} className="flex-1">
              <NavLink
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `flex min-h-14 items-center justify-center text-sm ${isActive ? 'font-semibold text-neutral-900' : 'text-neutral-500'}`
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
