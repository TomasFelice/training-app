import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Flame, ChevronRight, Clock, Zap, Trophy, Plus, Settings } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useUIStore } from '../store'
import { useWeightUnit } from '../hooks/useWeightUnit'
import SettingsSheet from '../components/SettingsSheet'

// ── Helpers ───────────────────────────────────────────────────────────────

function calcStreak(workouts) {
  if (!workouts?.length) return 0
  const days = new Set(
    workouts.map((w) => new Date(w.date).toLocaleDateString('en-CA')) // YYYY-MM-DD
  )
  let streak = 0
  const today = new Date()
  const cursor = new Date(today)
  // Allow today or yesterday as the most recent day
  const todayStr = today.toLocaleDateString('en-CA')
  const yesterdayStr = new Date(today - 86400000).toLocaleDateString('en-CA')
  if (!days.has(todayStr) && !days.has(yesterdayStr)) return 0
  if (!days.has(todayStr)) cursor.setDate(cursor.getDate() - 1)

  while (days.has(cursor.toLocaleDateString('en-CA'))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

function fmtDuration(secs) {
  if (!secs) return '0min'
  const m = Math.round(secs / 60)
  return m >= 60 ? `${(m / 60).toFixed(1)}h` : `${m}min`
}

function relativeDate(iso) {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now - d) / 86400000)
  if (diffDays === 0) return `Hoy, ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
  if (diffDays === 1) return 'Ayer'
  if (diffDays < 7) return `Hace ${diffDays} días`
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatPill({ icon: Icon, value, label, color }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${color}`}>
        <Icon size={16} className="text-white" />
      </div>
      <span className="text-white text-sm font-semibold tabular-nums">{value}</span>
      <span className="text-[#8E8E93] text-[10px] text-center leading-tight">{label}</span>
    </div>
  )
}

function SectionHeader({ title, action, onAction }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-white font-semibold text-base">{title}</h2>
      {action && (
        <button onClick={onAction} className="text-[#0A84FF] text-sm font-medium pressable">
          {action}
        </button>
      )}
    </div>
  )
}

// ── Skeleton loaders ───────────────────────────────────────────────────────

