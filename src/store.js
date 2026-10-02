import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

const idleRest = (target = 90) => ({ startedAt: null, target })
const newSet = (data = {}) => ({ uid: crypto.randomUUID(), weight: null, reps: null, rpe: null, done: false, ...data })

export function restStatus(timer, now = Date.now()) {
  const seconds = timer.startedAt == null ? 0 : Math.max(0, Math.floor((now - timer.startedAt) / 1000))
  return { seconds, remaining: Math.max(0, timer.target - seconds), running: timer.startedAt != null && seconds < timer.target,
    finished: timer.startedAt != null && seconds >= timer.target }
}

export const useWorkoutStore = create(persist((set, get) => ({
  activeWorkout: null, sets: {}, restTimer: idleRest(), storageError: null,
  startWorkout: (routine, dayIndex = 0, defaultRestSeconds = 90) => {
    if (get().activeWorkout) return false
    const day = routine.trainingDays?.[dayIndex]
    if (!day?.exercises?.length) return false
    const sets = {}
    const plannedConfig = {}
    for (const exercise of day.exercises) {
      const count = Math.max(1, Number(exercise.sets) || 1)
      sets[exercise.exerciseId] = Array.from({ length: count }, () => newSet({ weight: exercise.weight ?? null,
        reps: exercise.reps ?? null, repsDraft: String(exercise.reps ?? ''), weightDraft: null }))
      plannedConfig[exercise.exerciseId] = { sets: count, reps: exercise.reps }
    }
    set({ activeWorkout: { sessionId: crypto.randomUUID(), routineId: routine.id, name: routine.name, dayName: day.name,
      startTime: Date.now(), dayIndex, exerciseIds: day.exercises.map((e) => e.exerciseId), plannedConfig },
      sets, restTimer: idleRest(defaultRestSeconds) })
    return true
  },
  addSet: (exerciseId, data = {}) => set((state) => ({ sets: { ...state.sets,
    [exerciseId]: [...(state.sets[exerciseId] ?? []), newSet(data)] } })),
  updateSet: (exerciseId, index, data) => set((state) => {
    const updated = [...(state.sets[exerciseId] ?? [])]
    if (!updated[index]) return state
    updated[index] = { ...updated[index], ...data }
    return { sets: { ...state.sets, [exerciseId]: updated } }
  }),
  removeSet: (exerciseId, index) => set((state) => ({ sets: { ...state.sets,
    [exerciseId]: (state.sets[exerciseId] ?? []).filter((_, i) => i !== index) } })),
  markSetDone: (exerciseId, index) => get().updateSet(exerciseId, index, { done: true }),
  unmarkSetDone: (exerciseId, index) => get().updateSet(exerciseId, index, { done: false, rpe: null }),
  startRestTimer: (target = get().restTimer.target) => set({ restTimer: { startedAt: Date.now(), target } }),
  stopRestTimer: () => set({ restTimer: idleRest(get().restTimer.target) }),
  setRestTarget: (target) => set((state) => ({ restTimer: { ...state.restTimer, target } })),
  finishWorkout: () => set({ activeWorkout: null, sets: {}, restTimer: idleRest(), storageError: null }),
}), {
  name: 'gymtrack_active_workout', version: 1,
  storage: createJSONStorage(() => ({
    getItem: (key) => { try { return localStorage.getItem(key) } catch { return null } },
    setItem: (key, value) => {
      try { localStorage.setItem(key, value) }
      catch { queueMicrotask(() => { if (!useWorkoutStore.getState().storageError) useWorkoutStore.setState({ storageError: 'No se pudo conservar la sesión. Liberá espacio antes de cerrar la app.' }) }) }
    },
    removeItem: (key) => localStorage.removeItem(key),
  })),
  partialize: ({ activeWorkout, sets, restTimer }) => ({ activeWorkout, sets, restTimer }),
}))

export const useClockStore = create(() => ({ now: Date.now() }))

export const useUIStore = create((set) => ({
  activeTab: typeof window !== 'undefined' && (window.location.pathname === '/routines' || window.location.search.includes('tab=routines')) ? 'routines' : 'home',
  setActiveTab: (activeTab) => set({ activeTab }), modal: null,
  routinesSection: 'mine',
  openRoutineLibrary: () => set({ activeTab: 'routines', routinesSection: 'library' }),
  setRoutinesSection: (routinesSection) => set({ routinesSection }),
  openModal: (type, data = null) => set({ modal: { type, data } }), closeModal: () => set({ modal: null }),
}))

const STORAGE_KEY = 'gymtrack_settings'
function loadSettings() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } catch { return {} }
}
function saveSettings(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ defaultRestSeconds: state.defaultRestSeconds, weightUnit: state.weightUnit }))
}
export const useSettingsStore = create((set, get) => ({
  defaultRestSeconds: 90, weightUnit: 'kg', _hydrated: false,
  hydrate: () => {
    if (get()._hydrated) return
    const saved = loadSettings()
    set({ defaultRestSeconds: [45, 60, 90, 120, 180].includes(saved.defaultRestSeconds) ? saved.defaultRestSeconds : 90,
      weightUnit: saved.weightUnit === 'lb' ? 'lb' : 'kg', _hydrated: true })
  },
  setDefaultRestSeconds: (defaultRestSeconds) => { set({ defaultRestSeconds }); saveSettings(get()) },
  setWeightUnit: (weightUnit) => { set({ weightUnit }); saveSettings(get()) },
}))
