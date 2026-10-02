import { Plus, Minus, X, Timer } from 'lucide-react'
import { restStatus, useClockStore, useWorkoutStore } from '../store'
import { formatDuration } from '../lib/time'

export default function RestTimer() {
  const { restTimer, stopRestTimer, setRestTarget } = useWorkoutStore()
  const now = useClockStore((s) => s.now)
  const status = restStatus(restTimer, now)
  if (restTimer.startedAt == null) return null
  return <div className={`rest-timer ${status.finished ? 'rest-finished' : ''}`} role="region" aria-label="Descanso">
    <div className="rest-copy"><Timer size={21} /><span>{status.finished ? 'Descanso completo' : 'Descanso'}<strong>{status.finished ? 'Listo para seguir' : formatDuration(status.remaining)}</strong></span></div>
    <div className="rest-controls"><button className="icon-button" aria-label="Reducir descanso 15 segundos" onClick={() => setRestTarget(Math.max(15, restTimer.target - 15))}><Minus size={18} /></button>
      <button className="icon-button" aria-label="Agregar 15 segundos de descanso" onClick={() => setRestTarget(restTimer.target + 15)}><Plus size={18} /></button>
      <button className="icon-button" aria-label="Cerrar descanso" onClick={stopRestTimer}><X size={18} /></button></div>
  </div>
}
