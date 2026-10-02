import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Play, Pencil, Trash2, ChevronRight, Dumbbell } from 'lucide-react'
import { db, getRoutineExerciseCount } from '../db'
import { useWorkoutStore, useUIStore, useSettingsStore } from '../store'
import { ROUTINE_TEMPLATES, resolveTemplate, templateReps } from '../lib/routineTemplates'
import RoutineEditor from '../components/RoutineEditor'
import Sheet from '../components/Sheet'
import ExercisesTab from './ExercisesPage'

export default function RoutinesPage() {
  const routines = useLiveQuery(() => db.routines.toArray(), [], [])
  const { routinesSection: tab, setRoutinesSection: setTab } = useUIStore()
  const [editor, setEditor] = useState(null)
  const [preview, setPreview] = useState(null)
  const [dayPicker, setDayPicker] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { activeWorkout, startWorkout } = useWorkoutStore()
  const { setActiveTab } = useUIStore()
  const { defaultRestSeconds } = useSettingsStore()
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], [])
  const catalog = new Map(exercises.map((e) => [e.catalogId, e]))
  async function save(data) {
    if (editor.initial?.id) await db.routines.update(editor.initial.id, data)
    else await db.routines.add(data)
    setTab('mine')
  }
  async function useTemplate() {
    setLoading(true)
    try { const initial = await resolveTemplate(preview); setEditor({ initial }); setPreview(null) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }
  function start(routine, dayIndex = null) {
    if (activeWorkout) { setActiveTab('session'); return }
    if (dayIndex == null && routine.trainingDays.length > 1) { setDayPicker(routine); return }
    if (startWorkout(routine, dayIndex ?? 0, defaultRestSeconds)) { setDayPicker(null); setActiveTab('session') }
    else setError('Este día no tiene ejercicios. Editá la rutina antes de entrenar.')
  }
  async function remove() {
    try { await db.routines.delete(deleting.id); setDeleting(null) }
    catch { setError('No se pudo eliminar la rutina. Volvé a intentar.') }
  }
  return <div className="page routines-page">
    <header className="page-header"><div><p className="muted">Tu plan de entrenamiento</p><h1>Rutinas</h1></div><button className="icon-button accent-button" aria-label="Nueva rutina" onClick={() => setEditor({})}><Plus size={24} /></button></header>
    <div className="segmented-control" aria-label="Secciones de rutinas">{[['mine', 'Mis rutinas'], ['library', 'Biblioteca'], ['exercises', 'Ejercicios']].map(([id, label]) => <button key={id} aria-pressed={tab === id} className={tab === id ? 'selected' : ''} onClick={() => { setTab(id); setError('') }}>{label}</button>)}</div>
    {error && <p role="alert" className="form-error page-message">{error}</p>}
    {tab === 'exercises' ? <ExercisesTab /> : <div className="page-scroll scroll-ios">
      {tab === 'mine' ? <>
        {!routines.length && <div className="empty-state routine-empty"><Dumbbell size={36} /><h2>Tu primera rutina empieza acá</h2><p>Elegí un plan de la biblioteca y adaptalo a vos, o armá uno desde cero.</p><button className="primary-button" onClick={() => setTab('library')}>Explorar biblioteca</button><button className="text-button" onClick={() => setEditor({})}>Crear desde cero</button></div>}
        <div className="routine-list">{routines.map((routine) => <article className="routine-card" key={routine.id}>
          <div className="routine-card-heading"><h2>{routine.name}</h2><span>{routine.trainingDays.length} {routine.trainingDays.length === 1 ? 'día' : 'días'}</span></div>
          <p className="muted">{getRoutineExerciseCount(routine)} ejercicios{routine.scheduledDays.length ? ` · ${routine.scheduledDays.join(', ')}` : ''}</p>
          <div className="routine-day-preview">{routine.trainingDays.map((d, i) => <span key={i}>{d.name}</span>)}</div>
          <div className="routine-card-actions"><button className="primary-button" onClick={() => start(routine)}><Play size={17} /> {activeWorkout ? 'Retomar' : 'Entrenar'}</button>
            <button className="icon-button" aria-label={`Editar ${routine.name}`} onClick={() => setEditor({ initial: routine })}><Pencil size={19} /></button><button className="icon-button danger-text" aria-label={`Eliminar ${routine.name}`} onClick={() => setDeleting(routine)}><Trash2 size={18} /></button></div>
        </article>)}</div>
      </> : <>
        <div className="library-intro"><h2>Un punto de partida</h2><p className="muted">Planes listos para copiar. Vos elegís los días, las cargas y los cambios.</p></div>
        <div className="template-list">{ROUTINE_TEMPLATES.map((template) => <button className="template-card" onClick={() => { setPreview(template); setError('') }} key={template.id}>
          <div><span className="template-level">{template.level}</span><h2>{template.name}</h2><p>{template.goal}</p><span className="template-frequency">{template.frequency}</span><small>{template.equipment}</small></div><ChevronRight size={21} />
        </button>)}</div>
      </>}
    </div>}
    {editor && <RoutineEditor initial={editor.initial} onSave={save} onClose={() => setEditor(null)} />}
    {preview && <Sheet title={preview.name} onClose={() => setPreview(null)} footer={<button className="primary-button" onClick={useTemplate} disabled={loading}>{loading ? 'Preparando…' : 'Usar rutina'}</button>}>
      <p className="muted">{preview.frequency} · {preview.level}</p><p className="template-note">{preview.note}</p>{error && <p className="form-error" role="alert">{error}</p>}
      {preview.days.map((d) => <section className="template-day" key={d.name}><h3>{d.name}</h3><ul>{d.catalogIds.map((id) => <li key={id}><span>{catalog.get(id)?.name ?? id}</span><strong>3 × {templateReps(id)}</strong></li>)}</ul></section>)}
    </Sheet>}
    {dayPicker && <Sheet title="¿Qué día entrenás?" onClose={() => setDayPicker(null)}>{dayPicker.trainingDays.map((d, i) => <button className="day-picker-button" key={i} onClick={() => start(dayPicker, i)}><span><strong>{d.name}</strong><small>{d.exercises.length} ejercicios</small></span><ChevronRight size={20} /></button>)}</Sheet>}
    {deleting && <Sheet title="¿Eliminar rutina?" onClose={() => setDeleting(null)} footer={<button className="danger-button" onClick={remove}>Eliminar rutina</button>}><p>Se eliminará “{deleting.name}”. Tus entrenamientos registrados se conservan.</p></Sheet>}
  </div>
}
