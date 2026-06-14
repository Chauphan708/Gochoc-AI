/* ═══════════════════════════════════════
   AUTH STORE — Zustand
   Quản lý trạng thái đăng nhập GV/HS
   ═══════════════════════════════════════ */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Teacher, Student } from '@/types/database'

type UserRole = 'teacher' | 'student' | null

interface AuthState {
  // State
  user: Teacher | Student | null
  role: UserRole
  isAuthenticated: boolean
  isLoading: boolean

  // Actions
  setUser: (user: Teacher | Student, role: UserRole) => void
  logout: () => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      role: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user, role) =>
        set({ user, role, isAuthenticated: true, isLoading: false }),

      logout: () =>
        set({ user: null, role: null, isAuthenticated: false, isLoading: false }),

      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'gochoc-auth',
      partialize: (state) => ({
        user: state.user,
        role: state.role,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
