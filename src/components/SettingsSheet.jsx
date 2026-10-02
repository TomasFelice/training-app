import { useState } from 'react'
import { useSettingsStore } from '../store'
import { db } from '../db'
import Sheet from './Sheet'
import InstallPrompt from './InstallPrompt'

const REST_PRESETS = [45, 60, 90, 120, 180]
export default function SettingsSheet({ embedded = false, onClose }) {
  const { weightUnit, setWeightUnit, defaultRestSeconds, setDefaultRestSeconds } = useSettingsStore()
  const [clear, setClear] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function clearHistory() {
    setBusy(true)
    try { await db.transaction('rw', db.workouts, db.workout_sets, async () => { await db.workouts.clear(); await db.workout_sets.clear() }); setClear(false) }
    catch { setError('No se pudo borrar el historial. Volvé a intentar.') }
    finally { setBusy(false) }
  }
  const content = <div className="settings-content">
    <section><h3>Unidad de peso</h3><div className="segmented-control">{['kg', 'lb'].map((u) => <button key={u} aria-pressed={weightUnit === u} className={weightUnit === u ? 'selected' : ''} onClick={() => setWeightUnit(u)}>{u === 'kg' ? 'Kilogramos (kg)' : 'Libras (lb)'}</button>)}</div></section>
    <section><h3>Descanso entre series</h3><div className="rest-presets">{REST_PRESETS.map((s) => <button className={defaultRestSeconds === s ? 'selected' : ''} aria-pressed={defaultRestSeconds === s} onClick={() => setDefaultRestSeconds(s)} key={s}>{s < 60 ? `${s} s` : `${s / 60} min`}</button>)}</div><p className="muted">El descanso empieza al completar una serie.</p></section>
    <InstallPrompt compact />
    <section><h3>Tus datos</h3><p className="muted">Rutinas, historial y sesión activa se guardan en este dispositivo. El coach usa Gemini únicamente cuando le enviás una consulta.</p><button className="text-button danger-text" onClick={() => setClear(true)}>Borrar historial de entrenamientos</button></section>
    <section className="app-about"><h3>GymTrack</h3><p className="muted">Versión 2.0 · Entrená a tu manera</p><a href="https://github.com/hasaneyldrm/exercises-dataset" target="_blank" rel="noreferrer">Catálogo de ejercicios · licencia MIT</a><a href="https://gymvisual.com/" target="_blank" rel="noreferrer">Medios © Gym visual</a></section>
    {clear && <Sheet title="¿Borrar historial?" onClose={() => { if (!busy) setClear(false) }} footer={<button className="danger-button" disabled={busy} onClick={clearHistory}>{busy ? 'Borrando…' : 'Borrar historial'}</button>}><p>Se eliminarán tus entrenamientos y series guardados. Las rutinas, los ejercicios y el entrenamiento en curso se conservan. Esta acción no se puede deshacer.</p>{error && <p role="alert" className="form-error">{error}</p>}</Sheet>}
  </div>
  return embedded ? content : <Sheet title="Configuración" onClose={onClose}>{content}</Sheet>
}
