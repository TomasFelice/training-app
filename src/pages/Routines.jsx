import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, ChevronRight, Trash2, Pencil, X, Check, Dumbbell } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useWorkoutStore, useUIStore, useSettingsStore } from '../store'
import ExercisePicker from '../components/ExercisePicker'

const WEEK_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// ── Routine Form (create / edit) ──────────────────────────────────────────

function RoutineForm({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [days, setDays] = useState(new Set(initial?.days ?? []))
  const [exerciseIds, setExerciseIds] = useState(initial?.exerciseIds ?? [])
  const [showPicker, setShowPicker] = useState(false)

  const exercises = useLiveQuery(
    () => exerciseIds.length ? db.exercises.bulkGet(exerciseIds) : Promise.resolve([]),
    [exerciseIds]
  )

  function toggleDay(d) {
    setDays((prev) => {
      const next = new Set(prev)
      next.has(d) ? next.delete(d) : next.add(d)
      return next
    })
  }

  async function handleSave() {
    if (!name.trim()) return
    await onSave({ name: name.trim(), days: [...days], exerciseIds })
    onClose()
  }

  return (
    <>
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 40 }}
        className="fixed inset-x-0 bottom-0 z-40 bg-[#1C1C1E] rounded-t-3xl flex flex-col"
        style={{ maxHeight: '92vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-[#48484A] rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
          <button onClick={onClose} className="pressable text-[#0A84FF] font-medium">Cancelar</button>
          <h2 className="text-white font-semibold">{initial ? 'Editar rutina' : 'Nueva rutina'}</h2>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="pressable text-[#0A84FF] font-semibold disabled:opacity-30"
          >
            Guardar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scroll-ios px-5 pb-6">
          {/* Name */}
          <div className="bg-[#2C2C2E] rounded-2xl px-4 py-3 mb-5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de la rutina (ej. Push)"
              className="w-full bg-transparent text-white text-base outline-none placeholder:text-[#48484A]"
              autoFocus
            />
          </div>

          {/* Days */}
          <p className="text-[#8E8E93] text-xs font-semibold uppercase tracking-wider mb-3">
            Días de entrenamiento
          </p>
          <div className="flex gap-2 mb-6">
            {WEEK_DAYS.map((d) => (
              <button
                key={d}
                onClick={() => toggleDay(d)}
                className={`pressable flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                  days.has(d)
                    ? 'bg-[#0A84FF] text-white'
                    : 'bg-[#2C2C2E] text-[#8E8E93]'
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          {/* Exercises */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-[#8E8E93] text-xs font-semibold uppercase tracking-wider">
              Ejercicios ({exerciseIds.length})
            </p>
            <button
              onClick={() => setShowPicker(true)}
              className="pressable flex items-center gap-1 text-[#0A84FF] text-sm font-medium"
            >
              <Plus size={15} /> Agregar
            </button>
          </div>

          <div className="flex flex-col gap-1">
            {exercises?.filter(Boolean).map((ex, i) => (
              <div key={ex.id} className="flex items-center gap-3 bg-[#2C2C2E] rounded-2xl px-4 py-3">
                <span className="w-5 h-5 bg-[#3A3A3C] rounded-full flex items-center justify-center text-[10px] text-[#8E8E93] font-bold flex-shrink-0">
                  {i + 1}
                </span>
                <span className="flex-1 text-white text-sm">{ex.name}</span>
                <span className="text-[#8E8E93] text-xs">{ex.muscleGroup}</span>
                <button
                  onClick={() => setExerciseIds((prev) => prev.filter((id) => id !== ex.id))}
                  className="pressable ml-1"
                >
                  <X size={14} className="text-[#48484A]" />
                </button>
              </div>
            ))}
            {exerciseIds.length === 0 && (
              <button
                onClick={() => setShowPicker(true)}
                className="pressable flex items-center justify-center gap-2 bg-[#2C2C2E] rounded-2xl px-4 py-5 border-2 border-dashed border-[#3A3A3C]"
              >
                <Plus size={18} className="text-[#48484A]" />
                <span className="text-[#48484A] text-sm">Agregar ejercicios</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showPicker && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[49] bg-black/60"
              onClick={() => setShowPicker(false)}
            />
            <ExercisePicker
              selectedIds={exerciseIds}
              onConfirm={(ids) => { setExerciseIds(ids); setShowPicker(false) }}
              onClose={() => setShowPicker(false)}
            />
          </>
        )}
      </AnimatePresence>
    </>
  )
}

// ── Main Routines Page ────────────────────────────────────────────────────

export default function RoutinesPage() {
  const [formState, setFormState] = useState(null) // null | { mode: 'create' | 'edit', routine }
  const { startWorkout } = useWorkoutStore()
  const { defaultRestSeconds } = useSettingsStore()
  const { setActiveTab } = useUIStore()

  const routines = useLiveQuery(() => db.routines.toArray(), [])

  async function handleSave({ name, days, exerciseIds }) {
    if (formState?.mode === 'edit') {
      await db.routines.update(formState.routine.id, { name, days, exerciseIds })
    } else {
      await db.routines.add({ name, days, exerciseIds })
    }
  }

  async function handleDelete(id) {
    await db.routines.delete(id)
  }

  function handleStart(routine) {
    startWorkout(routine, defaultRestSeconds)
    setActiveTab('session')
  }

  return (
    <div className="flex flex-col h-full bg-black">
      <div style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)' }} />

      {/* Header */}
      <div className="px-5 pb-4 flex items-center justify-between flex-shrink-0">
        <h1 className="text-white text-2xl font-bold tracking-tight">Rutinas</h1>
        <button
          onClick={() => setFormState({ mode: 'create', routine: null })}
          className="pressable w-9 h-9 bg-[#0A84FF] rounded-full flex items-center justify-center"
        >
          <Plus size={20} className="text-white" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scroll-ios px-5 pb-6">
        {routines?.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 pt-20">
            <div className="w-20 h-20 bg-[#1C1C1E] rounded-3xl flex items-center justify-center">
              <Dumbbell size={32} className="text-[#48484A]" />
            </div>
            <div className="text-center">
              <p className="text-white font-semibold text-lg">Sin rutinas</p>
              <p className="text-[#8E8E93] text-sm mt-1">Creá tu primera rutina para empezar</p>
            </div>
            <button
              onClick={() => setFormState({ mode: 'create', routine: null })}
              className="pressable bg-[#0A84FF] px-6 py-3 rounded-2xl text-white font-semibold text-sm mt-2"
            >
              Crear rutina
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {routines?.map((routine) => (
            <RoutineCard
              key={routine.id}
              routine={routine}
              onEdit={() => setFormState({ mode: 'edit', routine })}
              onDelete={() => handleDelete(routine.id)}
              onStart={() => handleStart(routine)}
            />
          ))}
        </div>
      </div>

      {/* Form modal */}
      <AnimatePresence>
        {formState && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 bg-black/60"
              onClick={() => setFormState(null)}
            />
            <RoutineForm
              initial={formState.mode === 'edit' ? formState.routine : null}
              onSave={handleSave}
              onClose={() => setFormState(null)}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Routine Card ─────────────────────────────────────────────────────────

function RoutineCard({ routine, onEdit, onDelete, onStart }) {
  const [showActions, setShowActions] = useState(false)

  const exercises = useLiveQuery(
    () => routine.exerciseIds?.length
      ? db.exercises.bulkGet(routine.exerciseIds)
      : Promise.resolve([]),
    [routine.exerciseIds]
  )

  return (
    <div className="bg-[#1C1C1E] rounded-2xl overflow-hidden">
      <button
        onClick={onStart}
        className="pressable w-full px-4 py-4 flex items-center gap-4 text-left"
      >
        <div className="w-12 h-12 bg-[#0A84FF]/15 rounded-xl flex items-center justify-center flex-shrink-0">
          <Dumbbell size={22} className="text-[#0A84FF]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-base">{routine.name}</p>
          <p className="text-[#8E8E93] text-xs mt-0.5 truncate">
            {routine.exerciseIds?.length ?? 0} ejercicios
            {routine.days?.length > 0 && ` · ${routine.days.join(', ')}`}
          </p>
        </div>
        <ChevronRight size={18} className="text-[#48484A] flex-shrink-0" />
      </button>

      {/* Exercise preview */}
      {exercises?.filter(Boolean).length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {exercises.filter(Boolean).slice(0, 5).map((ex) => (
            <span
              key={ex.id}
              className="text-[11px] text-[#8E8E93] bg-[#2C2C2E] px-2.5 py-1 rounded-full"
            >
              {ex.name}
            </span>
          ))}
          {exercises.filter(Boolean).length > 5 && (
            <span className="text-[11px] text-[#48484A] bg-[#2C2C2E] px-2.5 py-1 rounded-full">
              +{exercises.filter(Boolean).length - 5}
            </span>
          )}
        </div>
      )}

      {/* Actions row */}
      <div className="flex border-t border-[#2C2C2E]">
        <button
          onClick={onEdit}
          className="pressable flex-1 flex items-center justify-center gap-1.5 py-3 text-[#0A84FF] text-sm font-medium"
        >
          <Pencil size={14} /> Editar
        </button>
        <div className="w-px bg-[#2C2C2E]" />
        <button
          onClick={onDelete}
          className="pressable flex-1 flex items-center justify-center gap-1.5 py-3 text-[#FF453A] text-sm font-medium"
        >
          <Trash2 size={14} /> Eliminar
        </button>
      </div>
    </div>
  )
}
