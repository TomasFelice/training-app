import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, ChevronDown, ChevronUp, Check, Dumbbell } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getLastSetForExercise } from '../db'
import { useWorkoutStore, useUIStore, useSettingsStore } from '../store'
import { useWeightUnit } from '../hooks/useWeightUnit'
import SetRow from '../components/SetRow'
import RPESelector from '../components/RPESelector'
import RestTimer from '../components/RestTimer'

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ── Exercise Block ─────────────────────────────────────────────────────────

function ExerciseBlock({ exerciseId, workoutSets, prevSets, plannedSets }) {
  const [collapsed, setCollapsed] = useState(false)
  const { addSet, updateSet, removeSet, markSetDone, unmarkSetDone, startRestTimer } = useWorkoutStore()
  const [pendingRPE, setPendingRPE] = useState(null) // { setIndex }

  const exercise = useLiveQuery(() => db.exercises.get(exerciseId), [exerciseId])

  const sets = workoutSets ?? []
  const doneSets = sets.filter((s) => s.done).length
  const allPlannedDone = plannedSets != null && doneSets >= plannedSets && plannedSets > 0

  function handleDone(index, setData) {
    updateSet(exerciseId, index, { ...setData, done: true })
    setPendingRPE({ setIndex: index })
    // Rest timer starts AFTER RPE is dismissed (see handleRPESelect/handleRPESkip)
  }

  function handleRPESelect(rpe) {
    updateSet(exerciseId, pendingRPE.setIndex, { rpe })
    setPendingRPE(null)
    startRestTimer()
  }

  function handleRPESkip() {
    setPendingRPE(null)
    startRestTimer()
  }

  function handleUndo(index) {
    unmarkSetDone(exerciseId, index)
  }

  return (
    <>
      <motion.div
        animate={{
          borderColor: allPlannedDone ? 'rgba(48,209,88,0.4)' : 'transparent',
        }}
        className="rounded-2xl overflow-hidden mb-3 border"
        style={{ backgroundColor: allPlannedDone ? 'rgba(48,209,88,0.06)' : '#1C1C1E' }}
      >
        {/* Exercise header */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="pressable w-full flex items-center gap-3 px-4 py-3.5"
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
            allPlannedDone ? 'bg-[#30D158]/20' : 'bg-[#0A84FF]/15'
          }`}>
            {allPlannedDone
              ? <Check size={16} className="text-[#30D158]" strokeWidth={2.5} />
              : <Dumbbell size={16} className="text-[#0A84FF]" />
            }
          </div>
          <div className="flex-1 text-left">
            <p className={`font-semibold text-sm ${allPlannedDone ? 'text-[#30D158]' : 'text-white'}`}>
              {exercise?.name ?? '…'}
            </p>
            <p className="text-[#8E8E93] text-xs mt-0.5">
              {doneSets}/{sets.length} series
              {plannedSets != null && ` · ${plannedSets} planificadas`}
              {exercise?.muscleGroup && ` · ${exercise.muscleGroup}`}
            </p>
          </div>
          {collapsed
            ? <ChevronDown size={16} className="text-[#48484A]" />
            : <ChevronUp   size={16} className="text-[#48484A]" />
          }
        </button>

        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              {/* Column headers */}
              <div className="flex items-center gap-3 px-4 py-1.5 border-t border-[#2C2C2E]">
                <span className="w-6 text-[#48484A] text-[10px] text-center">Nº</span>
                <span className="w-14 text-[#48484A] text-[10px] text-center">Ant.</span>
                <span className="flex-1 text-[#48484A] text-[10px] text-center">Peso</span>
                <span className="flex-1 text-[#48484A] text-[10px] text-center">Reps</span>
                <span className="w-9" />
              </div>

              {/* Sets */}
              <AnimatePresence>
                {sets.map((set, i) => (
                  <SetRow
                    key={i}
                    index={i}
                    set={set}
                    prevSet={prevSets?.[i] ?? (prevSets?.length ? prevSets[prevSets.length - 1] : null)}
                    onUpdate={(data) => updateSet(exerciseId, i, data)}
                    onRemove={() => removeSet(exerciseId, i)}
                    onDone={(data) => handleDone(i, data)}
                    onUndo={() => handleUndo(i)}
                  />
                ))}
              </AnimatePresence>

              {/* Add set button */}
              <button
                onClick={() => addSet(exerciseId, {})}
                className="pressable w-full flex items-center justify-center gap-2 py-3.5 border-t border-[#2C2C2E] text-[#0A84FF] text-sm font-medium"
              >
                <Plus size={15} /> Agregar serie
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* RPE Selector overlay — z-50 so it's above the rest timer */}
      <AnimatePresence>
        {pendingRPE && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/50"
              onClick={handleRPESkip}
            />
            <RPESelector
              current={sets[pendingRPE.setIndex]?.rpe}
              onSelect={handleRPESelect}
              onSkip={handleRPESkip}
            />
          </>
        )}
      </AnimatePresence>
    </>
  )
}

// ── Finish Modal ──────────────────────────────────────────────────────────

function FinishModal({ duration, totalVolume, totalSets, onConfirm, onCancel }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      className="bg-[#1C1C1E] rounded-3xl p-6 mx-6 max-w-sm w-full"
    >
      <div className="w-14 h-14 bg-[#30D158]/15 rounded-full flex items-center justify-center mx-auto mb-4">
        <Check size={28} className="text-[#30D158]" strokeWidth={2.5} />
      </div>
      <h2 className="text-white font-bold text-xl text-center mb-1">¡Buen trabajo!</h2>
      <p className="text-[#8E8E93] text-sm text-center mb-5">Resumen del entrenamiento</p>
      <div className="flex justify-around mb-6">
        <div className="text-center">
          <p className="text-white font-bold text-lg">{formatDuration(duration)}</p>
          <p className="text-[#8E8E93] text-xs">Duración</p>
        </div>
        <div className="text-center">
          <p className="text-white font-bold text-lg">{totalSets}</p>
          <p className="text-[#8E8E93] text-xs">Series</p>
        </div>
        <div className="text-center">
          <p className="text-white font-bold text-lg">{(totalVolume / 1000).toFixed(1)}t</p>
          <p className="text-[#8E8E93] text-xs">Volumen</p>
        </div>
      </div>
      <button
        onClick={onConfirm}
        className="pressable w-full bg-[#30D158] py-3.5 rounded-2xl text-white font-semibold text-base mb-3"
      >
        Guardar entrenamiento
      </button>
      <button
        onClick={onCancel}
        className="pressable w-full py-3 text-[#8E8E93] text-sm"
      >
        Seguir entrenando
      </button>
    </motion.div>
  )
}

// ── Main Session Page ─────────────────────────────────────────────────────

export default function WorkoutSession() {
  const { activeWorkout, sets, finishWorkout, stopRestTimer, setRestTarget } = useWorkoutStore()
  const { setActiveTab } = useUIStore()
  const { defaultRestSeconds } = useSettingsStore()
  const { display } = useWeightUnit()
  const [elapsed, setElapsed] = useState(0)
  const [showFinish, setShowFinish] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setRestTarget(defaultRestSeconds) }, [defaultRestSeconds, setRestTarget])

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - (activeWorkout?.startTime ?? Date.now())) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [activeWorkout?.startTime])

  const exerciseIds = activeWorkout ? Object.keys(sets).map(Number) : []

  const [prevSetsMap, setPrevSetsMap] = useState({})
  useEffect(() => {
    async function load() {
      const map = {}
      for (const id of exerciseIds) {
        const last = await getLastSetForExercise(id)
        if (last) map[id] = [last]
      }
      setPrevSetsMap(map)
    }
    if (exerciseIds.length) load()
  }, [exerciseIds.join(',')])

  const allSets = Object.values(sets).flat()
  const doneSets = allSets.filter((s) => s.done)
  const totalVolume = doneSets.reduce((acc, s) => acc + (s.weight ?? 0) * (s.reps ?? 0), 0)

  async function handleFinish() {
    setSaving(true)
    try {
      const workoutId = await db.workouts.add({
        routineId: activeWorkout.routineId ?? null,
        date: new Date().toISOString(),
        duration: elapsed,
        totalVolume,
      })

      const setRows = []
      let order = 0
      for (const [exerciseId, exSets] of Object.entries(sets)) {
        for (const s of exSets) {
          if (!s.done) continue
          setRows.push({
            workoutId,
            exerciseId: Number(exerciseId),
            weight: s.weight ?? 0,
            reps: s.reps ?? 0,
            rpe: s.rpe ?? null,
            setOrder: order++,
          })
        }
      }
      await db.workout_sets.bulkAdd(setRows)
    } finally {
      setSaving(false)
      stopRestTimer()
      finishWorkout()
      setActiveTab('home')
    }
  }

  function handleDiscard() {
    stopRestTimer()
    finishWorkout()
    setActiveTab('home')
  }

  if (!activeWorkout) return null

  const plannedConfig = activeWorkout.plannedConfig ?? {}

  return (
    <div className="flex flex-col h-full bg-black">
      {/* ── Top bar ── */}
      <div
        className="glass border-b border-white/8 flex-shrink-0 px-4"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)', paddingBottom: '12px' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={handleDiscard}
            className="pressable w-9 h-9 bg-[#2C2C2E] rounded-full flex items-center justify-center"
          >
            <X size={16} className="text-[#8E8E93]" />
          </button>

          <div className="flex-1 text-center">
            <p className="text-white font-semibold text-sm leading-tight">
              {activeWorkout.name}
              {activeWorkout.dayName ? ` · ${activeWorkout.dayName}` : ''}
            </p>
            <p className="text-[#0A84FF] text-xs tabular-nums">{formatDuration(elapsed)}</p>
          </div>

          <button
            onClick={() => setShowFinish(true)}
            className="pressable bg-[#30D158] px-4 py-2 rounded-full text-white text-sm font-semibold"
          >
            Terminar
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1 bg-[#2C2C2E] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#0A84FF] rounded-full"
            animate={{ width: `${allSets.length ? (doneSets.length / allSets.length) * 100 : 0}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="flex border-b border-[#1C1C1E] flex-shrink-0">
        {[
          { label: 'Series', value: `${doneSets.length}/${allSets.length}` },
          { label: 'Volumen', value: totalVolume > 0 ? `${(totalVolume / 1000).toFixed(1)}t` : '0t' },
          { label: 'Ejercicios', value: exerciseIds.length },
        ].map((stat) => (
          <div key={stat.label} className="flex-1 flex flex-col items-center py-2.5">
            <span className="text-white text-sm font-semibold tabular-nums">{stat.value}</span>
            <span className="text-[#8E8E93] text-[10px]">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* ── Exercise list ── */}
      <div className="flex-1 overflow-y-auto scroll-ios px-4 pt-4 pb-32">
        {exerciseIds.map((id) => (
          <ExerciseBlock
            key={id}
            exerciseId={id}
            workoutSets={sets[id]}
            prevSets={prevSetsMap[id]}
            plannedSets={plannedConfig[id]?.sets}
          />
        ))}

        {exerciseIds.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 pt-16">
            <p className="text-[#8E8E93] text-sm">Esta rutina no tiene ejercicios.</p>
          </div>
        )}
      </div>

      {/* ── Rest timer (inside session, lower offset) ── */}
      <RestTimer offsetBottom="calc(env(safe-area-inset-bottom,0px)+72px)" />

      {/* ── Finish modal ── */}
      <AnimatePresence>
        {showFinish && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center"
          >
            <FinishModal
              duration={elapsed}
              totalVolume={totalVolume}
              totalSets={doneSets.length}
              onConfirm={handleFinish}
              onCancel={() => setShowFinish(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
