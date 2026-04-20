import { db, getAIContext } from '../db'

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY

const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`

export function hasApiKey() {
  return Boolean(API_KEY)
}

// ── Build context string from IndexedDB ───────────────────────────────────

async function buildContext() {
  const recentWorkouts = await getAIContext(10)
  const routines = await db.routines.toArray()
  const exercises = await db.exercises.toArray()
  const exerciseMap = Object.fromEntries(exercises.map((e) => [e.id, e]))

  // PRs per exercise (max weight × reps)
  const sets = await db.workout_sets.toArray()
  const prMap = {}
  for (const s of sets) {
    const key = s.exerciseId
    const est1rm = (s.weight ?? 0) * (1 + (s.reps ?? 0) / 30)
    if (!prMap[key] || est1rm > prMap[key].est1rm) {
      prMap[key] = { name: exerciseMap[key]?.name ?? key, weight: s.weight, reps: s.reps, est1rm }
    }
  }

  // Stagnation: exercises with ≥3 workouts and flat or declining 1RM
  const stagnated = []
  for (const exId of Object.keys(prMap)) {
    const exSets = sets.filter((s) => s.exerciseId === Number(exId))
    const byWorkout = {}
    for (const s of exSets) {
      const e = (s.weight ?? 0) * (1 + (s.reps ?? 0) / 30)
      if (!byWorkout[s.workoutId] || e > byWorkout[s.workoutId]) byWorkout[s.workoutId] = e
    }
    const vals = Object.values(byWorkout)
    if (vals.length >= 3) {
      const last3 = vals.slice(-3)
      if (last3[2] <= last3[0]) stagnated.push(exerciseMap[exId]?.name ?? exId)
    }
  }

  const lines = [
    '=== CONTEXTO DE ENTRENAMIENTO ===',
    `Rutinas activas: ${routines.map((r) => `${r.name} (${r.exerciseIds?.length ?? 0} ejercicios, días: ${r.days?.join(', ') ?? '—'})`).join(' | ') || 'ninguna'}`,
    '',
    `Records personales (1RM estimado):`,
    ...Object.values(prMap).map((p) => `  - ${p.name}: ${p.weight}kg × ${p.reps} reps (1RM ~${p.est1rm.toFixed(1)}kg)`),
    '',
    stagnated.length
      ? `Ejercicios sin progreso (últimas 3 sesiones): ${stagnated.join(', ')}`
      : 'Sin estancamientos detectados.',
    '',
    `Últimos ${recentWorkouts.length} entrenamientos:`,
    ...recentWorkouts.slice(0, 5).map((w) =>
      `  ${w.date.slice(0, 10)} — ${w.sets.length} series, volumen ${(w.totalVolume / 1000).toFixed(1)}t, duración ${Math.round((w.duration ?? 0) / 60)}min`
    ),
  ]

  return lines.join('\n')
}

// ── System prompt ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un coach de fitness experto, empático y directo. Respondes siempre en español argentino (tono informal, tuteo). Eres conciso: máximo 3 párrafos salvo que el usuario pida algo extenso.

Cuando el usuario pida generar una rutina, devolvés SIEMPRE un bloque JSON válido con este formato exacto al final de tu respuesta, sin markdown adicional dentro del JSON:
<ROUTINE_JSON>
{"name":"Nombre","days":["Lun","Mié","Vie"],"exercises":["Press Banca","Sentadilla"]}
</ROUTINE_JSON>

Nunca inventés datos de entrenamiento. Usá solo el contexto provisto.`

// ── Main send function ────────────────────────────────────────────────────

export async function sendMessage(messages) {
  if (!API_KEY) throw new Error('VITE_GEMINI_API_KEY no está configurada en el archivo .env')

  const context = await buildContext()

  const systemWithContext = `${SYSTEM_PROMPT}\n\n${context}`

  const contents = [
    { role: 'user', parts: [{ text: systemWithContext }] },
    { role: 'model', parts: [{ text: 'Perfecto, estoy listo para ayudarte con tu entrenamiento.' }] },
    ...messages.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    })),
  ]

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `Error ${res.status}`)
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

// ── Parse routine JSON from AI response ──────────────────────────────────

export function parseRoutineFromResponse(text) {
  const match = text.match(/<ROUTINE_JSON>([\s\S]*?)<\/ROUTINE_JSON>/)
  if (!match) return null
  try {
    return JSON.parse(match[1].trim())
  } catch {
    return null
  }
}

export async function saveRoutineFromAI(parsed) {
  const exerciseNames = parsed.exercises ?? []

  // Match exercise names to existing DB entries (case-insensitive)
  const allExercises = await db.exercises.toArray()
  const exerciseIds = exerciseNames
    .map((name) => allExercises.find((e) => e.name.toLowerCase() === name.toLowerCase())?.id)
    .filter(Boolean)

  return db.routines.add({
    name: parsed.name,
    days: parsed.days ?? [],
    exerciseIds,
  })
}
