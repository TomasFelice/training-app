import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { ExerciseConfigRow } from './RoutineEditor'
import { validateRoutine } from '../lib/routineTemplates'

function Harness() {
  const [config, setConfig] = useState({ sets: 3, reps: 10 })
  return <ExerciseConfigRow exercise={{ name: 'Press Banca' }} config={config} onUpdate={(data) => setConfig((c) => ({ ...c, ...data }))} onRemove={() => {}} onMoveUp={() => {}} onMoveDown={() => {}} isFirst isLast />
}
describe('routine numeric drafts', () => {
  it('allows clearing 10, writing 8, and clearing 1 without reinserting it', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const reps = screen.getByLabelText('Repeticiones de Press Banca')
    await user.clear(reps)
    expect(reps).toHaveValue('')
    await user.type(reps, '8')
    expect(reps).toHaveValue('8')
    await user.clear(reps); await user.type(reps, '1'); await user.clear(reps)
    expect(reps).toHaveValue('')
    await user.tab()
    expect(reps).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Entero mayor que cero')).toBeInTheDocument()
  })
  it.each(['', '0', '-1', '1.5'])('rejects %s at save rather than silently clamping it', (value) => {
    expect(validateRoutine({ name: 'Plan', trainingDays: [{ name: 'A', exercises: [{ sets: '3', reps: value }] }] })).toContain('enteros mayores que cero')
  })
})
