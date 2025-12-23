/**
 * Role-based permission system for multi-tenancy
 */

export type Role = 'admin' | 'member'

export interface Permission {
    // Team Management
    canManageTeam: boolean
    canInviteUsers: boolean
    canChangeRoles: boolean

    // Organization Settings
    canViewOrgSettings: boolean
    canEditOrgSettings: boolean
    canManageApiKeys: boolean
    canManageBilling: boolean

    // Data Access
    canViewAllLeads: boolean  // All company leads vs own leads
    canDeleteLeads: boolean
    canExportData: boolean
}

const PERMISSIONS: Record<Role, Permission> = {
    admin: {
        canManageTeam: true,
        canInviteUsers: true,
        canChangeRoles: true,
        canViewOrgSettings: true,
        canEditOrgSettings: true,
        canManageApiKeys: true,
        canManageBilling: true,
        canViewAllLeads: true,
        canDeleteLeads: true,
        canExportData: true,
    },
    member: {
        canManageTeam: false,
        canInviteUsers: false,
        canChangeRoles: false,
        canViewOrgSettings: false,
        canEditOrgSettings: false,
        canManageApiKeys: false,
        canManageBilling: false,
        canViewAllLeads: true,  // Can view all company leads
        canDeleteLeads: false,
        canExportData: false,
    },
}

/**
 * Get permissions for a given role
 */
export function getPermissions(role: string): Permission {
    const normalizedRole = role.toLowerCase() as Role
    return PERMISSIONS[normalizedRole] || PERMISSIONS.member
}

/**
 * Check if user has specific permission
 */
export function hasPermission(role: string, permission: keyof Permission): boolean {
    const permissions = getPermissions(role)
    return permissions[permission] === true
}

/**
 * Check if user is admin
 */
export function isAdmin(role: string): boolean {
    return role.toLowerCase() === 'admin'
}

/**
 * Check if user can access admin-only features
 */
export function requireAdmin(role: string): void {
    if (!isAdmin(role)) {
        throw new Error('Admin access required')
    }
}
