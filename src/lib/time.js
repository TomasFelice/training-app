export function formatDuration(seconds) {
  const safe = Math.max(0, Math.floor(seconds || 0))
  const minutes = Math.floor(safe / 60)
  return `${minutes}:${String(safe % 60).padStart(2, '0')}`
}
export function workoutElapsed(workout, now = Date.now()) {
  return workout ? Math.max(0, Math.floor((now - workout.startTime) / 1000)) : 0
}
