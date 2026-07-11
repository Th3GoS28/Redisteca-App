export type Module =
  | 'inventory'
  | 'quotes'
  | 'orders'
  | 'clients'
  | 'finance'
  | 'reports'
  | 'users'
  | 'roles'

export type Action = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export'

export interface Permission {
  module: Module
  action: Action
}

export interface Role {
  id: string
  name: string
  description: string | null
  is_system: boolean
}

export interface Profile {
  id: string
  full_name: string
  email: string
  phone: string | null
  avatar_url: string | null
  role_id: string | null
  active: boolean
  role?: Role
  permissions: Permission[]
}
