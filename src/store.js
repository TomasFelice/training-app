import { create } from 'zustand'

// ─── Active Workout Store ───────────────────────────────────────────────────
// Manages the in-progress training session state (not persisted to IndexedDB
// until the user finishes the workout)

export const useWorkoutStore = create((set, get) => ({
  // null when no workout is active
  activeWorkout: null,

  // { [exerciseId]: [ { weight, reps, rpe, done } ] }
  sets: {},

  // Rest timer
  restTimer: { running: false, seconds: 0, target: 90 },

  startWorkout: (routine, defaultRestSeconds = 90) =>
    set((state) => ({
      activeWorkout: { routineId: routine.id, name: routine.name, startTime: Date.now() },
      sets: Object.fromEntries((routine.exerciseIds ?? []).map((id) => [id, []])),
      restTimer: { running: false, seconds: 0, target: defaultRestSeconds },
    })),

  addSet: (exerciseId, setData) =>
    set((state) => ({
      sets: {
        ...state.sets,
        [exerciseId]: [...(state.sets[exerciseId] ?? []), { ...setData, done: false }],
      },
    })),

  updateSet: (exerciseId, index, setData) =>
    set((state) => {
      const updated = [...(state.sets[exerciseId] ?? [])]
      updated[index] = { ...updated[index], ...setData }
      return { sets: { ...state.sets, [exerciseId]: updated } }
    }),

  removeSet: (exerciseId, index) =>
    set((state) => {
      const updated = [...(state.sets[exerciseId] ?? [])]
      updated.splice(index, 1)
      return { sets: { ...state.sets, [exerciseId]: updated } }
    }),

  markSetDone: (exerciseId, index) => {
    get().updateSet(exerciseId, index, { done: true })
    get().startRestTimer()
  },

  startRestTimer: (target = get().restTimer.target) =>
    set({ restTimer: { running: true, seconds: 0, target } }),

  tickRestTimer: () =>
    set((state) => {
      const next = state.restTimer.seconds + 1
      if (next >= state.restTimer.target) return { restTimer: { ...state.restTimer, running: false, seconds: next } }
      return { restTimer: { ...state.restTimer, seconds: next } }
    }),

  stopRestTimer: () =>
    set((state) => ({ restTimer: { ...state.restTimer, running: false, seconds: 0 } })),

  setRestTarget: (target) =>
    set((state) => ({ restTimer: { ...state.restTimer, target } })),

  finishWorkout: () => set({ activeWorkout: null, sets: {}, restTimer: { running: false, seconds: 0, target: 90 } }),
}))

// ─── UI Store ──────────────────────────────────────────────────────────────
export const useUIStore = create((set) => ({
  activeTab: 'home',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Bottom sheet / modal state
  modal: null, // { type: 'routine-form' | 'exercise-picker' | ..., data: any }
  openModal: (type, data = null) => set({ modal: { type, data } }),
  closeModal: () => set({ modal: null }),
}))

// ─── Settings Store ────────────────────────────────────────────────────────
// Persisted manually to localStorage (no backend)
const STORAGE_KEY = 'gymtrack_settings'

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function saveSettings(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    defaultRestSeconds: state.defaultRestSeconds,
    weightUnit: state.weightUnit,
  }))
}

export const useSettingsStore = create((set, get) => ({
  defaultRestSeconds: 90,
  weightUnit: 'kg', // 'kg' | 'lb'

  _hydrated: false,
  hydrate: () => {
    if (get()._hydrated) return
    const saved = loadSettings()
    set({ ...saved, _hydrated: true })
  },

  setDefaultRestSeconds: (s) => {
    set({ defaultRestSeconds: s })
    saveSettings(get())
  },
  setWeightUnit: (u) => {
    set({ weightUnit: u })
    saveSettings(get())
  },
}))
