'use client'

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string, name: string) => Promise<string | null>
  signOut: () => Promise<void>
  fetchProfile: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      user: null,
      isLoading: true,
      isAuthenticated: false,

      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) return error.message
        return null
      },

      signUp: async (email, password, name) => {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        })
        if (error) return error.message
        return null
      },

      signOut: async () => {
        await supabase.auth.signOut()
        set({ user: null, isAuthenticated: false })
      },

      fetchProfile: async () => {
        set({ isLoading: true })
        try {
          const { data: sessionData } = await supabase.auth.getSession()
          if (!sessionData.session) {
            set({ user: null, isAuthenticated: false, isLoading: false })
            return
          }

          const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', sessionData.session.user.id)
            .single()

          if (error || !profile) {
            set({ user: null, isAuthenticated: false, isLoading: false })
            return
          }

          set({
            user: {
              id: profile.id,
              email: profile.email,
              name: profile.name,
              company: profile.company ?? undefined,
              plan: profile.plan as User['plan'],
              contractsUsed: profile.contracts_used,
              contractsLimit: profile.contracts_limit,
              createdAt: profile.created_at,
            },
            isAuthenticated: true,
            isLoading: false,
          })
        } catch {
          set({ user: null, isAuthenticated: false, isLoading: false })
        }
      },
    }),
    { name: 'auth-store' }
  )
)
