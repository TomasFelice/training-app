import { db, getAIContext } from '../db'
import { normalizeSearch } from './catalog'

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY?.trim()
export const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL?.trim() || 'gemini-3.8-flash'
export const GEMINI_MODEL_LABEL = GEMINI_MODEL === 'gemini-3.8-flash' ? 'Gemini 3.8 Flash' : GEMINI_MODEL

const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`

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
    `Rutinas activas: ${routines.map((r) => {
      const exCount = (r.trainingDays ?? []).reduce((a, d) => a + d.exercises.length, 0)
      const days = r.scheduledDays?.join(', ') ?? '—'
      return `${r.name} (${exCount} ejercicios, días: ${days})`
    }).join(' | ') || 'ninguna'}`,
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

  const contents = messages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    // Keep model parts intact to preserve thinking signatures across turns.
    parts: m.role === 'user' ? [{ text: m.content }] : (m.parts ?? [{ text: m.content }]),
  }))

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: systemWithContext }] },
      generationConfig: {
        temperature: 1,
        // The limit includes thinking tokens as well as the final answer.
        maxOutputTokens: 32768,
        thinkingConfig: { thinkingLevel: 'medium', includeThoughts: false },
      },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    if (res.status === 429) throw new Error('Se alcanzó la cuota de Gemini para este proyecto. Volvé a intentar más tarde o revisá los límites en Google AI Studio. Google AI Pro tiene límites separados de la API.')
    if (res.status === 401 || res.status === 403 || err?.error?.message?.includes('API key not valid')) {
      throw new Error('La clave de Gemini no es válida o no tiene acceso. Revisá VITE_GEMINI_API_KEY en .env y los permisos del proyecto en Google AI Studio.')
    }
    if (res.status === 404) throw new Error(`El modelo ${GEMINI_MODEL} no está disponible para este proyecto. Revisá VITE_GEMINI_MODEL en .env.`)
    throw new Error(err?.error?.message ?? `Error ${res.status}`)
  }

  const data = await res.json()
  const candidate = data.candidates?.[0]
  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new Error('Gemini no pudo completar la respuesta dentro del límite. Probá pedir una rutina o un análisis más breve.')
  }
  const parts = candidate?.content?.parts ?? []
  const content = parts.filter((part) => !part.thought && typeof part.text === 'string').map((part) => part.text).join('').trim()
  if (!content) throw new Error('Gemini no devolvió una respuesta. Probá reformular la consulta.')
  return { content, parts }
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

  const allExercises = await db.exercises.toArray()
  const matchedIds = exerciseNames
    .map((name) => allExercises.find((e) => [e.name, e.catalogName, ...(e.aliases ?? [])].filter(Boolean)
      .some((alias) => normalizeSearch(alias) === normalizeSearch(name)))?.id)
    .filter(Boolean)

  if (!matchedIds.length) throw new Error('No se encontraron los ejercicios de la rutina en el catálogo.')

  return db.routines.add({
    name: parsed.name,
    scheduledDays: parsed.days ?? [],
    trainingDays: [
      {
        name: 'Día 1',
        exercises: matchedIds.map((id) => ({ exerciseId: id, sets: 3, reps: 10 })),
      },
    ],
  })
}
