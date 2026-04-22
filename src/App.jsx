import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Home, Dumbbell, TrendingUp, Sparkles, ChevronRight } from 'lucide-react'

import { useUIStore, useSettingsStore, useWorkoutStore } from './store'
import HomePage from './pages/Home'
import RoutinesPage from './pages/Routines'
import ProgressPage from './pages/Progress'
import AIPage from './pages/AI'
import WorkoutSession from './pages/WorkoutSession'
import RestTimer from './components/RestTimer'

const TABS = [
  { id: 'home',     label: 'Inicio',   Icon: Home },
  { id: 'routines', label: 'Rutinas',  Icon: Dumbbell },
  { id: 'progress', label: 'Progreso', Icon: TrendingUp },
  { id: 'ai',       label: 'IA Coach', Icon: Sparkles },
]

const TAB_ORDER = TABS.map((t) => t.id)

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function getPageVariants(direction) {
  return {
    enter:  { x: direction > 0 ? '100%' : '-100%', opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit:   { x: direction > 0 ? '-100%' : '100%', opacity: 0 },
  }
}

export default function App() {
  const { activeTab, setActiveTab } = useUIStore()
  const { hydrate } = useSettingsStore()
  const { activeWorkout } = useWorkoutStore()
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => { hydrate() }, [hydrate])

  // Track elapsed time for the workout pill (always running, even off session tab)
  useEffect(() => {
    if (!activeWorkout) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - activeWorkout.startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [activeWorkout?.startTime])

  // When a workout starts and we're not already on session, navigate there
  useEffect(() => {
    if (activeWorkout && activeTab !== 'session') setActiveTab('session')
  }, [activeWorkout?.routineId])

  const prevIndex = TAB_ORDER.indexOf(activeTab)
  const currentIndex = TAB_ORDER.indexOf(activeTab)

  const showSession = activeTab === 'session'

  return (
    <div className="flex flex-col h-full bg-black overflow-hidden">
      {showSession ? (
        <WorkoutSession />
      ) : (
        <>
          {/* ── Page content ── */}
          <div className="flex-1 relative overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeTab}
                variants={getPageVariants(currentIndex - prevIndex)}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'tween', ease: [0.32, 0.72, 0, 1], duration: 0.28 }}
                className="absolute inset-0 flex flex-col overflow-hidden"
              >
                {activeTab === 'home'     && <HomePage />}
                {activeTab === 'routines' && <RoutinesPage />}
                {activeTab === 'progress' && <ProgressPage />}
                {activeTab === 'ai'       && <AIPage />}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── Floating workout pill (when workout active and off session tab) ── */}
          {activeWorkout && (
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="absolute inset-x-3 z-50"
              style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 68px)' }}
            >
              <button
                onClick={() => setActiveTab('session')}
                className="w-full glass border border-[#0A84FF]/40 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl"
              >
                <div className="w-2 h-2 rounded-full bg-[#0A84FF] animate-pulse flex-shrink-0" />
                <div className="flex-1 text-left min-w-0">
                  <p className="text-white text-sm font-semibold leading-tight truncate">
                    {activeWorkout.name}
                    {activeWorkout.dayName ? ` · ${activeWorkout.dayName}` : ''}
                  </p>
                  <p className="text-[#8E8E93] text-xs">Entrenamiento en curso</p>
                </div>
                <span className="text-[#0A84FF] text-sm font-semibold tabular-nums flex-shrink-0">
                  {formatDuration(elapsed)}
                </span>
                <ChevronRight size={16} className="text-[#48484A] flex-shrink-0" />
              </button>
            </motion.div>
          )}

          {/* ── Rest timer — visible even when browsing other tabs ── */}
          {activeWorkout && <RestTimer offsetBottom="calc(env(safe-area-inset-bottom, 0px) + 130px)" />}

          {/* ── Bottom Tab Bar ── */}
          <nav
            className="glass border-t border-white/8 flex-shrink-0"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="flex">
              {TABS.map((tab) => {
                const active = tab.id === activeTab
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="pressable flex-1 flex flex-col items-center gap-1 py-2.5 px-1"
                  >
                    <motion.div
                      animate={{ scale: active ? 1.15 : 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    >
                      <tab.Icon
                        size={22}
                        strokeWidth={active ? 2.2 : 1.6}
                        className={active ? 'text-[#0A84FF]' : 'text-[#8E8E93]'}
                      />
                    </motion.div>
                    <span className={`text-[10px] font-medium tracking-tight transition-colors ${
                      active ? 'text-[#0A84FF]' : 'text-[#8E8E93]'
                    }`}>
                      {tab.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </nav>
        </>
      )}
    </div>
  )
}
