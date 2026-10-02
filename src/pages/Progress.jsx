import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { TrendingUp } from 'lucide-react'
import { db, getVolumeHistoryForExercise, get1RMHistoryForExercise } from '../db'
import { useWeightUnit } from '../hooks/useWeightUnit'
import { useUIStore } from '../store'

export default function ProgressPage() {
  const [exerciseId, setExerciseId] = useState(null)
  const [chart, setChart] = useState('volume')
  const { display, unit } = useWeightUnit()
  const { setActiveTab } = useUIStore()
  const workouts = useLiveQuery(() => db.workouts.orderBy('date').reverse().toArray(), [], [])
  const sets = useLiveQuery(() => db.workout_sets.toArray(), [], [])
  const exercises = useLiveQuery(async () => {
    const recorded = await db.workout_sets.toArray()
    const records = await db.exercises.bulkGet([...new Set(recorded.map((s) => s.exerciseId))])
    return records.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name))
  }, [], [])
  const selectedId = exerciseId ?? exercises[0]?.id
  const volume = useLiveQuery(() => selectedId ? getVolumeHistoryForExercise(selectedId) : Promise.resolve([]), [selectedId], [])
  const rm = useLiveQuery(() => selectedId ? get1RMHistoryForExercise(selectedId) : Promise.resolve([]), [selectedId], [])
  const points = (chart === 'volume' ? volume : rm).map((item) => ({ date: new Date(item.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }), value: display(item.volume ?? item.value) }))
  const totalVolume = workouts.reduce((sum, w) => sum + (w.totalVolume ?? 0), 0)
  return <div className="page progress-page"><header className="page-header"><div><p className="muted">Cada serie cuenta</p><h1>Progreso</h1></div><TrendingUp size={26} className="accent-text" /></header>
    <div className="page-scroll scroll-ios">
      {!workouts.length ? <div className="empty-state"><TrendingUp size={40} /><h2>Tu progreso empieza con una sesión</h2><p>Registrá un entrenamiento para seguir tus cargas y repeticiones.</p><button className="primary-button" onClick={() => setActiveTab('routines')}>Elegir rutina</button></div> : <>
        <div className="progress-summary"><div><strong>{workouts.length}</strong><span>Entrenamientos</span></div><div><strong>{sets.length}</strong><span>Series</span></div><div><strong>{Math.round(display(totalVolume)).toLocaleString('es-AR')}</strong><span>{unit} de volumen</span></div></div>
        {exercises.length > 0 && <section className="progress-chart"><label className="field-label">Ejercicio<select value={selectedId} onChange={(e) => setExerciseId(Number(e.target.value))}>{exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
          <div className="segmented-control">{[['volume', 'Volumen'], ['1rm', '1RM estimado']].map(([key, label]) => <button key={key} className={chart === key ? 'selected' : ''} aria-pressed={chart === key} onClick={() => setChart(key)}>{label}</button>)}</div>
          <div className="chart-container" role="img" aria-label={`Historial de ${chart === 'volume' ? 'volumen' : '1RM estimado'} en ${unit}`}><ResponsiveContainer width="100%" height={240}><AreaChart data={points} margin={{ top: 16, right: 12, bottom: 8, left: 0 }}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} width={50} /><Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, color: 'var(--text)' }} formatter={(value) => [`${Number(value).toLocaleString('es-AR')} ${unit}`, chart === 'volume' ? 'Volumen' : '1RM']} /><Area type="monotone" dataKey="value" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.12} strokeWidth={2} isAnimationActive={false} /></AreaChart></ResponsiveContainer></div>
          {chart === '1rm' && <p className="muted">Estimación según tus series, usando la fórmula de Epley.</p>}
        </section>}
        <section><h2>Historial reciente</h2><div className="workout-history">{workouts.slice(0, 20).map((w) => <div className="history-row" key={w.id}><div><strong>{w.name ?? 'Entrenamiento'}</strong><span>{new Date(w.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} · {Math.round(w.duration / 60)} min</span></div><strong>{Math.round(display(w.totalVolume ?? 0)).toLocaleString('es-AR')} {unit}</strong></div>)}</div></section>
      </>}
    </div>
  </div>
}
