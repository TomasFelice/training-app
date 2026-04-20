import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { TrendingUp, ChevronDown, Dumbbell, Trophy, BarChart2, Activity } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getVolumeHistoryForExercise, get1RMHistoryForExercise } from '../db'

// ── Custom Tooltip ─────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#2C2C2E] border border-white/10 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-[#8E8E93] mb-0.5">{label}</p>
      <p className="text-white font-semibold">
        {payload[0].value.toFixed(1)}{unit}
      </p>
    </div>
  )
}

// ── Exercise selector bottom sheet ─────────────────────────────────────────

function ExerciseSheet({ exercises, selected, onSelect, onClose }) {
  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 40 }}
      className="fixed inset-x-0 bottom-0 z-50 bg-[#1C1C1E] rounded-t-3xl flex flex-col"
      style={{ maxHeight: '70vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
        <div className="w-10 h-1 bg-[#48484A] rounded-full" />
      </div>
      <div className="px-5 py-3 flex-shrink-0">
        <h2 className="text-white font-semibold text-base">Elegí un ejercicio</h2>
      </div>
      <div className="flex-1 overflow-y-auto scroll-ios px-5 pb-4">
        {exercises.map((ex) => (
          <button
            key={ex.id}
            onClick={() => { onSelect(ex); onClose() }}
            className={`pressable w-full flex items-center justify-between py-3.5 border-b border-[#2C2C2E] ${
              selected?.id === ex.id ? 'text-[#0A84FF]' : 'text-white'
            }`}
          >
            <span className="text-sm">{ex.name}</span>
            <span className="text-[#8E8E93] text-xs">{ex.muscleGroup}</span>
          </button>
        ))}
      </div>
    </motion.div>
  )
}

// ── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }) {
  return (
    <div className="flex-1 bg-[#1C1C1E] rounded-2xl p-4">
      <p className="text-[#8E8E93] text-xs mb-1">{label}</p>
      <p className="text-white font-bold text-xl tabular-nums" style={{ color }}>{value}</p>
      {sub && <p className="text-[#8E8E93] text-[10px] mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Recent Workout Row ──────────────────────────────────────────────────────

function WorkoutRow({ workout }) {
  const date = new Date(workout.date)
  const label = date.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-[#2C2C2E] last:border-0">
      <div>
        <p className="text-white text-sm capitalize">{label}</p>
        <p className="text-[#8E8E93] text-xs mt-0.5">
          {Math.round((workout.duration ?? 0) / 60)} min
        </p>
      </div>
      <div className="text-right">
        <p className="text-white text-sm font-semibold">
          {((workout.totalVolume ?? 0) / 1000).toFixed(1)}t
        </p>
        <p className="text-[#8E8E93] text-xs">volumen</p>
      </div>
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 pt-20">
      <div className="w-20 h-20 bg-[#1C1C1E] rounded-3xl flex items-center justify-center">
        <TrendingUp size={32} className="text-[#48484A]" />
      </div>
      <div className="text-center px-8">
        <p className="text-white font-semibold text-lg">Sin datos aún</p>
        <p className="text-[#8E8E93] text-sm mt-1">
          Completá tu primer entrenamiento para ver tu progreso acá.
        </p>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ProgressPage() {
  const [selectedExercise, setSelectedExercise] = useState(null)
  const [showSheet, setShowSheet] = useState(false)
  const [volumeData, setVolumeData] = useState([])
  const [irmData, setIrmData] = useState([])
  const [activeChart, setActiveChart] = useState('volume') // 'volume' | '1rm'

  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray(), [])
  const recentWorkouts = useLiveQuery(
    () => db.workouts.orderBy('date').reverse().limit(10).toArray(), []
  )
  const totalWorkouts = useLiveQuery(() => db.workouts.count(), [])
  const totalSets = useLiveQuery(() => db.workout_sets.count(), [])

  // Auto-select first exercise with data
  useEffect(() => {
    if (!exercises?.length || selectedExercise) return
    setSelectedExercise(exercises[0])
  }, [exercises])

  // Load chart data when exercise changes
  useEffect(() => {
    if (!selectedExercise) return
    let cancelled = false
    async function load() {
      const [vol, irm] = await Promise.all([
        getVolumeHistoryForExercise(selectedExercise.id),
        get1RMHistoryForExercise(selectedExercise.id),
      ])
      if (cancelled) return
      setVolumeData(vol.map((d) => ({
        date: new Date(d.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
        value: Math.round(d.volume),
      })))
      setIrmData(irm.map((d) => ({
        date: new Date(d.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
        value: d.value,
      })))
    }
    load()
    return () => { cancelled = true }
  }, [selectedExercise])

  const hasWorkouts = (recentWorkouts?.length ?? 0) > 0

  // Best 1RM for selected exercise
  const best1RM = irmData.length ? Math.max(...irmData.map((d) => d.value)) : null
  const latestVolume = volumeData.length ? volumeData[volumeData.length - 1]?.value : null

  return (
    <div className="flex flex-col h-full bg-black">
      <div style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)' }} />

      {/* Header */}
      <div className="px-5 pb-4 flex-shrink-0">
        <h1 className="text-white text-2xl font-bold tracking-tight">Progreso</h1>
      </div>

      {!hasWorkouts ? (
        <div className="flex-1 overflow-y-auto scroll-ios">
          <EmptyState />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scroll-ios px-5 pb-6">
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
            className="flex flex-col gap-5"
          >

            {/* ── Global stats ── */}
            <motion.div
              variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
              className="flex gap-3"
            >
              <StatCard label="Entrenamientos" value={totalWorkouts ?? 0} color="#0A84FF" />
              <StatCard label="Series totales" value={totalSets ?? 0} color="#30D158" />
            </motion.div>

            {/* ── Exercise picker ── */}
            <motion.div variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
              <p className="text-[#8E8E93] text-xs font-semibold uppercase tracking-wider mb-2">
                Ejercicio
              </p>
              <button
                onClick={() => setShowSheet(true)}
                className="pressable w-full bg-[#1C1C1E] rounded-2xl px-4 py-3.5 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#0A84FF]/15 rounded-xl flex items-center justify-center">
                    <Dumbbell size={15} className="text-[#0A84FF]" />
                  </div>
                  <div className="text-left">
                    <p className="text-white text-sm font-medium">
                      {selectedExercise?.name ?? 'Elegir ejercicio'}
                    </p>
                    {selectedExercise && (
                      <p className="text-[#8E8E93] text-xs">{selectedExercise.muscleGroup}</p>
                    )}
                  </div>
                </div>
                <ChevronDown size={16} className="text-[#48484A]" />
              </button>
            </motion.div>

            {/* ── Exercise stats ── */}
            {selectedExercise && (
              <motion.div
                variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                className="flex gap-3"
              >
                <StatCard
                  label="Mejor 1RM est."
                  value={best1RM ? `${best1RM.toFixed(1)}kg` : '—'}
                  sub="Fórmula de Epley"
                  color="#FF9F0A"
                />
                <StatCard
                  label="Últ. volumen"
                  value={latestVolume ? `${(latestVolume / 1000).toFixed(1)}t` : '—'}
                  sub="Sesión anterior"
                  color="#BF5AF2"
                />
              </motion.div>
            )}

            {/* ── Chart card ── */}
            {selectedExercise && (volumeData.length > 0 || irmData.length > 0) && (
              <motion.div
                variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                className="bg-[#1C1C1E] rounded-3xl p-4"
              >
                {/* Chart type toggle */}
                <div className="flex items-center justify-between mb-4">
                  <p className="text-white font-semibold text-sm">{selectedExercise.name}</p>
                  <div className="flex bg-[#2C2C2E] rounded-xl p-0.5">
                    {[
                      { id: 'volume', Icon: BarChart2, label: 'Vol.' },
                      { id: '1rm',    Icon: Activity,  label: '1RM' },
                    ].map(({ id, Icon, label }) => (
                      <button
                        key={id}
                        onClick={() => setActiveChart(id)}
                        className={`pressable flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          activeChart === id
                            ? 'bg-[#3A3A3C] text-white'
                            : 'text-[#8E8E93]'
                        }`}
                      >
                        <Icon size={12} /> {label}
                      </button>
                    ))}
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeChart}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                  >
                    {activeChart === 'volume' ? (
                      <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={volumeData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                          <defs>
                            <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#0A84FF" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#0A84FF" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2C2C2E" vertical={false} />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8E8E93' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                          <YAxis tick={{ fontSize: 10, fill: '#8E8E93' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}t`} />
                          <Tooltip content={<ChartTooltip unit="kg" />} />
                          <Area type="monotone" dataKey="value" stroke="#0A84FF" strokeWidth={2} fill="url(#volGrad)" dot={false} activeDot={{ r: 4, fill: '#0A84FF' }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={irmData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2C2C2E" vertical={false} />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8E8E93' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                          <YAxis tick={{ fontSize: 10, fill: '#8E8E93' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}kg`} />
                          <Tooltip content={<ChartTooltip unit="kg" />} />
                          <Line type="monotone" dataKey="value" stroke="#FF9F0A" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#FF9F0A' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </motion.div>
                </AnimatePresence>

                {volumeData.length < 2 && (
                  <p className="text-[#48484A] text-xs text-center mt-2">
                    Necesitás al menos 2 sesiones para ver la curva.
                  </p>
                )}
              </motion.div>
            )}

            {/* ── No chart data ── */}
            {selectedExercise && volumeData.length === 0 && irmData.length === 0 && (
              <motion.div
                variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
                className="bg-[#1C1C1E] rounded-2xl p-6 flex flex-col items-center gap-2"
              >
                <Trophy size={24} className="text-[#48484A]" />
                <p className="text-[#8E8E93] text-sm text-center">
                  Todavía no hay registros de <strong className="text-white">{selectedExercise.name}</strong>.
                  Usalo en tu próximo entrenamiento.
                </p>
              </motion.div>
            )}

            {/* ── Recent workouts ── */}
            <motion.div variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
              <p className="text-[#8E8E93] text-xs font-semibold uppercase tracking-wider mb-3">
                Historial reciente
              </p>
              <div className="bg-[#1C1C1E] rounded-2xl px-4">
                {recentWorkouts?.map((w) => <WorkoutRow key={w.id} workout={w} />)}
              </div>
            </motion.div>

          </motion.div>
        </div>
      )}

      {/* Exercise selector sheet */}
      <AnimatePresence>
        {showSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60"
              onClick={() => setShowSheet(false)}
            />
            <ExerciseSheet
              exercises={exercises ?? []}
              selected={selectedExercise}
              onSelect={setSelectedExercise}
              onClose={() => setShowSheet(false)}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
