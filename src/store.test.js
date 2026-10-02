import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { restStatus, useWorkoutStore } from './store'
import { workoutElapsed } from './lib/time'

const routine = { id: 1, name: 'Plan', trainingDays: [{ name: 'A', exercises: [{ exerciseId: 9, sets: 2, reps: 10 }, { exerciseId: 2, sets: 1, reps: 8 }] }] }
beforeEach(() => { localStorage.clear(); useWorkoutStore.getState().finishWorkout() })
afterEach(() => vi.restoreAllMocks())
it('preserves planned order, series identities, and refuses to overwrite an active workout', () => {
  const store = useWorkoutStore.getState()
  expect(store.startWorkout(routine)).toBe(true)
  const active = useWorkoutStore.getState().activeWorkout
  expect(active.exerciseIds).toEqual([9, 2])
  const [first, second] = useWorkoutStore.getState().sets[9]
  expect(first.uid).not.toBe(second.uid)
  store.removeSet(9, 0)
  expect(useWorkoutStore.getState().sets[9][0].uid).toBe(second.uid)
  expect(store.startWorkout({ ...routine, name: 'Other' })).toBe(false)
  expect(useWorkoutStore.getState().activeWorkout.sessionId).toBe(active.sessionId)
})
it('rehydrates empty drafts, completed sets, and timer timestamps', async () => {
  const store = useWorkoutStore.getState()
  store.startWorkout(routine)
  store.updateSet(9, 0, { repsDraft: '', reps: null, weightDraft: '12,5', weightDraftUnit: 'kg', weight: 12.5 })
  store.markSetDone(9, 1)
  store.startRestTimer(90)
  const snapshot = localStorage.getItem('gymtrack_active_workout')
  store.finishWorkout()
  localStorage.setItem('gymtrack_active_workout', snapshot)
  await useWorkoutStore.persist.rehydrate()
  expect(useWorkoutStore.getState().activeWorkout.exerciseIds).toEqual([9, 2])
  expect(useWorkoutStore.getState().sets[9][0]).toMatchObject({ repsDraft: '', reps: null, weightDraft: '12,5' })
  expect(useWorkoutStore.getState().sets[9][1].done).toBe(true)
  expect(useWorkoutStore.getState().restTimer.startedAt).toBeTypeOf('number')
})
it('uses actual elapsed time after suspension and respects adjustments to rest target', () => {
  vi.spyOn(Date, 'now').mockReturnValue(100000)
  useWorkoutStore.getState().startWorkout(routine)
  useWorkoutStore.getState().startRestTimer(90)
  expect(restStatus(useWorkoutStore.getState().restTimer, 130000)).toMatchObject({ remaining: 60, running: true })
  expect(restStatus(useWorkoutStore.getState().restTimer, 230000)).toMatchObject({ remaining: 0, finished: true, running: false })
  useWorkoutStore.getState().setRestTarget(180)
  expect(restStatus(useWorkoutStore.getState().restTimer, 230000)).toMatchObject({ remaining: 50, running: true })
  expect(workoutElapsed(useWorkoutStore.getState().activeWorkout, 3700000)).toBe(3600)
})
