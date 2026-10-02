import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AIPage from './AI'
import { sendMessage } from '../lib/gemini'

vi.mock('../lib/gemini', () => ({
  hasApiKey: () => true,
  GEMINI_MODEL_LABEL: 'Gemini 3.8 Flash',
  sendMessage: vi.fn(async () => ({ content: 'Seguís progresando en tus ejercicios.', parts: [{ text: 'Seguís progresando en tus ejercicios.', thoughtSignature: 'signature' }] })),
  parseRoutineFromResponse: () => null,
  saveRoutineFromAI: vi.fn(),
}))

// JSDOM does not implement browser scrolling.
const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
beforeAll(() => Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() }))
afterAll(() => {
  if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScroll)
  else delete HTMLElement.prototype.scrollIntoView
})

it('displays the selected model and renders the reply from the reasoning model', async () => {
  const user = userEvent.setup()
  render(<AIPage />)
  expect(screen.getByText('Gemini 3.8 Flash · Razonamiento medio')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Analizá mi progreso/ }))
  expect(await screen.findByText('Seguís progresando en tus ejercicios.')).toBeInTheDocument()
  await user.type(screen.getByPlaceholderText('Preguntá algo…'), '¿Y el pecho?{Enter}')
  await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2))
  expect(sendMessage.mock.calls[1][0][1]).toMatchObject({ role: 'assistant',
    content: 'Seguís progresando en tus ejercicios.',
    parts: [{ text: 'Seguís progresando en tus ejercicios.', thoughtSignature: 'signature' }] })
})
