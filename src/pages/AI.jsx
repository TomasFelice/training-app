import { useState, useRef, useEffect } from 'react'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Send, ChevronRight,
  CheckCircle, AlertCircle, Dumbbell, RotateCcw, X,
} from 'lucide-react'
import { sendMessage, parseRoutineFromResponse, saveRoutineFromAI, hasApiKey, GEMINI_MODEL_LABEL, getGeminiModelLabel } from '../lib/gemini'
import { useUIStore } from '../store'

const SUGGESTIONS = [
  { label: '💪 Generá una rutina', text: 'Tengo 3 días a la semana disponibles. Quiero priorizar hipertrofia en espalda y pecho. Haceme una rutina completa.' },
  { label: '📊 Analizá mi progreso', text: '¿Cómo viene mi progreso general? ¿Qué ejercicios están estancados?' },
  { label: '🔄 Romper estancamiento', text: '¿Qué puedo hacer para seguir progresando si estoy estancado en algún ejercicio?' },
  { label: '🦵 Rutina de piernas', text: 'Quiero una rutina de piernas de 4 ejercicios enfocada en hipertrofia. Generame el JSON.' },
]

// ── No API key configured screen ──────────────────────────────────────────

function NoKeyScreen() {
  const setActiveTab = useUIStore((state) => state.setActiveTab)
  return <div className="page"><header className="page-header"><div><p className="muted">Una mirada a tu entrenamiento</p><h1>IA Coach</h1></div><Sparkles className="accent-text" size={26} /></header><div className="page-scroll"><div className="empty-state"><h2>El coach todavía no está disponible</h2><p>Mientras se configura el coach, podés entrenar con las rutinas de la biblioteca y seguir tu progreso.</p><button className="primary-button" onClick={() => setActiveTab('routines')}>Ver rutinas</button></div></div></div>
}

// ── Message Bubble ─────────────────────────────────────────────────────────

