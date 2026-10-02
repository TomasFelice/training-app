import Dexie from 'dexie'

export const db = new Dexie('GymTrackDB')

// Version 1 — original schema (kept for migration chain)
db.version(1).stores({
  exercises: '++id, name, muscleGroup',
  routines: '++id, name',
  workouts: '++id, routineId, date',
  workout_sets: '++id, workoutId, exerciseId, setOrder',
})

// Catalog identities never replace local numeric IDs or historical references.
db.version(3).stores({
  exercises: '++id, name, muscleGroup, &catalogId, equipment, target',
  routines: '++id, name',
  workouts: '++id, routineId, date, &sessionId',
  workout_sets: '++id, workoutId, exerciseId, setOrder',
  metadata: '&key',
})

export async function archiveExercise(id) {
  // Even an unreferenced custom exercise can belong to a not-yet-saved active session.
  // Hiding always remains reversible and never invalidates those references.
  await db.exercises.update(id, { archived: true })
}

/** Atomic and idempotent: a failed write leaves both the history and active draft intact. */
export async function saveWorkoutSession(activeWorkout, sets, now = Date.now()) {
  if (!activeWorkout?.sessionId) throw new Error('No hay un entrenamiento activo')
  return db.transaction('rw', db.workouts, db.workout_sets, async () => {
    const existing = await db.workouts.where('sessionId').equals(activeWorkout.sessionId).first()
    if (existing) return existing.id
    const orderedIds = activeWorkout.exerciseIds ?? Object.keys(sets).map(Number)
    const completed = orderedIds.flatMap((exerciseId) => (sets[exerciseId] ?? [])
      .filter((s) => s.done).map((s) => ({ ...s, exerciseId })))
    const workoutId = await db.workouts.add({
      sessionId: activeWorkout.sessionId, routineId: activeWorkout.routineId ?? null,
      name: activeWorkout.name, dayName: activeWorkout.dayName,
      date: new Date(now).toISOString(), duration: Math.max(0, Math.floor((now - activeWorkout.startTime) / 1000)),
      totalVolume: completed.reduce((total, s) => total + (s.weight ?? 0) * (s.reps ?? 0), 0),
    })
    await db.workout_sets.bulkAdd(completed.map((s, setOrder) => ({
      workoutId, exerciseId: s.exerciseId, weight: s.weight ?? 0, reps: s.reps ?? 0,
      rpe: s.rpe ?? null, setOrder,
    })))
    return workoutId
  })
}

// Version 2 — new routine format: scheduledDays + trainingDays; exercises get optional photo
db.version(2).stores({
  exercises: '++id, name, muscleGroup',
  routines: '++id, name',
  workouts: '++id, routineId, date',
  workout_sets: '++id, workoutId, exerciseId, setOrder',
}).upgrade((tx) => {
  // Migrate old routines: { days: string[], exerciseIds: number[] }
  // →  new: { scheduledDays: string[], trainingDays: [{ name, exercises: [{exerciseId,sets,reps}] }] }
  return tx.table('routines').toCollection().modify((routine) => {
    if (routine.exerciseIds !== undefined) {
      const scheduledDays = Array.isArray(routine.days) ? routine.days : []
      const ids = Array.isArray(routine.exerciseIds) ? routine.exerciseIds : []
      routine.scheduledDays = scheduledDays
      routine.trainingDays = [
        {
          name: 'Día 1',
          exercises: ids.map((id) => ({ exerciseId: id, sets: 3, reps: 10 })),
        },
      ]
      delete routine.days
      delete routine.exerciseIds
    }
  })
})

// ─── Helpers de consulta ────────────────────────────────────────────────────

/** Total de ejercicios distintos en una rutina (compatible con ambos formatos) */
export function getRoutineExerciseCount(routine) {
  if (routine.trainingDays) {
    const ids = new Set(routine.trainingDays.flatMap((d) => d.exercises.map((e) => e.exerciseId)))
    return ids.size
  }
  return routine.exerciseIds?.length ?? 0
}

/** Todos los IDs de ejercicios de una rutina, sin duplicados */
export function getRoutineExerciseIds(routine) {
  if (routine.trainingDays) {
    return [...new Set(routine.trainingDays.flatMap((d) => d.exercises.map((e) => e.exerciseId)))]
  }
  return routine.exerciseIds ?? []
}

/** Último workout_set para un ejercicio dado (para mostrar peso anterior) */
export async function getLastSetForExercise(exerciseId) {
  const sets = await db.workout_sets
    .where('exerciseId')
    .equals(exerciseId)
    .toArray()

  if (!sets.length) return null

  sets.sort((a, b) => b.workoutId - a.workoutId)
  return sets[0]
}

/** Historial de volumen total por ejercicio para los gráficos de progreso */
export async function getVolumeHistoryForExercise(exerciseId, limit = 20) {
  const sets = await db.workout_sets
    .where('exerciseId')
    .equals(exerciseId)
    .toArray()

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
