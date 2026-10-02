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
  vi.stubEnv('VITE_GEMINI_FALLBACK_MODEL', 'gemini-3.1-flash-lite')
  fetchGemini = vi.fn()
  vi.stubGlobal('fetch', fetchGemini)
  gemini = await import('./gemini')
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers() })

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
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:streamGenerateContent?alt=sse')
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
  it('falls back after persistent saturation, keeps the query and medium reasoning, and separates model signatures', async () => {
    vi.useFakeTimers()
    const primaryParts = [{ text: 'Respuesta anterior de Flash.', thoughtSignature: 'flash-signature' }]
    const liteParts = [{ text: 'Respuesta anterior de Lite.', thoughtSignature: 'lite-signature' }]
    const messages = [userMessage,
      { role: 'assistant', content: primaryParts[0].text, parts: primaryParts, model: 'gemini-3.8-flash' },
      { role: 'user', content: 'Ajustala' },
      { role: 'assistant', content: liteParts[0].text, parts: liteParts, model: 'gemini-3.1-flash-lite' },
      { role: 'user', content: 'Sumá un día' },
    ]
    const newParts = [{ text: 'Rutina alternativa.', thoughtSignature: 'new-lite-signature' }]
    fetchGemini.mockImplementation(async (url) => url.includes('gemini-3.8-flash:')
      ? response({ error: { message: 'High demand' } }, 503)
      : response({ candidates: [{ content: { parts: newParts }, finishReason: 'STOP' }] }))
    const onModel = vi.fn()
    const pending = gemini.sendMessage(messages, { onModel })
    await vi.advanceTimersByTimeAsync(10000)
    const reply = await pending
    expect(reply).toEqual({ content: 'Rutina alternativa.', parts: newParts, model: 'gemini-3.1-flash-lite' })
    expect(fetchGemini).toHaveBeenCalledTimes(4)
    const primaryBody = JSON.parse(fetchGemini.mock.calls[0][1].body)
    const fallbackBody = JSON.parse(fetchGemini.mock.calls[3][1].body)
    expect(primaryBody.contents[1].parts).toEqual(primaryParts)
    expect(primaryBody.contents[3].parts).toEqual([{ text: liteParts[0].text }])
    expect(fallbackBody.contents[1].parts).toEqual([{ text: primaryParts[0].text }])
    expect(fallbackBody.contents[3].parts).toEqual(liteParts)
    expect(fallbackBody.contents[4]).toEqual(primaryBody.contents[4])
    expect(fallbackBody.systemInstruction).toEqual(primaryBody.systemInstruction)
    expect(fallbackBody.generationConfig).toEqual(primaryBody.generationConfig)
    expect(onModel.mock.calls).toEqual([['gemini-3.8-flash'], ['gemini-3.1-flash-lite']])
    fetchGemini.mockResolvedValue(response({ candidates: [{ content: { parts: [{ text: 'Volvió Flash.' }] } }] }))
    await gemini.sendMessage([...messages, { role: 'assistant', ...reply }, userMessage])
    expect(fetchGemini.mock.calls[4][0]).toContain('gemini-3.8-flash:')
    expect(JSON.parse(fetchGemini.mock.calls[4][1].body).contents[5].parts).toEqual([{ text: reply.content }])
  })
  it.each(['', 'gemini-3.8-flash'])('disables fallback when blank or identical to the primary (%s)', async (fallbackModel) => {
    vi.stubEnv('VITE_GEMINI_FALLBACK_MODEL', fallbackModel)
    vi.resetModules()
    gemini = await import('./gemini')
    vi.useFakeTimers()
    fetchGemini.mockResolvedValue(response({}, 503))
    const failure = expect(gemini.sendMessage([userMessage])).rejects.toThrow('Gemini está saturado')
    await vi.advanceTimersByTimeAsync(10000)
    await failure
    expect(fetchGemini).toHaveBeenCalledTimes(3)
    expect(fetchGemini.mock.calls.every(([url]) => url.includes('gemini-3.8-flash:'))).toBe(true)
  })
  it('identifies an unavailable fallback model and its environment variable', async () => {
    fetchGemini.mockResolvedValueOnce(new Response('{}', { status: 503, headers: { 'Retry-After': '120' } }))
      .mockResolvedValueOnce(response({}, 404))
    await expect(gemini.sendMessage([userMessage])).rejects.toThrow('gemini-3.1-flash-lite no está disponible para este proyecto. Revisá VITE_GEMINI_FALLBACK_MODEL')
    expect(fetchGemini).toHaveBeenCalledTimes(2)
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
