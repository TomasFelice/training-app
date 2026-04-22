import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, ChevronRight, Trash2, Pencil, X, Check, Dumbbell,
  ArrowUp, ArrowDown, ChevronDown,
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getRoutineExerciseCount, getRoutineExerciseIds } from '../db'
import { useWorkoutStore, useUIStore, useSettingsStore } from '../store'
import ExercisePicker from '../components/ExercisePicker'
import ExercisesTab from './ExercisesPage'

const WEEK_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// ── Exercise Config Row ───────────────────────────────────────────────────
// Shows an exercise inside the routine editor with sets/reps inputs and reorder

function ExerciseConfigRow({ exercise, config, onUpdate, onRemove, onMoveUp, onMoveDown, isFirst, isLast }) {
  return (
    <div className="flex items-center gap-2 bg-[#2C2C2E] rounded-2xl px-3 py-2.5">
      {/* Reorder arrows */}
      <div className="flex flex-col gap-0.5 flex-shrink-0">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className="pressable w-6 h-5 flex items-center justify-center disabled:opacity-20"
        >
          <ArrowUp size={11} className="text-[#8E8E93]" />
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className="pressable w-6 h-5 flex items-center justify-center disabled:opacity-20"
        >
          <ArrowDown size={11} className="text-[#8E8E93]" />
        </button>
      </div>

      {/* Name + muscle group */}
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{exercise?.name ?? '…'}</p>
        <p className="text-[#8E8E93] text-[10px]">{exercise?.muscleGroup}</p>
      </div>

      {/* Sets input */}
      <div className="flex flex-col items-center gap-0.5">
        <input
          type="number"
          inputMode="numeric"
          value={config.sets}
          onChange={(e) => onUpdate({ sets: Math.max(1, Number(e.target.value) || 1) })}
          className="w-10 bg-[#3A3A3C] rounded-lg text-white text-xs font-semibold text-center py-1 outline-none"
        />
        <span className="text-[#48484A] text-[9px]">series</span>
      </div>

      <span className="text-[#48484A] text-xs">×</span>

      {/* Reps input */}
      <div className="flex flex-col items-center gap-0.5">
        <input
          type="number"
          inputMode="numeric"
          value={config.reps}
          onChange={(e) => onUpdate({ reps: Math.max(1, Number(e.target.value) || 1) })}
          className="w-10 bg-[#3A3A3C] rounded-lg text-white text-xs font-semibold text-center py-1 outline-none"
        />
        <span className="text-[#48484A] text-[9px]">reps</span>
      </div>

      {/* Delete */}
      <button onClick={onRemove} className="pressable ml-1 flex-shrink-0">
        <X size={14} className="text-[#FF453A]" />
      </button>
    </div>
  )
}

// ── Routine Editor ────────────────────────────────────────────────────────
// Full-featured bottom sheet for creating/editing routines

