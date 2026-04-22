import { create } from 'zustand'

// ─── Active Workout Store ───────────────────────────────────────────────────

export const useWorkoutStore = create((set, get) => ({
  activeWorkout: null,

  // { [exerciseId]: [ { weight, reps, rpe, done } ] }
  sets: {},

  restTimer: { running: false, seconds: 0, target: 90 },

  // Initialise a session from a routine + day index.
  // Pre-fills sets from the planned exercise config.
  startWorkout: (routine, dayIndex = 0, defaultRestSeconds = 90) => {
    const trainingDays = routine.trainingDays ?? []
    const day = trainingDays[dayIndex] ?? { name: 'Día 1', exercises: [] }

    const initialSets = {}
    const plannedConfig = {} // { [exerciseId]: { sets, reps } }

    for (const ex of day.exercises) {
      const count = ex.sets ?? 1
      initialSets[ex.exerciseId] = Array.from({ length: count }, () => ({
        weight: ex.weight ?? null,
        reps: ex.reps ?? null,
        done: false,
        rpe: null,
      }))
      plannedConfig[ex.exerciseId] = { sets: count, reps: ex.reps }
    }

    set({
      activeWorkout: {
        routineId: routine.id,
        name: routine.name,
        dayName: day.name,
        startTime: Date.now(),
        dayIndex,
        plannedConfig,
      },
      sets: initialSets,
      restTimer: { running: false, seconds: 0, target: defaultRestSeconds },
    })
  },

  addSet: (exerciseId, setData) =>
    set((state) => ({
      sets: {
        ...state.sets,
        [exerciseId]: [...(state.sets[exerciseId] ?? []), { weight: null, reps: null, done: false, rpe: null, ...setData }],
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

  // Mark done without starting the rest timer (timer starts after RPE is handled)
  markSetDone: (exerciseId, index) =>
    get().updateSet(exerciseId, index, { done: true }),

  // Toggle a completed set back to pending
  unmarkSetDone: (exerciseId, index) =>
    get().updateSet(exerciseId, index, { done: false, rpe: null }),

  startRestTimer: (target = get().restTimer.target) =>
    set({ restTimer: { running: true, seconds: 0, target } }),

  tickRestTimer: () =>
    set((state) => {
      const next = state.restTimer.seconds + 1
      if (next >= state.restTimer.target)
        return { restTimer: { ...state.restTimer, running: false, seconds: next } }
      return { restTimer: { ...state.restTimer, seconds: next } }
    }),

  stopRestTimer: () =>
    set((state) => ({ restTimer: { ...state.restTimer, running: false, seconds: 0 } })),

  setRestTarget: (target) =>
    set((state) => ({ restTimer: { ...state.restTimer, target } })),

  finishWorkout: () =>
    set({ activeWorkout: null, sets: {}, restTimer: { running: false, seconds: 0, target: 90 } }),
}))

// ─── UI Store ──────────────────────────────────────────────────────────────
export const useUIStore = create((set) => ({
  activeTab: 'home',
  setActiveTab: (tab) => set({ activeTab: tab }),

  modal: null,
  openModal: (type, data = null) => set({ modal: { type, data } }),
  closeModal: () => set({ modal: null }),
}))

// ─── Settings Store ────────────────────────────────────────────────────────
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
  weightUnit: 'kg',

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
