import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowUp, ArrowDown, X, Plus } from 'lucide-react'
import { db } from '../db'
import { positiveInteger, validateRoutine } from '../lib/routineTemplates'
import Sheet from './Sheet'
import ExercisePicker from './ExercisePicker'

const WEEK_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
export function ExerciseConfigRow({ exercise, config, onUpdate, onRemove, onMoveUp, onMoveDown, isFirst, isLast, validate = false }) {
  const [touched, setTouched] = useState({})
  return <div className="routine-exercise">
    <div className="routine-exercise-title"><strong>{exercise?.name ?? 'Cargando ejercicio…'}</strong><button className="icon-button danger-text" onClick={onRemove} aria-label={`Quitar ${exercise?.name ?? 'ejercicio'}`}><X size={18} /></button></div>
    <div className="routine-exercise-controls">
      {['sets', 'reps'].map((field) => { const label = field === 'sets' ? 'Series' : 'Repeticiones'; const invalid = (touched[field] || validate) && !positiveInteger(config[field]); return <label className="number-field" key={field}>{label}
        <input type="text" inputMode="numeric" aria-label={`${label} de ${exercise?.name ?? 'ejercicio'}`} value={String(config[field] ?? '')}
          onChange={(e) => onUpdate({ [field]: e.target.value })} onBlur={() => setTouched((state) => ({ ...state, [field]: true }))} aria-invalid={invalid || undefined} />
        {invalid && <small className="form-error">Entero mayor que cero</small>}</label> })}
      <div className="reorder-controls"><button className="icon-button" disabled={isFirst} onClick={onMoveUp} aria-label="Mover arriba"><ArrowUp size={18} /></button><button className="icon-button" disabled={isLast} onClick={onMoveDown} aria-label="Mover abajo"><ArrowDown size={18} /></button></div>
    </div>
  </div>
}

export default function RoutineEditor({ initial, onSave, onClose }) {
  const [draft, setDraft] = useState(() => structuredClone(initial ?? { name: '', scheduledDays: [], trainingDays: [{ name: 'Día 1', exercises: [] }] }))
  const [activeDay, setActiveDay] = useState(0)
  const [picker, setPicker] = useState(false)
  const [error, setError] = useState('')
  const [validating, setValidating] = useState(false)
  const [saving, setSaving] = useState(false)
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], [])
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]))
  const day = draft.trainingDays[activeDay]
  function updateDay(update) { setDraft((state) => ({ ...state, trainingDays: state.trainingDays.map((d, i) => i === activeDay ? update(d) : d) })) }
  function updateExercise(index, data) { updateDay((d) => ({ ...d, exercises: d.exercises.map((e, i) => i === index ? { ...e, ...data } : e) })) }
  function move(index, direction) {
    updateDay((d) => { const next = [...d.exercises]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; return { ...d, exercises: next } })
  }
  function addDay() { setDraft((state) => ({ ...state, trainingDays: [...state.trainingDays, { name: `Día ${state.trainingDays.length + 1}`, exercises: [] }] })); setActiveDay(draft.trainingDays.length) }
  function removeDay(index) { setDraft((state) => ({ ...state, trainingDays: state.trainingDays.filter((_, i) => i !== index) })); setActiveDay((value) => Math.max(0, Math.min(value - (index < value ? 1 : 0), draft.trainingDays.length - 2))) }
  function choose(ids) {
    updateDay((d) => ({ ...d, exercises: ids.map((id) => d.exercises.find((e) => e.exerciseId === id) ?? { exerciseId: id, sets: 3, reps: 10 }) }))
    setPicker(false)
  }
  async function save() {
    setValidating(true)
    const validation = validateRoutine(draft)
    if (validation) { setError(validation); return }
    setSaving(true)
    try {
      await onSave({ name: draft.name.trim(), scheduledDays: [...draft.scheduledDays],
        trainingDays: draft.trainingDays.map((d) => ({ name: d.name.trim(), exercises: d.exercises.map((e) => ({ ...e, sets: Number(e.sets), reps: Number(e.reps) })) })) })
      onClose()
    } catch { setError('No se pudo guardar la rutina. Volvé a intentar.') }
    finally { setSaving(false) }
  }
  return <Sheet title={initial?.id ? 'Editar rutina' : 'Preparar rutina'} onClose={onClose} className="routine-editor"
    footer={<>{error && <p role="alert" className="form-error">{error}</p>}<button className="primary-button" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar rutina'}</button></>}>
    <div className="form-stack">
      <label className="field-label">Nombre de la rutina<input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Mi rutina" /></label>
      <details className="schedule-settings" open={draft.scheduledDays.length ? true : undefined}><summary>Días de la semana (opcional)</summary><div className="week-days">{WEEK_DAYS.map((d) => <button key={d} aria-pressed={draft.scheduledDays.includes(d)} className={draft.scheduledDays.includes(d) ? 'selected' : ''} onClick={() => setDraft((s) => ({ ...s, scheduledDays: s.scheduledDays.includes(d) ? s.scheduledDays.filter((x) => x !== d) : [...s.scheduledDays, d] }))}>{d}</button>)}</div></details>
      <div className="section-heading"><h3>Días de la rutina</h3><button className="text-button" onClick={addDay}><Plus size={17} /> Agregar día</button></div>
      <div className="day-tabs">{draft.trainingDays.map((d, i) => <div key={i}><button className={activeDay === i ? 'selected' : ''} onClick={() => setActiveDay(i)}>{d.name || `Día ${i + 1}`}</button>{draft.trainingDays.length > 1 && <button className="icon-button" aria-label={`Eliminar día ${i + 1}`} onClick={() => removeDay(i)}><X size={15} /></button>}</div>)}</div>
      <label className="field-label">Nombre del día<input value={day.name} onChange={(e) => updateDay((d) => ({ ...d, name: e.target.value }))} /></label>
      <div className="section-heading"><h3>Ejercicios ({day.exercises.length})</h3><button className="text-button" onClick={() => setPicker(true)}><Plus size={18} /> Elegir</button></div>
      <div className="routine-exercises">{day.exercises.map((config, i) => <ExerciseConfigRow key={config.exerciseId} exercise={exerciseMap.get(config.exerciseId)} config={config}
        onUpdate={(data) => updateExercise(i, data)} onRemove={() => updateDay((d) => ({ ...d, exercises: d.exercises.filter((_, idx) => idx !== i) }))}
        onMoveUp={() => move(i, -1)} onMoveDown={() => move(i, 1)} isFirst={i === 0} isLast={i === day.exercises.length - 1} validate={validating} />)}</div>
      {!day.exercises.length && <button className="empty-add" onClick={() => setPicker(true)}><Plus size={22} /> Agregar ejercicios a este día</button>}
    </div>
    {picker && <ExercisePicker selectedIds={day.exercises.map((e) => e.exerciseId)} onConfirm={choose} onClose={() => setPicker(false)} />}
  </Sheet>
}
