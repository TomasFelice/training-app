import { useState } from 'react'
import { Plus } from 'lucide-react'
import { db } from '../db'
import Sheet from './Sheet'
import ExerciseBrowser from './ExerciseBrowser'
import ExerciseForm from './ExerciseForm'

export default function ExercisePicker({ selectedIds = [], onConfirm, onClose }) {
  const [selected, setSelected] = useState(new Set(selectedIds))
  const [creating, setCreating] = useState(false)
  function toggle(id) { setSelected((previous) => { const next = new Set(previous); next.has(id) ? next.delete(id) : next.add(id); return next }) }
  async function create(data) {
    const id = await db.exercises.add(data)
    setSelected((previous) => new Set([...previous, id]))
  }
  return <Sheet title="Elegir ejercicios" onClose={onClose} className="browser-sheet"
    footer={<button className="primary-button" onClick={() => onConfirm([...selected])}>Confirmar selección ({selected.size})</button>}>
    <button className="text-button create-exercise" onClick={() => setCreating(true)}><Plus size={18} /> Crear ejercicio</button>
    <ExerciseBrowser selected={selected} onToggle={toggle} />
    {creating && <ExerciseForm onSave={create} onClose={() => setCreating(false)} />}
  </Sheet>
}
