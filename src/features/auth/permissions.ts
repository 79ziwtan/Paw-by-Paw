import { useAuth } from './AuthProvider'

/** Admin permissions (mirror of the permission_keys table; the database enforces them). */
export const PERMISSIONS = [
  { key: 'delete_sessions', label: 'Delete session logs & homework' },
  { key: 'manage_tags', label: 'Create & edit behavior tags' },
  { key: 'delete_tags', label: 'Delete behavior tags' },
  { key: 'manage_templates', label: 'Create & edit plan templates' },
  { key: 'delete_templates', label: 'Delete plan templates' },
  { key: 'edit_households', label: 'Edit household details' },
  { key: 'delete_households', label: 'Delete households' },
  { key: 'manage_packages', label: 'Packages & session counts' },
  { key: 'manage_team', label: 'Invite & manage trainers' },
  { key: 'manage_admin_permissions', label: "Edit other admins' permissions" },
] as const
export type Permission = (typeof PERMISSIONS)[number]['key']

/** Permissions that open the Org tab for an admin. */
export const ORG_PERMISSIONS: Permission[] = ['manage_tags', 'delete_tags', 'manage_templates', 'delete_templates', 'manage_team', 'manage_admin_permissions']

/** `can('delete_sessions')`: owners always, admins when granted, trainers never. */
export function useCan() {
  const { staff } = useAuth()
  return (p: Permission) => staff?.role === 'owner' || (staff?.role === 'admin' && staff.permissions.includes(p))
}
