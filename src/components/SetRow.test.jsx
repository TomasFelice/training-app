import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { it, expect, vi } from 'vitest'
import SetRow from './SetRow'
import { useSettingsStore } from '../store'

it('keeps canonical kg when completing a set after switching the display to pounds', async () => {
  useSettingsStore.setState({ weightUnit: 'lb' })
  const done = vi.fn()
  render(<SetRow index={0} set={{ weight: 12.5, weightDraft: '12,5', weightDraftUnit: 'kg', reps: 8, repsDraft: '8', done: false }} onUpdate={() => {}} onRemove={() => {}} onDone={done} onUndo={() => {}} />)
  expect(screen.getByLabelText('Peso de serie 1')).toHaveValue('27.5')
  await userEvent.setup().click(screen.getByRole('button', { name: 'Completar serie 1' }))
  expect(done).toHaveBeenCalledWith({ weight: 12.5, reps: 8 })
  useSettingsStore.setState({ weightUnit: 'kg' })
})
