import { useState } from 'react'
import { Play, Dumbbell } from 'lucide-react'
import Sheet from './Sheet'
import { equipmentLabel, muscleLabel } from '../lib/catalog'

export function ExerciseThumbnail({ exercise }) {
  const [failedImage, setFailedImage] = useState(null)
  const image = exercise.photoBase64 || exercise.image
  return <div className="exercise-thumb">
    {image && image !== failedImage ? <img src={image} alt="" loading="lazy" width="56" height="56" onError={() => setFailedImage(image)} /> : <Dumbbell size={22} />}
  </div>
}

export default function ExerciseDetails({ exercise, onClose }) {
  const [playing, setPlaying] = useState(false)
  const [mediaError, setMediaError] = useState(false)
  return <Sheet title={exercise.name} onClose={onClose}>
    {(exercise.image || exercise.photoBase64) && <div className="exercise-media">
      {playing && !mediaError ? <video src={exercise.video} poster={exercise.image} width="180" height="180"
        autoPlay muted loop playsInline controls preload="metadata" onError={() => setMediaError(true)} /> :
        <img src={exercise.photoBase64 || exercise.image} alt={`Demostración de ${exercise.name}`} width="180" height="180" />}
      {exercise.video && !playing && <button className="secondary-button" onClick={() => setPlaying(true)}><Play size={18} /> Ver movimiento</button>}
      {mediaError && <p role="status" className="muted">No se pudo cargar el vídeo. Podés seguir las instrucciones.</p>}
    </div>}
    {exercise.attribution && <a className="media-credit" href="https://gymvisual.com/" target="_blank" rel="noreferrer">{exercise.attribution}</a>}
    <dl className="exercise-facts"><div><dt>Músculo principal</dt><dd>{muscleLabel(exercise.target) || exercise.muscleGroup}</dd></div>
      {exercise.equipment && <div><dt>Equipamiento</dt><dd>{equipmentLabel(exercise.equipment)}</dd></div>}
      {exercise.secondaryMuscles?.length > 0 && <div><dt>También trabaja</dt><dd>{exercise.secondaryMuscles.map(muscleLabel).join(', ')}</dd></div>}
    </dl>
    <h3>Cómo hacerlo</h3>
    {exercise.instructionSteps?.length ? <ol className="instruction-list">{exercise.instructionSteps.map((step, i) => <li key={i}>{step}</li>)}</ol> :
      <p className="muted">Este ejercicio personalizado todavía no tiene instrucciones.</p>}
  </Sheet>
}
