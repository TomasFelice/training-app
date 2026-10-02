import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Settings, Play, ChevronRight, Dumbbell, ArrowUpRight, Flame } from 'lucide-react'
import { db } from '../db'
import { useUIStore, useWorkoutStore } from '../store'
import { useWeightUnit } from '../hooks/useWeightUnit'
import SettingsSheet from '../components/SettingsSheet'
import InstallPrompt from '../components/InstallPrompt'
import Sheet from '../components/Sheet'

function streakFor(workouts) {
  const dates = new Set(workouts.map((w) => new Date(w.date).toLocaleDateString('en-CA')))
  const cursor = new Date()
  if (!dates.has(cursor.toLocaleDateString('en-CA'))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (dates.has(cursor.toLocaleDateString('en-CA'))) { streak++; cursor.setDate(cursor.getDate() - 1) }
  return streak
}
export default function HomePage() {
  const workouts = useLiveQuery(() => db.workouts.orderBy('date').reverse().toArray(), [], [])
  const routines = useLiveQuery(() => db.routines.toArray(), [], [])
  const allSets = useLiveQuery(() => db.workout_sets.toArray(), [], [])
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], [])
  const { activeWorkout } = useWorkoutStore()
  const { setActiveTab, openRoutineLibrary } = useUIStore()
  const { display, unit } = useWeightUnit()
  const [settings, setSettings] = useState(false)
  const [today] = useState(() => Date.now())
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'
  const last = workouts[0]
  const weekVolume = workouts.filter((w) => new Date(w.date).getTime() >= today - 7 * 86400000).reduce((a, w) => a + (w.totalVolume ?? 0), 0)
  const streak = streakFor(workouts)
  const records = useMemo(() => {
    const map = new Map()
    for (const set of allSets) {
      const estimate = (set.weight ?? 0) * (1 + (set.reps ?? 0) / 30)
      if (estimate > (map.get(set.exerciseId)?.estimate ?? 0)) map.set(set.exerciseId, { ...set, estimate })
    }
    return [...map.values()].sort((a, b) => b.estimate - a.estimate).slice(0, 3)
  }, [allSets])
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]))
  return <div className="page home-page">
    <header className="page-header"><div><p className="muted">{greeting}</p><h1>GymTrack<span className="brand-mark" /></h1></div><button className="icon-button" aria-label="Configuración" onClick={() => setSettings(true)}><Settings size={23} /></button></header>
    <div className="page-scroll scroll-ios">
      <section className={`training-hero ${activeWorkout ? 'hero-active' : ''}`}>
        <div className="hero-topline"><Dumbbell size={25} /><span>{activeWorkout ? 'En entrenamiento' : 'Tu próxima sesión'}</span></div>
        <h2>{activeWorkout ? activeWorkout.dayName || activeWorkout.name : routines.length ? 'Todo listo para entrenar' : 'Empezá con un plan'}</h2>
        <p>{activeWorkout ? `${activeWorkout.name}. Tu sesión sigue en marcha.` : routines.length ? 'Elegí tu rutina y registrá cada serie.' : 'Encontrá una rutina, adaptala a vos y registrá tu primera sesión.'}</p>
        <button className="primary-button" onClick={() => activeWorkout ? setActiveTab('session') : routines.length ? setActiveTab('routines') : openRoutineLibrary()}><Play size={18} />{activeWorkout ? 'Retomar entrenamiento' : routines.length ? 'Iniciar entrenamiento' : 'Elegir una rutina'}</button>
      </section>
      <div className="home-summary"><div><strong>{workouts.length}</strong><span>Sesiones totales</span></div><div><strong>{Math.round(display(weekVolume)).toLocaleString('es-AR')}</strong><span>{unit} esta semana</span></div><div><strong><Flame size={19} />{streak}</strong><span>Días de racha</span></div></div>
      {routines.length > 0 && <section className="home-section"><div className="section-heading"><h2>Mis rutinas</h2><button className="text-button" onClick={() => setActiveTab('routines')}>Ver todas</button></div>
        {routines.slice(0, 3).map((routine) => <button className="home-routine-row" key={routine.id} onClick={() => setActiveTab('routines')}><div><strong>{routine.name}</strong><span>{routine.trainingDays.length} días de entrenamiento</span></div><ChevronRight size={20} /></button>)}
      </section>}
      {!routines.length && <button className="library-link" onClick={openRoutineLibrary}><div><strong>Explorá la biblioteca</strong><span>Full body, torso/pierna y más</span></div><ArrowUpRight size={23} /></button>}
      {last ? <section className="home-section"><div className="section-heading"><h2>Último entrenamiento</h2><button className="text-button" onClick={() => setActiveTab('progress')}>Ver progreso</button></div>
        <div className="last-workout"><h3>{last.name ?? routines.find((r) => r.id === last.routineId)?.name ?? 'Entrenamiento'}</h3><p className="muted">{new Date(last.date).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</p><div><span>{Math.round(last.duration / 60)} min</span><span>{Math.round(display(last.totalVolume ?? 0)).toLocaleString('es-AR')} {unit} de volumen</span></div></div>
      </section> : <div className="first-session-note"><span className="small-line" /><p>Tu progreso se construye serie a serie. Cuando completes tu primer entrenamiento, lo vas a ver acá.</p></div>}
      {records.length > 0 && <section className="home-section"><div className="section-heading"><h2>Récords personales</h2></div>{records.map((record) => <div className="record-row" key={record.exerciseId}><span>{exerciseMap.get(record.exerciseId)?.name ?? 'Ejercicio'}</span><strong>{display(record.weight)} {unit} × {record.reps}</strong></div>)}</section>}
      <InstallPrompt />
    </div>
    {settings && <Sheet title="Configuración" onClose={() => setSettings(false)} className="settings-wrapper"><SettingsSheet embedded onClose={() => setSettings(false)} /></Sheet>}
  </div>
}
