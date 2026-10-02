const RETRYABLE_STATUS = new Set([500, 502, 503, 504])
const MAX_RETRIES = 2
const REQUEST_TIMEOUT_MS = 90000

function abortError() {
  return new DOMException('Consulta cancelada', 'AbortError')
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(abortError()); return }
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve() }, ms)
    function cancel() { clearTimeout(timer); reject(abortError()) }
    signal.addEventListener('abort', cancel, { once: true })
  })
}

// Decode complete SSE events, even when a network packet splits JSON or UTF-8.
async function readStream(response, { signal, onChunk }) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const parts = []
  let buffer = '', lineBuffer = '', finishReason, content = ''
  const cancel = () => { void reader.cancel().catch(() => {}) }
  signal.addEventListener('abort', cancel, { once: true })
  function event() {
    if (!lineBuffer) return
    const payload = lineBuffer.trim()
    lineBuffer = ''
    if (payload === '[DONE]') return
    const data = JSON.parse(payload)
    if (data.error) throw new Error('Gemini interrumpió la respuesta. Podés reintentar la consulta.')
    const candidate = data.candidates?.[0]
    if (candidate?.finishReason) finishReason = candidate.finishReason
    for (const part of candidate?.content?.parts ?? []) {
      // A signature belongs to its part; do not combine signed parts.
      const previous = parts.at(-1)
      if (typeof part.text === 'string' && !part.thoughtSignature && previous &&
        typeof previous.text === 'string' && !previous.thoughtSignature && Boolean(previous.thought) === Boolean(part.thought)) {
        previous.text += part.text
      } else parts.push({ ...part })
      if (!part.thought && typeof part.text === 'string') content += part.text
    }
    onChunk?.(content)
  }
  function lines(flush = false) {
    let end
    while ((end = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, end).replace(/\r$/, '')
      buffer = buffer.slice(end + 1)
      if (line === '') event()
      else if (line.startsWith('data:')) lineBuffer += line.slice(5).replace(/^ /, '') + '\n'
    }
    if (flush) {
      if (buffer.startsWith('data:')) lineBuffer += buffer.slice(5).trimStart()
      event()
    }
  }
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (signal.aborted) throw abortError()
      if (done) { buffer += decoder.decode(); lines(true); break }
      buffer += decoder.decode(value, { stream: true })
      lines()
    }
    if (!finishReason) throw new Error('La conexión se cortó antes de completar la respuesta de Gemini. Podés reintentar la consulta.')
    return { candidates: [{ content: { parts }, finishReason }] }
  } finally {
    signal.removeEventListener('abort', cancel)
    void reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

/** Retries only explicit server failures; an uncertain network failure is not replayed. */
export async function requestGemini(url, init, { signal, onStatus, onChunk, fallbackRequest, onFallback } = {}) {
  const controller = new AbortController()
  let timedOut = false
  let usedFallback = false
  const cancel = () => controller.abort()
  signal?.addEventListener('abort', cancel, { once: true })
  if (signal?.aborted) controller.abort()
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, REQUEST_TIMEOUT_MS)
  let rejectAbort
  const aborted = new Promise((_, reject) => { rejectAbort = reject })
  const onAbort = () => rejectAbort(abortError())
  controller.signal.addEventListener('abort', onAbort, { once: true })
  async function execute() {
    if (controller.signal.aborted) throw abortError()
    for (let attempt = 0; ; attempt++) {
      onStatus?.(usedFallback ? 'Consultando al coach con el modelo alternativo…' : attempt ? 'Volviendo a consultar al coach…' : 'Consultando al coach…')
      const request = usedFallback ? fallbackRequest : { url, init }
      const response = await fetch(request.url, { ...request.init, signal: controller.signal })
      if (controller.signal.aborted) throw abortError()
      if (RETRYABLE_STATUS.has(response.status)) {
        // Honor Retry-After without retrying earlier than Google asks.
        const retryAfter = response.headers?.get('Retry-After')
        const seconds = Number(retryAfter)
        const requestedDelay = retryAfter ? (Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now()) : 0
        await response.body?.cancel()
        if (controller.signal.aborted) throw abortError()
        if (attempt === MAX_RETRIES || requestedDelay > 15000) {
          if (fallbackRequest && !usedFallback) {
            usedFallback = true
            onFallback?.()
            attempt = -1
            continue
          }
          throw new Error('Gemini está saturado en este momento. Volvé a intentar en unos minutos. Tu consulta sigue acá.')
        }
        const delay = Math.max(Number.isFinite(requestedDelay) ? requestedDelay : 0, 1500 * 2 ** attempt + Math.random() * 500)
        onStatus?.(`Gemini está ocupado. Reintentando (${attempt + 1}/${MAX_RETRIES})…`)
        await wait(delay, controller.signal)
        continue
      }
      if (!response.ok) return { response, data: await response.json().catch(() => ({})), usedFallback }
      onStatus?.('El coach está preparando la respuesta…')
      const streamed = response.headers?.get('Content-Type')?.includes('text/event-stream')
      const data = streamed && response.body ? await readStream(response, { signal: controller.signal, onChunk }) : await response.json()
      return { response, data, usedFallback }
    }
  }
  try {
    return await Promise.race([execute(), aborted])
  } catch (error) {
    if (timedOut) throw new Error('Gemini tardó demasiado en responder. Podés reintentar; tu consulta sigue acá.')
    if (signal?.aborted || error.name === 'AbortError') throw abortError()
    if (error instanceof TypeError) throw new Error('No se pudo mantener la conexión con Gemini. Revisá tu conexión y reintentá; tu consulta sigue acá.')
    if (error instanceof SyntaxError) throw new Error('La respuesta de Gemini llegó incompleta. Podés reintentar la consulta.')
    throw error
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', cancel)
    controller.signal.removeEventListener('abort', onAbort)
    controller.abort()
  }
}
