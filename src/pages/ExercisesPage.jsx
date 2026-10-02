import { useState } from 'react'
import { Plus, Pencil, EyeOff, RotateCcw } from 'lucide-react'
import { db, archiveExercise } from '../db'
import ExerciseBrowser from '../components/ExerciseBrowser'
import ExerciseForm from '../components/ExerciseForm'
import Sheet from '../components/Sheet'

export default function ExercisesTab() {
  const [form, setForm] = useState(null)
  const [hidden, setHidden] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [error, setError] = useState('')
  async function save(data) {
    if (form.exercise) await db.exercises.update(form.exercise.id, data)
    else await db.exercises.add(data)
  }
  async function archive() {
    try { await archiveExercise(confirm.id); setConfirm(null); setError('') }
    catch { setError('No se pudo ocultar. Volvé a intentar.') }
  }
  async function restore(id) {
    try { await db.exercises.update(id, { archived: false }); setError('') }
    catch { setError('No se pudo restaurar. Volvé a intentar.') }
  }
  return <div className="catalog-page">
    <div className="catalog-toolbar"><button className="text-button" onClick={() => setHidden(!hidden)}>{hidden ? 'Ver catálogo' : 'Ver ocultos'}</button>
      <button className="secondary-button" onClick={() => setForm({})}><Plus size={18} /> Crear ejercicio</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <ExerciseBrowser showArchived={hidden} renderActions={(exercise) => <div className="row-actions">
      {hidden ? <button className="icon-button" onClick={() => restore(exercise.id)} aria-label={`Restaurar ${exercise.name}`}><RotateCcw size={18} /></button> : <>
        <button className="icon-button" onClick={() => setForm({ exercise })} aria-label={`Editar ${exercise.name}`}><Pencil size={17} /></button>
        <button className="icon-button" onClick={() => setConfirm(exercise)} aria-label={`Ocultar ${exercise.name}`}><EyeOff size={17} /></button></>}
    </div>} />
    {form && <ExerciseForm initial={form.exercise} onSave={save} onClose={() => setForm(null)} />}
    {confirm && <Sheet title="¿Ocultar ejercicio?" onClose={() => setConfirm(null)} footer={<button className="danger-button" onClick={archive}>Ocultar ejercicio</button>}>
      <p>“{confirm.name}” dejará de aparecer en el catálogo. Sus referencias en rutinas e historial se conservan. Podés restaurarlo desde “Ver ocultos”.</p>
    </Sheet>}
  </div>
}
