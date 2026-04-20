import { db } from './db'

const EXERCISES = [
  // Pecho
  { name: 'Press Banca', muscleGroup: 'Pecho' },
  { name: 'Press Banca Inclinado', muscleGroup: 'Pecho' },
  { name: 'Press Banca Declinado', muscleGroup: 'Pecho' },
  { name: 'Aperturas con Mancuernas', muscleGroup: 'Pecho' },
  { name: 'Press con Mancuernas', muscleGroup: 'Pecho' },
  { name: 'Fondos en Paralelas', muscleGroup: 'Pecho' },
  { name: 'Crossover en Polea', muscleGroup: 'Pecho' },
  // Espalda
  { name: 'Dominadas', muscleGroup: 'Espalda' },
  { name: 'Remo con Barra', muscleGroup: 'Espalda' },
  { name: 'Remo con Mancuerna', muscleGroup: 'Espalda' },
  { name: 'Jalón al Pecho', muscleGroup: 'Espalda' },
  { name: 'Peso Muerto', muscleGroup: 'Espalda' },
  { name: 'Peso Muerto Rumano', muscleGroup: 'Espalda' },
  { name: 'Pullover con Mancuerna', muscleGroup: 'Espalda' },
  // Hombros
  { name: 'Press Militar', muscleGroup: 'Hombros' },
  { name: 'Press Arnold', muscleGroup: 'Hombros' },
  { name: 'Elevaciones Laterales', muscleGroup: 'Hombros' },
  { name: 'Elevaciones Frontales', muscleGroup: 'Hombros' },
  { name: 'Pájaros', muscleGroup: 'Hombros' },
  { name: 'Face Pull', muscleGroup: 'Hombros' },
  // Bíceps
  { name: 'Curl con Barra', muscleGroup: 'Bíceps' },
  { name: 'Curl con Mancuernas', muscleGroup: 'Bíceps' },
  { name: 'Curl Martillo', muscleGroup: 'Bíceps' },
  { name: 'Curl en Predicador', muscleGroup: 'Bíceps' },
  { name: 'Curl en Polea', muscleGroup: 'Bíceps' },
  // Tríceps
  { name: 'Press Cerrado', muscleGroup: 'Tríceps' },
  { name: 'Extensión en Polea Alta', muscleGroup: 'Tríceps' },
  { name: 'Extensión Francesa', muscleGroup: 'Tríceps' },
  { name: 'Fondos entre Bancos', muscleGroup: 'Tríceps' },
  { name: 'Patada de Tríceps', muscleGroup: 'Tríceps' },
  // Piernas
  { name: 'Sentadilla', muscleGroup: 'Cuádriceps' },
  { name: 'Sentadilla Frontal', muscleGroup: 'Cuádriceps' },
  { name: 'Prensa de Piernas', muscleGroup: 'Cuádriceps' },
  { name: 'Extensión de Cuádriceps', muscleGroup: 'Cuádriceps' },
  { name: 'Zancadas', muscleGroup: 'Cuádriceps' },
  { name: 'Curl Femoral', muscleGroup: 'Isquiotibiales' },
  { name: 'Buenos Días', muscleGroup: 'Isquiotibiales' },
  { name: 'Hip Thrust', muscleGroup: 'Glúteos' },
  { name: 'Elevación de Pantorrillas', muscleGroup: 'Pantorrillas' },
  // Core
  { name: 'Plancha', muscleGroup: 'Core' },
  { name: 'Crunch en Polea', muscleGroup: 'Core' },
  { name: 'Rueda Abdominal', muscleGroup: 'Core' },
]

export async function seedIfEmpty() {
  const count = await db.exercises.count()
  if (count > 0) return
  await db.exercises.bulkAdd(EXERCISES)
}
