import { useEffect, useState } from 'react'
import App from './App'
import { initializeCatalog } from './seed'

export default function Bootstrap() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    initializeCatalog().then(() => { if (!cancelled) setReady(true) }).catch(() => {
      if (!cancelled) setError('No se pudo abrir tu catálogo. Revisá el almacenamiento del dispositivo y volvé a intentar.')
    })
    return () => { cancelled = true }
  }, [attempt])
  if (ready) return <App />
  return <div className="bootstrap"><h1>GymTrack</h1>{error ? <><p role="alert">{error}</p><button className="primary-button" onClick={() => { setError(''); setAttempt(attempt + 1) }}>Volver a intentar</button></> : <p role="status">Preparando tus ejercicios…</p>}</div>
}
