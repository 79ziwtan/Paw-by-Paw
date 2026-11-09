import { Navigate, NavLink, Outlet } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { useCan, type Permission } from '../auth/permissions'
import { useOrganization } from './api'

// `perms`: an admin needs any one of these to see the section. Business is owner-only.
const sections: { to: string; label: string; perms: Permission[] | 'owner' }[] = [
  { to: 'team', label: 'Team', perms: ['manage_team', 'manage_admin_permissions'] },
  { to: 'tags', label: 'Tags & templates', perms: ['manage_tags', 'delete_tags', 'manage_templates', 'delete_templates'] },
  { to: 'business', label: 'Business', perms: 'owner' },
]

function useSections() {
  const { staff } = useAuth()
  const can = useCan()
  return sections.filter((s) => (s.perms === 'owner' ? staff?.role === 'owner' : s.perms.some(can)))
}

/** /org → the first section this person can open. */
export function OrgIndex() {
  const first = useSections()[0]
  return <Navigate to={first ? first.to : '/'} replace />
}

/** Organization settings: everything for owners; admins see the sections their permissions cover. */
export function OrgLayout() {
  const { data: org } = useOrganization()
  const visible = useSections()
  return (
    <section className="flex flex-col gap-4">
      <header>
        <p className="text-sm text-neutral-500">Organization</p>
        <h1 className="text-xl font-semibold">{org?.name ?? '…'}</h1>
      </header>
      <nav className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {visible.map((s) => (
            <li key={s.to}>
              <NavLink
                to={s.to}
                className={({ isActive }) =>
                  `flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-sm ${isActive ? 'bg-gold-400 font-semibold text-neutral-900' : 'border border-neutral-300 bg-white text-neutral-700'}`
                }
              >
                {s.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Outlet />
    </section>
  )
}
