import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Home, Dumbbell, TrendingUp, Sparkles } from 'lucide-react'

import { useUIStore, useSettingsStore, useWorkoutStore } from './store'
import HomePage from './pages/Home'
import RoutinesPage from './pages/Routines'
import ProgressPage from './pages/Progress'
import AIPage from './pages/AI'
import WorkoutSession from './pages/WorkoutSession'

const TABS = [
  { id: 'home',     label: 'Inicio',   Icon: Home },
  { id: 'routines', label: 'Rutinas',  Icon: Dumbbell },
  { id: 'progress', label: 'Progreso', Icon: TrendingUp },
  { id: 'ai',       label: 'IA Coach', Icon: Sparkles },
]

const TAB_ORDER = TABS.map((t) => t.id)

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

  useEffect(() => { hydrate() }, [hydrate])

  // When a workout starts, redirect to session tab; when it ends, go back
  useEffect(() => {
    if (activeWorkout && activeTab !== 'session') setActiveTab('session')
  }, [activeWorkout])

  const prevIndex = TAB_ORDER.indexOf(activeTab)
  const currentIndex = TAB_ORDER.indexOf(activeTab)

  // Session overlay — renders on top of everything when workout is active
  if (activeTab === 'session') {
    return (
      <div className="flex flex-col h-full bg-black overflow-hidden">
        <WorkoutSession />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-black overflow-hidden">
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
    </div>
  )
}