function MessageBubble({ msg, onSaveRoutine }) {
  const isUser = msg.role === 'user'
  const routine = !isUser && !msg.loading ? parseRoutineFromResponse(msg.content) : null

  const displayText = msg.content
    .replace(/<ROUTINE_JSON>[\s\S]*?(?:<\/ROUTINE_JSON>|$)/g, '')
    .trim()

  return (
    <Motion.div
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}
    >
      {!isUser && (
        <div className="w-7 h-7 bg-[var(--accent)]/20 rounded-full flex items-center justify-center mr-2 mt-1 flex-shrink-0">
          <Sparkles size={13} className="text-[var(--accent)]" />
        </div>
      )}
      <div className="max-w-[82%] flex flex-col gap-2">
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-[var(--accent)] text-white rounded-br-md'
            : 'bg-[var(--surface)] text-white/90 rounded-bl-md'
        }`}>
          {displayText || (msg.loading ? '' : '…')}
          {msg.loading && (
            <span className="inline-flex gap-1 ml-1">
              {[0, 1, 2].map((i) => (
                <Motion.span
                  key={i}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  className="w-1 h-1 bg-white/60 rounded-full inline-block"
                />
              ))}
            </span>
          )}
        </div>

        {routine && (
          <Motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[var(--success)]/10 border border-[var(--success)]/30 rounded-2xl p-3"
          >
            <div className="flex items-start gap-2 mb-2">
              <Dumbbell size={14} className="text-[var(--success)] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-white text-xs font-semibold">{routine.name}</p>
                <p className="text-[var(--muted)] text-xs">
                  {routine.exercises?.length ?? 0} ejercicios · {routine.days?.join(', ')}
                </p>
              </div>
            </div>
            <button
              onClick={() => onSaveRoutine(routine)}
              className="pressable w-full bg-[var(--success)] py-2.5 rounded-xl text-white text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <CheckCircle size={13} /> Guardar rutina
            </button>
          </Motion.div>
        )}
      </div>
    </Motion.div>
  )
}

// ── Main AI Page ───────────────────────────────────────────────────────────

export default function AIPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [requestStatus, setRequestStatus] = useState('')
  const [modelLabel, setModelLabel] = useState(GEMINI_MODEL_LABEL)
  const [failedRequest, setFailedRequest] = useState(null)
  const [savedRoutine, setSavedRoutine] = useState(null)
  const bottomRef = useRef(null)
  const requestRef = useRef(null)

  useEffect(() => () => {
    const controller = requestRef.current
    requestRef.current = null
    controller?.abort()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!hasApiKey()) return <NoKeyScreen />

  async function handleSend(text) {
    const content = (text ?? input).trim()
    if (!content || requestRef.current) return
    setInput('')
    setError(null)

    const userMsg = { role: 'user', content }
    await runRequest([...messages, userMsg])
  }

  async function runRequest(conversation) {
    if (requestRef.current) return
    const controller = new AbortController()
    requestRef.current = controller
    setError(null)
    setFailedRequest(null)
    setMessages([...conversation, { role: 'assistant', content: '', loading: true }])
    setLoading(true)

    try {
      const reply = await sendMessage(conversation, {
        signal: controller.signal,
        onModel: (model) => { if (requestRef.current === controller) setModelLabel(getGeminiModelLabel(model)) },
        onStatus: (status) => { if (requestRef.current === controller) setRequestStatus(status) },
        onChunk: (content) => {
          if (requestRef.current === controller) setMessages([...conversation, { role: 'assistant', content, loading: true }])
        },
      })
      if (requestRef.current === controller) setMessages([...conversation, { role: 'assistant', ...reply }])
    } catch (err) {
      if (requestRef.current !== controller) return
      setMessages(conversation)
      setFailedRequest(conversation)
      setError(err.name === 'AbortError' ? 'Consulta cancelada. Podés reintentar cuando quieras.' : err.message)
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null
        setLoading(false)
        setRequestStatus('')
      }
    }
  }

  function resetConversation() {
    const controller = requestRef.current
    requestRef.current = null
    controller?.abort()
    setMessages([])
    setError(null)
    setFailedRequest(null)
    setRequestStatus('')
    setModelLabel(GEMINI_MODEL_LABEL)
    setLoading(false)
  }

  async function handleSaveRoutine(parsed) {
    try {
      await saveRoutineFromAI(parsed)
      setSavedRoutine(parsed.name)
      setTimeout(() => setSavedRoutine(null), 3000)
    } catch {
      setError('No se pudo guardar la rutina.')
    }
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg)]">
      <div style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)' }} />

      {/* Header */}
      <div className="px-5 pb-3 flex-shrink-0">
        <h1 className="text-white text-2xl font-bold tracking-tight">IA Coach</h1>
        <p className="text-[var(--muted)] text-xs mt-0.5">{modelLabel} · Razonamiento medio</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scroll-ios px-4 py-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-5 pt-6 pb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-[var(--accent)]/30 to-[var(--accent)]/20 rounded-2xl flex items-center justify-center">
              <Sparkles size={28} className="text-[var(--accent)]" />
            </div>
            <div className="text-center">
              <p className="text-white font-semibold text-base">¿En qué te ayudo hoy?</p>
              <p className="text-[var(--muted)] text-sm mt-1">
                Analizá tu progreso, generá rutinas o pedí consejos.
              </p>
            </div>
            <div className="w-full flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => handleSend(s.text)}
                  className="pressable bg-[var(--surface)] rounded-2xl px-4 py-3.5 flex items-center justify-between text-left"
                >
                  <span className="text-white text-sm">{s.label}</span>
                  <ChevronRight size={14} className="text-[var(--muted)] flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-2">
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} onSaveRoutine={handleSaveRoutine} />
            ))}
          </div>
        )}

        <AnimatePresence>
          {error && (
            <Motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              role="alert"
              className="flex items-center gap-2 bg-[var(--danger)]/15 border border-[var(--danger)]/30 rounded-2xl px-4 py-3 mb-3"
            >
              <AlertCircle size={15} className="text-[var(--danger)] flex-shrink-0" />
              <p className="text-[var(--danger)] text-xs flex-1">{error}</p>
              {failedRequest && <button onClick={() => runRequest(failedRequest)} disabled={loading} className="pressable text-xs font-semibold">Reintentar</button>}
              <button onClick={() => setError(null)} className="pressable" aria-label="Cerrar error">
                <X size={14} className="text-[var(--danger)]" />
              </button>
            </Motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Saved routine toast */}
      <AnimatePresence>
        {savedRoutine && (
          <Motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-28 inset-x-5 z-50 bg-[var(--success)] rounded-2xl px-4 py-3 flex items-center gap-2 shadow-xl"
          >
            <CheckCircle size={16} className="text-white flex-shrink-0" />
            <p className="text-white text-sm font-medium">"{savedRoutine}" guardada en Rutinas</p>
          </Motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <div
        className="glass border-t border-white/8 flex-shrink-0 px-4 py-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
      >
        {loading && <div className="flex items-center justify-between gap-3 mb-2">
          <p role="status" className="text-[var(--muted)] text-xs">{requestStatus || 'Consultando al coach…'}</p>
          <button onClick={() => requestRef.current?.abort()} className="pressable text-[var(--muted)] text-xs">Cancelar consulta</button>
        </div>}
        {messages.length > 0 && (
          <button
            onClick={resetConversation}
            className="pressable flex items-center gap-1 text-[var(--muted)] text-xs mb-2"
          >
            <RotateCcw size={11} /> Nueva conversación
          </button>
        )}
        <div className="flex items-end gap-3">
          <div className="flex-1 bg-[var(--surface)] rounded-2xl px-4 py-3 min-h-[44px] max-h-32">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
              }}
              placeholder="Preguntá algo…"
              rows={1}
              className="w-full bg-transparent text-white text-sm outline-none resize-none placeholder:text-[var(--muted)] leading-relaxed"
              style={{ maxHeight: '96px' }}
            />
          </div>
          <button
            onClick={() => handleSend()}
            aria-label="Enviar consulta"
            disabled={!input.trim() || loading}
            className="pressable w-11 h-11 bg-[var(--accent)] rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-30 disabled:bg-[var(--surface-raised)]"
          >
            {loading
              ? <Motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <Sparkles size={17} className="text-white" />
                </Motion.div>
              : <Send size={17} className="text-white" />
            }
          </button>
        </div>
      </div>
    </div>
  )
}