function RoutineEditor({ initial, onSave, onClose }) {
  const defaultDay = { name: 'Día 1', exercises: [] }

  const [name, setName] = useState(initial?.name ?? '')
  const [scheduledDays, setScheduledDays] = useState(new Set(initial?.scheduledDays ?? []))
  const [trainingDays, setTrainingDays] = useState(
    initial?.trainingDays?.length ? initial.trainingDays : [{ ...defaultDay }]
  )
  const [activeDayIdx, setActiveDayIdx] = useState(0)
  const [showPicker, setShowPicker] = useState(false)

  // Collect all exerciseIds across all days for the ExercisePicker "already selected" context
  const allSelectedIds = trainingDays.flatMap((d) => d.exercises.map((e) => e.exerciseId))

  // Load exercise objects for the current day
  const currentDayExIds = trainingDays[activeDayIdx]?.exercises.map((e) => e.exerciseId) ?? []
  const exercises = useLiveQuery(
    () => currentDayExIds.length ? db.exercises.bulkGet(currentDayExIds) : Promise.resolve([]),
    [JSON.stringify(currentDayExIds)]
  )
  const exMap = Object.fromEntries((exercises ?? []).filter(Boolean).map((e) => [e.id, e]))

  function toggleScheduledDay(d) {
    setScheduledDays((prev) => {
      const next = new Set(prev)
      next.has(d) ? next.delete(d) : next.add(d)
      return next
    })
  }

  function updateCurrentDay(updater) {
    setTrainingDays((prev) => {
      const next = [...prev]
      next[activeDayIdx] = updater(next[activeDayIdx])
      return next
    })
  }

  function addTrainingDay() {
    const n = trainingDays.length + 1
    setTrainingDays((prev) => [...prev, { name: `Día ${n}`, exercises: [] }])
    setActiveDayIdx(trainingDays.length)
  }

  function removeTrainingDay(idx) {
    if (trainingDays.length <= 1) return
    setTrainingDays((prev) => prev.filter((_, i) => i !== idx))
    setActiveDayIdx((prev) => Math.min(prev, trainingDays.length - 2))
  }

  function addExercises(ids) {
    updateCurrentDay((day) => {
      const existing = new Set(day.exercises.map((e) => e.exerciseId))
      const newOnes = ids.filter((id) => !existing.has(id)).map((id) => ({ exerciseId: id, sets: 3, reps: 10 }))
      return { ...day, exercises: [...day.exercises, ...newOnes] }
    })
    setShowPicker(false)
  }

  function removeExercise(exIdx) {
    updateCurrentDay((day) => ({
      ...day,
      exercises: day.exercises.filter((_, i) => i !== exIdx),
    }))
  }

  function updateExercise(exIdx, patch) {
    updateCurrentDay((day) => {
      const exercises = [...day.exercises]
      exercises[exIdx] = { ...exercises[exIdx], ...patch }
      return { ...day, exercises }
    })
  }

  function moveExercise(exIdx, dir) {
    updateCurrentDay((day) => {
      const exs = [...day.exercises]
      const swapIdx = exIdx + dir
      if (swapIdx < 0 || swapIdx >= exs.length) return day
      ;[exs[exIdx], exs[swapIdx]] = [exs[swapIdx], exs[exIdx]]
      return { ...day, exercises: exs }
    })
  }

  async function handleSave() {
    if (!name.trim()) return
    await onSave({
      name: name.trim(),
      scheduledDays: [...scheduledDays],
      trainingDays,
    })
    onClose()
  }

  const currentDay = trainingDays[activeDayIdx] ?? defaultDay

  return (
    <>
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 40 }}
        className="fixed inset-x-0 bottom-0 z-40 bg-[#1C1C1E] rounded-t-3xl flex flex-col"
        style={{ maxHeight: '96vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
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
              placeholder="Nombre de la rutina (ej. Push/Pull/Legs)"
              className="w-full bg-transparent text-white text-base outline-none placeholder:text-[#48484A]"
              autoFocus
            />
          </div>

          {/* Scheduled days */}
          <p className="text-[#8E8E93] text-xs font-semibold uppercase tracking-wider mb-3">
            Días de entrenamiento
          </p>
          <div className="flex gap-2 mb-6">
            {WEEK_DAYS.map((d) => (
              <button
                key={d}
                onClick={() => toggleScheduledDay(d)}
                className={`pressable flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                  scheduledDays.has(d)
                    ? 'bg-[#0A84FF] text-white'
                    : 'bg-[#2C2C2E] text-[#8E8E93]'
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          {/* Training days tabs */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-[#8E8E93] text-xs font-semibold uppercase tracking-wider">
              Días de entrenamiento
            </p>
            <button
              onClick={addTrainingDay}
              className="pressable flex items-center gap-1 text-[#0A84FF] text-xs font-medium"
            >
              <Plus size={13} /> Agregar día
            </button>
          </div>

          {/* Day tabs */}
          <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide pb-1">
            {trainingDays.map((day, idx) => (
              <div key={idx} className="flex-shrink-0 flex items-center gap-1">
                <button
                  onClick={() => setActiveDayIdx(idx)}
                  className={`pressable px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    activeDayIdx === idx
                      ? 'bg-[#0A84FF] text-white'
                      : 'bg-[#2C2C2E] text-[#8E8E93]'
                  }`}
                >
                  {day.name}
                </button>
                {trainingDays.length > 1 && (
                  <button
                    onClick={() => removeTrainingDay(idx)}
                    className="pressable w-5 h-5 flex items-center justify-center"
                  >
                    <X size={10} className="text-[#FF453A]" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Current day name */}
          <div className="bg-[#2C2C2E] rounded-2xl px-4 py-2.5 mb-4 flex items-center gap-2">
            <span className="text-[#8E8E93] text-xs">Nombre del día:</span>
            <input
              value={currentDay.name}
              onChange={(e) => updateCurrentDay((d) => ({ ...d, name: e.target.value }))}
              className="flex-1 bg-transparent text-white text-sm outline-none"
            />
          </div>

          {/* Exercises for current day */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-[#8E8E93] text-xs font-semibold uppercase tracking-wider">
              Ejercicios ({currentDay.exercises.length})
            </p>
            <button
              onClick={() => setShowPicker(true)}
              className="pressable flex items-center gap-1 text-[#0A84FF] text-sm font-medium"
            >
              <Plus size={15} /> Agregar
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {currentDay.exercises.map((ex, i) => (
              <ExerciseConfigRow
                key={`${ex.exerciseId}-${i}`}
                exercise={exMap[ex.exerciseId]}
                config={ex}
                onUpdate={(patch) => updateExercise(i, patch)}
                onRemove={() => removeExercise(i)}
                onMoveUp={() => moveExercise(i, -1)}
                onMoveDown={() => moveExercise(i, 1)}
                isFirst={i === 0}
                isLast={i === currentDay.exercises.length - 1}
              />
            ))}
            {currentDay.exercises.length === 0 && (
              <button
                onClick={() => setShowPicker(true)}
                className="pressable flex items-center justify-center gap-2 bg-[#2C2C2E] rounded-2xl px-4 py-5 border-2 border-dashed border-[#3A3A3C]"
              >
                <Plus size={18} className="text-[#48484A]" />
                <span className="text-[#48484A] text-sm">Agregar ejercicios a este día</span>
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
              selectedIds={currentDay.exercises.map((e) => e.exerciseId)}
              onConfirm={addExercises}
              onClose={() => setShowPicker(false)}
            />
          </>
        )}
      </AnimatePresence>
    </>
  )
}

// ── Day Picker (for multi-day routines) ───────────────────────────────────

function DayPickerSheet({ routine, onSelect, onClose }) {
  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 40 }}
      className="fixed inset-x-0 bottom-0 z-40 bg-[#1C1C1E] rounded-t-3xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 bg-[#48484A] rounded-full" />
      </div>
      <div className="flex items-center justify-between px-5 py-3">
        <button onClick={onClose} className="pressable text-[#0A84FF] font-medium">Cancelar</button>
        <h2 className="text-white font-semibold">¿Qué día entrenás?</h2>
        <div className="w-16" />
      </div>
      <div className="px-5 pb-6 flex flex-col gap-2">
        {routine.trainingDays.map((day, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(idx)}
            className="pressable flex items-center justify-between bg-[#2C2C2E] rounded-2xl px-4 py-4"
          >
            <div className="text-left">
              <p className="text-white font-semibold text-sm">{day.name}</p>
              <p className="text-[#8E8E93] text-xs mt-0.5">
                {day.exercises.length} ejercicios
              </p>
            </div>
            <ChevronRight size={18} className="text-[#48484A]" />
          </button>
        ))}
      </div>
    </motion.div>
  )
}

// ── Routine Card ─────────────────────────────────────────────────────────

function RoutineCard({ routine, onEdit, onDelete, onStart }) {
  const exIds = getRoutineExerciseIds(routine)
  const exercises = useLiveQuery(
    () => exIds.length ? db.exercises.bulkGet(exIds) : Promise.resolve([]),
    [JSON.stringify(exIds)]
  )

  const totalExercises = getRoutineExerciseCount(routine)
  const dayCount = routine.trainingDays?.length ?? 1

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
            {totalExercises} ejercicios · {dayCount} {dayCount === 1 ? 'día' : 'días'}
            {routine.scheduledDays?.length > 0 && ` · ${routine.scheduledDays.join(', ')}`}
          </p>
        </div>
        <ChevronRight size={18} className="text-[#48484A] flex-shrink-0" />
      </button>

      {/* Exercise preview (from day 1) */}
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

      {/* Actions */}
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

// ── Main Routines Page ────────────────────────────────────────────────────

export default function RoutinesPage() {
  const [activeTab, setActiveTab] = useState('routines') // 'routines' | 'exercises'
  const [editorState, setEditorState] = useState(null)   // null | { mode, routine }
  const [dayPicker, setDayPicker] = useState(null)        // null | routine
  const { startWorkout } = useWorkoutStore()
  const { defaultRestSeconds } = useSettingsStore()
  const { setActiveTab: setAppTab } = useUIStore()

  const routines = useLiveQuery(() => db.routines.toArray(), [])

  async function handleSave({ name, scheduledDays, trainingDays }) {
    if (editorState?.mode === 'edit') {
      await db.routines.update(editorState.routine.id, { name, scheduledDays, trainingDays })
    } else {
      await db.routines.add({ name, scheduledDays, trainingDays })
    }
  }

  async function handleDelete(id) {
    await db.routines.delete(id)
  }

  function handleStartRoutine(routine) {
    const days = routine.trainingDays ?? []
    if (days.length > 1) {
      setDayPicker(routine)
    } else {
      startWorkout(routine, 0, defaultRestSeconds)
      setAppTab('session')
    }
  }

  function handleDaySelected(dayIdx) {
    startWorkout(dayPicker, dayIdx, defaultRestSeconds)
    setDayPicker(null)
    setAppTab('session')
  }

  return (
    <div className="flex flex-col h-full bg-black">
      <div style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)' }} />

      {/* Header */}
      <div className="px-5 pb-3 flex items-center justify-between flex-shrink-0">
        <h1 className="text-white text-2xl font-bold tracking-tight">
          {activeTab === 'routines' ? 'Rutinas' : 'Ejercicios'}
        </h1>
        {activeTab === 'routines' && (
          <button
            onClick={() => setEditorState({ mode: 'create', routine: null })}
            className="pressable w-9 h-9 bg-[#0A84FF] rounded-full flex items-center justify-center"
          >
            <Plus size={20} className="text-white" />
          </button>
        )}
      </div>

      {/* Internal tab bar */}
      <div className="flex gap-0 mx-5 mb-4 bg-[#1C1C1E] rounded-xl p-1 flex-shrink-0">
        {[
          { id: 'routines', label: 'Rutinas' },
          { id: 'exercises', label: 'Ejercicios' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pressable flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === tab.id ? 'bg-[#2C2C2E] text-white' : 'text-[#8E8E93]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'routines' ? (
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
                onClick={() => setEditorState({ mode: 'create', routine: null })}
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
                onEdit={() => setEditorState({ mode: 'edit', routine })}
                onDelete={() => handleDelete(routine.id)}
                onStart={() => handleStartRoutine(routine)}
              />
            ))}
          </div>
        </div>
      ) : (
        <ExercisesTab />
      )}

      {/* Routine editor modal */}
      <AnimatePresence>
        {editorState && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 bg-black/60"
              onClick={() => setEditorState(null)}
            />
            <RoutineEditor
              initial={editorState.mode === 'edit' ? editorState.routine : null}
              onSave={handleSave}
              onClose={() => setEditorState(null)}
            />
          </>
        )}
      </AnimatePresence>

      {/* Day picker for multi-day routines */}
      <AnimatePresence>
        {dayPicker && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 bg-black/60"
              onClick={() => setDayPicker(null)}
            />
            <DayPickerSheet
              routine={dayPicker}
              onSelect={handleDaySelected}
              onClose={() => setDayPicker(null)}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
