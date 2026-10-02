import { useState } from 'react'
import Sheet from './Sheet'

const descriptions = ['Muy fácil', 'Fácil', 'Moderado', 'Algo exigente', 'Exigente', '4 repeticiones en reserva', '3 repeticiones en reserva', '2 repeticiones en reserva', '1 repetición en reserva', 'Esfuerzo máximo']
export default function RPESelector({ current, onSelect, onSkip }) {
  const [selected, setSelected] = useState(current ?? null)
  return <Sheet title="¿Cómo se sintió la serie?" onClose={onSkip} footer={<><button className="primary-button" disabled={!selected} onClick={() => onSelect(selected)}>Guardar esfuerzo</button><button className="text-button" onClick={onSkip}>Omitir</button></>}>
    <p className="muted">Esfuerzo percibido (RPE), del 1 al 10. Este registro es opcional.</p>
    <div className="rpe-grid">{descriptions.map((description, i) => <button key={i} className={selected === i + 1 ? 'selected' : ''} aria-pressed={selected === i + 1} aria-label={`RPE ${i + 1}: ${description}`} onClick={() => setSelected(i + 1)}>{i + 1}</button>)}</div>
    <p className="rpe-description" role="status">{selected ? descriptions[selected - 1] : 'Elegí un valor'}</p>
  </Sheet>
}
