import { useState } from 'react'
import { Camera } from 'lucide-react'
import Sheet from './Sheet'
import { MUSCLE_GROUPS } from '../lib/catalog'

export default function ExerciseForm({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [muscleGroup, setMuscleGroup] = useState(initial?.muscleGroup ?? 'Pecho')
  const [photoBase64, setPhoto] = useState(initial?.photoBase64 ?? null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  async function photo(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Elegí una imagen.'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const scale = Math.min(1, 640 / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale)
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
        setPhoto(canvas.toDataURL('image/jpeg', 0.8))
      }
      image.onerror = () => setError('No se pudo leer la imagen. Probá otra.')
      image.src = reader.result
    }
    reader.readAsDataURL(file)
  }
  async function save() {
    if (!name.trim()) { setError('Escribí un nombre para el ejercicio.'); return }
    setSaving(true)
    try { await onSave({ name: name.trim(), muscleGroup, photoBase64 }); onClose() }
    catch { setError('No se pudo guardar. Volvé a intentar.') }
    finally { setSaving(false) }
  }
  return <Sheet title={initial ? 'Editar ejercicio' : 'Nuevo ejercicio'} onClose={onClose}
    footer={<button className="primary-button" disabled={saving} onClick={save}>{saving ? 'Guardando…' : 'Guardar ejercicio'}</button>}>
    <div className="form-stack">
      <label className="photo-picker">{photoBase64 ? <img src={photoBase64} alt="Foto del ejercicio" /> : <Camera size={28} />}<span>Elegir foto</span><input type="file" accept="image/*" onChange={photo} /></label>
      <label className="field-label">Nombre<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Remo con mancuerna" /></label>
      <label className="field-label">Grupo muscular<select value={muscleGroup} onChange={(e) => setMuscleGroup(e.target.value)}>{MUSCLE_GROUPS.map((g) => <option key={g}>{g}</option>)}</select></label>
      {error && <p role="alert" className="form-error">{error}</p>}
    </div>
  </Sheet>
}
