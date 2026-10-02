import { Check, Trash2 } from 'lucide-react'
import { useWeightUnit } from '../hooks/useWeightUnit'
import { positiveInteger } from '../lib/routineTemplates'

export default function SetRow({ index, set, prevSet, onUpdate, onRemove, onDone, onUndo }) {
  const { unit, display, toKg } = useWeightUnit()
  const weight = set.weightDraft != null && (!set.weightDraftUnit || set.weightDraftUnit === unit) ? set.weightDraft : set.weight != null ? String(display(set.weight)) : ''
  const reps = set.repsDraft ?? (set.reps == null ? '' : String(set.reps))
  const normalizedWeight = weight.replace(',', '.')
  const validWeight = weight === '' || (/^(\d+([.,]\d*)?|[.,]\d+)$/.test(weight) && Number.isFinite(Number(normalizedWeight)))
  const validReps = positiveInteger(reps)
  function editWeight(value) {
    const normalized = value.replace(',', '.')
    onUpdate({ weightDraft: value, weightDraftUnit: unit, weight: value === '' ? null : Number.isFinite(Number(normalized)) && Number(normalized) >= 0 ? toKg(normalized) : null })
  }
  function editReps(value) { onUpdate({ repsDraft: value, reps: positiveInteger(value) ? Number(value) : null }) }
  return <div className={`set-row ${set.done ? 'set-done' : ''}`}>
    <div className="set-inputs">
      <span className="set-number">{index + 1}</span>
      <label className="set-field"><span>Peso ({unit})</span><input aria-label={`Peso de serie ${index + 1}`} type="text" inputMode="decimal" value={weight} onChange={(e) => editWeight(e.target.value)} disabled={set.done} placeholder="0" aria-invalid={!validWeight || undefined} /></label>
      <label className="set-field"><span>Reps</span><input aria-label={`Repeticiones de serie ${index + 1}`} type="text" inputMode="numeric" value={reps} onChange={(e) => editReps(e.target.value)} disabled={set.done} placeholder="0" aria-invalid={reps !== '' && !validReps || undefined} /></label>
      <button className={`icon-button complete-set ${set.done ? 'selected' : ''}`} aria-label={`${set.done ? 'Desmarcar' : 'Completar'} serie ${index + 1}`}
        aria-pressed={set.done} disabled={!set.done && (!validWeight || !validReps)} onClick={() => set.done ? onUndo() : onDone({ weight: set.weight ?? 0, reps: Number(reps) })}><Check size={21} /></button>
    </div>
    <div className="set-meta"><span>{prevSet ? `Anterior: ${display(prevSet.weight ?? 0)} ${unit} × ${prevSet.reps}` : 'Sin registro anterior'}{set.rpe != null ? ` · RPE ${set.rpe}` : ''}</span>
      <button className="icon-button remove-set" aria-label={`Quitar serie ${index + 1}`} onClick={onRemove}><Trash2 size={15} /></button></div>
    {(!validWeight || (reps !== '' && !validReps)) && <p className="form-error">Usá un peso positivo o cero y repeticiones enteras mayores que cero.</p>}
  </div>
}
