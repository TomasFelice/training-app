import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AIPage from './AI'
import { sendMessage } from '../lib/gemini'

vi.mock('../lib/gemini', () => ({
  hasApiKey: () => true,
  GEMINI_MODEL_LABEL: 'Gemini 3.8 Flash',
  getGeminiModelLabel: model => model === 'gemini-3.1-flash-lite' ? 'Gemini 3.1 Flash-Lite' : 'Gemini 3.8 Flash',
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
beforeEach(() => vi.clearAllMocks())

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

it('keeps a failed query and retries it without adding another user message', async () => {
  const user = userEvent.setup()
  sendMessage.mockRejectedValueOnce(new Error('No se pudo mantener la conexión con Gemini.'))
  render(<AIPage />)
  await user.type(screen.getByPlaceholderText('Preguntá algo…'), 'Revisá mi progreso{Enter}')
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo mantener la conexión')
  const failedConversation = sendMessage.mock.calls[0][0]
  await user.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByText('Seguís progresando en tus ejercicios.')).toBeInTheDocument()
  expect(sendMessage.mock.calls[1][0]).toEqual(failedConversation)
  expect(screen.getAllByText('Revisá mi progreso')).toHaveLength(1)
})

it('shows streamed text, hides unfinished routine JSON, and lets the user cancel', async () => {
  const user = userEvent.setup()
  let signal
  sendMessage.mockImplementationOnce((_, options) => {
    signal = options.signal
    options.onStatus('El coach está preparando la respuesta…')
    options.onChunk('Preparando tu plan. <ROUTINE_JSON>{"name":"Borrador"}')
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Cancelada', 'AbortError'))))
  })
  render(<AIPage />)
  await user.type(screen.getByPlaceholderText('Preguntá algo…'), 'Armá un plan{Enter}')
  expect(await screen.findByText('Preparando tu plan.')).toBeInTheDocument()
  expect(screen.queryByText(/Borrador/)).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('preparando')
  await user.click(screen.getByRole('button', { name: 'Cancelar consulta' }))
  expect(signal.aborted).toBe(true)
  expect(await screen.findByRole('alert')).toHaveTextContent('Consulta cancelada')
  expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
})

it('aborts a pending request when the coach is left', async () => {
  const user = userEvent.setup()
  let signal
  sendMessage.mockImplementationOnce((_, options) => {
    signal = options.signal
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Cancelada', 'AbortError'))))
  })
  const view = render(<AIPage />)
  await user.type(screen.getByPlaceholderText('Preguntá algo…'), 'Analizá{Enter}')
  view.unmount()
  expect(signal.aborted).toBe(true)
})

it('shows the fallback model and keeps its identity for subsequent turns', async () => {
  const user = userEvent.setup()
  const liteReply = { content: 'Respuesta alternativa.', parts: [{ text: 'Respuesta alternativa.', thoughtSignature: 'lite' }], model: 'gemini-3.1-flash-lite' }
  sendMessage.mockImplementationOnce(async (_, options) => {
    options.onModel('gemini-3.1-flash-lite')
    return liteReply
  })
  render(<AIPage />)
  await user.type(screen.getByPlaceholderText('Preguntá algo…'), 'Revisá mi plan{Enter}')
  expect(await screen.findByText('Respuesta alternativa.')).toBeInTheDocument()
  expect(screen.getByText('Gemini 3.1 Flash-Lite · Razonamiento medio')).toBeInTheDocument()
  await user.type(screen.getByPlaceholderText('Preguntá algo…'), 'Agregá un día{Enter}')
  await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2))
  expect(sendMessage.mock.calls[1][0][1]).toEqual({ role: 'assistant', ...liteReply })
  await user.click(screen.getByRole('button', { name: 'Nueva conversación' }))
  expect(screen.getByText('Gemini 3.8 Flash · Razonamiento medio')).toBeInTheDocument()
})
