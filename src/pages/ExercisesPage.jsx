import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, X, Camera, Trash2, Pencil, Check } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

const MUSCLE_GROUPS = [
  'Pecho', 'Espalda', 'Hombros', 'Bíceps',
  'Tríceps', 'Cuádriceps', 'Isquiotibiales', 'Glúteos', 'Core', 'Pantorrillas',
]

const MUSCLE_COLORS = {
  Pecho:          'bg-red-500/20 text-red-400',
  Espalda:        'bg-blue-500/20 text-blue-400',
  Hombros:        'bg-orange-500/20 text-orange-400',
  Bíceps:         'bg-purple-500/20 text-purple-400',
  Tríceps:        'bg-pink-500/20 text-pink-400',
  Cuádriceps:     'bg-green-500/20 text-green-400',
  Isquiotibiales: 'bg-teal-500/20 text-teal-400',
  Glúteos:        'bg-yellow-500/20 text-yellow-400',
  Core:           'bg-gray-500/20 text-gray-400',
  Pantorrillas:   'bg-indigo-500/20 text-indigo-400',
}

// ── Exercise Form ─────────────────────────────────────────────────────────

function ExerciseForm({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [muscleGroup, setMuscleGroup] = useState(initial?.muscleGroup ?? '')
  const [photoPreview, setPhotoPreview] = useState(initial?.photoBase64 ?? null)
  const [photoBase64, setPhotoBase64] = useState(initial?.photoBase64 ?? null)
  const fileRef = useRef(null)

  function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setPhotoBase64(ev.target.result)
      setPhotoPreview(ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    if (!name.trim() || !muscleGroup) return
    await onSave({
      name: name.trim(),
      muscleGroup,
      photoBase64: photoBase64 ?? null,
    })
    onClose()
  }

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 40 }}
      className="fixed inset-x-0 bottom-0 z-50 bg-[#1C1C1E] rounded-t-3xl flex flex-col"
      style={{ maxHeight: '92vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Handle */}
      <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
        <div className="w-10 h-1 bg-[#48484A] rounded-full" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
        <button onClick={onClose} className="pressable text-[#0A84FF] font-medium">Cancelar</button>
        <h2 className="text-white font-semibold">{initial ? 'Editar ejercicio' : 'Nuevo ejercicio'}</h2>
        <button
          onClick={handleSave}
          disabled={!name.trim() || !muscleGroup}
          className="pressable text-[#0A84FF] font-semibold disabled:opacity-30"
        >
          Guardar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scroll-ios px-5 pb-6">
        {/* Photo */}
        <div className="flex justify-center mb-5">
          <button
            onClick={() => fileRef.current?.click()}
            className="pressable relative w-24 h-24 rounded-2xl overflow-hidden bg-[#2C2C2E] flex items-center justify-center"
          >
            {photoPreview ? (
              <>
                <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Camera size={20} className="text-white" />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <Camera size={24} className="text-[#48484A]" />
                <span className="text-[#48484A] text-[10px]">Foto</span>
              </div>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
            className="hidden"
          />
        </div>

        {/* Name */}
        <p className="text-[#8E8E93] text-xs font-semibold uppercase tracking-wider mb-2">Nombre</p>
        <div className="bg-[#2C2C2E] rounded-2xl px-4 py-3 mb-5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Press Banca con Mancuernas"
            className="w-full bg-transparent text-white text-base outline-none placeholder:text-[#48484A]"
            autoFocus
          />
        </div>

        {/* Muscle group */}
        <p className="text-[#8E8E93] text-xs font-semibold uppercase tracking-wider mb-3">
          Grupo muscular
        </p>
        <div className="grid grid-cols-2 gap-2">
          {MUSCLE_GROUPS.map((g) => (
            <button
              key={g}
              onClick={() => setMuscleGroup(g)}
              className={`pressable flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                muscleGroup === g
                  ? 'bg-[#0A84FF] text-white'
                  : 'bg-[#2C2C2E] text-[#8E8E93]'
              }`}
            >
              {muscleGroup === g && <Check size={13} strokeWidth={3} />}
              {g}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ── Exercise Row ──────────────────────────────────────────────────────────

function ExerciseRow({ exercise, onEdit, onDelete }) {
  return (
    <div className="flex items-center gap-3 bg-[#1C1C1E] rounded-2xl px-4 py-3">
      {/* Photo or placeholder */}
      <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-[#2C2C2E] flex items-center justify-center">
        {exercise.photoBase64 ? (
          <img src={exercise.photoBase64} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className={`text-[10px] font-bold ${MUSCLE_COLORS[exercise.muscleGroup]?.split(' ')[1] ?? 'text-[#8E8E93]'}`}>
            {exercise.name.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{exercise.name}</p>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
          MUSCLE_COLORS[exercise.muscleGroup] ?? 'bg-gray-500/20 text-gray-400'
        }`}>
          {exercise.muscleGroup}
        </span>
      </div>

      <button onClick={onEdit} className="pressable w-8 h-8 flex items-center justify-center">
        <Pencil size={14} className="text-[#0A84FF]" />
      </button>
      <button onClick={onDelete} className="pressable w-8 h-8 flex items-center justify-center">
        <Trash2 size={14} className="text-[#FF453A]" />
      </button>
    </div>
  )
}

// ── Exercises Tab (used in Routines page) ─────────────────────────────────

export default function ExercisesTab() {
  const [query, setQuery] = useState('')
  const [formState, setFormState] = useState(null) // null | { mode, exercise? }

  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray(), [])

  const filtered = exercises?.filter((e) =>
    e.name.toLowerCase().includes(query.toLowerCase())
  ) ?? []

  async function handleSave({ name, muscleGroup, photoBase64 }) {
    if (formState?.mode === 'edit') {
      await db.exercises.update(formState.exercise.id, { name, muscleGroup, photoBase64 })
    } else {
      await db.exercises.add({ name, muscleGroup, photoBase64 })
    }
  }

  async function handleDelete(id) {
    await db.exercises.delete(id)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Search + add */}
      <div className="px-5 pb-3 flex gap-2 flex-shrink-0">
        <div className="flex-1 flex items-center gap-3 bg-[#1C1C1E] rounded-xl px-3 py-2.5">
          <Search size={15} className="text-[#8E8E93] flex-shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar ejercicio…"
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-[#48484A]"
          />
          {query && (
            <button onClick={() => setQuery('')} className="pressable">
              <X size={13} className="text-[#8E8E93]" />
            </button>
          )}
        </div>
        <button
          onClick={() => setFormState({ mode: 'create' })}
          className="pressable w-10 h-10 bg-[#0A84FF] rounded-xl flex items-center justify-center flex-shrink-0"
        >
          <Plus size={18} className="text-white" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scroll-ios px-5 pb-6">
        <div className="flex flex-col gap-2">
          {filtered.map((ex) => (
            <ExerciseRow
              key={ex.id}
              exercise={ex}
              onEdit={() => setFormState({ mode: 'edit', exercise: ex })}
              onDelete={() => handleDelete(ex.id)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center gap-3 pt-16">
              <p className="text-[#8E8E93] text-sm">
                {query ? 'Sin resultados' : 'No hay ejercicios creados'}
              </p>
              {!query && (
                <button
                  onClick={() => setFormState({ mode: 'create' })}
                  className="pressable text-[#0A84FF] text-sm font-medium"
                >
                  Crear ejercicio
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Exercise form */}
      <AnimatePresence>
        {formState && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[49] bg-black/60"
              onClick={() => setFormState(null)}
            />
            <ExerciseForm
              initial={formState.mode === 'edit' ? formState.exercise : null}
              onSave={handleSave}
              onClose={() => setFormState(null)}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
