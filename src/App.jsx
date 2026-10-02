import { useEffect } from 'react'
import { MotionConfig } from 'framer-motion'
import { Home, Dumbbell, TrendingUp, Sparkles, ChevronRight } from 'lucide-react'
import { useUIStore, useSettingsStore, useWorkoutStore, useClockStore, restStatus } from './store'
import { formatDuration, workoutElapsed } from './lib/time'
import HomePage from './pages/Home'
import RoutinesPage from './pages/Routines'
import ProgressPage from './pages/Progress'
import AIPage from './pages/AI'
import WorkoutSession from './pages/WorkoutSession'
import RestTimer from './components/RestTimer'
import PwaUpdater from './components/PwaUpdater'

const TABS = [{ id: 'home', label: 'Inicio', Icon: Home }, { id: 'routines', label: 'Rutinas', Icon: Dumbbell },
  { id: 'progress', label: 'Progreso', Icon: TrendingUp }, { id: 'ai', label: 'IA Coach', Icon: Sparkles }]

export default function App() {
  const { activeTab, setActiveTab } = useUIStore()
  const hydrate = useSettingsStore((s) => s.hydrate)
  const { activeWorkout, sets, restTimer, storageError } = useWorkoutStore()
  const now = useClockStore((s) => s.now)
  const sessionId = activeWorkout?.sessionId
  useEffect(() => { hydrate() }, [hydrate])
  useEffect(() => {
    if (!sessionId) return
    const tick = () => useClockStore.setState({ now: Date.now() })
    tick()
    const interval = setInterval(tick, 1000)
    document.addEventListener('visibilitychange', tick); window.addEventListener('pageshow', tick)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', tick); window.removeEventListener('pageshow', tick) }
  }, [sessionId])
  useEffect(() => {
    const viewport = window.visualViewport
    const resize = () => {
      document.documentElement.style.setProperty('--viewport-height', `${viewport?.height ?? window.innerHeight}px`)
      document.documentElement.style.setProperty('--viewport-offset-top', `${viewport?.offsetTop ?? 0}px`)
    }
    resize(); viewport?.addEventListener('resize', resize); viewport?.addEventListener('scroll', resize)
    return () => { viewport?.removeEventListener('resize', resize); viewport?.removeEventListener('scroll', resize) }
  }, [])
  const session = activeTab === 'session' && activeWorkout
  const allSets = Object.values(sets).flat()
  const completed = allSets.filter((s) => s.done).length
  const rest = restStatus(restTimer, now)
  return <MotionConfig reducedMotion="user"><div className={`app-shell ${activeWorkout ? 'training-active' : ''} ${session ? 'session-open' : ''}`}>
    <PwaUpdater />
    {storageError && <p role="alert" className="storage-error">{storageError}</p>}
    <main className="app-main">
      {session ? <WorkoutSession /> : <>
        {activeTab === 'home' && <HomePage />}{activeTab === 'routines' && <RoutinesPage />}
        {activeTab === 'progress' && <ProgressPage />}{activeTab === 'ai' && <AIPage />}
      </>}
    </main>
    {activeWorkout && <div className="workout-dock">
      {!session && <button className="workout-resume" onClick={() => setActiveTab('session')} aria-label="Retomar entrenamiento">
        <span className="live-dot" /><span className="resume-copy"><strong>{activeWorkout.dayName || activeWorkout.name}</strong><small>{completed}/{allSets.length} series{rest.running ? ` · Descanso ${formatDuration(rest.remaining)}` : ' · En entrenamiento'}</small></span>
        <time>{formatDuration(workoutElapsed(activeWorkout, now))}</time><ChevronRight size={20} />
      </button>}
      <RestTimer />
    </div>}
    {!session && <nav className="bottom-nav" aria-label="Navegación principal">{TABS.map((tab) => <button key={tab.id} aria-current={activeTab === tab.id ? 'page' : undefined}
      className={activeTab === tab.id ? 'selected' : ''} onClick={() => setActiveTab(tab.id)}><tab.Icon size={23} strokeWidth={activeTab === tab.id ? 2.3 : 1.7} /><span>{tab.label}</span></button>)}</nav>}
  </div></MotionConfig>
}
