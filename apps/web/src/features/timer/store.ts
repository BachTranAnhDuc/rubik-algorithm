'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { Penalty, SolveTime } from './types'

const INSPECTION_LIMIT_MS = 15_000
const PLUS_TWO_LIMIT_MS = 17_000
const HISTORY_CAP = 100
const STORAGE_KEY = 'rubik:timer:v1'

export type TimerPhase =
  | { kind: 'idle' }
  | { kind: 'inspecting'; startedAt: number }
  | { kind: 'ready'; inspectionMs: number }
  | { kind: 'solving'; startedAt: number; inspectionMs: number }
  | {
      kind: 'done'
      rawMs: number
      inspectionMs: number
      appliedPenalty: Penalty
    }

interface TimerState {
  phase: TimerPhase
  times: SolveTime[]
  startInspection: (now: number) => void
  arm: (now: number) => void
  startSolving: (now: number) => void
  finishSolve: (now: number, scramble: string, caseSlug: string | null) => void
  reset: () => void
  editPenalty: (id: string, penalty: Penalty) => void
  deleteTime: (id: string) => void
  clearHistory: () => void
}

const computeAutoPenalty = (inspectionMs: number): Penalty => {
  if (inspectionMs <= INSPECTION_LIMIT_MS) return 'OK'
  if (inspectionMs <= PLUS_TWO_LIMIT_MS) return 'PLUS_TWO'
  return 'DNF'
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set) => ({
      phase: { kind: 'idle' },
      times: [],
      startInspection: (now) =>
        set({ phase: { kind: 'inspecting', startedAt: now } }),
      arm: (now) =>
        set((state) => {
          if (state.phase.kind !== 'inspecting') return state
          return {
            phase: { kind: 'ready', inspectionMs: now - state.phase.startedAt },
          }
        }),
      startSolving: (now) =>
        set((state) => {
          if (state.phase.kind !== 'ready') return state
          return {
            phase: {
              kind: 'solving',
              startedAt: now,
              inspectionMs: state.phase.inspectionMs,
            },
          }
        }),
      finishSolve: (now, scramble, caseSlug) =>
        set((state) => {
          if (state.phase.kind !== 'solving') return state
          const rawMs = now - state.phase.startedAt
          const appliedPenalty = computeAutoPenalty(state.phase.inspectionMs)
          const time: SolveTime = {
            id: crypto.randomUUID(),
            rawMs,
            penalty: appliedPenalty,
            inspectionMs: state.phase.inspectionMs,
            scramble,
            caseSlug,
            createdAt: new Date().toISOString(),
          }
          const nextTimes = [time, ...state.times].slice(0, HISTORY_CAP)
          return {
            phase: {
              kind: 'done',
              rawMs,
              inspectionMs: state.phase.inspectionMs,
              appliedPenalty,
            },
            times: nextTimes,
          }
        }),
      reset: () => set({ phase: { kind: 'idle' } }),
      editPenalty: (id, penalty) =>
        set((state) => ({
          times: state.times.map((t) =>
            t.id === id ? { ...t, penalty } : t,
          ),
        })),
      deleteTime: (id) =>
        set((state) => ({ times: state.times.filter((t) => t.id !== id) })),
      clearHistory: () => set({ times: [] }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ times: state.times }),
    },
  ),
)
