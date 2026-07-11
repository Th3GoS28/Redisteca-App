import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Profile, Module, Action } from '../types'

interface AuthState {
  profile: Profile | null
  loading: boolean
  initialized: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  loadProfile: () => Promise<void>
  can: (module: Module, action: Action) => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  profile: null,
  loading: true,
  initialized: false,

  can: (module, action) => {
    const perms = get().profile?.permissions ?? []
    return perms.some((p) => p.module === module && p.action === action)
  },

  loadProfile: async () => {
    set({ loading: true })
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      set({ profile: null, loading: false, initialized: true })
      return
    }

    // Trae el perfil junto con su rol y los permisos de ese rol
    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('*, role:roles(*)')
      .eq('id', user.id)
      .single()

    if (error || !profileData) {
      set({ profile: null, loading: false, initialized: true })
      return
    }

    let permissions: { module: Module; action: Action }[] = []
    if (profileData.role_id) {
      const { data: rp } = await supabase
        .from('role_permissions')
        .select('permission:permissions(module, action)')
        .eq('role_id', profileData.role_id)

      permissions = (rp ?? []).map((r: any) => ({
        module: r.permission.module,
        action: r.permission.action
      }))
    }

    set({
      profile: { ...profileData, permissions } as Profile,
      loading: false,
      initialized: true
    })
  },

  signIn: async (emailOrUsername, password) => {
    let email = emailOrUsername.trim()

    // Si no parece un correo, lo tratamos como username y lo resolvemos
    if (!email.includes('@')) {
      const { data: resolvedEmail, error: lookupError } = await supabase.rpc(
        'email_for_username',
        { p_username: email }
      )
      if (lookupError || !resolvedEmail) {
        return { error: 'Usuario o contraseña incorrectos.' }
      }
      email = resolvedEmail
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: 'Usuario/correo o contraseña incorrectos.' }
    await get().loadProfile()
    return { error: null }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ profile: null })
  }
}))

// Mantiene la sesión sincronizada (por ejemplo tras refrescar el token)
supabase.auth.onAuthStateChange((_event, _session) => {
  useAuthStore.getState().loadProfile()
})