function Skeleton({ className }) {
  return (
    <motion.div
      animate={{ opacity: [0.3, 0.6, 0.3] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      className={`bg-[#2C2C2E] rounded-xl ${className}`}
    />
  )
}

// ── Animation variants ────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 32 } },
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function HomePage() {
  const { setActiveTab } = useUIStore()
  const { display, unit } = useWeightUnit()
  const [showSettings, setShowSettings] = useState(false)

  // ── Live queries ──
  const allWorkouts   = useLiveQuery(() => db.workouts.orderBy('date').reverse().toArray(), [])
  const routines      = useLiveQuery(() => db.routines.toArray(), [])
  const totalWorkouts = useLiveQuery(() => db.workouts.count(), [])

  // Last workout + its sets + exercise names
  const lastWorkout = allWorkouts?.[0] ?? null
  const lastWorkoutSets = useLiveQuery(
    () => lastWorkout ? db.workout_sets.where('workoutId').equals(lastWorkout.id).toArray() : Promise.resolve([]),
    [lastWorkout?.id]
  )
  const lastWorkoutExercises = useLiveQuery(
    () => {
      const ids = [...new Set((lastWorkoutSets ?? []).map((s) => s.exerciseId))]
      return ids.length ? db.exercises.bulkGet(ids) : Promise.resolve([])
    },
    [lastWorkoutSets]
  )

  // PRs: max 1RM per exercise across all sets
  const allSets = useLiveQuery(() => db.workout_sets.toArray(), [])
  const prs = useMemo(() => {
    if (!allSets?.length) return []
    const map = {}
    for (const s of allSets) {
      const est = (s.weight ?? 0) * (1 + (s.reps ?? 0) / 30)
      if (!map[s.exerciseId] || est > map[s.exerciseId].est1rm) {
        map[s.exerciseId] = { exerciseId: s.exerciseId, weight: s.weight, reps: s.reps, est1rm: est }
      }
    }
    return Object.values(map).sort((a, b) => b.est1rm - a.est1rm).slice(0, 5)
  }, [allSets])

  const prExercises = useLiveQuery(
    () => {
      const ids = prs.map((p) => p.exerciseId)
      return ids.length ? db.exercises.bulkGet(ids) : Promise.resolve([])
    },
    [prs.map((p) => p.exerciseId).join(',')]
  )

  // Streak
  const streak = useMemo(() => calcStreak(allWorkouts), [allWorkouts])

  // This-week volume
  const weekVolume = useMemo(() => {
    if (!allWorkouts) return 0
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 7)
    return allWorkouts
      .filter((w) => new Date(w.date) >= cutoff)
      .reduce((acc, w) => acc + (w.totalVolume ?? 0), 0)
  }, [allWorkouts])

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 18) return 'Buenas tardes'
    return 'Buenas noches'
  })()

  const isLoading = allWorkouts === undefined

  // Build last workout display sets (group by exercise, show one row per exercise)
  const lastWorkoutDisplay = useMemo(() => {
    if (!lastWorkoutSets?.length || !lastWorkoutExercises?.length) return []
    const exMap = Object.fromEntries(
      (lastWorkoutExercises ?? []).filter(Boolean).map((e) => [e.id, e.name])
    )
    // group sets by exercise, pick best set (highest weight)
    const byEx = {}
    for (const s of lastWorkoutSets) {
      if (!byEx[s.exerciseId] || (s.weight ?? 0) > (byEx[s.exerciseId].weight ?? 0)) {
        byEx[s.exerciseId] = s
      }
    }
    return Object.values(byEx).slice(0, 5).map((s) => ({
      exercise: exMap[s.exerciseId] ?? 'Ejercicio',
      weight: s.weight,
      reps: s.reps,
      rpe: s.rpe,
    }))
  }, [lastWorkoutSets, lastWorkoutExercises])

  return (
    <div className="flex flex-col h-full bg-black">
      <div style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)' }} />

      {/* ── Header ── */}
      <div className="px-5 pb-4 flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-[#8E8E93] text-sm">{greeting}</p>
          <h1 className="text-white text-2xl font-bold tracking-tight">GymTrack</h1>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="pressable w-10 h-10 bg-[#1C1C1E] rounded-full flex items-center justify-center"
        >
          <Settings size={18} className="text-[#8E8E93]" />
        </button>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto scroll-ios px-5 pb-6">
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="flex flex-col gap-5">

          {/* ── Stats card ── */}
          <motion.div variants={itemVariants}>
            <div className="bg-[#1C1C1E] rounded-3xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <motion.div
                  animate={streak > 0 ? { rotate: [0, -8, 8, -4, 4, 0] } : {}}
                  transition={{ delay: 0.8, duration: 0.6 }}
                >
                  <Flame size={18} className={streak > 0 ? 'text-[#FF9F0A]' : 'text-[#48484A]'} />
                </motion.div>
                <span className="text-white font-semibold text-sm">
                  {streak > 0 ? `${streak} día${streak !== 1 ? 's' : ''} seguido${streak !== 1 ? 's' : ''}` : 'Sin racha activa'}
                </span>
                <span className="ml-auto text-[#8E8E93] text-xs">
                  {totalWorkouts ?? 0} totales
                </span>
              </div>

              {isLoading ? (
                <div className="flex justify-around">
                  {[0, 1, 2].map((i) => <Skeleton key={i} className="w-16 h-12" />)}
                </div>
              ) : (
                <div className="flex justify-around">
                  <StatPill
                    icon={Clock}
                    value={lastWorkout ? fmtDuration(lastWorkout.duration) : '—'}
                    label="Última sesión"
                    color="bg-[#0A84FF]/80"
                  />
                  <StatPill
                    icon={Zap}
                    value={weekVolume > 0 ? `${(weekVolume / 1000).toFixed(1)}t` : '—'}
                    label="Vol. semana"
                    color="bg-[#FF9F0A]/80"
                  />
                  <StatPill
                    icon={Trophy}
                    value={prs.length}
                    label="Records"
                    color="bg-[#30D158]/80"
                  />
                </div>
              )}
            </div>
          </motion.div>

          {/* ── Start workout CTA ── */}
          <motion.div variants={itemVariants}>
            <button
              onClick={() => setActiveTab('routines')}
              className="pressable w-full bg-[#0A84FF] rounded-2xl p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Plus size={20} className="text-white" />
                </div>
                <div className="text-left">
                  <p className="text-white font-semibold text-base">Iniciar entrenamiento</p>
                  <p className="text-white/70 text-xs">
                    {routines?.length
                      ? `${routines.length} rutina${routines.length !== 1 ? 's' : ''} disponible${routines.length !== 1 ? 's' : ''}`
                      : 'Creá tu primera rutina'}
                  </p>
                </div>
              </div>
              <ChevronRight size={20} className="text-white/70" />
            </button>
          </motion.div>

          {/* ── Last workout ── */}
          {lastWorkout && (
            <motion.div variants={itemVariants}>
              <SectionHeader
                title="Último entrenamiento"
                action="Ver progreso"
                onAction={() => setActiveTab('progress')}
              />
              <div className="bg-[#1C1C1E] rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-[#2C2C2E]">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white font-semibold text-sm">
                        {routines?.find((r) => r.id === lastWorkout.routineId)?.name ?? 'Entrenamiento libre'}
                      </p>
                      <p className="text-[#8E8E93] text-xs mt-0.5">{relativeDate(lastWorkout.date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white text-sm font-semibold">{fmtDuration(lastWorkout.duration)}</p>
                      <p className="text-[#8E8E93] text-xs">
                        {((lastWorkout.totalVolume ?? 0) / 1000).toFixed(1)}t vol.
                      </p>
                    </div>
                  </div>
                </div>

                {lastWorkoutDisplay.length > 0 ? (
                  <div className="divide-y divide-[#2C2C2E]">
                    {lastWorkoutDisplay.map((s, i) => (
                      <div key={i} className="px-4 py-3 flex items-center justify-between">
                        <span className="text-white/80 text-sm">{s.exercise}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium tabular-nums">
                            {s.weight != null ? `${display(s.weight)}${unit}` : '—'} × {s.reps ?? '—'}
                          </span>
                          {s.rpe != null && (
                            <span className="text-[#8E8E93] text-xs bg-[#2C2C2E] px-2 py-0.5 rounded-full">
                              RPE {s.rpe}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-3">
                    <p className="text-[#48484A] text-sm">Sin series registradas.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── My Routines ── */}
          {routines?.length > 0 && (
            <motion.div variants={itemVariants}>
              <SectionHeader title="Mis rutinas" action="Editar" onAction={() => setActiveTab('routines')} />
              <div className="flex flex-col gap-2">
                {routines.slice(0, 4).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setActiveTab('routines')}
                    className="pressable bg-[#1C1C1E] rounded-2xl p-4 flex items-center gap-3"
                  >
                    <div className="w-11 h-11 bg-[#0A84FF]/10 rounded-xl flex items-center justify-center">
                      <span className="text-[#0A84FF] text-lg font-bold">
                        {r.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-white font-semibold text-sm">{r.name}</p>
                      <p className="text-[#8E8E93] text-xs mt-0.5">
                        {(r.trainingDays ?? []).reduce((a, d) => a + d.exercises.length, 0)} ejercicios
                        {r.scheduledDays?.length > 0 && ` · ${r.scheduledDays.join(', ')}`}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-[#48484A]" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── PRs ── */}
          {prs.length > 0 && prExercises?.length > 0 && (
            <motion.div variants={itemVariants}>
              <SectionHeader
                title="Records personales"
                action="Ver progreso"
                onAction={() => setActiveTab('progress')}
              />
              <div className="bg-[#1C1C1E] rounded-2xl divide-y divide-[#2C2C2E]">
                {prs.map((pr, i) => {
                  const ex = prExercises?.find((e) => e?.id === pr.exerciseId)
                  return (
                    <div key={i} className="px-4 py-3.5 flex items-center justify-between">
                      <span className="text-white/80 text-sm">{ex?.name ?? '…'}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold text-sm tabular-nums">
                          {display(pr.weight)}{unit} × {pr.reps}
                        </span>
                        <span className="text-[#FF9F0A] text-xs bg-[#FF9F0A]/10 px-2 py-0.5 rounded-full tabular-nums">
                          ~{pr.est1rm.toFixed(1)}{unit}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* ── Empty state (no workouts yet) ── */}
          {!isLoading && !lastWorkout && (
            <motion.div variants={itemVariants} className="flex flex-col items-center gap-4 pt-8">
              <div className="w-20 h-20 bg-[#1C1C1E] rounded-3xl flex items-center justify-center">
                <Flame size={32} className="text-[#48484A]" />
              </div>
              <div className="text-center">
                <p className="text-white font-semibold text-lg">Empezá hoy</p>
                <p className="text-[#8E8E93] text-sm mt-1 px-6">
                  Creá una rutina, completá tu primer entrenamiento y tu progreso aparecerá acá.
                </p>
              </div>
            </motion.div>
          )}

        </motion.div>
      </div>

      {/* Settings sheet */}
      <AnimatePresence>
        {showSettings && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60"
              onClick={() => setShowSettings(false)}
            />
            <SettingsSheet onClose={() => setShowSettings(false)} />
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
