import { render, act } from '@testing-library/react'
import { afterEach, it, expect, vi } from 'vitest'
import { useWorkoutStore } from '../store'
import PwaUpdater from './PwaUpdater'

const { updateServiceWorker } = vi.hoisted(() => ({ updateServiceWorker: vi.fn() }))
vi.mock('virtual:pwa-register/react', () => ({ useRegisterSW: () => ({ needRefresh: [true], updateServiceWorker }) }))
afterEach(() => { useWorkoutStore.getState().finishWorkout(); updateServiceWorker.mockClear() })
it('keeps a waiting service worker inactive until the workout finishes', () => {
  useWorkoutStore.getState().startWorkout({ id: 1, name: 'Plan', trainingDays: [{ name: 'A', exercises: [{ exerciseId: 1, sets: 3, reps: 10 }] }] })
  render(<PwaUpdater />)
  expect(updateServiceWorker).not.toHaveBeenCalled()
  act(() => useWorkoutStore.getState().finishWorkout())
  expect(updateServiceWorker).toHaveBeenCalledWith(true)
})
