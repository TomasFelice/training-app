import { db } from '../db'

const day = (name, ids) => ({ name, catalogIds: ids.split(' ') })
export const ROUTINE_TEMPLATES = [
  { id: 'full-body', name: 'Full body inicial', goal: 'Construir una base de fuerza', level: 'Inicial',
    frequency: '3 veces por semana', equipment: 'Mancuernas, poleas y máquinas', note: 'Alterná A y B, dejando un día de descanso entre sesiones.',
    days: [day('Full body A', '1760 0289 0861 0432 0334'), day('Full body B', '0336 0405 2330 0599 0294')] },
  { id: 'upper-lower', name: 'Torso / pierna', goal: 'Fuerza y desarrollo muscular', level: 'Intermedio',
    frequency: '4 veces por semana', equipment: 'Gimnasio completo', note: 'Repetí torso y pierna dos veces por semana.',
    days: [day('Torso', '0025 0861 0405 2330 0294 0201'), day('Pierna', '0043 0085 0599 0585 1373')] },
  { id: 'ppl', name: 'Push / pull / legs', goal: 'Trabajar por patrones de movimiento', level: 'Intermedio',
    frequency: '3–6 veces por semana', equipment: 'Gimnasio completo', note: 'Completá push, pull y legs en ese orden; repetí el ciclo según tu disponibilidad.',
    days: [day('Push', '0025 0405 0334 0201'), day('Pull', '2330 0027 0294'), day('Legs', '0043 0085 0599 0585 1373')] },
  { id: 'dumbbells', name: 'Full body con mancuernas', goal: 'Entrenar con poco equipamiento', level: 'Inicial',
    frequency: '3 veces por semana', equipment: 'Mancuernas y banco', note: 'Alterná A y B. Elegí una carga que te permita completar las repeticiones con control.',
    days: [day('Mancuernas A', '1760 0289 0293 0432 0334'), day('Mancuernas B', '0336 0405 0293 0432 0294')] },
]
export function templateReps(catalogId) {
  if (catalogId === '1373') return 15
  return ['0334', '0294', '0201', '0599', '0585'].includes(catalogId) ? 12 : 10
}
export async function resolveTemplate(template, database = db) {
  const ids = [...new Set(template.days.flatMap((d) => d.catalogIds))]
  const records = await database.exercises.where('catalogId').anyOf(ids).toArray()
  const map = new Map(records.map((r) => [r.catalogId, r]))
  if (ids.some((id) => !map.has(id))) throw new Error('Faltan ejercicios del catálogo. Volvé a cargar la app.')
  return { name: template.name, scheduledDays: [], trainingDays: template.days.map((d) => ({ name: d.name,
    exercises: d.catalogIds.map((id) => ({ exerciseId: map.get(id).id, sets: 3, reps: templateReps(id) })) })) }
}

export function positiveInteger(value) {
  return /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0
}
export function validateRoutine(routine) {
  if (!routine.name.trim()) return 'Escribí un nombre para la rutina.'
  for (const day of routine.trainingDays) {
    if (!day.name.trim()) return 'Todos los días necesitan un nombre.'
    if (!day.exercises.length) return `Agregá ejercicios a ${day.name}.`
    if (day.exercises.some((e) => !positiveInteger(e.sets) || !positiveInteger(e.reps))) return `Revisá las series y repeticiones de ${day.name}. Usá enteros mayores que cero.`
  }
  return null
}
