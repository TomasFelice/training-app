import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, Check, Info } from 'lucide-react'
import { db } from '../db'
import { filterExercises, equipmentLabel } from '../lib/catalog'
import ExerciseDetails, { ExerciseThumbnail } from './ExerciseDetails'

export default function ExerciseBrowser({ selected, onToggle, renderActions, showArchived = false }) {
  const [query, setQuery] = useState('')
  const [muscleGroup, setMuscleGroup] = useState('')
  const [equipment, setEquipment] = useState('')
  const [limit, setLimit] = useState(40)
  const [details, setDetails] = useState(null)
  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray(), [], [])
  const filters = { query, muscleGroup, equipment, archived: showArchived }
  const filtered = filterExercises(exercises, filters)
  const groups = useMemo(() => [...new Set(exercises.map((e) => e.muscleGroup))].filter(Boolean).sort(), [exercises])
  const equipments = useMemo(() => [...new Set(exercises.map((e) => e.equipment))].filter(Boolean).sort((a, b) => equipmentLabel(a).localeCompare(equipmentLabel(b))), [exercises])
  function change(setter, value) { setter(value); setLimit(40) }
  return <div className="exercise-browser">
    <div className="browser-filters">
      <label className="search-field"><Search size={19} aria-hidden="true" /><input aria-label="Buscar ejercicio" placeholder="Buscar por nombre, músculo…"
        value={query} onChange={(e) => change(setQuery, e.target.value)} type="search" autoCapitalize="none" /></label>
      <div className="filter-row">
        <select aria-label="Grupo muscular" value={muscleGroup} onChange={(e) => change(setMuscleGroup, e.target.value)}><option value="">Todos los músculos</option>{groups.map((g) => <option key={g}>{g}</option>)}</select>
        <select aria-label="Equipamiento" value={equipment} onChange={(e) => change(setEquipment, e.target.value)}><option value="">Todo el equipo</option>{equipments.map((g) => <option value={g} key={g}>{equipmentLabel(g)}</option>)}</select>
      </div>
      <p className="result-count" role="status">{filtered.length.toLocaleString('es-AR')} ejercicios{selected ? ` · ${selected.size} seleccionados` : ''}</p>
    </div>
    <div className="browser-results scroll-ios">
      {filtered.slice(0, limit).map((exercise) => <div className="exercise-list-row" key={exercise.id}>
        <button className="exercise-list-main" onClick={() => onToggle ? onToggle(exercise.id) : setDetails(exercise)} aria-pressed={selected ? selected.has(exercise.id) : undefined}>
          {selected && <span className={`selection-check ${selected.has(exercise.id) ? 'selected' : ''}`}>{selected.has(exercise.id) && <Check size={16} />}</span>}
          <ExerciseThumbnail exercise={exercise} /><span className="exercise-list-copy"><strong>{exercise.name}</strong><span>{exercise.muscleGroup}{exercise.equipment ? ` · ${equipmentLabel(exercise.equipment)}` : ''}</span>
            {exercise.image && !exercise.photoBase64 && <small>© Gym visual</small>}</span>
        </button>
        {onToggle && <button className="icon-button" aria-label={`Ver ${exercise.name}`} onClick={() => setDetails(exercise)}><Info size={19} /></button>}
        {renderActions?.(exercise)}
      </div>)}
      {!filtered.length && <div className="empty-state"><h3>No encontramos ejercicios</h3><p>Cambiá la búsqueda o los filtros. También podés crear tu propio ejercicio.</p></div>}
      {filtered.length > limit && <button className="secondary-button load-more" onClick={() => setLimit((value) => value + 40)}>Mostrar más ejercicios</button>}
    </div>
    {details && <ExerciseDetails exercise={details} onClose={() => setDetails(null)} />}
  </div>
}
