import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, ChevronUp, Plus, Info, Check, Minimize2 } from 'lucide-react'
import { db, saveWorkoutSession } from '../db'
import { useWorkoutStore, useUIStore, useClockStore } from '../store'
import { formatDuration, workoutElapsed } from '../lib/time'
import { useWeightUnit } from '../hooks/useWeightUnit'
import SetRow from '../components/SetRow'
import RPESelector from '../components/RPESelector'
import Sheet from '../components/Sheet'
import ExerciseDetails, { ExerciseThumbnail } from '../components/ExerciseDetails'

function ExerciseBlock({ exerciseId, position, workoutSets, plannedSets }) {
  const [collapsed, setCollapsed] = useState(false)
  const [details, setDetails] = useState(false)
  const { addSet, updateSet, removeSet, unmarkSetDone, startRestTimer } = useWorkoutStore()
  const [pendingRPE, setPendingRPE] = useState(null)
  const exercise = useLiveQuery(() => db.exercises.get(exerciseId), [exerciseId])
  const previousSets = useLiveQuery(async () => {
    const all = await db.workout_sets.where('exerciseId').equals(exerciseId).toArray()
    const lastId = Math.max(0, ...all.map((s) => s.workoutId))
    return all.filter((s) => s.workoutId === lastId).sort((a, b) => a.setOrder - b.setOrder)
  }, [exerciseId], [])
  const sets = workoutSets ?? []
  const done = sets.filter((s) => s.done).length
  const complete = sets.length > 0 && done === sets.length
  function handleDone(index, data) {
    updateSet(exerciseId, index, { ...data, done: true })
    startRestTimer()
    setPendingRPE(sets[index].uid)
  }
  function saveRPE(value) {
    const index = sets.findIndex((s) => s.uid === pendingRPE)
    if (index >= 0) updateSet(exerciseId, index, { rpe: value })
    setPendingRPE(null)
  }
  return <article className={`session-exercise ${complete ? 'exercise-complete' : ''}`}>
    <div className="session-exercise-header"><button className="exercise-collapse" onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed}>
      <span className="exercise-position">{complete ? <Check size={19} /> : String(position + 1).padStart(2, '0')}</span>
      <span><h2>{exercise?.name ?? 'Ejercicio'}</h2><small>{done}/{sets.length} series{plannedSets ? ` · ${plannedSets} planificadas` : ''}</small></span>
      {collapsed ? <ChevronDown size={19} /> : <ChevronUp size={19} />}</button>
      <button className="icon-button" aria-label={`Ver instrucciones de ${exercise?.name ?? 'ejercicio'}`} disabled={!exercise} onClick={() => setDetails(true)}><Info size={20} /></button></div>
    {!collapsed && <><div className="session-exercise-guide">{exercise && <ExerciseThumbnail exercise={exercise} />}<span>{exercise?.muscleGroup}{exercise?.image && <small>© Gym visual</small>}</span></div>
      {sets.map((set, i) => <SetRow key={set.uid} index={i} set={set} prevSet={previousSets[i] ?? previousSets.at(-1)}
        onUpdate={(data) => updateSet(exerciseId, i, data)} onRemove={() => removeSet(exerciseId, i)} onDone={(data) => handleDone(i, data)} onUndo={() => unmarkSetDone(exerciseId, i)} />)}
      <button className="add-set-button" onClick={() => addSet(exerciseId)}><Plus size={18} /> Agregar serie</button></>}
    {pendingRPE && <RPESelector onSelect={saveRPE} onSkip={() => setPendingRPE(null)} />}
    {details && exercise && <ExerciseDetails exercise={exercise} onClose={() => setDetails(false)} />}
  </article>
}

export default function WorkoutSession() {
  const { activeWorkout, sets, finishWorkout } = useWorkoutStore()
  const { setActiveTab } = useUIStore()
  const now = useClockStore((s) => s.now)
  const { display, unit } = useWeightUnit()
  const [showFinish, setShowFinish] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  if (!activeWorkout) return null
  const elapsed = workoutElapsed(activeWorkout, now)
  const allSets = Object.values(sets).flat()
  const completed = allSets.filter((s) => s.done)
  const volume = completed.reduce((acc, s) => acc + (s.weight ?? 0) * (s.reps ?? 0), 0)
  async function finish() {
    if (saving) return
    setSaving(true); setError('')
    try { await saveWorkoutSession(activeWorkout, sets); finishWorkout(); setActiveTab('home') }
    catch { setError('No se pudo guardar el entrenamiento. Tus series siguen acá. Volvé a intentar.') }
    finally { setSaving(false) }
  }
  function discard() { finishWorkout(); setActiveTab('home') }
  return <div className="page session-page">
    <header className="session-header"><div className="session-topline"><button className="text-button" onClick={() => setActiveTab('home')}><Minimize2 size={18} /> Minimizar</button><span className="live-label">En entrenamiento</span><button className="primary-button" onClick={() => setShowFinish(true)}>Terminar</button></div>
      <div className="session-title"><div><h1>{activeWorkout.dayName || activeWorkout.name}</h1><p className="muted">{activeWorkout.name}</p></div><time>{formatDuration(elapsed)}</time></div>
      <div className="session-progress" role="progressbar" aria-label="Series completadas" aria-valuemin={0} aria-valuemax={allSets.length} aria-valuenow={completed.length}><span style={{ width: `${allSets.length ? completed.length / allSets.length * 100 : 0}%` }} /></div>
      <div className="session-statline"><span><strong>{completed.length}/{allSets.length}</strong> series</span><span><strong>{Math.round(display(volume)).toLocaleString('es-AR')}</strong> {unit} de volumen</span></div>
    </header>
    <div className="page-scroll scroll-ios session-scroll">{activeWorkout.exerciseIds.map((id, i) => <ExerciseBlock key={id} exerciseId={id} position={i} workoutSets={sets[id]} plannedSets={activeWorkout.plannedConfig?.[id]?.sets} />)}
      <button className="text-button danger-text discard-workout" onClick={() => setDiscarding(true)}>Descartar entrenamiento</button>
    </div>
    {showFinish && <Sheet title="Guardar entrenamiento" onClose={() => { if (!saving) setShowFinish(false) }} footer={<><button className="primary-button" disabled={saving} onClick={finish}>{saving ? 'Guardando…' : 'Guardar entrenamiento'}</button><button className="text-button" disabled={saving} onClick={() => setShowFinish(false)}>Seguir entrenando</button></>}>
      <p className="muted">Se guardarán las series completadas.</p><div className="finish-stats"><div><strong>{formatDuration(elapsed)}</strong><span>Duración</span></div><div><strong>{completed.length}</strong><span>Series</span></div><div><strong>{Math.round(display(volume)).toLocaleString('es-AR')}</strong><span>{unit} de volumen</span></div></div>
      {!completed.length && <p className="muted">Todavía no completaste ninguna serie. Podés volver al entrenamiento para registrarlas.</p>}{error && <p className="form-error" role="alert">{error}</p>}
    </Sheet>}
    {discarding && <Sheet title="¿Descartar entrenamiento?" onClose={() => setDiscarding(false)} footer={<button className="danger-button" onClick={discard}>Descartar entrenamiento</button>}><p>Se perderán las series de esta sesión. Para volver más tarde sin perderlas, usá “Minimizar”.</p></Sheet>}
  </div>
}
