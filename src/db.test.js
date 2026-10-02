import { beforeEach, afterAll, describe, it, expect, vi } from 'vitest'
import Dexie from 'dexie'
import catalog from '../public/catalog/exercises.json'
import { db, archiveExercise, saveWorkoutSession } from './db'
import { importCatalog } from './seed'
import { ROUTINE_TEMPLATES, resolveTemplate } from './lib/routineTemplates'
import { filterExercises } from './lib/catalog'
import { saveRoutineFromAI } from './lib/gemini'

beforeEach(async () => { vi.restoreAllMocks(); await db.delete(); await db.open() })
afterAll(() => db.delete())

describe('catalog and existing data', () => {
  it('migrates a v1 routine and enriches the existing numeric exercise ID without losing history or photos', async () => {
    await db.delete()
    const previous = new Dexie('GymTrackDB')
    previous.version(1).stores({ exercises: '++id, name, muscleGroup', routines: '++id, name', workouts: '++id, routineId, date', workout_sets: '++id, workoutId, exerciseId, setOrder' })
    const exerciseId = await previous.exercises.add({ name: 'Press Banca', muscleGroup: 'Pecho', photoBase64: 'data:photo' })
    const customId = await previous.exercises.add({ name: 'Mi ejercicio', muscleGroup: 'Core' })
    const routineId = await previous.routines.add({ name: 'Mi plan', days: ['Lun'], exerciseIds: [exerciseId, customId] })
    const workoutId = await previous.workouts.add({ routineId, date: '2026-09-01' })
    await previous.workout_sets.add({ workoutId, exerciseId, reps: 8, weight: 50, setOrder: 0 })
    previous.close()
    await db.open()
    await importCatalog(catalog)
    expect(await db.exercises.get(exerciseId)).toMatchObject({ id: exerciseId, name: 'Press Banca', muscleGroup: 'Pecho', photoBase64: 'data:photo', catalogId: '0025', catalogName: 'barbell bench press' })
    expect(await db.exercises.get(customId)).toMatchObject({ name: 'Mi ejercicio' })
    expect((await db.routines.get(routineId)).trainingDays[0].exercises.map((e) => e.exerciseId)).toEqual([exerciseId, customId])
    expect((await db.workout_sets.toArray())[0].exerciseId).toBe(exerciseId)
    expect(await db.workouts.count()).toBe(1)
  })
  it('imports all 1,324 entries idempotently and preserves edits and hidden state', async () => {
    await importCatalog(catalog)
    const bench = await db.exercises.where('catalogId').equals('0025').first()
    await db.exercises.update(bench.id, { name: 'Mi banca', photoBase64: 'photo', archived: true })
    await importCatalog(catalog)
    expect(await db.exercises.count()).toBe(1324)
    expect(await db.exercises.get(bench.id)).toMatchObject({ name: 'Mi banca', photoBase64: 'photo', archived: true })
    expect(filterExercises(await db.exercises.toArray(), { query: 'mi banca' })).toHaveLength(0)
    expect(filterExercises(await db.exercises.toArray(), { query: 'mi banca', archived: true })).toHaveLength(1)
  }, 15000)
  it('rejects an invalid source before mutating the database', async () => {
    await expect(importCatalog([catalog[0], catalog[0]])).rejects.toThrow('Registro inválido')
    expect(await db.exercises.count()).toBe(0)
  })
  it('archives referenced custom exercises instead of breaking routine references', async () => {
    const id = await db.exercises.add({ name: 'Personalizado', muscleGroup: 'Core' })
    await db.routines.add({ name: 'Plan', trainingDays: [{ exercises: [{ exerciseId: id }] }] })
    await archiveExercise(id)
    expect(await db.exercises.get(id)).toMatchObject({ archived: true })
  })
})

describe('templates and coach compatibility', () => {
  it('resolves every template against real source IDs and produces independent editable copies', async () => {
    await importCatalog(catalog)
    for (const template of ROUTINE_TEMPLATES) {
      const first = await resolveTemplate(template)
      const second = await resolveTemplate(template)
      expect(first.scheduledDays).toEqual([])
      expect(first.trainingDays.flatMap((d) => d.exercises).every((e) => Number.isInteger(e.exerciseId) && e.sets === 3 && [10, 12, 15].includes(e.reps) && e.weight === undefined)).toBe(true)
      first.trainingDays[0].exercises[0].reps = 8
      expect(second.trainingDays[0].exercises[0].reps).toBe(10)
      expect(template.days[0].catalogIds[0]).toMatch(/^\d+$/)
    }
  })
  it('resolves Spanish legacy names for coach routines', async () => {
    await importCatalog(catalog)
    const id = await saveRoutineFromAI({ name: 'Coach', exercises: ['Press Banca', 'Sentadilla'], days: ['Lun'] })
    expect((await db.routines.get(id)).trainingDays[0].exercises).toHaveLength(2)
  })
})

describe('atomic session saving', () => {
  const active = { sessionId: 'session-test', startTime: 1000, routineId: 5, name: 'Fuerza', dayName: 'A', exerciseIds: [12, 3] }
  const sets = { 3: [{ reps: 8, weight: 20, rpe: null, done: true }], 12: [{ reps: 10, weight: 50, rpe: 8, done: true }, { reps: 10, weight: 50, done: false }] }
  it('keeps exercise order, saves only completed sets, and makes retry idempotent', async () => {
    const first = await saveWorkoutSession(active, sets, 121000)
    const second = await saveWorkoutSession(active, sets, 122000)
    expect(second).toBe(first)
    expect(await db.workouts.count()).toBe(1)
    expect(await db.workouts.get(first)).toMatchObject({ duration: 120, totalVolume: 660 })
    expect((await db.workout_sets.toArray()).map((s) => s.exerciseId)).toEqual([12, 3])
  })
  it('rolls back the workout when the series write fails, then succeeds on retry', async () => {
    const failure = vi.spyOn(db.workout_sets, 'bulkAdd').mockRejectedValueOnce(new Error('disk full'))
    await expect(saveWorkoutSession(active, sets)).rejects.toThrow('disk full')
    expect(await db.workouts.count()).toBe(0)
    expect(await db.workout_sets.count()).toBe(0)
    failure.mockRestore()
    await saveWorkoutSession(active, sets)
    expect(await db.workouts.count()).toBe(1)
    expect(await db.workout_sets.count()).toBe(2)
  })
})
