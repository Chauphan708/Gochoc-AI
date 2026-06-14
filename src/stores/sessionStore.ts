/* ═══════════════════════════════════════
   SESSION STORE — Zustand
   Quản lý phiên học đang hoạt động
   ═══════════════════════════════════════ */

import { create } from 'zustand'
import type { Session, Station, Group, Task } from '@/types/database'

interface SessionState {
  // Current session
  currentSession: Session | null
  stations: Station[]
  groups: Group[]
  tasks: Task[]

  // Live state
  isLive: boolean
  currentRotation: number
  timeRemaining: number | null

  // Actions
  setSession: (session: Session) => void
  setStations: (stations: Station[]) => void
  setGroups: (groups: Group[]) => void
  setTasks: (tasks: Task[]) => void
  setLive: (isLive: boolean) => void
  setCurrentRotation: (rotation: number) => void
  setTimeRemaining: (time: number | null) => void
  resetSession: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  currentSession: null,
  stations: [],
  groups: [],
  tasks: [],
  isLive: false,
  currentRotation: 0,
  timeRemaining: null,

  setSession: (currentSession) => set({ currentSession }),
  setStations: (stations) => set({ stations }),
  setGroups: (groups) => set({ groups }),
  setTasks: (tasks) => set({ tasks }),
  setLive: (isLive) => set({ isLive }),
  setCurrentRotation: (currentRotation) => set({ currentRotation }),
  setTimeRemaining: (timeRemaining) => set({ timeRemaining }),
  resetSession: () =>
    set({
      currentSession: null,
      stations: [],
      groups: [],
      tasks: [],
      isLive: false,
      currentRotation: 0,
      timeRemaining: null,
    }),
}))
