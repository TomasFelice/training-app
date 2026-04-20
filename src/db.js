import Dexie from 'dexie'

export const db = new Dexie('GymTrackDB')

db.version(1).stores({
  // ── Catálogo de ejercicios
  // name indexed for autocomplete; muscleGroup for filtering
  exercises: '++id, name, muscleGroup',

  // ── Rutinas del usuario
  // days: array de strings (ej. ["Lunes", "Miércoles"])
  // exerciseIds: array de ids de exercises
  routines: '++id, name',

  // ── Sesiones de entrenamiento completadas
  // routineId nullable (puede ser entrenamiento libre)
  workouts: '++id, routineId, date',

  // ── Series individuales de cada sesión
  // workoutId + exerciseId forman la FK compuesta
  workout_sets: '++id, workoutId, exerciseId, setOrder',
})

// ─── Helpers de consulta ────────────────────────────────────────────────────

/** Último workout_set para un ejercicio dado (para mostrar peso anterior) */
export async function getLastSetForExercise(exerciseId) {
  const sets = await db.workout_sets
    .where('exerciseId')
    .equals(exerciseId)
    .toArray()

  if (!sets.length) return null

  // Ordenar por workoutId DESC (proxy de fecha) y devolver el primero
  sets.sort((a, b) => b.workoutId - a.workoutId)
  return sets[0]
}

/** Historial de volumen total por ejercicio para los gráficos de progreso */
export async function getVolumeHistoryForExercise(exerciseId, limit = 20) {
  const sets = await db.workout_sets
    .where('exerciseId')
    .equals(exerciseId)
    .toArray()

  // Agrupar por workoutId y sumar volumen (series × reps × peso)
  const byWorkout = {}
  for (const s of sets) {
    if (!byWorkout[s.workoutId]) byWorkout[s.workoutId] = { workoutId: s.workoutId, volume: 0 }
    byWorkout[s.workoutId].volume += (s.weight ?? 0) * (s.reps ?? 0)
  }

  const workoutIds = Object.keys(byWorkout).map(Number)
  const workouts = await db.workouts.bulkGet(workoutIds)

  return workouts
    .filter(Boolean)
    .map((w) => ({ date: w.date, volume: byWorkout[w.id].volume }))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-limit)
}

/** 1RM estimado (fórmula de Epley): peso × (1 + reps/30) */
export async function get1RMHistoryForExercise(exerciseId, limit = 20) {
  const history = await getVolumeHistoryForExercise(exerciseId, limit)
  const sets = await db.workout_sets.where('exerciseId').equals(exerciseId).toArray()

  const workoutIds = [...new Set(sets.map((s) => s.workoutId))]
  const workouts = await db.workouts.bulkGet(workoutIds)
  const dateMap = Object.fromEntries(workouts.filter(Boolean).map((w) => [w.id, w.date]))

  const byWorkout = {}
  for (const s of sets) {
    const est1rm = (s.weight ?? 0) * (1 + (s.reps ?? 0) / 30)
    if (!byWorkout[s.workoutId] || est1rm > byWorkout[s.workoutId].value) {
      byWorkout[s.workoutId] = { date: dateMap[s.workoutId], value: Math.round(est1rm * 10) / 10 }
    }
  }

  return Object.values(byWorkout)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-limit)
}

/** Contexto para la IA: últimos N workouts con sus series */
export async function getAIContext(limit = 10) {
  const workouts = await db.workouts.orderBy('date').reverse().limit(limit).toArray()
  const result = []

  for (const w of workouts) {
    const sets = await db.workout_sets.where('workoutId').equals(w.id).toArray()
    const exerciseIds = [...new Set(sets.map((s) => s.exerciseId))]
    const exercises = await db.exercises.bulkGet(exerciseIds)
    const exMap = Object.fromEntries(exercises.filter(Boolean).map((e) => [e.id, e.name]))

    result.push({
      date: w.date,
      duration: w.duration,
      totalVolume: w.totalVolume,
      sets: sets.map((s) => ({
        exercise: exMap[s.exerciseId] ?? 'Desconocido',
        weight: s.weight,
        reps: s.reps,
        rpe: s.rpe,
      })),
    })
  }

  return result
}
