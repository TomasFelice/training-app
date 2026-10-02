import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db', () => ({
  getAIContext: vi.fn(async () => []),
  db: {
    routines: { toArray: vi.fn(async () => []) },
    exercises: { toArray: vi.fn(async () => []) },
    workout_sets: { toArray: vi.fn(async () => []) },
  },
}))

let gemini
let fetchGemini
beforeEach(async () => {
  vi.resetModules()
  vi.stubEnv('VITE_GEMINI_API_KEY', 'test-api-key')
  vi.stubEnv('VITE_GEMINI_MODEL', '')
  fetchGemini = vi.fn()
  vi.stubGlobal('fetch', fetchGemini)
  gemini = await import('./gemini')
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

const userMessage = { role: 'user', content: 'Generá una rutina' }
const response = (data, status = 200) => ({ ok: status === 200, status, json: async () => data })

describe('Gemini coach integration', () => {
  it('uses Flash 3.8 with medium reasoning and native system instructions, joins response parts and preserves signatures', async () => {
    const parts = [
      { text: 'Resumen interno', thought: true, thoughtSignature: 'signature-thought' },
      { text: 'Tu rutina. ', thoughtSignature: 'signature-answer' },
      { text: '<ROUTINE_JSON>{"name":"Fuerza","days":["Lun"],"exercises":["Sentadilla"]}</ROUTINE_JSON>' },
    ]
    fetchGemini.mockResolvedValue(response({ candidates: [{ content: { parts }, finishReason: 'STOP' }] }))
    const reply = await gemini.sendMessage([userMessage])
    expect(reply.content).toBe('Tu rutina. ' + parts[2].text)
    expect(reply.parts).toEqual(parts)
    expect(gemini.parseRoutineFromResponse(reply.content)).toMatchObject({ name: 'Fuerza', exercises: ['Sentadilla'] })
    const [url, request] = fetchGemini.mock.calls[0]
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent')
    expect(url).not.toContain('test-api-key')
    expect(request.headers['x-goog-api-key']).toBe('test-api-key')
    const body = JSON.parse(request.body)
    expect(body.systemInstruction.parts[0].text).toContain('CONTEXTO DE ENTRENAMIENTO')
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: userMessage.content }] }])
    expect(body.generationConfig).toMatchObject({ temperature: 1, maxOutputTokens: 32768,
      thinkingConfig: { thinkingLevel: 'medium', includeThoughts: false } })

    await gemini.sendMessage([userMessage, { role: 'assistant', ...reply }, { role: 'user', content: 'Ajustala a 4 días' }])
    expect(JSON.parse(fetchGemini.mock.calls[1][1].body).contents[1]).toEqual({ role: 'model', parts })
  })
  it('reports quota exhaustion without switching models or retrying', async () => {
    fetchGemini.mockResolvedValue(response({ error: { message: 'Quota exceeded' } }, 429))
    await expect(gemini.sendMessage([userMessage])).rejects.toThrow('Se alcanzó la cuota')
    expect(fetchGemini).toHaveBeenCalledTimes(1)
  })
  it.each([
    [400, { error: { message: 'API key not valid. Please pass a valid API key.' } }, 'La clave de Gemini'],
    [403, { error: { message: 'Permission denied' } }, 'La clave de Gemini'],
    [404, { error: { message: 'Not found' } }, 'no está disponible'],
    [200, { candidates: [{ content: { parts: [{ text: 'JSON incompleto' }] }, finishReason: 'MAX_TOKENS' }] }, 'no pudo completar'],
    [200, { promptFeedback: { blockReason: 'SAFETY' } }, 'no devolvió una respuesta'],
  ])('handles an unusable response (%s) with an actionable error', async (status, data, message) => {
    fetchGemini.mockResolvedValue(response(data, status))
    await expect(gemini.sendMessage([userMessage])).rejects.toThrow(message)
  })
  it('does not call the API without a configured key', async () => {
    vi.stubEnv('VITE_GEMINI_API_KEY', ' ')
    vi.resetModules()
    gemini = await import('./gemini')
    expect(gemini.hasApiKey()).toBe(false)
    await expect(gemini.sendMessage([userMessage])).rejects.toThrow('no está configurada')
    expect(fetchGemini).not.toHaveBeenCalled()
  })
})
