import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useWorkoutStore } from '../store'

export default function PwaUpdater() {
  const active = useWorkoutStore((state) => state.activeWorkout)
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()
  useEffect(() => {
    if (needRefresh && !active) updateServiceWorker(true)
  }, [needRefresh, active, updateServiceWorker])
  return null
}
