import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestGemini } from './geminiRequest'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers() })

const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:streamGenerateContent?alt=sse'
const init = { method: 'POST', body: '{"contents":[]}' }
const fallbackRequest = { url: url.replace('gemini-3.8-flash', 'gemini-3.1-flash-lite'), init: { ...init, body: '{"contents":[{"role":"user"}]}' } }
const json = (status, headers = {}) => new Response(JSON.stringify({ candidates: [] }), {
  status, headers: { 'Content-Type': 'application/json', ...headers },
})
const chunk = (parts, finishReason) => ({ candidates: [{ content: { parts }, ...(finishReason ? { finishReason } : {}) }] })

function sse(events, splitEvery = 13) {
  const encoded = new TextEncoder().encode(': keepalive\r\n\r\n' + events.map(event => 'data: ' + JSON.stringify(event) + '\r\n\r\n').join(''))
  return new Response(new ReadableStream({ start(controller) {
    for (let index = 0; index < encoded.length; index += splitEvery) controller.enqueue(encoded.slice(index, index + splitEvery))
    controller.close()
  } }), { headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } })
}

describe('Gemini transport recovery', () => {
  it('reassembles SSE events and split UTF-8, shows progress and preserves signed parts', async () => {
    const signed = { text: 'Está bien. ', thoughtSignature: 'signature' }
    const fetchGemini = vi.fn().mockResolvedValue(sse([
      chunk([{ text: 'Oculto', thought: true }]),
      chunk([signed]),
      chunk([{ text: 'Podés ' }]),
      chunk([{ text: 'seguir.' }], 'STOP'),
    ], 1))
    vi.stubGlobal('fetch', fetchGemini)
    const onChunk = vi.fn()
    const { data } = await requestGemini(url, init, { onChunk })
    expect(data.candidates[0]).toEqual({ finishReason: 'STOP', content: { parts: [
      { text: 'Oculto', thought: true }, signed, { text: 'Podés seguir.' },
    ] } })
    expect(onChunk).toHaveBeenLastCalledWith('Está bien. Podés seguir.')
    expect(fetchGemini).toHaveBeenCalledTimes(1)
  })
  it('retries a 503 with backoff and succeeds using the same model and request', async () => {
    vi.useFakeTimers()
    const fetchGemini = vi.fn().mockResolvedValueOnce(json(503, { 'Retry-After': '2' })).mockResolvedValueOnce(json(200))
    vi.stubGlobal('fetch', fetchGemini)
    const onStatus = vi.fn()
    const pending = requestGemini(url, init, { onStatus })
    await vi.advanceTimersByTimeAsync(1999)
    expect(fetchGemini).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await pending
    expect(fetchGemini).toHaveBeenCalledTimes(2)
    expect(fetchGemini.mock.calls[1][0]).toBe(url)
    expect(fetchGemini.mock.calls[1][1].body).toBe(init.body)
    expect(onStatus).toHaveBeenCalledWith(expect.stringContaining('Reintentando'))
  })
  it('stops after two server-error retries and reports saturation in Spanish', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json(503))))
    const pending = requestGemini(url, init)
    const failure = expect(pending).rejects.toThrow('Gemini está saturado')
    await vi.advanceTimersByTimeAsync(10000)
    await failure
    expect(fetch).toHaveBeenCalledTimes(3)
  })
  it.each([400, 403, 404, 429])('does not retry status %s', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(status)))
    const result = await requestGemini(url, init)
    expect(result.response.status).toBe(status)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('does not automatically replay a failed browser connection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Load failed')))
    await expect(requestGemini(url, init)).rejects.toThrow('No se pudo mantener la conexión')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('rejects a truncated response instead of exposing an incomplete routine as success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sse([chunk([{ text: '<ROUTINE_JSON>{"name":"Plan"' }])])))
    await expect(requestGemini(url, init)).rejects.toThrow('antes de completar la respuesta')
  })
  it('aborts a hung request after 90 seconds', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const pending = requestGemini(url, init)
    const failure = expect(pending).rejects.toThrow('tardó demasiado')
    await vi.advanceTimersByTimeAsync(90000)
    await failure
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true)
  })
  it('covers a stalled response body with the same deadline', async () => {
    vi.useFakeTimers()
    const response = new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode('data: {'))
    } }), { headers: { 'Content-Type': 'text/event-stream' } })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
    const pending = requestGemini(url, init)
    const failure = expect(pending).rejects.toThrow('tardó demasiado')
    await vi.advanceTimersByTimeAsync(90000)
    await failure
    expect(response.body.locked).toBe(false)
  })
  it('lets a user abort the retry backoff without making another API call', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(503)))
    const controller = new AbortController()
    const pending = requestGemini(url, init, { signal: controller.signal })
    const failure = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await vi.advanceTimersByTimeAsync(1)
    controller.abort()
    await failure
    await vi.advanceTimersByTimeAsync(10000)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('does not send a request if already cancelled', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const controller = new AbortController()
    controller.abort()
    await expect(requestGemini(url, init, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetch).not.toHaveBeenCalled()
  })
  it('does not ignore a long Retry-After or retry too early', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(503, { 'Retry-After': '120' })))
    await expect(requestGemini(url, init)).rejects.toThrow('Gemini está saturado')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('switches once to the fallback after retries, then stops when both models are unavailable', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json(503))))
    const onFallback = vi.fn()
    const pending = requestGemini(url, init, { fallbackRequest, onFallback })
    const failure = expect(pending).rejects.toThrow('Gemini está saturado')
    await vi.advanceTimersByTimeAsync(20000)
    await failure
    expect(onFallback).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls.map(([requestUrl]) => requestUrl)).toEqual([url, url, url, fallbackRequest.url, fallbackRequest.url, fallbackRequest.url])
    expect(fetch.mock.calls[3][1].body).toBe(fallbackRequest.init.body)
  })
  it('keeps one 90-second deadline for the entire fallback chain', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (requestUrl) => requestUrl === url ? json(503) : new Promise(() => {})))
    const pending = requestGemini(url, init, { fallbackRequest })
    const failure = expect(pending).rejects.toThrow('tardó demasiado')
    await vi.advanceTimersByTimeAsync(90000)
    await failure
    expect(fetch).toHaveBeenCalledTimes(4)
    expect(fetch.mock.calls[3][1].signal.aborted).toBe(true)
  })
  it.each([400, 401, 403, 404, 429])('never switches models on status %s', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(status)))
    const onFallback = vi.fn()
    await requestGemini(url, init, { fallbackRequest, onFallback })
    expect(onFallback).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('does not switch models on a network error or partial response', async () => {
    const onFallback = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('Load failed'))
      .mockResolvedValueOnce(sse([chunk([{ text: 'Respuesta incompleta' }])])))
    await expect(requestGemini(url, init, { fallbackRequest, onFallback })).rejects.toThrow('No se pudo mantener')
    await expect(requestGemini(url, init, { fallbackRequest, onFallback })).rejects.toThrow('antes de completar')
    expect(onFallback).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('cancels an active fallback using the original user signal', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(503, { 'Retry-After': '120' }))
      .mockImplementation(() => new Promise(() => {})))
    const controller = new AbortController()
    let fallbackStarted
    const started = new Promise(resolve => { fallbackStarted = resolve })
    const pending = requestGemini(url, init, { fallbackRequest, signal: controller.signal, onStatus: status => {
      if (status.includes('modelo alternativo')) fallbackStarted()
    } })
    const failure = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await started
    controller.abort()
    await failure
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[1][1].signal.aborted).toBe(true)
  })
})
